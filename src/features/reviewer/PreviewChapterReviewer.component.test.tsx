import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";
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

beforeEach(() => {
  window.sessionStorage.clear();
});

function renderReviewer() {
  return render(
    <ToastProvider>
      <PreviewChapterReviewer fixture={previewFixture} />
    </ToastProvider>,
  );
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
  "Approve",
  "Close chapter review",
])("guards %s with the exact preview toast", expectPreviewGuard);

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

it.each(["Align paragraphs", "Sync scrolling"])(
  "toggles %s locally",
  async (name) => {
    const user = userEvent.setup();
    renderReviewer();
    const toggle = screen.getByRole("button", { name });

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  },
);

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

it("opens Retranslate locally and restores opener focus after closing", async () => {
  const user = userEvent.setup();
  renderReviewer();

  await user.click(screen.getAllByRole("button", { name: /warnings$/iu })[0]!);
  const opener = screen.getByRole("button", { name: "Retranslate" });
  await user.click(opener);

  expect(screen.getByRole("dialog", { name: /Revise chapter 25/iu })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Cancel" }));

  expect(screen.queryByRole("dialog", { name: /Revise chapter 25/iu })).toBeNull();
  await waitFor(() => expect(opener).toHaveFocus());
});

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
