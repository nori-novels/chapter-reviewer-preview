import { expect, it } from "vitest";
import type { GlossaryEntry } from "@/features/preview/types";
import {
  commitAcceptedTargetInput,
  createGlossaryReviewDraft,
  isGlossaryDraftDirty,
  normalizedGlossaryEntries,
  parseAcceptedTargets,
  updateAcceptedTargetInput,
} from "./glossary-review-draft";

function entry(overrides: Partial<GlossaryEntry> = {}): GlossaryEntry {
  return {
    source: "席瑶",
    target: "Xi Yao",
    acceptedTargets: ["Yao"],
    kind: "character",
    gender: "female",
    note: "",
    enabled: true,
    ...overrides,
  };
}

it("seeds accepted target inputs from the saved entries", () => {
  const draft = createGlossaryReviewDraft([entry({ acceptedTargets: ["Yao", "Little Yao"] })]);

  expect(draft.acceptedTargetInputs).toEqual(["Yao\nLittle Yao"]);
});

it("does not mutate the entries it was created from", () => {
  const entries = [entry()];
  const draft = createGlossaryReviewDraft(entries);
  draft.entries[0]!.acceptedTargets.push("Mutated");
  draft.entries[0]!.target = "Mutated";

  expect(entries[0]!.acceptedTargets).toEqual(["Yao"]);
  expect(entries[0]!.target).toBe("Xi Yao");
});

it("keeps raw accepted target text while editing and parses it on commit", () => {
  const editing = updateAcceptedTargetInput(
    createGlossaryReviewDraft([entry()]),
    0,
    "  Yao  \n\n Little Yao \n",
  );

  expect(editing.acceptedTargetInputs[0]).toBe("  Yao  \n\n Little Yao \n");
  expect(editing.entries[0]!.acceptedTargets).toEqual(["Yao"]);

  const committed = commitAcceptedTargetInput(editing, 0);

  expect(committed.entries[0]!.acceptedTargets).toEqual(["Yao", "Little Yao"]);
  expect(committed.acceptedTargetInputs[0]).toBe("Yao\nLittle Yao");
});

it("normalizes uncommitted accepted target text", () => {
  const editing = updateAcceptedTargetInput(createGlossaryReviewDraft([entry()]), 0, "A\n\nB\n");

  expect(normalizedGlossaryEntries(editing)[0]!.acceptedTargets).toEqual(["A", "B"]);
  expect(parseAcceptedTargets("")).toEqual([]);
});

it("reports dirtiness against the saved entries", () => {
  const saved = [entry()];
  const draft = createGlossaryReviewDraft(saved);

  expect(isGlossaryDraftDirty(draft, saved)).toBe(false);
  // Reordering the same text within a field is still a change.
  expect(isGlossaryDraftDirty(
    updateAcceptedTargetInput(draft, 0, "Yao\nLittle Yao"),
    saved,
  )).toBe(true);
  expect(isGlossaryDraftDirty(createGlossaryReviewDraft([entry({ enabled: false })]), saved))
    .toBe(true);
  expect(isGlossaryDraftDirty(createGlossaryReviewDraft([]), saved)).toBe(true);
});
