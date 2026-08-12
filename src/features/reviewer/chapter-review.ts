import type { GlossaryEntry } from "@/features/preview/types";

export const MISSING_SOURCE_MESSAGE = "No source chapter was found.";

export interface HighlightSegment {
  text: string;
  target?: string;
}

export interface ReviewParagraphPair {
  index: number;
  source: string;
  translation: string;
}

export interface ReviewParagraphIdentity {
  rowIndex: number;
  backingLineIndex: number | null;
}

export interface ReviewParagraphDraft extends ReviewParagraphIdentity {
  key: string;
  value: string;
}

export interface EditableReviewParagraphPair extends ReviewParagraphPair {
  translationKey: string;
  translationLineIndex: number | null;
  translationEditable: boolean;
}

export interface ReviewParagraphReplacement {
  text: string;
  backingLineIndex: number | null;
}

export interface ScrollMetrics {
  scrollTop?: number;
  scrollHeight: number;
  clientHeight: number;
}

export interface ComparisonPreferences {
  alignParagraphs: boolean;
  syncScrolling: boolean;
}

type ReviewStorage = Pick<Storage, "getItem" | "setItem">;
type SessionStorageOwner = { readonly sessionStorage: ReviewStorage };
const PREFERENCE_KEY = "nori:52shuku:chapter-review-comparison";
const DEFAULT_PREFERENCES: ComparisonPreferences = {
  alignParagraphs: true,
  syncScrolling: true,
};

export function safelyAcquireSessionStorage(
  browser: SessionStorageOwner,
): ReviewStorage | undefined {
  try {
    return browser.sessionStorage;
  } catch {
    return undefined;
  }
}

export function highlightSourceText(
  text: string,
  mismatches: GlossaryEntry[],
): HighlightSegment[] {
  const terms = mismatches
    .filter((entry) => entry.enabled && entry.source.length > 0)
    .sort((left, right) => right.source.length - left.source.length);
  if (!text || terms.length === 0) return [{ text }];

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    let bestStart = text.length;
    let best: GlossaryEntry | undefined;
    for (const term of terms) {
      const start = text.indexOf(term.source, cursor);
      if (start < 0) continue;
      if (
        start < bestStart ||
        (start === bestStart &&
          term.source.length > (best?.source.length ?? 0))
      ) {
        bestStart = start;
        best = term;
      }
    }
    if (!best) {
      segments.push({ text: text.slice(cursor) });
      break;
    }
    if (bestStart > cursor) {
      segments.push({ text: text.slice(cursor, bestStart) });
    }
    segments.push({ text: best.source, target: best.target });
    cursor = bestStart + best.source.length;
  }
  return segments.length > 0 ? segments : [{ text }];
}

interface ContentParagraph {
  lineIndex: number;
  text: string;
}

function contentParagraphs(text: string): ContentParagraph[] {
  return text.split(/\r?\n/u).flatMap((line, lineIndex) => (
    line.trim().length > 0 ? [{ lineIndex, text: line }] : []
  ));
}

export function normalizeReviewParagraphInput(value: string): string {
  return value.replace(/\r\n?|\n/gu, " ");
}

export function pairReviewParagraphs(
  source: string,
  translation: string,
): ReviewParagraphPair[] {
  const sourceParagraphs = contentParagraphs(source);
  const translationParagraphs = contentParagraphs(translation);
  const pairCount = Math.max(sourceParagraphs.length, translationParagraphs.length, 1);
  return Array.from({ length: pairCount }, (_, index) => ({
    index,
    source: sourceParagraphs[index]?.text ?? "",
    translation: translationParagraphs[index]?.text ?? "",
  }));
}

