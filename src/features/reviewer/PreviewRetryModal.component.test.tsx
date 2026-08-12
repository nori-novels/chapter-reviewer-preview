import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "@/components/Toast/Toast";
import { PREVIEW_PROMPT, PREVIEW_UNAVAILABLE_MESSAGE } from "@/features/preview/copy";
import type { GlossaryEntry } from "@/features/preview/types";
import { PreviewRetryModal } from "./PreviewRetryModal";

const EXPECTED_PREVIEW_PROMPT = `placeholder text
In nova fert animus mutatas dicere formas
corpora; di, coeptis (nam vos mutastis et illas)
adspirate meis primaque ab origine mundi
ad mea perpetuum deducite tempora carmen.
Ante mare et terras et quod tegit omnia caelum
unus erat toto naturae vultus in orbe,
quem dixere Chaos: rudis indigestaque moles
nec quicquam nisi pondus iners congestaque eodem
non bene iunctarum discordia semina rerum.
Nullus adhuc mundo praebebat lumina Titan,
nec nova crescendo reparabat cornua Phoebe,
nec circumfuso pendebat in aere tellus
ponderibus librata suis, nec bracchia longo
margine terrarum porrexerat Amphitrite;
utque erat et tellus illic et pontus et aer,
sic erat instabilis tellus, innabilis unda,
lucis egens aer; nulli sua forma manebat,
obstabatque aliis aliud, quia corpore in uno
frigida pugnabant calidis, umentia siccis,
mollia cum duris, sine pondere, habentia pondus.`;

const SYNTHETIC_GLOSSARY: GlossaryEntry[] = [{
  source: "Synthetic source",
  target: "Synthetic target",
  acceptedTargets: ["Synthetic variant"],
  kind: "character",
  gender: "unknown",
  note: "Synthetic note",
  enabled: true,
}];

function RetryHarness({ glossary = [] }: { glossary?: GlossaryEntry[] }) {
  const { show } = useToast();
  return (
    <PreviewRetryModal
      ordinal={25}
      glossary={glossary}
      onClose={() => {}}
      onSubmit={() => show(PREVIEW_UNAVAILABLE_MESSAGE)}
    />
  );
}

function renderRetryModal(glossary: GlossaryEntry[] = []) {
  return render(
    <ToastProvider>
      <RetryHarness glossary={glossary} />
    </ToastProvider>,
  );
}

it("shows three anonymized prompts with the exact synthetic value", () => {
  renderRetryModal();
  expect(PREVIEW_PROMPT).toBe(EXPECTED_PREVIEW_PROMPT);

  for (const label of ["Prompt 1", "Prompt 2", "Prompt 3"]) {
    expect(screen.getByRole("textbox", { name: label })).toHaveValue(
      PREVIEW_PROMPT,
    );
  }
  expect(screen.queryByText(/Translation prompt|Editor prompt|TL note prompt/iu)).toBeNull();
});

it("keeps the modal open and guards submission", async () => {
  const user = userEvent.setup();
  renderRetryModal();

  await user.click(screen.getByRole("button", { name: "Retry translation" }));

  expect(screen.getByRole("dialog", { name: /Revise chapter 25/iu })).toBeVisible();
  expect(screen.getByText(PREVIEW_UNAVAILABLE_MESSAGE)).toHaveAttribute(
    "data-show",
    "true",
  );
});

it("keeps prompt and glossary edits in local component state", async () => {
  const user = userEvent.setup();
  renderRetryModal(SYNTHETIC_GLOSSARY);

  const prompt = screen.getByRole("textbox", { name: "Prompt 1" });
  await user.clear(prompt);
  await user.type(prompt, "Local prompt edit");
  expect(prompt).toHaveValue("Local prompt edit");

  const target = screen.getByRole("textbox", { name: "Canonical target for Synthetic source" });
  await user.clear(target);
  await user.type(target, "Local glossary edit");
  expect(target).toHaveValue("Local glossary edit");
});

it.each(["Close retry", "Cancel"])("calls onClose from %s", async (name) => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <PreviewRetryModal
      ordinal={25}
      glossary={[]}
      onClose={onClose}
      onSubmit={() => {}}
    />,
  );

  await user.click(screen.getByRole("button", { name }));

  expect(onClose).toHaveBeenCalledOnce();
});

it("calls onClose from Escape and the backdrop", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <PreviewRetryModal
      ordinal={25}
      glossary={[]}
      onClose={onClose}
      onSubmit={() => {}}
    />,
  );

  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);

  const backdrop = screen.getByRole("dialog", { name: /Revise chapter 25/iu }).parentElement;
  expect(backdrop).not.toBeNull();
  fireEvent.mouseDown(backdrop!);
  expect(onClose).toHaveBeenCalledTimes(2);
});

it("focuses the dialog and traps Tab within it", async () => {
  const user = userEvent.setup();
  renderRetryModal();
  const dialog = screen.getByRole("dialog", { name: /Revise chapter 25/iu });

  await waitFor(() => expect(dialog).toHaveFocus());
  const retry = screen.getByRole("button", { name: "Retry translation" });
  retry.focus();
  await user.tab();

  expect(screen.getByRole("button", { name: "Close retry" })).toHaveFocus();
});
