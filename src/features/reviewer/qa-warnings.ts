import type { GlossaryEntry } from "@/features/preview/types";
import { normalizeGlossaryMatch } from "./glossary";
import { HAN_CHARACTER, HAN_RUN } from "./han";
import { splitTlNoteSuffix } from "./tl-note";

// Review-time QA warnings, computed deterministically from the chapter's
// source text, the current draft translation, and the chapter-relevant
// glossary. This module is client-safe: the review modal recomputes warnings
// live while the admin edits, so paragraph indices must match the aligned
// comparison rows. Rows are the non-empty lines of each body, 0-based, with
// the chapter title as its own "title" slot; the TL-note suffix is excluded
// from every check.

export type QaWarningParagraph = number | "title";

export interface QaWarningOccurrence {
  paragraph: QaWarningParagraph;
  // Translation-side row for glossary mismatches, which may differ from the
  // source-side row after editorial merges/splits. Absent means both sides
  // share `paragraph` (all other warning types).
  translationParagraph?: QaWarningParagraph;
}

export interface GlossaryMismatchWarning {
  type: "glossary_mismatch";
  entry: GlossaryEntry;
  occurrences: QaWarningOccurrence[];
}

export interface HanResidueWarning {
  type: "han_residue";
  snippets: string[];
  occurrences: QaWarningOccurrence[];
}

export interface PronounWarning {
  type: "pronoun";
  character: GlossaryEntry;
  expectedPronouns: string;
  occurrences: QaWarningOccurrence[];
}

export interface ParagraphBreakWarning {
  type: "paragraph_breaks";
  sourceCount: number;
  translationCount: number;
  occurrences: QaWarningOccurrence[];
}

export type QaWarning =
  | GlossaryMismatchWarning
  | HanResidueWarning
  | PronounWarning
  | ParagraphBreakWarning;

export interface QaWarningInput {
  sourceTitle: string;
  sourceBody: string;
  translatedTitle: string;
  translatedBody: string;
  glossary: GlossaryEntry[];
}

const MAX_HAN_SNIPPETS = 8;
const MAX_HAN_SNIPPET_CHARACTERS = 24;

const MALE_PRONOUNS = new Set(["he", "him", "his", "himself"]);
const FEMALE_PRONOUNS = new Set(["she", "her", "hers", "herself"]);
const SPACE_PATTERN = / /gu;
const WORD_LIKE_PATTERN = /[\p{L}\p{N}]/u;

function nonEmptyLines(text: string): string[] {
  return text.split(/\r?\n/u).filter((line) => line.trim().length > 0);
}

function compactNormalizedSource(value: string): string {
  return normalizeGlossaryMatch(value).replace(SPACE_PATTERN, "");
}

function isWeakSingleCharacterTerm(entry: GlossaryEntry): boolean {
  return entry.kind === "term" && Array.from(compactNormalizedSource(entry.source)).length <= 1;
}

function requiresWordBoundary(character: string | undefined): boolean {
  return Boolean(character && WORD_LIKE_PATTERN.test(character) && !HAN_CHARACTER.test(character));
}

function codePointBefore(value: string, index: number): string | undefined {
  if (index <= 0) return undefined;
  const trailing = value.charCodeAt(index - 1);
  if (trailing >= 0xDC00 && trailing <= 0xDFFF && index >= 2) {
    const leading = value.charCodeAt(index - 2);
    if (leading >= 0xD800 && leading <= 0xDBFF) return value.slice(index - 2, index);
  }
  return value[index - 1];
}

function codePointAt(value: string, index: number): string | undefined {
  const codePoint = value.codePointAt(index);
  return codePoint === undefined ? undefined : String.fromCodePoint(codePoint);
}

function includesGlossaryTarget(normalizedTranslation: string, target: string): boolean {
  const normalizedTarget = normalizeGlossaryMatch(target);
  if (!normalizedTarget) return false;
  const targetCodePoints = Array.from(normalizedTarget);
  const needsStartBoundary = requiresWordBoundary(targetCodePoints[0]);
  const needsEndBoundary = requiresWordBoundary(targetCodePoints.at(-1));
  let fromIndex = 0;
  while (fromIndex < normalizedTranslation.length) {
    const start = normalizedTranslation.indexOf(normalizedTarget, fromIndex);
    if (start === -1) return false;
    const end = start + normalizedTarget.length;
    const startMatches = !needsStartBoundary
      || !WORD_LIKE_PATTERN.test(codePointBefore(normalizedTranslation, start) ?? "");
    const endMatches = !needsEndBoundary
      || !WORD_LIKE_PATTERN.test(codePointAt(normalizedTranslation, end) ?? "");
    if (startMatches && endMatches) return true;
    fromIndex = start + 1;
  }
  return false;
}

