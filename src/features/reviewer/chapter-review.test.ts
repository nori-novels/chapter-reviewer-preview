import assert from "node:assert/strict";
import { describe, it } from "vitest";
import type { GlossaryEntry } from "@/features/preview/types";
import {
  highlightSourceText,
  normalizeReviewParagraphInput,
  pairEditableReviewParagraphs,
  pairReviewParagraphs,
  proportionalScrollTop,
  replaceReviewParagraph,
  replaceReviewParagraphByIdentity,
  requiresApprovalOverride,
} from "./chapter-review";

function entry(source: string, target: string): GlossaryEntry {
  return {
    source,
    target,
    acceptedTargets: [],
    kind: "term",
    gender: "unknown",
    note: "",
    enabled: true,
  };
}

describe("chapter review helpers", () => {
  it("highlights repeated glossary terms in titles and bodies", () => {
    assert.deepEqual(
      highlightSourceText("青云宗与青云宗", [entry("青云宗", "Azure Cloud Sect")]),
      [
        { text: "青云宗", target: "Azure Cloud Sect" },
        { text: "与" },
        { text: "青云宗", target: "Azure Cloud Sect" },
      ],
    );
  });

  it("prefers the longest term when sources overlap", () => {
    assert.deepEqual(
      highlightSourceText("青云宗", [
        entry("青云", "Azure Cloud"),
        entry("青云宗", "Azure Cloud Sect"),
      ]),
      [{ text: "青云宗", target: "Azure Cloud Sect" }],
    );
  });

  it("ignores empty, disabled, and absent terms without changing source text", () => {
    assert.deepEqual(highlightSourceText("原文", []), [{ text: "原文" }]);
    assert.deepEqual(
      highlightSourceText("原文", [{ ...entry("原", "Source"), enabled: false }]),
      [{ text: "原文" }],
    );
  });

  it("pairs nonblank paragraphs by ordinal and ignores whitespace-only lines", () => {
    assert.deepEqual(
      pairReviewParagraphs("甲\n   \n乙\n\t\n丙", "One\n\nTwo"),
      [
        { index: 0, source: "甲", translation: "One" },
        { index: 1, source: "乙", translation: "Two" },
        { index: 2, source: "丙", translation: "" },
      ],
    );
  });

  it("keeps one editable row when both bodies are empty", () => {
    assert.deepEqual(pairReviewParagraphs("", ""), [
      { index: 0, source: "", translation: "" },
    ]);
  });

  it("replaces an English paragraph without changing whitespace separators", () => {
    assert.equal(
      replaceReviewParagraph("One\n   \nTwo\n\t\nThree", 1, "Second"),
      "One\n   \nSecond\n\t\nThree",
    );
  });

  it("appends a newly filled unmatched translation paragraph", () => {
    assert.equal(replaceReviewParagraph("One\n\nTwo", 2, "Third"), "One\n\nTwo\nThird");
    assert.equal(replaceReviewParagraph("", 0, "First"), "First");
    assert.equal(replaceReviewParagraph("One", 1, ""), "One");
  });

  it("preserves CRLF when appending a translation paragraph", () => {
    assert.equal(replaceReviewParagraph("One\r\nTwo", 2, "Third"), "One\r\nTwo\r\nThird");
  });

  it("normalizes multiline aligned input into one paragraph without dropping text", () => {
    assert.equal(
      normalizeReviewParagraphInput("One\r\nNew\nAgain\rLast"),
      "One New Again Last",
    );
  });

  it("keeps an active empty draft at its backing-line position", () => {
    assert.deepEqual(
      pairEditableReviewParagraphs("甲\n乙\n丙", "One\n\n\n\nThree", {
        rowIndex: 1,
        backingLineIndex: 2,
        key: "line:2",
        value: "",
      }).map((pair) => ({
        translation: pair.translation,
        key: pair.translationKey,
        lineIndex: pair.translationLineIndex,
      })),
      [
        { translation: "One", key: "line:0", lineIndex: 0 },
        { translation: "", key: "line:2", lineIndex: 2 },
        { translation: "Three", key: "line:4", lineIndex: 4 },
      ],
    );
  });

  it("replaces a cleared draft through its original backing line", () => {
    const cleared = replaceReviewParagraphByIdentity(
      "One\n\nTwo\n\nThree",
      { rowIndex: 1, backingLineIndex: 2 },
      "",
    );
    assert.deepEqual(cleared, {
      text: "One\n\n\n\nThree",
      backingLineIndex: 2,
    });
    assert.deepEqual(
      replaceReviewParagraphByIdentity(
        cleared.text,
        { rowIndex: 1, backingLineIndex: cleared.backingLineIndex },
        "Replacement",
      ),
      { text: "One\n\nReplacement\n\nThree", backingLineIndex: 2 },
    );
  });

  it("rejects a non-contiguous unmatched translation", () => {
    assert.equal(replaceReviewParagraph("", 2, "Third"), "");
    assert.deepEqual(
      replaceReviewParagraphByIdentity(
        "",
        { rowIndex: 2, backingLineIndex: null },
        "Third",
      ),
      { text: "", backingLineIndex: null },
    );
  });

  it("maps scroll progress between differently sized panes", () => {
    assert.equal(
      proportionalScrollTop(
        { scrollTop: 400, scrollHeight: 1000, clientHeight: 200 },
        { scrollHeight: 600, clientHeight: 200 },
      ),
      200,
    );
    assert.equal(
      proportionalScrollTop(
        { scrollTop: 0, scrollHeight: 100, clientHeight: 100 },
        { scrollHeight: 600, clientHeight: 200 },
      ),
      0,
    );
  });

  it.each([
    ["needs_override", "pending", true],
    ["needs_override", "approved", false],
    ["complete", "pending", false],
  ])(
    "derives override approval from %s plus %s",
    (pipelineStatus, approvalStatus, expected) => {
      assert.equal(
        requiresApprovalOverride({ pipelineStatus, approvalStatus }),
        expected,
      );
    },
  );
});
