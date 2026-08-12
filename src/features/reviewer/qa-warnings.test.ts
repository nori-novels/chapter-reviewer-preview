import assert from "node:assert/strict";
import { describe, it } from "vitest";

import type { GlossaryEntry } from "@/features/preview/types";
import { collectQaWarnings, qaWarningKey, type QaWarning } from "./qa-warnings";

function entry(overrides: Partial<GlossaryEntry> & Pick<GlossaryEntry, "source" | "target">): GlossaryEntry {
  return {
    acceptedTargets: [],
    kind: "character",
    gender: "unknown",
    note: "",
    enabled: true,
    ...overrides,
  };
}

function byType(warnings: QaWarning[], type: QaWarning["type"]) {
  return warnings.filter((warning) => warning.type === type);
}

describe("collectQaWarnings", () => {
  it("reports glossary mismatches with title and paragraph occurrences", () => {
    const warnings = collectQaWarnings({
      sourceTitle: "第24章 奶奶礼物",
      sourceBody: "纪言低声问道。\n奶奶看着他。\n他点了点头。",
      translatedTitle: "Chapter 24: A Gift",
      translatedBody: "Ji Yan asked quietly.\nThe old lady looked at him.\nHe nodded.",
      glossary: [
        entry({ source: "奶奶", target: "Grandmother", kind: "title" }),
        entry({ source: "纪言", target: "Ji Yan" }),
      ],
    });

    const mismatches = byType(warnings, "glossary_mismatch");
    assert.equal(mismatches.length, 1);
    const mismatch = mismatches[0];
    assert.equal(mismatch.type, "glossary_mismatch");
    if (mismatch.type !== "glossary_mismatch") return;
    assert.equal(mismatch.entry.source, "奶奶");
    assert.deepEqual(
      mismatch.occurrences.map((occurrence) => occurrence.paragraph),
      ["title", 1],
    );
  });

  it("accepts glossary accepted targets and title-only matches", () => {
    const warnings = collectQaWarnings({
      sourceTitle: "奶奶",
      sourceBody: "别的段落。",
      translatedTitle: "Granny",
      translatedBody: "Another paragraph.",
      glossary: [entry({
        source: "奶奶",
        target: "Grandmother",
        acceptedTargets: ["Granny"],
        kind: "title",
      })],
    });

    assert.equal(byType(warnings, "glossary_mismatch").length, 0);
  });

  it("reports han residue occurrences with snippets", () => {
    const warnings = collectQaWarnings({
      sourceTitle: "第1章",
      sourceBody: "第一段。\n第二段。",
      translatedTitle: "Chapter 一 One",
      translatedBody: "First paragraph.\nSecond 段落 paragraph 测试.",
      glossary: [],
    });

    const [han] = byType(warnings, "han_residue");
    assert.ok(han && han.type === "han_residue");
    if (han.type !== "han_residue") return;
    assert.deepEqual(
      han.occurrences.map((occurrence) => occurrence.paragraph),
      ["title", 1],
    );
    assert.deepEqual(han.snippets, ["一", "段落", "测试"]);
  });

  it("flags wrong-gender pronouns for a known character", () => {
    const warnings = collectQaWarnings({
      sourceTitle: "第1章",
      sourceBody: "纪言低声问道。\n纪言点了点头。\n纪言离开了。",
      translatedTitle: "Chapter 1",
      translatedBody: "Ji Yan asked quietly, and he frowned.\nJi Yan nodded. She left early.\nJi Yan left; her steps were light.",
      glossary: [entry({ source: "纪言", target: "Ji Yan", gender: "female" })],
    });

    const [pronoun] = byType(warnings, "pronoun");
    assert.ok(pronoun && pronoun.type === "pronoun");
    if (pronoun.type !== "pronoun") return;
    assert.equal(pronoun.character.target, "Ji Yan");
    assert.equal(pronoun.expectedPronouns, "she/her");
    assert.deepEqual(
      pronoun.occurrences.map((occurrence) => occurrence.paragraph),
      [0],
    );
  });

  it("suppresses pronoun findings when an opposite-gender character shares the paragraph", () => {
    const warnings = collectQaWarnings({
      sourceTitle: "第1章",
      sourceBody: "纪言看着老爷子，他笑了。",
      translatedTitle: "Chapter 1",
      translatedBody: "Ji Yan looked at the old master, and he smiled.",
      glossary: [
        entry({ source: "纪言", target: "Ji Yan", gender: "female" }),
        entry({ source: "老爷子", target: "Old Master", gender: "male" }),
      ],
    });

    assert.equal(byType(warnings, "pronoun").length, 0);
  });

  it("ignores pronoun checks for unknown genders, disabled entries, and non-characters", () => {
    const warnings = collectQaWarnings({
      sourceTitle: "第1章",
      sourceBody: "纪言问道。\n王府很大。",
      translatedTitle: "Chapter 1",
      translatedBody: "He asked.\nHe walked around the estate.",
      glossary: [
        entry({ source: "纪言", target: "Ji Yan", gender: "unknown" }),
        entry({ source: "纪言", target: "Ji Yan 2", gender: "female", enabled: false }),
        entry({ source: "王府", target: "the estate", kind: "place", gender: "female" }),
      ],
    });

    assert.equal(byType(warnings, "pronoun").length, 0);
  });

  it("matches pronoun tokens on word boundaries only", () => {
    const warnings = collectQaWarnings({
      sourceTitle: "第1章",
      sourceBody: "纪言在这里。",
      translatedTitle: "Chapter 1",
      translatedBody: "Ji Yan stood by the shed with hers-truly nowhere in sight, hemmed in.",
      glossary: [entry({ source: "纪言", target: "Ji Yan", gender: "male" })],
    });

    // "shed" and "hemmed" must not count as she/her; "hers" appears only as a
    // hyphenated token which normalization splits into a real token.
    const [pronoun] = byType(warnings, "pronoun");
    assert.ok(pronoun && pronoun.type === "pronoun");
    if (pronoun.type !== "pronoun") return;
    assert.equal(pronoun.expectedPronouns, "he/him");
    assert.deepEqual(pronoun.occurrences.map((occurrence) => occurrence.paragraph), [0]);
  });

  it("reports paragraph-break mismatches with the unmatched rows", () => {
    const warnings = collectQaWarnings({
      sourceTitle: "第1章",
      sourceBody: "一。\n二。\n三。\n四。",
      translatedTitle: "Chapter 1",
      translatedBody: "One.\nTwo and three.",
      glossary: [],
    });

    const [paragraphs] = byType(warnings, "paragraph_breaks");
    assert.ok(paragraphs && paragraphs.type === "paragraph_breaks");
    if (paragraphs.type !== "paragraph_breaks") return;
    assert.equal(paragraphs.sourceCount, 4);
    assert.equal(paragraphs.translationCount, 2);
    assert.deepEqual(
      paragraphs.occurrences.map((occurrence) => occurrence.paragraph),
      [2, 3],
    );
  });

  it("excludes the TL note suffix from every check", () => {
    const warnings = collectQaWarnings({
      sourceTitle: "第1章",
      sourceBody: "纪言问道。\n结束了。",
      translatedTitle: "Chapter 1",
      translatedBody: "Ji Yan asked.\nIt was over.\n\nTL Note:\n- 纪言 means he said 一 with her.",
      glossary: [entry({ source: "纪言", target: "Ji Yan", gender: "male" })],
    });

    assert.equal(warnings.length, 0);
  });

  it("returns no warnings for a clean chapter", () => {
    const warnings = collectQaWarnings({
      sourceTitle: "第1章 纪言",
      sourceBody: "纪言低声问道。\n没有别的了。",
      translatedTitle: "Chapter 1: Ji Yan",
      translatedBody: "Ji Yan asked quietly.\nThere was nothing else.",
      glossary: [entry({ source: "纪言", target: "Ji Yan", gender: "female" })],
    });

    assert.deepEqual(warnings, []);
  });

  it("handles an empty translation body without crashing", () => {
    const warnings = collectQaWarnings({
      sourceTitle: "第1章",
      sourceBody: "一。\n二。",
      translatedTitle: "",
      translatedBody: "",
      glossary: [],
    });

    const [paragraphs] = byType(warnings, "paragraph_breaks");
    assert.ok(paragraphs && paragraphs.type === "paragraph_breaks");
    if (paragraphs.type !== "paragraph_breaks") return;
    assert.deepEqual(
      paragraphs.occurrences.map((occurrence) => occurrence.paragraph),
      [0, 1],
    );
  });

  it("orders warnings glossary, han, pronoun, paragraphs and keys them stably", () => {
    const warnings = collectQaWarnings({
      sourceTitle: "第1章 奶奶",
      sourceBody: "纪言问道。\n奶奶看了看。\n多余的一段。",
      translatedTitle: "Chapter 1: Granny 一",
      translatedBody: "He asked about it.\nThe old lady looked around.",
      glossary: [
        entry({ source: "奶奶", target: "Grandmother", kind: "title" }),
        entry({ source: "纪言", target: "Ji Yan", gender: "female" }),
      ],
    });

    assert.deepEqual(warnings.map((warning) => warning.type), [
      "glossary_mismatch",
      "glossary_mismatch",
      "han_residue",
      "pronoun",
      "paragraph_breaks",
    ]);
    assert.deepEqual(warnings.map(qaWarningKey), [
      "glossary_mismatch:奶奶",
      "glossary_mismatch:纪言",
      "han_residue",
      "pronoun:纪言",
      "paragraph_breaks",
    ]);
  });

  it("emits no occurrences for an entry whose target lands anywhere in the body", () => {
    // Rows 0 and 2 carry the target; row 1 does not. Presence in the body
    // clears the entry for the chapter, so nothing is reportable.
    const warnings = collectQaWarnings({
      sourceTitle: "第1章",
      sourceBody: "青云宗在此。\n青云宗的弟子来了。\n青云宗屹立。",
      translatedTitle: "Chapter 1",
      translatedBody: "Azure Cloud Sect stands here.\nIts disciples arrived.\nThe Azure Cloud Sect endures.",
      glossary: [entry({ source: "青云宗", target: "Azure Cloud Sect", kind: "organization" })],
    });

    assert.deepEqual(byType(warnings, "glossary_mismatch"), []);
  });

  it("points the occurrence at the drifted translation row when counts differ", () => {
    const warnings = collectQaWarnings({
      sourceTitle: "第1章",
      sourceBody: "一句。\n两句。\n三句。\n纪言离开。",
      translatedTitle: "Chapter 1",
      translatedBody: "One and two.\nThree.\nHe left.",
      glossary: [entry({ source: "纪言", target: "Ji Yan" })],
    });

    const [mismatch] = byType(warnings, "glossary_mismatch");
    assert.ok(mismatch && mismatch.type === "glossary_mismatch");
    if (mismatch.type !== "glossary_mismatch") return;
    assert.deepEqual(mismatch.occurrences, [{ paragraph: 3, translationParagraph: 2 }]);
  });

  it("suppresses a character's paragraph misses once the name lands in the body", () => {
    const warnings = collectQaWarnings({
      sourceTitle: "第1章",
      sourceBody: "纪言问道。\n纪言点头。\n纪言离开。",
      translatedTitle: "Chapter 1",
      translatedBody: "Ji Yan asked.\nHe nodded.\nHe left.",
      glossary: [entry({ source: "纪言", target: "Ji Yan" })],
    });

    assert.deepEqual(byType(warnings, "glossary_mismatch"), []);
  });

  it("keeps only the title occurrence for a character established in the body", () => {
    const warnings = collectQaWarnings({
      sourceTitle: "沈清秋的剑",
      sourceBody: "沈清秋走进房间。\n沈清秋拿起剑。",
      translatedTitle: "His Sword",
      translatedBody: "Shen Qingqiu walked into the room.\nHe picked up the sword.",
      glossary: [entry({ source: "沈清秋", target: "Shen Qingqiu" })],
    });

    const mismatches = byType(warnings, "glossary_mismatch");
    assert.equal(mismatches.length, 1);
    const mismatch = mismatches[0];
    if (mismatch.type !== "glossary_mismatch") return;
    // The title miss blocks, so it is shown. Paragraph 1's miss does not, so it
    // is not.
    assert.deepEqual(
      mismatch.occurrences.map((occurrence) => occurrence.paragraph),
      ["title"],
    );
  });

  it("keeps only the title occurrence for a non-character entry whose target lands in the body", () => {
    // Presence is measured over the body only and never excuses the title:
    // the body carries the target, yet the translated title dropped it.
    const warnings = collectQaWarnings({
      sourceTitle: "青云宗的秘密",
      sourceBody: "青云宗在此。",
      translatedTitle: "The Secret",
      translatedBody: "Azure Cloud Sect stands here.",
      glossary: [entry({ source: "青云宗", target: "Azure Cloud Sect", kind: "organization" })],
    });

    const mismatches = byType(warnings, "glossary_mismatch");
    assert.equal(mismatches.length, 1);
    const mismatch = mismatches[0];
    if (mismatch.type !== "glossary_mismatch") return;
    assert.deepEqual(
      mismatch.occurrences.map((occurrence) => occurrence.paragraph),
      ["title"],
    );
  });

  it("keeps every paragraph for a character whose name never appears", () => {
    const warnings = collectQaWarnings({
      sourceTitle: "第1章",
      sourceBody: "沈清秋走进房间。\n沈清秋拿起剑。",
      translatedTitle: "Chapter 1",
      translatedBody: "He walked into the room.\nHe picked up the sword.",
      glossary: [entry({ source: "沈清秋", target: "Shen Qingqiu" })],
    });

    const mismatches = byType(warnings, "glossary_mismatch");
    assert.equal(mismatches.length, 1);
    const mismatch = mismatches[0];
    if (mismatch.type !== "glossary_mismatch") return;
    assert.deepEqual(
      mismatch.occurrences.map((occurrence) => occurrence.paragraph),
      [0, 1],
    );
  });

  it("emits every occurrence for a non-character entry absent from the body", () => {
    const warnings = collectQaWarnings({
      sourceTitle: "第1章",
      sourceBody: "青云宗在此。\n青云宗的弟子来了。",
      translatedTitle: "Chapter 1",
      translatedBody: "The sect stands here.\nIts disciples arrived.",
      glossary: [entry({ source: "青云宗", target: "Azure Cloud Sect", kind: "organization" })],
    });

    const mismatches = byType(warnings, "glossary_mismatch");
    assert.equal(mismatches.length, 1);
    const mismatch = mismatches[0];
    if (mismatch.type !== "glossary_mismatch") return;
    assert.deepEqual(mismatch.occurrences, [
      { paragraph: 0, translationParagraph: 0 },
      { paragraph: 1, translationParagraph: 1 },
    ]);
  });

  it("does not let the translated title establish a character for the body", () => {
    const warnings = collectQaWarnings({
      sourceTitle: "沈清秋的剑",
      sourceBody: "沈清秋走进房间。\n沈清秋拿起剑。",
      translatedTitle: "Shen Qingqiu's Sword",
      translatedBody: "He walked into the room.\nHe picked up the sword.",
      glossary: [entry({ source: "沈清秋", target: "Shen Qingqiu" })],
    });

    const mismatches = byType(warnings, "glossary_mismatch");
    assert.equal(mismatches.length, 1);
    const mismatch = mismatches[0];
    if (mismatch.type !== "glossary_mismatch") return;
    // The translated title carries the name, so there is no title mismatch.
    // But establishment only looks at the body, so the name never appearing
    // there means both pronoun-only paragraphs still miss.
    assert.deepEqual(
      mismatch.occurrences.map((occurrence) => occurrence.paragraph),
      [0, 1],
    );
  });
});
