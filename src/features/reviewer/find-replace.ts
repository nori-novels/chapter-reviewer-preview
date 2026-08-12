// Pure matching and replacement logic for the chapter review
// find-and-replace window. Paragraph indexes follow the aligned-comparison
// convention (see contentParagraphs in ./chapter-review): the 0-based index
// over non-blank lines of the body, so navigation can reuse the QA warning
// scroll/highlight mechanism.

export const MAX_REVIEW_BODY_CHARACTERS = 500_000;

export interface FindMatch {
  start: number;
  end: number;
  paragraph: number;
}

interface LineSpan {
  start: number;
  row: number | null;
}

// Lowercases per code point, keeping the original character whenever
// lowercasing would change its UTF-16 length (e.g. "İ" -> "i̇"), so match
// offsets always index into the original body.
function foldCase(text: string): string {
  let folded = "";
  for (const character of text) {
    const lower = character.toLowerCase();
    folded += lower.length === character.length ? lower : character;
  }
  return folded;
}

function lineSpans(body: string): LineSpan[] {
  const spans: LineSpan[] = [];
  const newline = /\r?\n/gu;
  let start = 0;
  let row = 0;
  for (;;) {
    const boundary = newline.exec(body);
    const end = boundary ? boundary.index : body.length;
    const hasContent = body.slice(start, end).trim().length > 0;
    spans.push({ start, row: hasContent ? row : null });
    if (hasContent) row += 1;
    if (!boundary) break;
    start = newline.lastIndex;
  }
  return spans;
}

// A match on a blank line (only possible with a whitespace query) maps to
// the nearest preceding paragraph row.
function paragraphForOffset(spans: LineSpan[], offset: number): number {
  let paragraph = 0;
  for (const span of spans) {
    if (span.start > offset) break;
    if (span.row !== null) paragraph = span.row;
  }
  return paragraph;
}

export function findMatches(
  body: string,
  query: string,
  caseSensitive: boolean,
): FindMatch[] {
  if (query.length === 0) return [];
  const haystack = caseSensitive ? body : foldCase(body);
  const needle = caseSensitive ? query : foldCase(query);
  const spans = lineSpans(body);
  const matches: FindMatch[] = [];
  let cursor = 0;
  for (;;) {
    const start = haystack.indexOf(needle, cursor);
    if (start < 0) break;
    const end = start + needle.length;
    matches.push({ start, end, paragraph: paragraphForOffset(spans, start) });
    cursor = end;
  }
  return matches;
}

export function replaceMatchAt(
  body: string,
  match: FindMatch,
  replacement: string,
): string {
  return body.slice(0, match.start) + replacement + body.slice(match.end);
}

export function replaceAllMatches(
  body: string,
  query: string,
  caseSensitive: boolean,
  replacement: string,
): { text: string; count: number } {
  const matches = findMatches(body, query, caseSensitive);
  if (matches.length === 0) return { text: body, count: 0 };
  let text = "";
  let cursor = 0;
  for (const match of matches) {
    text += body.slice(cursor, match.start) + replacement;
    cursor = match.end;
  }
  text += body.slice(cursor);
  return { text, count: matches.length };
}

export interface FindHighlightQuery {
  query: string;
  caseSensitive: boolean;
}

// Identifies the selected match so the highlight backdrop can render it
// distinctly from the others. `ordinal` is the match index across the whole
// body (used by the standard single-backdrop view); `paragraph` and
// `indexInParagraph` locate it for the aligned per-paragraph backdrops.
export interface FindCurrentMatch {
  ordinal: number;
  paragraph: number;
  indexInParagraph: number;
}

export interface MatchSegment {
  text: string;
  match: boolean;
  current: boolean;
}

// Splits a single paragraph's text into alternating plain/match segments for
// the review highlight backdrop. Segment text always comes verbatim from the
// input so the backdrop's layout matches the textarea's character for
// character.
export function splitByMatches(
  text: string,
  query: string,
  caseSensitive: boolean,
  currentIndex = -1,
): MatchSegment[] {
  const matches = findMatches(text, query, caseSensitive);
  if (matches.length === 0) return [{ text, match: false, current: false }];
  const segments: MatchSegment[] = [];
  let cursor = 0;
  matches.forEach((match, ordinal) => {
    if (match.start > cursor) {
      segments.push({ text: text.slice(cursor, match.start), match: false, current: false });
    }
    segments.push({
      text: text.slice(match.start, match.end),
      match: true,
      current: ordinal === currentIndex,
    });
    cursor = match.end;
  });
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: false, current: false });
  }
  return segments;
}
