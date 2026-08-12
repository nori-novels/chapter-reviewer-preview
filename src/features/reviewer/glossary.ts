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
