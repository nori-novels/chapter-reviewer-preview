import type { GlossaryEntry } from "@/features/preview/types";

// Editable glossary state shared by the retranslate modal and the glossary
// editor. Accepted targets are held as raw multi-line text while a field has
// focus so a trailing newline does not disappear mid-edit, then committed to
// the parsed array on blur.
export interface GlossaryReviewDraft {
  entries: GlossaryEntry[];
  acceptedTargetInputs: string[];
}

export function parseAcceptedTargets(value: string): string[] {
  return value.split(/\n/u).map((target) => target.trim()).filter(Boolean);
}

function cloneEntry(entry: GlossaryEntry): GlossaryEntry {
  return { ...entry, acceptedTargets: [...entry.acceptedTargets] };
}

export function createGlossaryReviewDraft(
  entries: readonly GlossaryEntry[],
): GlossaryReviewDraft {
  const clonedEntries = entries.map(cloneEntry);
  return {
    entries: clonedEntries,
    acceptedTargetInputs: clonedEntries.map((entry) => entry.acceptedTargets.join("\n")),
  };
}

export function updateAcceptedTargetInput(
  draft: GlossaryReviewDraft,
  index: number,
  value: string,
): GlossaryReviewDraft {
  const acceptedTargetInputs = [...draft.acceptedTargetInputs];
  acceptedTargetInputs[index] = value;
  return { ...draft, acceptedTargetInputs };
}

export function commitAcceptedTargetInput(
  draft: GlossaryReviewDraft,
  index: number,
): GlossaryReviewDraft {
  const acceptedTargets = parseAcceptedTargets(draft.acceptedTargetInputs[index] ?? "");
  const entries = draft.entries.map((entry, currentIndex) => (
    currentIndex === index ? { ...entry, acceptedTargets } : entry
  ));
  const acceptedTargetInputs = [...draft.acceptedTargetInputs];
  acceptedTargetInputs[index] = acceptedTargets.join("\n");
  return { entries, acceptedTargetInputs };
}

export function normalizedGlossaryEntries(draft: GlossaryReviewDraft): GlossaryEntry[] {
  return draft.entries.map((entry, index) => ({
    ...entry,
    acceptedTargets: parseAcceptedTargets(
      draft.acceptedTargetInputs[index] ?? entry.acceptedTargets.join("\n"),
    ),
  }));
}

function glossaryEntryEqual(left: GlossaryEntry, right: GlossaryEntry): boolean {
  return left.source === right.source
    && left.target === right.target
    && left.kind === right.kind
    && left.gender === right.gender
    && left.note === right.note
    && left.enabled === right.enabled
    && left.acceptedTargets.length === right.acceptedTargets.length
    && left.acceptedTargets.every((target, index) => target === right.acceptedTargets[index]);
}

export function glossaryEntriesEqual(
  left: readonly GlossaryEntry[],
  right: readonly GlossaryEntry[],
): boolean {
  return left.length === right.length
    && left.every((entry, index) => glossaryEntryEqual(entry, right[index]!));
}

export function isGlossaryDraftDirty(
  draft: GlossaryReviewDraft,
  savedEntries: readonly GlossaryEntry[],
): boolean {
  return !glossaryEntriesEqual(normalizedGlossaryEntries(draft), savedEntries);
}
