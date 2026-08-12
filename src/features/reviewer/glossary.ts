// Normalizes text for deterministic, display-independent glossary comparison.
const PUNCTUATION_PATTERN = /[\p{P}]+/gu;
const WHITESPACE_PATTERN = /\s+/gu;

export function normalizeGlossaryMatch(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(PUNCTUATION_PATTERN, " ")
    .replace(WHITESPACE_PATTERN, " ")
    .trim();
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

// Non-overlapping occurrences of each glossary source in the chapter's source
// text. The glossary editor shows this as each entry's usage so the busiest
// terms sort to the top of the table.
export function glossaryUsageBySource(
  text: string,
  sources: readonly string[],
): Map<string, number> {
  const usage = new Map<string, number>();
  for (const source of sources) {
    if (usage.has(source)) continue;
    usage.set(source, countOccurrences(text, source));
  }
  return usage;
}
