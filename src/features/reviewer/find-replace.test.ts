import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  findMatches,
  MAX_REVIEW_BODY_CHARACTERS,
  replaceAllMatches,
  replaceMatchAt,
  splitByMatches,
} from "./find-replace";

describe("findMatches", () => {
  it("returns no matches for an empty query", () => {
    assert.deepEqual(findMatches("Lin walked.", "", false), []);
  });

  it("finds every occurrence with offsets in document order", () => {
    const matches = findMatches("Lin walked. Lin smiled.", "Lin", false);
    assert.deepEqual(matches, [
      { start: 0, end: 3, paragraph: 0 },
      { start: 12, end: 15, paragraph: 0 },
    ]);
  });

  it("is case-insensitive when caseSensitive is false", () => {
    const matches = findMatches("Lin met LIN and lin.", "lin", false);
    assert.equal(matches.length, 3);
  });

  it("matches exactly when caseSensitive is true", () => {
    const matches = findMatches("Lin met LIN and lin.", "Lin", true);
    assert.deepEqual(matches, [{ start: 0, end: 3, paragraph: 0 }]);
  });

  it("does not return overlapping matches", () => {
    assert.deepEqual(findMatches("aaaa", "aa", false), [
      { start: 0, end: 2, paragraph: 0 },
      { start: 2, end: 4, paragraph: 0 },
    ]);
  });

  it("maps matches to paragraph rows, skipping blank lines", () => {
    const body = "First row\n\nSecond row\nThird row has Lin";
    const matches = findMatches(body, "Lin", false);
    assert.deepEqual(matches, [
      { start: body.indexOf("Lin"), end: body.indexOf("Lin") + 3, paragraph: 2 },
    ]);
  });

  it("does not count whitespace-only lines as paragraph rows", () => {
    const body = "First row\n   \nSecond row with Lin";
    const matches = findMatches(body, "Lin", false);
    assert.equal(matches[0]?.paragraph, 1);
  });

  it("handles CRLF newlines when computing paragraph rows", () => {
    const body = "First row\r\n\r\nSecond row with Lin";
    const matches = findMatches(body, "Lin", false);
    assert.equal(matches[0]?.paragraph, 1);
  });

  it("keeps offsets aligned when lowercasing would change string length", () => {
    // "İ" (U+0130) lowercases to a two-code-unit string; naive
    // body.toLowerCase() would shift every later offset.
    const body = "İstanbul x";
    const matches = findMatches(body, "x", false);
    assert.deepEqual(matches, [{ start: 9, end: 10, paragraph: 0 }]);
  });
});

describe("replaceMatchAt", () => {
  it("replaces exactly the matched range", () => {
    const body = "Lin walked. Lin smiled.";
    const [, second] = findMatches(body, "Lin", false);
    assert.equal(replaceMatchAt(body, second!, "Rin"), "Lin walked. Rin smiled.");
  });

  it("supports an empty replacement (deletion)", () => {
    const body = "Lin walked.";
    const [first] = findMatches(body, "Lin ", false);
    assert.equal(replaceMatchAt(body, first!, ""), "walked.");
  });
});

describe("replaceAllMatches", () => {
  it("replaces every match and reports the count", () => {
    const result = replaceAllMatches("Lin met LIN and lin.", "lin", false, "Rin");
    assert.deepEqual(result, { text: "Rin met Rin and Rin.", count: 3 });
  });

  it("returns the body unchanged for an empty query", () => {
    assert.deepEqual(replaceAllMatches("Lin walked.", "", false, "Rin"), {
      text: "Lin walked.",
      count: 0,
    });
  });

  it("respects case sensitivity", () => {
    const result = replaceAllMatches("Lin met lin.", "lin", true, "Rin");
    assert.deepEqual(result, { text: "Lin met Rin.", count: 1 });
  });
});

describe("splitByMatches", () => {
  it("returns one plain segment when there is no query or no match", () => {
    assert.deepEqual(splitByMatches("Lin walked.", "", false), [
      { text: "Lin walked.", match: false, current: false },
    ]);
    assert.deepEqual(splitByMatches("Lin walked.", "Rin", false), [
      { text: "Lin walked.", match: false, current: false },
    ]);
  });

  it("splits into alternating plain and match segments", () => {
    assert.deepEqual(splitByMatches("Lin met Lin.", "Lin", false), [
      { text: "Lin", match: true, current: false },
      { text: " met ", match: false, current: false },
      { text: "Lin", match: true, current: false },
      { text: ".", match: false, current: false },
    ]);
  });

  it("flags only the current match segment when currentIndex is given", () => {
    assert.deepEqual(splitByMatches("Lin met Lin.", "Lin", false, 1), [
      { text: "Lin", match: true, current: false },
      { text: " met ", match: false, current: false },
      { text: "Lin", match: true, current: true },
      { text: ".", match: false, current: false },
    ]);
  });

  it("preserves the original casing of case-insensitive matches", () => {
    assert.deepEqual(splitByMatches("LIN met lin.", "Lin", false), [
      { text: "LIN", match: true, current: false },
      { text: " met ", match: false, current: false },
      { text: "lin", match: true, current: false },
      { text: ".", match: false, current: false },
    ]);
  });

  it("reassembles to the exact input text", () => {
    const text = "Lin met LIN and lin again.";
    const joined = splitByMatches(text, "lin", false)
      .map((segment) => segment.text)
      .join("");
    assert.equal(joined, text);
  });
});

describe("MAX_REVIEW_BODY_CHARACTERS", () => {
  it("matches the review textarea limit", () => {
    assert.equal(MAX_REVIEW_BODY_CHARACTERS, 500_000);
  });
});
