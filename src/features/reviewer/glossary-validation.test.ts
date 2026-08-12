import { expect, it } from "vitest";
import type { GlossaryEntry } from "@/features/preview/types";
import {
  glossaryValidationMessages,
  validateGlossaryEntryIssues,
} from "./glossary-validation";

function entry(overrides: Partial<GlossaryEntry> = {}): GlossaryEntry {
  return {
    source: "席瑶",
    target: "Xi Yao",
    acceptedTargets: [],
    kind: "character",
    gender: "female",
    note: "",
    enabled: true,
    ...overrides,
  };
}

it("accepts a well-formed glossary", () => {
  expect(validateGlossaryEntryIssues([entry(), entry({ source: "席玉", target: "Xi Yu" })]))
    .toEqual([]);
});

it("requires a source and a canonical target", () => {
  const issues = validateGlossaryEntryIssues([entry({ source: " ", target: "" })]);

  expect(issues.map(({ code }) => code)).toEqual(["source_required", "target_required"]);
  expect(glossaryValidationMessages([entry({ source: " ", target: "" })], issues)).toEqual([
    "Row 1: source is required.",
    "Row 1: canonical target is required.",
  ]);
});

it("flags every repeat of a normalized source but keeps the first row clean", () => {
  const entries = [entry(), entry({ target: "Xi Yao Two" }), entry({ target: "Xi Yao Three" })];

  expect(validateGlossaryEntryIssues(entries)
    .filter(({ code }) => code === "duplicate_source")
    .map(({ rowIndex }) => rowIndex)).toEqual([1, 2]);
});

it("collapses a duplicate canonical target into one message naming the target", () => {
  const entries = [entry(), entry({ source: "席玉" })];
  const issues = validateGlossaryEntryIssues(entries);

  expect(issues.filter(({ code }) => code === "duplicate_target").map(({ rowIndex }) => rowIndex))
    .toEqual([0, 1]);
  expect(glossaryValidationMessages(entries, issues)).toEqual([
    "duplicate canonical target: Xi Yao",
  ]);
});

it("ignores disabled rows when detecting duplicate targets", () => {
  expect(validateGlossaryEntryIssues([entry(), entry({ source: "席玉", enabled: false })]))
    .toEqual([]);
});

it("bounds field lengths and accepted target counts", () => {
  const issues = validateGlossaryEntryIssues([entry({
    source: "席".repeat(101),
    target: "X".repeat(151),
    note: "n".repeat(301),
    acceptedTargets: Array.from({ length: 13 }, (_, index) => `variant ${index}`),
  })]);

  expect(issues.map(({ code }) => code)).toEqual([
    "source_too_long",
    "target_too_long",
    "note_too_long",
    "too_many_accepted_targets",
  ]);
});

it("flags an over-long accepted target", () => {
  expect(validateGlossaryEntryIssues([entry({ acceptedTargets: ["X".repeat(151)] })])
    .map(({ code }) => code)).toEqual(["accepted_target_too_long"]);
});
