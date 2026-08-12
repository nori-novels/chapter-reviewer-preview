import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

const PREVIEW_UNAVAILABLE_MESSAGE = "This function is not available in the preview.";
const PROMPT_CONTRACT = {
  firstLine: "placeholder text",
  lastLine: "mollia cum duris, sine pondere, habentia pondus.",
  lineCount: 21,
  sha256: "1e0e06a7c5e436fe9b55d632f960eba2a47896f06c00c88e2d01321dece44055",
};

const STATIC_RESOURCE_TYPES = new Set([
  "document",
  "stylesheet",
  "script",
  "font",
  "image",
]);

async function expectPreviewGuard(page: Page, action: () => Promise<unknown>) {
  const status = page.getByRole("status");
  await expect(status).toHaveAttribute("data-show", "false", { timeout: 5_000 });
  await action();
  await expect(status).toHaveAttribute("data-show", "true");
  await expect(status).toHaveText(PREVIEW_UNAVAILABLE_MESSAGE);
}

function expectPromptContract(value: string) {
  const lines = value.split("\n");
  expect(lines).toHaveLength(PROMPT_CONTRACT.lineCount);
  expect(lines[0]).toBe(PROMPT_CONTRACT.firstLine);
  expect(lines.at(-1)).toBe(PROMPT_CONTRACT.lastLine);
  expect(createHash("sha256").update(value).digest("hex")).toBe(PROMPT_CONTRACT.sha256);
}

async function captureVisualQa(page: Page, outputPath: string) {
  if (process.env.PLAYWRIGHT_VISUAL_QA !== "1") return;
  await expect(page.getByRole("status")).toHaveAttribute("data-show", "false", {
    timeout: 5_000,
  });
  await page.screenshot({ path: outputPath, animations: "disabled" });
}

