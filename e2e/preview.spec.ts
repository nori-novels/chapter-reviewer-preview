import { expect, test, type Page } from "@playwright/test";
import {
  PREVIEW_PROMPT,
  PREVIEW_UNAVAILABLE_MESSAGE,
} from "../src/features/preview/copy";

const STATIC_RESOURCE_TYPES = new Set([
  "document",
  "stylesheet",
  "script",
  "font",
  "image",
]);

async function expectPreviewGuard(page: Page, action: () => Promise<unknown>) {
  await action();
  const status = page.getByRole("status");
  await expect(status).toHaveAttribute("data-show", "true");
  await expect(status).toHaveText(PREVIEW_UNAVAILABLE_MESSAGE);
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

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`${viewport.name} reviewer preview`, async ({ page }, testInfo) => {
    const baseURL = String(testInfo.project.use.baseURL);
    const previewOrigin = new URL(baseURL).origin;
    const applicationRequests: string[] = [];

    page.on("request", (request) => {
      const resourceType = request.resourceType();
      const method = request.method();
      const requestOrigin = new URL(request.url()).origin;
      const isStaticRequest = STATIC_RESOURCE_TYPES.has(resourceType)
        && (method === "GET" || method === "HEAD")
        && requestOrigin === previewOrigin;
      if (!isStaticRequest) {
        applicationRequests.push(`${method} ${resourceType} ${request.url()}`);
      }
    });

    await page.setViewportSize(viewport);
    await page.goto("/");

    const reviewer = page.locator('[role="dialog"]:has([aria-label="English title"])');
    await expect(reviewer).toBeVisible();
    await expect(reviewer).toHaveAccessibleName(/Chapter 25/iu);
    await expect(page.getByText("Chapter 25", { exact: true }).first()).toBeVisible();
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
    await expectPreviewGuard(page, () => page.getByTestId("chapter-index-dropdown")
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
    const hasScrollablePanes = await sourceScroller.evaluate((element) => (
      element.scrollHeight > element.clientHeight
    ));
    if (hasScrollablePanes) {
      await sourceScroller.evaluate((element) => {
        element.scrollTop = (element.scrollHeight - element.clientHeight) / 2;
        element.dispatchEvent(new Event("scroll", { bubbles: true }));
      });
      await expect.poll(() => englishScroller.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
    }

    const firstWarningIcon = page.getByRole("button", { name: /warnings$/iu }).first();
    await firstWarningIcon.click();
    const qaSidebar = page.getByTestId("qa-sidebar");
    await expect(qaSidebar).toHaveAttribute("data-expanded", "true");
    await expect(page.getByTestId("qa-warning-list")
      .getByRole("button", { pressed: true })
      .first()).toBeVisible();
    await expectViewportContained(page);
    await captureVisualQa(page, testInfo.outputPath(`${viewport.name}-qa-navigation.png`));
    const nextOccurrence = qaSidebar.getByRole("button", { name: /^Next .+ occurrence$/iu }).first();
    if (await nextOccurrence.count()) {
      await nextOccurrence.click();
    }

    await title.dispatchEvent("mousedown");
    await expect(qaSidebar).toHaveAttribute("data-expanded", "false");

    const glossaryHighlight = page.locator(
      'button:has(mark[data-testid^="glossary-highlight-"])',
    ).first();
    if (await glossaryHighlight.count()) {
      await glossaryHighlight.click();
      await expect(page.getByRole("status")).toHaveText("Term copied to clipboard");
    }

    if (await qaSidebar.getAttribute("data-expanded") !== "true") {
      await firstWarningIcon.click();
    }
    await expectPreviewGuard(page, () => page.getByRole("button", {
      name: "Edit glossary",
    }).click());

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
    expect(promptValues.every((value) => value === PREVIEW_PROMPT)).toBe(true);
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
      name: "Approve",
    }).click());
    await expectPreviewGuard(page, () => page.getByRole("button", {
      name: "Close chapter review",
    }).click());
    await expectPreviewGuard(page, () => reviewer.press("Escape"));
    await expectPreviewGuard(page, () => reviewer.locator("..").dispatchEvent("mousedown"));

    await page.reload();
    const resetTitle = await page.getByRole("textbox", { name: "English title" }).inputValue();
    const resetFirstTranslation = await page.getByRole("textbox", {
      name: "Translation 1",
      exact: true,
    }).inputValue();
    expect(resetTitle === originalTitle).toBe(true);
    expect(resetFirstTranslation === originalFirstTranslation).toBe(true);
    await expectViewportContained(page);

    expect(applicationRequests).toEqual([]);
  });
}
