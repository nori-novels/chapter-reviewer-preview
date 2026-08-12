export const TL_NOTE_MARKER = "\n\nTL Note:\n";
export const MAX_TL_NOTE_ITEMS = 8;
export const MAX_TL_NOTE_ITEM_CHARACTERS = 400;

function invalidTlNote(): never {
  throw new Error("The TL-note response is invalid.");
}

// TL-note prose and items use the exact ECMAScript trim() visibility contract:
// WhiteSpace plus LineTerminator code points. PostgreSQL lists the same set in
// private.novel_import_has_ecmascript_trimmed_content.
function hasEcmascriptTrimmedContent(value: string): boolean {
  return value.trim().length > 0;
}

function unicodeCodePointLength(value: string): number {
  return Array.from(value).length;
}

function normalizedComparisonKey(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en");
}

// A parenthetical after a term must gloss it, not repeat it: reject
// "转正 (转正)" while accepting "转正 (being made permanent)". Quotation marks
// around the leading term are ignored for the comparison.
const PARENTHETICAL_GLOSS = /(\S+)\s*[(（]([^)）]+)[)）]/gu;

function repeatsTermInParenthetical(item: string): boolean {
  for (const match of item.matchAll(PARENTHETICAL_GLOSS)) {
    const lead = normalizedComparisonKey(match[1].replace(/[“”"'‘’]/gu, ""));
    const gloss = normalizedComparisonKey(match[2].trim().replace(/[“”"'‘’]/gu, ""));
    if (lead && lead === gloss) return true;
  }
  return false;
}

export function normalizeTlNoteItems(items: string[]): string[] {
  if (items.length > MAX_TL_NOTE_ITEMS) invalidTlNote();
  const seen = new Set<string>();
  return items.map((item) => {
    const trimmed = item.trim();
    const key = normalizedComparisonKey(trimmed);
    if (
      !trimmed
      || unicodeCodePointLength(trimmed) > MAX_TL_NOTE_ITEM_CHARACTERS
      || /[\r\n]/u.test(trimmed)
      || repeatsTermInParenthetical(trimmed)
      || seen.has(key)
    ) {
      invalidTlNote();
    }
    seen.add(key);
    return trimmed;
  });
}

export function appendTlNotes(body: string, notes: string[]): string {
  const normalized = normalizeTlNoteItems(notes);
  if (normalized.length === 0) return body;
  if (body.includes(TL_NOTE_MARKER)) invalidTlNote();
  return `${body.trimEnd()}${TL_NOTE_MARKER}${normalized.join("\n")}`;
}

export function splitTlNoteSuffix(body: string): {
  prose: string;
  notes: string[];
} {
  const markerIndex = body.lastIndexOf(TL_NOTE_MARKER);
  if (markerIndex < 1) return { prose: body, notes: [] };
  const prose = body.slice(0, markerIndex);
  const noteText = body.slice(markerIndex + TL_NOTE_MARKER.length);
  if (
    prose.endsWith("\n")
    || prose.endsWith("\r")
    || !noteText
    || noteText.endsWith("\n")
    || noteText.includes("\n\n")
  ) {
    return { prose: body, notes: [] };
  }
  const notes = noteText.split("\n");
  if (
    !hasEcmascriptTrimmedContent(prose)
    || notes.length < 1
    || notes.length > MAX_TL_NOTE_ITEMS
    || notes.some((item) => (
      !hasEcmascriptTrimmedContent(item)
      || unicodeCodePointLength(item) > MAX_TL_NOTE_ITEM_CHARACTERS
      || item.includes("\r")
    ))
  ) {
    return { prose: body, notes: [] };
  }
  return { prose, notes };
}

export function hasTlNote(body: string): boolean {
  return splitTlNoteSuffix(body).notes.length > 0;
}

export function describeTlNoteRegion(
  body: string,
): { headerLineIndex: number; noteLineIndices: number[] } | null {
  const { prose, notes } = splitTlNoteSuffix(body);
  if (notes.length === 0) return null;
  // The header line sits after the prose lines and the marker's blank line, so
  // its index (over the same /\r?\n/u split contentParagraphs uses) is the
  // prose line count plus one.
  const headerLineIndex = prose.split(/\r?\n/u).length + 1;
  const noteLineIndices = Array.from(
    { length: notes.length },
    (_, offset) => headerLineIndex + 1 + offset,
  );
  return { headerLineIndex, noteLineIndices };
}

export function removeTlNoteAt(body: string, index: number): string {
  const { prose, notes } = splitTlNoteSuffix(body);
  if (index < 0 || index >= notes.length) return body;
  const remaining = notes.filter((_, noteIndex) => noteIndex !== index);
  if (remaining.length === 0) return prose;
  return `${prose}${TL_NOTE_MARKER}${remaining.join("\n")}`;
}

export function removeAllTlNotes(body: string): string {
  const { prose, notes } = splitTlNoteSuffix(body);
  return notes.length > 0 ? prose : body;
}