async function expectViewportContained(page: Page) {
  const metrics = await page.evaluate(() => {
    const title = document.querySelector('[aria-label="English title"]');
    const reviewer = title?.closest('[role="dialog"]');
    const reviewerBox = reviewer?.getBoundingClientRect();
    return {
      bodyScrollLeft: document.body.scrollLeft,
      reviewerClientWidth: reviewer?.clientWidth,
      reviewerLeft: reviewerBox?.left,
      reviewerRight: reviewerBox?.right,
      reviewerScrollLeft: reviewer?.scrollLeft,
      reviewerScrollWidth: reviewer?.scrollWidth,
      scrollX: window.scrollX,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
  expect(metrics).toEqual({
    bodyScrollLeft: 0,
    reviewerClientWidth: metrics.viewportWidth,
    reviewerLeft: 0,
    reviewerRight: metrics.viewportWidth,
    reviewerScrollLeft: 0,
    reviewerScrollWidth: metrics.viewportWidth,
    scrollX: 0,
    scrollWidth: metrics.viewportWidth,
    viewportWidth: metrics.viewportWidth,
  });
}

async function expectPreviewAnnouncementHelp(
  page: Page,
  viewport: { width: number; height: number },
) {
  const announcement = page.getByTestId("reviewer-preview-announcement");
  const drawer = page.getByTestId("reviewer-help-drawer");
  const source = page.getByTestId("chapter-source-scroller");
  const english = page.getByTestId("chapter-english-scroller");
  const qa = page.getByTestId("qa-sidebar");
  const growthTarget = viewport.width <= 760 ? source.locator("../..") : source;

  await expect(announcement).toBeVisible();
  await expect(announcement).toHaveText(
    /This is a preview\. Click help for details about reviewer features\./u,
  );
  await expect(drawer).toHaveAttribute("aria-hidden", "true");

  const widthsBefore = await Promise.all([source, english, qa].map(async (locator) => (
    (await locator.boundingBox())?.width
  )));
  const heightBefore = (await growthTarget.boundingBox())?.height ?? 0;
  const help = page.getByRole("button", {
    name: "Reviewer feature help",
    exact: true,
  });
  await help.click();

  const close = page.getByRole("button", { name: "Close reviewer feature help" });
  await expect(close).toBeFocused();
  await expect(drawer).not.toHaveAttribute("aria-hidden");
  await expect(drawer).toHaveCSS("background-color", "rgb(30, 30, 33)");
  await expect(drawer).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(drawer).toHaveCSS("font-family", /Figtree/u);
  await expect.poll(() => drawer.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return Math.round(bounds.right);
  })).toBe(viewport.width);
  await expect.poll(() => drawer.evaluate((element) => (
    Math.round(element.getBoundingClientRect().width)
  ))).toBe(Math.min(440, viewport.width));

  const widthsOpen = await Promise.all([source, english, qa].map(async (locator) => (
    (await locator.boundingBox())?.width
  )));
  expect(widthsOpen).toEqual(widthsBefore);
  await announcement.getByText(
    "This is a preview. Click help for details about reviewer features.",
  ).click();
  await page.keyboard.press("Escape");
  await expect(drawer).not.toHaveAttribute("aria-hidden");
  await expect(page.getByRole("status")).toHaveAttribute("data-show", "false");

  await help.click();
  await expect(drawer).toHaveAttribute("aria-hidden", "true");
  await help.click();
  await expect(close).toBeFocused();

  const drawerCoversViewport = await drawer.evaluate((element) => (
    Math.round(element.getBoundingClientRect().left) <= 0
  ));
  if (!drawerCoversViewport) {
    await english.click({ position: { x: 20, y: 20 } });
    await expect(drawer).toHaveAttribute("aria-hidden", "true");
    await expect(page.getByRole("status")).toHaveAttribute("data-show", "false");
    await help.click();
    await expect(close).toBeFocused();
  }

  await page.getByRole("button", { name: "Dismiss preview announcement" }).click();
  await expect(announcement).toBeHidden();
  await expect(drawer).toHaveAttribute("data-announcement-visible", "false");
  await expect.poll(() => drawer.evaluate((element) => (
    Math.round(element.getBoundingClientRect().top)
  ))).toBe(0);
  await expect.poll(async () => (await growthTarget.boundingBox())?.height ?? 0)
    .toBeGreaterThan(heightBefore);

  await close.click();
  await expect(page.getByRole("textbox", { name: "English title" })).toBeFocused();
  await expect(drawer).toHaveAttribute("aria-hidden", "true");
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`${viewport.name} reviewer preview`, async ({ context, page }, testInfo) => {
    type RequestRecord = { method: string; resourceType: string; url: string };
    const bootstrapRequests: RequestRecord[] = [];
    const trafficViolations: RequestRecord[] = [];
    const websocketViolations: string[] = [];
    let allowedStaticUrls = new Set<string>();
    let networkLocked = false;

    const observeWebSockets = (candidate: Page) => {
      candidate.on("websocket", (socket) => websocketViolations.push(socket.url()));
    };
    observeWebSockets(page);
    context.on("page", observeWebSockets);
    context.on("request", (request) => {
      const record = {
        method: request.method(),
        resourceType: request.resourceType(),
        url: request.url(),
      };
      if (!networkLocked) {
        bootstrapRequests.push(record);
        return;
      }
      const resourceType = request.resourceType();
      const method = request.method();
      const isKnownStaticRequest = STATIC_RESOURCE_TYPES.has(resourceType)
        && (method === "GET" || method === "HEAD")
        && allowedStaticUrls.has(request.url());
      if (!isKnownStaticRequest) trafficViolations.push(record);
    });

    await page.setViewportSize(viewport);
    await page.goto("/");

    const reviewer = page.locator('[role="dialog"]:has([aria-label="English title"])');
    await expect(reviewer).toBeVisible();
    await expect(reviewer).toHaveAccessibleName(/Chapter 25/iu);
    await expect(page.getByText("Chapter 25", { exact: true }).first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    const previewOrigin = new URL(page.url()).origin;
    const invalidBootstrapRequests = bootstrapRequests.filter((request) => (
      !STATIC_RESOURCE_TYPES.has(request.resourceType)
      || (request.method !== "GET" && request.method !== "HEAD")
      || new URL(request.url).origin !== previewOrigin
    ));
    expect(invalidBootstrapRequests).toEqual([]);
    expect(bootstrapRequests.some((request) => request.resourceType === "document")).toBe(true);
    allowedStaticUrls = new Set(bootstrapRequests.map((request) => request.url));
    expect(allowedStaticUrls.size).toBeGreaterThan(1);
    networkLocked = true;
    await context.route("**/*", async (route) => {
      const request = route.request();
      const isKnownStaticRequest = STATIC_RESOURCE_TYPES.has(request.resourceType())
        && (request.method() === "GET" || request.method() === "HEAD")
        && allowedStaticUrls.has(request.url());
      if (isKnownStaticRequest) {
        await route.continue();
        return;
      }
      await route.abort("blockedbyclient");
    });
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: previewOrigin,
    });

    await expectViewportContained(page);
    for (const name of [
      "Previous chapter",
      "Chapter index",
      "Next chapter",
      "Align paragraphs",
      "Sync scrolling",
      "Find and replace",
      "Close chapter review",
    ]) {
      await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
    }

    await expectPreviewAnnouncementHelp(page, viewport);

    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press("Tab");
      expect(await reviewer.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
    }
    await captureVisualQa(page, testInfo.outputPath(`${viewport.name}-reviewer.png`));

    await expectPreviewGuard(page, () => page.getByRole("button", {
      name: "Previous chapter",
    }).click());
    await expectPreviewGuard(page, () => page.getByRole("button", {
      name: "Next chapter",
    }).click());

    await page.getByRole("button", { name: "Chapter index" }).click();
    const chapterIndex = page.getByTestId("chapter-index-dropdown");
    await expect(chapterIndex).toBeVisible();
    if (viewport.name === "mobile") {
      const headerBox = await page.locator("header").first().boundingBox();
      const indexBox = await chapterIndex.boundingBox();
      expect(headerBox).not.toBeNull();
      expect(indexBox).not.toBeNull();
      expect(indexBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
    }
    await expectViewportContained(page);
    await captureVisualQa(page, testInfo.outputPath(`${viewport.name}-chapter-index.png`));
    await expectPreviewGuard(page, () => chapterIndex
      .getByRole("button", { name: /^24/iu })
      .click());

    const title = page.getByRole("textbox", { name: "English title" });
    const originalTitle = await title.inputValue();
    await title.fill("Local browser journey title");
    await expect(title).toHaveValue("Local browser journey title");

    const firstTranslation = page.getByRole("textbox", {
      name: "Translation 1",
      exact: true,
    });
    const originalFirstTranslation = await firstTranslation.inputValue();
    await firstTranslation.fill("Local paragraph edit for browser verification.");
    await expect(firstTranslation).toHaveValue("Local paragraph edit for browser verification.");

    const findOpener = page.getByRole("button", { name: "Find and replace" });
    await findOpener.click();
    const findPanel = page.getByRole("dialog", { name: "Find and replace" });
    await findPanel.getByRole("textbox", { name: "Find" }).fill("browser verification");
    await findPanel.getByRole("textbox", { name: "Replace with" }).fill("local journey");
    if (viewport.name === "mobile") {
      const headerBox = await page.locator("header").first().boundingBox();
      const findBox = await findPanel.boundingBox();
      expect(headerBox).not.toBeNull();
      expect(findBox).not.toBeNull();
      expect(findBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
    }
    await expect(findOpener.locator("span")).toHaveCSS("opacity", "0");
    await expectViewportContained(page);
    await captureVisualQa(page, testInfo.outputPath(`${viewport.name}-find-replace.png`));
    await findPanel.getByRole("button", { name: "Replace all" }).click();
    await expect(firstTranslation).toHaveValue("Local paragraph edit for local journey.");
    await findPanel.getByRole("button", { name: "Close find and replace" }).click();

    const align = page.getByRole("button", { name: "Align paragraphs" });
    await expect(align).toHaveAttribute("aria-pressed", "true");
    await align.click();
    await expect(align).toHaveAttribute("aria-pressed", "false");
    expect((await page.getByRole("textbox", { name: "English body" }).inputValue())
      .includes("Local paragraph edit for local journey.")).toBe(true);
    await align.click();
    await expect(align).toHaveAttribute("aria-pressed", "true");

    const sync = page.getByRole("button", { name: "Sync scrolling" });
    await expect(sync).toHaveAttribute("aria-pressed", "true");
    await sync.click();
    await expect(sync).toHaveAttribute("aria-pressed", "false");
    await sync.click();
    await expect(sync).toHaveAttribute("aria-pressed", "true");

    const sourceScroller = page.getByTestId("chapter-source-scroller");
    const englishScroller = page.getByTestId("chapter-english-scroller");
    const comparisonLayout = sourceScroller.locator("../..");
    if (viewport.name === "desktop") {
      expect(await sourceScroller.evaluate((element) => (
        element.scrollHeight - element.clientHeight
      ))).toBeGreaterThan(0);
      await sourceScroller.evaluate((element) => {
        element.scrollTop = (element.scrollHeight - element.clientHeight) / 2;
        element.dispatchEvent(new Event("scroll", { bubbles: true }));
      });
      await expect.poll(() => englishScroller.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
    } else {
      expect(await comparisonLayout.evaluate((element) => (
        element.scrollHeight - element.clientHeight
      ))).toBeGreaterThan(0);
    }

    const firstWarningIcon = page.getByRole("button", {
      name: "Glossary mismatch warnings",
    });
    await firstWarningIcon.click();
    const qaSidebar = page.getByTestId("qa-sidebar");
    await expect(qaSidebar).toHaveAttribute("data-expanded", "true");
    await expect(page.getByTestId("qa-warning-list")
      .getByRole("button", { pressed: true })
      .first()).toBeVisible();
    await expectViewportContained(page);
    await captureVisualQa(page, testInfo.outputPath(`${viewport.name}-qa-navigation.png`));
    const selectedGlossaryWarning = page.locator('[data-testid^="qa-warning-glossary_mismatch"]');
    const nextOccurrence = selectedGlossaryWarning.getByRole("button", {
      name: "Next Glossary mismatch occurrence",
    });
    const occurrenceCounter = selectedGlossaryWarning.locator('[aria-live="polite"]');
    const initialCounter = await occurrenceCounter.textContent();
    const occurrenceTotal = Number(initialCounter?.split("/")[1]);
    expect(occurrenceTotal).toBeGreaterThan(1);
    await Promise.all([sourceScroller, englishScroller, comparisonLayout].map((locator) => (
      locator.evaluate((element) => { element.scrollTop = 0; })
    )));
    await nextOccurrence.click();
    await expect(occurrenceCounter).toHaveText(`2/${occurrenceTotal}`);
    if (viewport.name === "desktop") {
      await expect.poll(() => englishScroller.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
      await expect.poll(() => sourceScroller.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
    } else {
      await expect.poll(() => comparisonLayout.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
    }

    await title.dispatchEvent("mousedown");
    await expect(qaSidebar).toHaveAttribute("data-expanded", "false");

    const glossaryHighlight = page.locator(
      'button:has(mark[data-testid^="glossary-highlight-"])',
    ).first();
    await expect(glossaryHighlight).toBeVisible();
    const copiedTerm = await glossaryHighlight.locator("mark").textContent();
    expect(copiedTerm).toBeTruthy();
    await glossaryHighlight.click();
    await expect(page.getByRole("status")).toHaveText("Term copied to clipboard");
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(copiedTerm);

    if (await qaSidebar.getAttribute("data-expanded") !== "true") {
      await firstWarningIcon.click();
    }
    const glossaryOpener = page.getByRole("button", { name: "Edit glossary" });
    await glossaryOpener.click();
    const glossaryDialog = page.getByRole("dialog", { name: "Edit glossary" });
    await expect(glossaryDialog).toBeVisible();
    await expect(reviewer).toHaveAttribute("inert", "");
    await expectViewportContained(page);
    await captureVisualQa(page, testInfo.outputPath(`${viewport.name}-glossary.png`));

    // Character rows carry the three-way gender picker, so start from one.
    const characterRow = glossaryDialog.locator('tbody tr:has([role="group"])').first();
    const glossaryTerm = ((await characterRow.getByRole("button", { name: /^Copy /u })
      .textContent()) ?? "").trim();
    expect(glossaryTerm).toBeTruthy();
    await expect(characterRow.getByRole("group", { name: `Gender for ${glossaryTerm}` }))
      .toBeVisible();

    // The kind cell is a listbox trigger carrying the solid triangle marker.
    const kindTrigger = characterRow.getByRole("combobox");
    await expect(kindTrigger.locator("[data-select-triangle]")).toHaveCount(1);
    await kindTrigger.click();
    await expect(page.getByRole("listbox", { name: `Kind for ${glossaryTerm}` })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(glossaryDialog).toBeVisible();

    const glossarySearch = glossaryDialog.getByRole("textbox", { name: "Search" });
    await glossarySearch.fill("no-preview-glossary-match");
    await expect(glossaryDialog.getByText("No glossary entries match these filters."))
      .toBeVisible();
    await glossarySearch.fill("");
    await expect(characterRow).toBeVisible();

    for (let index = 0; index < 8; index += 1) {
      await page.keyboard.press("Tab");
      expect(await glossaryDialog.evaluate((dialog) => dialog.contains(document.activeElement)))
        .toBe(true);
    }

    const saveGlossary = glossaryDialog.getByRole("button", { name: "Save glossary" });
    await expect(saveGlossary).toBeDisabled();
    await glossaryDialog.getByRole("textbox", { name: `Canonical target for ${glossaryTerm}` })
      .fill("Preview Renamed Target");
    await expect(saveGlossary).toBeEnabled();
    await saveGlossary.click();
    await expect(page.getByRole("status")).toHaveText(
      "Glossary saved. QA checks were updated for this chapter.",
    );
    await expect(saveGlossary).toBeDisabled();
    await glossaryDialog.getByRole("button", { name: "Close glossary editor" }).click();
    await expect(glossaryDialog).toBeHidden();
    await expect(glossaryOpener).toBeFocused();
    // The renamed target is absent from the translation, so QA re-reports it.
    await expect(page.getByTestId(`qa-warning-glossary_mismatch:${glossaryTerm}`)).toBeVisible();

    await page.getByRole("button", { name: "Retranslate" }).click();
    const retryDialog = page.getByRole("dialog", { name: /Revise chapter 25/iu });
    await expect(retryDialog).toBeVisible();
    if (viewport.name === "mobile") {
      expect(await retryDialog.evaluate((dialog) => {
        const box = dialog.getBoundingClientRect();
        return { left: box.left, right: box.right, width: box.width };
      })).toEqual({ left: 0, right: viewport.width, width: viewport.width });
    }
    await expectViewportContained(page);
    await captureVisualQa(page, testInfo.outputPath(`${viewport.name}-retranslate.png`));
    const promptValues = await Promise.all(["Prompt 1", "Prompt 2", "Prompt 3"].map(
      (name) => retryDialog.getByRole("textbox", { name }).inputValue(),
    ));
    promptValues.forEach(expectPromptContract);
    await retryDialog.getByRole("textbox", { name: "Prompt 2" })
      .fill("Local synthetic prompt edit");
    await expect(retryDialog.getByRole("textbox", { name: "Prompt 2" }))
      .toHaveValue("Local synthetic prompt edit");
    await expectPreviewGuard(page, () => retryDialog.getByRole("button", {
      name: "Retry translation",
    }).click());
    await expect(retryDialog).toBeVisible();
    await expect(reviewer).toHaveAttribute("inert", "");

    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press("Tab");
      expect(await retryDialog.evaluate((dialog) => dialog.contains(document.activeElement)))
        .toBe(true);
    }
    await retryDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(retryDialog).toBeHidden();

    await expectPreviewGuard(page, () => page.getByRole("button", {
      name: "Save changes",
    }).click());
    await expectPreviewGuard(page, () => page.getByRole("button", {
      name: "Approve with override",
    }).click());
    await expectPreviewGuard(page, () => page.getByRole("button", {
      name: "Close chapter review",
    }).click());
    await expectPreviewGuard(page, () => reviewer.press("Escape"));
    await expectPreviewGuard(page, () => reviewer.locator("..").dispatchEvent("mousedown"));

    await align.click();
    await sync.click();
    await expect(align).toHaveAttribute("aria-pressed", "false");
    await expect(sync).toHaveAttribute("aria-pressed", "false");

    await page.reload();
    await page.waitForLoadState("networkidle");
    const resetTitle = await page.getByRole("textbox", { name: "English title" }).inputValue();
    const resetFirstTranslation = await page.getByRole("textbox", {
      name: "Translation 1",
      exact: true,
    }).inputValue();
    expect(resetTitle === originalTitle).toBe(true);
    expect(resetFirstTranslation === originalFirstTranslation).toBe(true);
    await expect(page.getByRole("button", { name: "Align paragraphs" }))
      .toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Sync scrolling" }))
      .toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("reviewer-preview-announcement")).toBeVisible();
    await expectViewportContained(page);

    expect(trafficViolations).toEqual([]);
    expect(websocketViolations).toEqual([]);
  });
}

async function measureFindAnchor(page: Page) {
  return page.evaluate(() => {
    const bounds = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing element for ${selector}`);
      return element.getBoundingClientRect();
    };
    const header = bounds("header");
    const icon = bounds('button[aria-label="Find and replace"]');
    const panel = bounds('[data-testid="find-replace-panel"]');
    return {
      belowIcon: Math.round(panel.top - icon.bottom),
      fromHeaderBottom: Math.round(panel.top - header.bottom),
    };
  });
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`${viewport.name} find panel hangs off the header in both announcement states`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByRole("button", { name: "Find and replace" }).click();
    await expect(page.getByTestId("find-replace-panel")).toBeVisible();

    const withAnnouncement = await measureFindAnchor(page);
    expect(withAnnouncement.belowIcon).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Dismiss preview announcement" }).click();
    await expect(page.getByTestId("reviewer-preview-announcement")).toBeHidden();

    const withoutAnnouncement = await measureFindAnchor(page);
    expect(withoutAnnouncement.belowIcon).toBe(withAnnouncement.belowIcon);
    expect(withoutAnnouncement.fromHeaderBottom).toBe(withAnnouncement.fromHeaderBottom);
  });
}

test("preview help drawer disables motion when requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Reviewer feature help" }).click();
  await expect(page.getByTestId("reviewer-help-drawer"))
    .toHaveCSS("transition-duration", "0s");
});