function glossaryTargets(entry: GlossaryEntry): string[] {
  const seen = new Set<string>();
  const targets: string[] = [];
  for (const target of [entry.target, ...entry.acceptedTargets]) {
    const normalized = normalizeGlossaryMatch(target);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    targets.push(target);
  }
  return targets;
}

interface MatchedOccurrence {
  entry: GlossaryEntry;
  entryIndex: number;
  start: number;
  end: number;
  length: number;
}

function relevantGlossaryEntries(source: string, entries: GlossaryEntry[]): GlossaryEntry[] {
  const normalizedSource = normalizeGlossaryMatch(source);
  if (!normalizedSource) return [];
  const occurrences = entries.flatMap((entry, entryIndex) => {
    if (!entry.enabled || isWeakSingleCharacterTerm(entry)) return [];
    const normalizedEntrySource = normalizeGlossaryMatch(entry.source);
    if (!normalizedEntrySource) return [];
    const matches: MatchedOccurrence[] = [];
    let fromIndex = 0;
    while (fromIndex < normalizedSource.length) {
      const start = normalizedSource.indexOf(normalizedEntrySource, fromIndex);
      if (start === -1) break;
      matches.push({ entry, entryIndex, start, end: start + normalizedEntrySource.length, length: normalizedEntrySource.length });
      fromIndex = start + 1;
    }
    return matches;
  }).sort((left, right) => right.length - left.length || left.start - right.start || left.entryIndex - right.entryIndex);
  const selected: MatchedOccurrence[] = [];
  const selectedIndexes = new Set<number>();
  for (const occurrence of occurrences) {
    if (selectedIndexes.has(occurrence.entryIndex)) continue;
    if (selected.some((candidate) => occurrence.start < candidate.end && candidate.start < occurrence.end)) continue;
    selected.push(occurrence);
    selectedIndexes.add(occurrence.entryIndex);
  }
  return selected.sort((left, right) => left.start - right.start || left.entryIndex - right.entryIndex).map((occurrence) => occurrence.entry);
}

function findGlossaryMismatches(source: string, translation: string, entries: GlossaryEntry[]): GlossaryEntry[] {
  const normalizedTranslation = normalizeGlossaryMatch(translation);
  return relevantGlossaryEntries(source, entries).filter((entry) => (
    !glossaryTargets(entry).some((target) => includesGlossaryTarget(normalizedTranslation, target))
  ));
}

interface Anchor { source: number; translation: number }

function collectAnchors(sourceRows: string[], normalizedTranslationRows: string[], entries: GlossaryEntry[]): Anchor[] {
  const sourceRowsByEntry = new Map<GlossaryEntry, number[]>();
  sourceRows.forEach((row, index) => {
    for (const entry of relevantGlossaryEntries(row, entries)) {
      const rows = sourceRowsByEntry.get(entry) ?? [];
      rows.push(index);
      sourceRowsByEntry.set(entry, rows);
    }
  });
  const anchors: Anchor[] = [];
  for (const [entry, sourceIndexes] of sourceRowsByEntry) {
    const targets = glossaryTargets(entry);
    const translationIndexes = normalizedTranslationRows.flatMap((row, index) => (
      targets.some((target) => includesGlossaryTarget(row, target)) ? [index] : []
    ));
    if (translationIndexes.length === 0 || translationIndexes.length !== sourceIndexes.length) continue;
    sourceIndexes.forEach((source, index) => anchors.push({ source, translation: translationIndexes[index]! }));
  }
  return anchors;
}

function monotonicAnchors(anchors: Anchor[]): Anchor[] {
  const bySource = new Map<number, number>();
  for (const anchor of anchors) {
    const existing = bySource.get(anchor.source);
    if (existing === undefined || anchor.translation < existing) bySource.set(anchor.source, anchor.translation);
  }
  const deduped = [...bySource.entries()].map(([source, translation]) => ({ source, translation })).sort((left, right) => left.source - right.source);
  const best: number[] = [];
  const previous: number[] = [];
  let bestEnd = -1;
  let bestLength = 0;
  for (let index = 0; index < deduped.length; index += 1) {
    best[index] = 1;
    previous[index] = -1;
    for (let prior = 0; prior < index; prior += 1) {
      if (deduped[prior]!.translation <= deduped[index]!.translation && best[prior]! + 1 > best[index]!) {
        best[index] = best[prior]! + 1;
        previous[index] = prior;
      }
    }
    if (best[index]! > bestLength) { bestLength = best[index]!; bestEnd = index; }
  }
  const kept: Anchor[] = [];
  for (let index = bestEnd; index >= 0; index = previous[index]!) kept.push(deduped[index]!);
  return kept.reverse();
}

