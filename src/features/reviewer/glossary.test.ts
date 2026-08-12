import { expect, it } from "vitest";
import { glossaryUsageBySource, normalizeGlossaryMatch } from "./glossary";

it("normalizes punctuation, case, and whitespace for comparison", () => {
  expect(normalizeGlossaryMatch("  Xi  Yao's,  ")).toBe("xi yao s");
  expect(normalizeGlossaryMatch("席瑶")).toBe("席瑶");
});

it("counts non-overlapping source occurrences", () => {
  const usage = glossaryUsageBySource("席瑶 met 席玉. 席瑶 left.", ["席瑶", "席玉", "洛怡然"]);

  expect(usage.get("席瑶")).toBe(2);
  expect(usage.get("席玉")).toBe(1);
  expect(usage.get("洛怡然")).toBe(0);
});

it("does not double count overlapping runs of the same term", () => {
  expect(glossaryUsageBySource("aaaa", ["aa"]).get("aa")).toBe(2);
});

it("ignores empty sources and repeated lookups", () => {
  const usage = glossaryUsageBySource("席瑶", ["", "席瑶", "席瑶"]);

  expect(usage.get("")).toBe(0);
  expect(usage.get("席瑶")).toBe(1);
  expect(usage.size).toBe(2);
});
