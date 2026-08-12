import type { GlossaryEntry } from "@/features/preview/types";
import { normalizeGlossaryMatch } from "./glossary";

export const MAX_GLOSSARY_SOURCE_LENGTH = 100;
export const MAX_GLOSSARY_TARGET_LENGTH = 150;
export const MAX_GLOSSARY_NOTE_LENGTH = 300;
export const MAX_GLOSSARY_ACCEPTED_TARGETS = 12;

export type GlossaryValidationIssueCode =
  | "source_required"
  | "source_too_long"
  | "target_required"
  | "target_too_long"
  | "note_too_long"
  | "duplicate_source"
  | "duplicate_target"
  | "too_many_accepted_targets"
  | "accepted_target_too_long";

export interface GlossaryValidationIssue {
  rowIndex: number;
  code: GlossaryValidationIssueCode;
  message: string;
}

function addToGroup(groups: Map<string, number[]>, value: string, rowIndex: number) {
  if (!value) return;
  const indexes = groups.get(value);
  if (indexes) indexes.push(rowIndex);
  else groups.set(value, [rowIndex]);
}

// Mirrors the checks the real reviewer runs before a glossary write, so the
// preview blocks the same rows for the same reasons.
export function validateGlossaryEntryIssues(
  entries: readonly GlossaryEntry[],
): GlossaryValidationIssue[] {
  const normalizedSources = entries.map(({ source }) => normalizeGlossaryMatch(source.trim()));
  const normalizedTargets = entries.map(({ target }) => normalizeGlossaryMatch(target.trim()));
  const sourceGroups = new Map<string, number[]>();
  const enabledTargetGroups = new Map<string, number[]>();

  entries.forEach((entry, index) => {
    addToGroup(sourceGroups, normalizedSources[index]!, index);
    if (entry.enabled) addToGroup(enabledTargetGroups, normalizedTargets[index]!, index);
  });

  const duplicateSourceRows = new Set<number>();
  sourceGroups.forEach((indexes) => {
    indexes.slice(1).forEach((index) => duplicateSourceRows.add(index));
  });
  const duplicateTargetRows = new Set<number>();
  enabledTargetGroups.forEach((indexes) => {
    if (indexes.length > 1) indexes.forEach((index) => duplicateTargetRows.add(index));
  });

  const issues: GlossaryValidationIssue[] = [];
  const addIssue = (
    rowIndex: number,
    code: GlossaryValidationIssueCode,
    message: string,
  ) => issues.push({ rowIndex, code, message });

  entries.forEach((entry, index) => {
    const source = entry.source.trim();
    const target = entry.target.trim();

    if (!source) addIssue(index, "source_required", "source is required.");
    else if (source.length > MAX_GLOSSARY_SOURCE_LENGTH) {
      addIssue(index, "source_too_long", "source must be 100 characters or fewer.");
    }
    if (!target) addIssue(index, "target_required", "canonical target is required.");
    else if (target.length > MAX_GLOSSARY_TARGET_LENGTH) {
      addIssue(index, "target_too_long", "canonical target must be 150 characters or fewer.");
    }
    if (entry.note.length > MAX_GLOSSARY_NOTE_LENGTH) {
      addIssue(index, "note_too_long", "note must be 300 characters or fewer.");
    }
    if (duplicateSourceRows.has(index)) {
      addIssue(index, "duplicate_source", "duplicate normalized source.");
    }
    if (duplicateTargetRows.has(index)) {
      addIssue(index, "duplicate_target", "duplicate canonical target.");
    }
    if (entry.acceptedTargets.length > MAX_GLOSSARY_ACCEPTED_TARGETS) {
      addIssue(
        index,
        "too_many_accepted_targets",
        "accepted targets must contain at most 12 values.",
      );
    }
    entry.acceptedTargets.forEach((acceptedTarget) => {
      if (acceptedTarget.trim().length > MAX_GLOSSARY_TARGET_LENGTH) {
        addIssue(
          index,
          "accepted_target_too_long",
          "accepted targets must be 150 characters or fewer.",
        );
      }
    });
  });

  return issues;
}

// Duplicate-target issues repeat across every row that shares the target, so
// they collapse into one message naming the target instead of one per row.
export function glossaryValidationMessages(
  entries: readonly GlossaryEntry[],
  issues: readonly GlossaryValidationIssue[],
): string[] {
  const emittedTargets = new Set<string>();
  return issues.flatMap((issue) => {
    if (issue.code !== "duplicate_target") {
      return [`Row ${issue.rowIndex + 1}: ${issue.message}`];
    }
    const rawTarget = entries[issue.rowIndex]?.target.trim() ?? "";
    const target = normalizeGlossaryMatch(rawTarget);
    if (!target || emittedTargets.has(target)) return [];
    emittedTargets.add(target);
    return [`duplicate canonical target: ${rawTarget}`];
  });
}