function alignParagraphs(sourceRows: string[], translationRows: string[], entries: GlossaryEntry[]): number[] {
  const sourceCount = sourceRows.length;
  const translationCount = translationRows.length;
  if (translationCount === 0) return sourceRows.map((_, index) => index);
  const anchors = monotonicAnchors(collectAnchors(sourceRows, translationRows.map(normalizeGlossaryMatch), entries));
  if (anchors.length === 0) {
    const identity = sourceCount === translationCount;
    return sourceRows.map((_, index) => identity ? index : Math.min(translationCount - 1, Math.max(0, Math.round((index * translationCount) / sourceCount))));
  }
  const points: Anchor[] = [{ source: -1, translation: -1 }, ...anchors, { source: sourceCount, translation: translationCount }];
  const anchorBySource = new Map(anchors.map((anchor) => [anchor.source, anchor.translation]));
  const rows: number[] = [];
  let bracket = 0;
  for (let index = 0; index < sourceCount; index += 1) {
    while (bracket < points.length - 2 && points[bracket + 1]!.source <= index) bracket += 1;
    const before = points[bracket]!;
    const after = points[bracket + 1]!;
    const exact = anchorBySource.get(index);
    const interpolated = before.translation + Math.round(((index - before.source) * (after.translation - before.translation)) / (after.source - before.source));
    rows[index] = exact ?? Math.min(Math.min(translationCount - 1, after.translation), Math.max(Math.max(0, before.translation), interpolated));
  }
  return rows;
}

interface GlossaryInstanceMismatch { entry: GlossaryEntry; sourceParagraph: number; translationParagraph: number }

function reportableGlossaryInstanceMismatches(sourceRows: string[], translationRows: string[], entries: GlossaryEntry[]): GlossaryInstanceMismatch[] {
  const normalizedChapter = normalizeGlossaryMatch(translationRows.join("\n"));
  const present = new Set(entries.filter((entry) => glossaryTargets(entry).some((target) => includesGlossaryTarget(normalizedChapter, target))));
  const rows = alignParagraphs(sourceRows, translationRows, entries);
  return sourceRows.flatMap((row, sourceParagraph) => relevantGlossaryEntries(row, entries)
    .filter((entry) => !present.has(entry))
    .map((entry) => ({ entry, sourceParagraph, translationParagraph: rows[sourceParagraph]! })));
}

interface Slot {
  paragraph: QaWarningParagraph;
  normalizedSource: string;
  translation: string;
  translationTokens: Set<string>;
}

function tokenSet(text: string): Set<string> {
  return new Set(normalizeGlossaryMatch(text).split(" ").filter(Boolean));
}

function buildSlots(input: {
  sourceTitle: string;
  translatedTitle: string;
  sourceRows: string[];
  translationRows: string[];
}): Slot[] {
  const rowCount = Math.max(input.sourceRows.length, input.translationRows.length);
  const slots: Slot[] = [{
    paragraph: "title",
    normalizedSource: normalizeGlossaryMatch(input.sourceTitle),
    translation: input.translatedTitle,
    translationTokens: tokenSet(input.translatedTitle),
  }];
  for (let index = 0; index < rowCount; index += 1) {
    const translation = input.translationRows[index] ?? "";
    slots.push({
      paragraph: index,
      normalizedSource: normalizeGlossaryMatch(input.sourceRows[index] ?? ""),
      translation,
      translationTokens: tokenSet(translation),
    });
  }
  return slots;
}

function glossaryMismatchWarnings(
  input: QaWarningInput,
  sourceRows: string[],
  translationRows: string[],
): GlossaryMismatchWarning[] {
  if (input.glossary.length === 0) return [];
  const titleMismatches = new Set<GlossaryEntry>(
    findGlossaryMismatches(input.sourceTitle, input.translatedTitle, input.glossary),
  );
  const instanceMismatches = reportableGlossaryInstanceMismatches(
    sourceRows,
    translationRows,
    input.glossary,
  );

  return input.glossary.flatMap((entry) => {
    const occurrences: QaWarningOccurrence[] = [];
    if (titleMismatches.has(entry)) occurrences.push({ paragraph: "title" });
    for (const mismatch of instanceMismatches) {
      if (mismatch.entry !== entry) continue;
      occurrences.push({
        paragraph: mismatch.sourceParagraph,
        translationParagraph: mismatch.translationParagraph,
      });
    }
    if (occurrences.length === 0) return [];
    return [{ type: "glossary_mismatch" as const, entry, occurrences }];
  });
}

