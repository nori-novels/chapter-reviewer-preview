import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/Toast/Toast";
import { PREVIEW_UNAVAILABLE_MESSAGE } from "@/features/preview/copy";
import { previewFixture } from "@/features/preview/fixture";
import { PreviewChapterReviewer } from "./PreviewChapterReviewer";

if (!previewFixture) {
  throw new Error("The committed preview fixture must be valid.");
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

function renderReviewer(fixture = previewFixture) {
  return render(
    <ToastProvider>
      <PreviewChapterReviewer fixture={fixture} />
    </ToastProvider>,
  );
}

const REVIEWER_FEATURES = [
  ["QA rail", "Summarizes warnings, expands for details, and jumps to affected source and translation text."],
  ["Warning navigation", "Moves among repeated occurrences of the selected issue."],
  ["Find and replace", "Searches the English draft, navigates matches, and replaces one or all matches."],
  ["Align paragraphs", "Pairs source and translation paragraphs for direct comparison and editing."],
  ["Sync scrolling", "Keeps the source and translation panes moving together."],
  ["Glossary editing", "Opens the relevant glossary entry so terminology can be corrected at its source."],
  ["Retranslate", "Opens anonymized prompts so the retranslation workflow can be explored locally."],
] as const;

it("shows the preview announcement for each mounted preview session", async () => {
  const first = renderReviewer();
  expect(screen.getByTestId("reviewer-preview-announcement")).toHaveTextContent(
    "This is a preview. Click help for details about reviewer features.",
  );

  await userEvent.setup().click(screen.getByRole("button", {
    name: "Dismiss preview announcement",
  }));
  expect(screen.queryByTestId("reviewer-preview-announcement")).toBeNull();

  first.unmount();
  renderReviewer();
  expect(screen.getByTestId("reviewer-preview-announcement")).toBeVisible();
});

it("opens public feature help and closes it only through its own X", async () => {
  const user = userEvent.setup();
  renderReviewer();
  const help = screen.getByRole("button", { name: "Reviewer feature help" });
  const drawer = screen.getByTestId("reviewer-help-drawer");
  expect(drawer).toHaveAttribute("aria-hidden", "true");
  expect(drawer).toHaveAttribute("inert");

  await user.click(help);
  const close = screen.getByRole("button", { name: "Close reviewer feature help" });
  await waitFor(() => expect(close).toHaveFocus());
  expect(drawer).not.toHaveAttribute("aria-hidden");
  for (const [term, description] of REVIEWER_FEATURES) {
    expect(within(drawer).getByText(term)).toBeVisible();
    expect(within(drawer).getByText(description)).toBeVisible();
  }

  await user.click(help);
  fireEvent.mouseDown(screen.getByTestId("chapter-english-scroller"));
  await user.keyboard("{Escape}");
  expect(drawer).not.toHaveAttribute("aria-hidden");
  expect(screen.getByRole("status")).toHaveAttribute("data-show", "false");

  await user.click(close);
  await waitFor(() => expect(help).toHaveFocus());
  expect(drawer).toHaveAttribute("aria-hidden", "true");
});

it("keeps help open when its announcement is dismissed and restores safe focus", async () => {
  const user = userEvent.setup();
  renderReviewer();
  await user.click(screen.getByRole("button", { name: "Reviewer feature help" }));
  await user.click(screen.getByRole("button", { name: "Dismiss preview announcement" }));

  const drawer = screen.getByRole("complementary", { name: "Chapter reviewer features" });
  expect(drawer).toHaveAttribute("data-announcement-visible", "false");
  expect(drawer).not.toHaveAttribute("aria-hidden");

  await user.click(screen.getByRole("button", { name: "Close reviewer feature help" }));
  await waitFor(() => expect(screen.getByLabelText("English title")).toHaveFocus());
});

it("keeps hidden help controls out of both reviewer Tab boundaries", async () => {
  const user = userEvent.setup();
  renderReviewer();
  await user.click(screen.getByRole("button", { name: "Dismiss preview announcement" }));
  const first = screen.getByRole("button", { name: "Previous chapter" });
  const last = screen.getByRole("button", { name: "Approve with override" });

  first.focus();
  fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
  expect(last).toHaveFocus();

  fireEvent.keyDown(document, { key: "Tab" });
  expect(first).toHaveFocus();
});

async function openRetryModal() {
  const user = userEvent.setup();
  const reviewerDialog = screen.getByRole("dialog", { name: /Chapter 25/iu });
  await user.click(screen.getAllByRole("button", { name: /warnings$/iu })[0]!);
  const opener = screen.getByRole("button", { name: "Retranslate" });
  await user.click(opener);
  const retryDialog = screen.getByRole("dialog", { name: /Revise chapter 25/iu });
  return { user, reviewerDialog, retryDialog, opener };
}

async function expectPreviewGuard(name: string) {
  const user = userEvent.setup();
  renderReviewer();

  await user.click(screen.getByRole("button", { name }));

  expect(screen.getByText(PREVIEW_UNAVAILABLE_MESSAGE)).toHaveAttribute(
    "data-show",
    "true",
  );
}

it.each([
  "Previous chapter",
  "Next chapter",
  "Save changes",
  "Approve with override",
  "Close chapter review",
])("guards %s with the exact preview toast", expectPreviewGuard);

it("derives the approval action from unresolved override state", () => {
  const overrideView = renderReviewer();
  expect(screen.getByRole("button", { name: "Approve with override" }).className)
    .toMatch(/danger/u);
  overrideView.unmount();

  renderReviewer({
    ...previewFixture,
    chapter: {
      ...previewFixture.chapter,
      pipelineStatus: "complete",
    },
  });
  expect(screen.getByRole("button", { name: "Approve" }).className).toMatch(/primary/u);
});

it("guards non-current chapter-index selection", async () => {
  const user = userEvent.setup();
  renderReviewer();

  await user.click(screen.getByRole("button", { name: "Chapter index" }));
  const dropdown = screen.getByTestId("chapter-index-dropdown");
  await user.click(within(dropdown).getByRole("button", { name: /^24/iu }));

  expect(screen.getByText(PREVIEW_UNAVAILABLE_MESSAGE)).toHaveAttribute(
    "data-show",
    "true",
  );
});

it("restores chapter-index focus after keyboard selection", async () => {
  const user = userEvent.setup();
  renderReviewer();
  const opener = screen.getByRole("button", { name: "Chapter index" });
  opener.focus();

  await user.keyboard("{Enter}");
  await user.tab();
  expect(screen.getByRole("button", { name: /^24/iu })).toHaveFocus();
  await user.keyboard("{Enter}");

  await waitFor(() => expect(opener).toHaveFocus());
});

it("dismisses the chapter index on outside click without stealing focus", async () => {
  const user = userEvent.setup();
  renderReviewer();
  await user.click(screen.getByRole("button", { name: "Chapter index" }));
  const outside = screen.getByRole("button", { name: "Find and replace" });
  outside.focus();

  fireEvent.mouseDown(outside);

  expect(screen.queryByTestId("chapter-index-dropdown")).toBeNull();
  expect(outside).toHaveFocus();
});

it("keeps title and body edits local", async () => {
  const user = userEvent.setup();
  renderReviewer();

  const title = screen.getByRole("textbox", { name: /english title/iu });
  await user.clear(title);
  await user.type(title, "Local draft title");
  expect(title).toHaveValue("Local draft title");

  const firstParagraph = screen.getByRole("textbox", { name: "Translation 1" });
  await user.clear(firstParagraph);
  await user.type(firstParagraph, "Local paragraph edit");
  expect(firstParagraph).toHaveValue("Local paragraph edit");
});

it("opens and closes Find and replace locally", async () => {
  const user = userEvent.setup();
  renderReviewer();

  const opener = screen.getByRole("button", { name: "Find and replace" });
  await user.click(opener);
  expect(screen.getByRole("dialog", { name: "Find and replace" })).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Close find and replace" }));
  expect(screen.queryByRole("dialog", { name: "Find and replace" })).toBeNull();
});

it("replaces an English-body match locally", async () => {
  const user = userEvent.setup();
  renderReviewer();
  await user.click(screen.getByRole("button", { name: "Align paragraphs" }));
  const body = screen.getByRole("textbox", { name: "English body" });
  const original = String(body.getAttribute("value") ?? "") || (body as HTMLTextAreaElement).value;
  const query = original.match(/[A-Za-z]{5,}/u)?.[0];
  expect(query).toBeDefined();

  await user.click(screen.getByRole("button", { name: "Find and replace" }));
  const panel = screen.getByRole("dialog", { name: "Find and replace" });
  await user.type(within(panel).getByRole("textbox", { name: "Find" }), query!);
  await user.type(
    within(panel).getByRole("textbox", { name: "Replace with" }),
    "LOCAL_REPLACEMENT",
  );
  await user.click(within(panel).getByRole("button", { name: "Replace all" }));

  expect(body).not.toHaveValue(original);
  expect((body as HTMLTextAreaElement).value).toContain("LOCAL_REPLACEMENT");
});

it("resets both comparison controls after the reviewer reloads", async () => {
  const user = userEvent.setup();
  const firstView = renderReviewer();
  const align = screen.getByRole("button", { name: "Align paragraphs" });
  const sync = screen.getByRole("button", { name: "Sync scrolling" });

  expect(align).toHaveAttribute("aria-pressed", "true");
  expect(sync).toHaveAttribute("aria-pressed", "true");
  await user.click(align);
  await user.click(sync);
  expect(align).toHaveAttribute("aria-pressed", "false");
  expect(sync).toHaveAttribute("aria-pressed", "false");

  firstView.unmount();
  renderReviewer();
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });

  expect(screen.getByRole("button", { name: "Align paragraphs" }))
    .toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Sync scrolling" }))
    .toHaveAttribute("aria-pressed", "true");
});