export function pairEditableReviewParagraphs(
  source: string,
  translation: string,
  activeDraft?: ReviewParagraphDraft,
): EditableReviewParagraphPair[] {
  const sourceParagraphs = contentParagraphs(source);
  const translationParagraphs: Array<{
    lineIndex: number | null;
    text: string;
    key: string;
  }> = contentParagraphs(translation).map((paragraph) => ({
    ...paragraph,
    key: `line:${paragraph.lineIndex}`,
  }));

  if (activeDraft) {
    const backingLineIndex = activeDraft.backingLineIndex;
    const draftParagraph = {
      lineIndex: backingLineIndex,
      text: activeDraft.value,
      key: activeDraft.key,
    };
    if (backingLineIndex === null) {
      if (activeDraft.rowIndex === translationParagraphs.length) {
        translationParagraphs.push(draftParagraph);
      }
    } else {
      const existingIndex = translationParagraphs.findIndex(
        (paragraph) => paragraph.lineIndex === backingLineIndex,
      );
      if (existingIndex >= 0) {
        translationParagraphs[existingIndex] = draftParagraph;
      } else {
        const followingIndex = translationParagraphs.findIndex(
          (paragraph) => paragraph.lineIndex !== null
            && paragraph.lineIndex > backingLineIndex,
        );
        translationParagraphs.splice(
          followingIndex >= 0 ? followingIndex : translationParagraphs.length,
          0,
          draftParagraph,
        );
      }
    }
  }

  const pairCount = Math.max(
    sourceParagraphs.length,
    translationParagraphs.length,
    1,
  );
  const nextAppendableIndex = activeDraft?.backingLineIndex === null
    ? activeDraft.rowIndex
    : translationParagraphs.length;
  return Array.from({ length: pairCount }, (_, index) => {
    const translationParagraph = translationParagraphs[index];
    return {
      index,
      source: sourceParagraphs[index]?.text ?? "",
      translation: translationParagraph?.text ?? "",
      translationKey: translationParagraph?.key ?? `unmatched:${index}`,
      translationLineIndex: translationParagraph?.lineIndex ?? null,
      translationEditable:
        translationParagraph !== undefined || index === nextAppendableIndex,
    };
  });
}

export function replaceReviewParagraphByIdentity(
  text: string,
  identity: ReviewParagraphIdentity,
  value: string,
): ReviewParagraphReplacement {
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/u);
  if (identity.backingLineIndex !== null) {
    if (
      identity.backingLineIndex < 0
      || identity.backingLineIndex >= lines.length
    ) {
      return { text, backingLineIndex: identity.backingLineIndex };
    }
    lines[identity.backingLineIndex] = value;
    return {
      text: lines.join(newline),
      backingLineIndex: identity.backingLineIndex,
    };
  }

  if (
    value.trim().length === 0
    || identity.rowIndex !== contentParagraphs(text).length
  ) {
    return { text, backingLineIndex: null };
  }
  if (text.length === 0) return { text: value, backingLineIndex: 0 };

  const backingLineIndex = text.endsWith("\n") ? lines.length - 1 : lines.length;
  return {
    text: text.endsWith("\n") ? `${text}${value}` : `${text}${newline}${value}`,
    backingLineIndex,
  };
}

export function replaceReviewParagraph(
  text: string,
  paragraphIndex: number,
  value: string,
): string {
  return replaceReviewParagraphByIdentity(
    text,
    {
      rowIndex: paragraphIndex,
      backingLineIndex: contentParagraphs(text)[paragraphIndex]?.lineIndex ?? null,
    },
    value,
  ).text;
}

export function proportionalScrollTop(
  source: ScrollMetrics,
  target: ScrollMetrics,
): number {
  const sourceRange = Math.max(0, source.scrollHeight - source.clientHeight);
  const targetRange = Math.max(0, target.scrollHeight - target.clientHeight);
  if (sourceRange === 0 || targetRange === 0) return 0;
  return Math.min(
    targetRange,
    Math.max(0, ((source.scrollTop ?? 0) / sourceRange) * targetRange),
  );
}

export function readComparisonPreferences(
  storage: Pick<ReviewStorage, "getItem"> | undefined,
): ComparisonPreferences {
  try {
    const parsed = JSON.parse(
      storage?.getItem(PREFERENCE_KEY) ?? "null",
    ) as Partial<ComparisonPreferences> | null;
    return {
      alignParagraphs:
        typeof parsed?.alignParagraphs === "boolean"
          ? parsed.alignParagraphs
          : DEFAULT_PREFERENCES.alignParagraphs,
      syncScrolling:
        typeof parsed?.syncScrolling === "boolean"
          ? parsed.syncScrolling
          : DEFAULT_PREFERENCES.syncScrolling,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function writeComparisonPreferences(
  storage: Pick<ReviewStorage, "setItem"> | undefined,
  preferences: ComparisonPreferences,
): void {
  try {
    storage?.setItem(PREFERENCE_KEY, JSON.stringify(preferences));
  } catch {
    // Preferences are optional; in-memory state remains authoritative.
  }
}