function hanResidueWarnings(slots: Slot[]): HanResidueWarning[] {
  const occurrences: QaWarningOccurrence[] = [];
  const snippets: string[] = [];
  const seenSnippets = new Set<string>();
  for (const slot of slots) {
    const runs = slot.translation.match(HAN_RUN);
    if (!runs) continue;
    occurrences.push({ paragraph: slot.paragraph });
    for (const run of runs) {
      const snippet = Array.from(run).slice(0, MAX_HAN_SNIPPET_CHARACTERS).join("");
      if (seenSnippets.has(snippet) || snippets.length >= MAX_HAN_SNIPPETS) continue;
      seenSnippets.add(snippet);
      snippets.push(snippet);
    }
  }
  if (occurrences.length === 0) return [];
  return [{ type: "han_residue", snippets, occurrences }];
}

function pronounCandidates(glossary: GlossaryEntry[]) {
  return glossary.filter((entry) => (
    entry.enabled
    && entry.kind === "character"
    && (entry.gender === "female" || entry.gender === "male")
    && normalizeGlossaryMatch(entry.source).length > 0
  ));
}

function pronounWarnings(glossary: GlossaryEntry[], slots: Slot[]): PronounWarning[] {
  const candidates = pronounCandidates(glossary);
  return candidates.flatMap((entry) => {
    const normalizedEntrySource = normalizeGlossaryMatch(entry.source);
    const oppositeGender = entry.gender === "female" ? "male" : "female";
    const unexpectedPronouns = entry.gender === "female" ? MALE_PRONOUNS : FEMALE_PRONOUNS;
    const suppressors = candidates.filter((other) => (
      other !== entry && other.gender === oppositeGender
    ));
    const occurrences = slots
      .filter((slot) => {
        if (!slot.normalizedSource.includes(normalizedEntrySource)) return false;
        let hasUnexpected = false;
        for (const token of slot.translationTokens) {
          if (unexpectedPronouns.has(token)) {
            hasUnexpected = true;
            break;
          }
        }
        if (!hasUnexpected) return false;
        return !suppressors.some((other) => (
          slot.normalizedSource.includes(normalizeGlossaryMatch(other.source))
        ));
      })
      .map((slot) => ({ paragraph: slot.paragraph }));
    if (occurrences.length === 0) return [];
    return [{
      type: "pronoun" as const,
      character: entry,
      expectedPronouns: entry.gender === "female" ? "she/her" : "he/him",
      occurrences,
    }];
  });
}

function paragraphBreakWarnings(
  sourceRows: string[],
  translationRows: string[],
): ParagraphBreakWarning[] {
  if (sourceRows.length === 0 || sourceRows.length === translationRows.length) {
    return [];
  }
  const from = Math.min(sourceRows.length, translationRows.length);
  const to = Math.max(sourceRows.length, translationRows.length);
  return [{
    type: "paragraph_breaks",
    sourceCount: sourceRows.length,
    translationCount: translationRows.length,
    occurrences: Array.from({ length: to - from }, (_, offset) => ({
      paragraph: from + offset,
    })),
  }];
}

export function collectQaWarnings(input: QaWarningInput): QaWarning[] {
  const prose = splitTlNoteSuffix(input.translatedBody).prose;
  const sourceRows = nonEmptyLines(input.sourceBody);
  const translationRows = nonEmptyLines(prose);
  const slots = buildSlots({
    sourceTitle: input.sourceTitle,
    translatedTitle: input.translatedTitle,
    sourceRows,
    translationRows,
  });

  return [
    ...glossaryMismatchWarnings(input, sourceRows, translationRows),
    ...hanResidueWarnings(slots),
    ...pronounWarnings(input.glossary, slots),
    ...paragraphBreakWarnings(sourceRows, translationRows),
  ];
}

export function qaWarningKey(warning: QaWarning): string {
  switch (warning.type) {
    case "glossary_mismatch":
      return `glossary_mismatch:${warning.entry.source}`;
    case "pronoun":
      return `pronoun:${warning.character.source}`;
    default:
      return warning.type;
  }
}