it("expands the QA rail and selects a warning", async () => {
  const user = userEvent.setup();
  renderReviewer();

  const warningIcon = screen.getAllByRole("button", { name: /warnings$/iu })[0];
  expect(warningIcon).toBeDefined();
  await user.click(warningIcon!);

  expect(screen.getByTestId("qa-sidebar")).toHaveAttribute("data-expanded", "true");
  expect(
    within(screen.getByTestId("qa-warning-list")).getAllByRole("button", {
      pressed: true,
    }),
  ).not.toHaveLength(0);
});

it("guards the glossary mutation action", async () => {
  const user = userEvent.setup();
  renderReviewer();

  await user.click(screen.getAllByRole("button", { name: /warnings$/iu })[0]!);
  await user.click(screen.getByRole("button", { name: "Edit glossary" }));

  expect(screen.getByText(PREVIEW_UNAVAILABLE_MESSAGE)).toHaveAttribute(
    "data-show",
    "true",
  );
});

it("makes the reviewer inert and hidden while Retranslate is active", async () => {
  renderReviewer();
  const { reviewerDialog, retryDialog } = await openRetryModal();

  expect(reviewerDialog).toHaveAttribute("aria-hidden", "true");
  expect(reviewerDialog).toHaveAttribute("inert");
  expect(reviewerDialog).not.toContainElement(retryDialog);
  expect(screen.getAllByRole("dialog")).toEqual([retryDialog]);
  expect(retryDialog).toHaveAttribute("aria-modal", "true");
});

it.each(["Cancel", "Close retry", "Escape", "backdrop"] as const)(
  "closes Retranslate via %s and restores reviewer semantics and opener focus",
  async (action) => {
    renderReviewer();
    const { user, reviewerDialog, retryDialog, opener } = await openRetryModal();

    if (action === "Escape") {
      await user.keyboard("{Escape}");
    } else if (action === "backdrop") {
      const backdrop = retryDialog.parentElement;
      expect(backdrop).not.toBeNull();
      fireEvent.mouseDown(backdrop!);
    } else {
      await user.click(screen.getByRole("button", { name: action }));
    }

    expect(screen.queryByRole("dialog", { name: /Revise chapter 25/iu })).toBeNull();
    expect(reviewerDialog).not.toHaveAttribute("aria-hidden");
    expect(reviewerDialog).not.toHaveAttribute("inert");
    expect(screen.getByRole("dialog", { name: /Chapter 25/iu })).toBe(reviewerDialog);
    await waitFor(() => expect(opener).toHaveFocus());
  },
);

it("announces guarded actions through a polite status region", async () => {
  const user = userEvent.setup();
  renderReviewer();

  await user.click(screen.getByRole("button", { name: "Save changes" }));

  expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  expect(screen.getByRole("status")).toHaveTextContent(PREVIEW_UNAVAILABLE_MESSAGE);
});

it("guards Escape at the full-screen reviewer boundary", async () => {
  const user = userEvent.setup();
  renderReviewer();

  await user.keyboard("{Escape}");

  expect(screen.getByText(PREVIEW_UNAVAILABLE_MESSAGE)).toHaveAttribute(
    "data-show",
    "true",
  );
});

it("guards backdrop dismissal at the full-screen reviewer boundary", () => {
  renderReviewer();
  const dialog = screen.getByRole("dialog", { name: /Chapter 25/iu });
  const backdrop = dialog.parentElement;
  expect(backdrop).not.toBeNull();

  fireEvent.mouseDown(backdrop!);

  expect(screen.getByText(PREVIEW_UNAVAILABLE_MESSAGE)).toHaveAttribute(
    "data-show",
    "true",
  );
});
