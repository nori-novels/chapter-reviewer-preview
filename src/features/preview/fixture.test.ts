import { describe, expect, it } from "vitest";
import rawFixture from "./fixture.json";
import { PreviewFixtureSchema } from "./fixture";

const serialized = JSON.stringify(rawFixture);

describe("public preview fixture", () => {
  it("is chapter 25 of obsessed", () => {
    const fixture = PreviewFixtureSchema.parse(rawFixture);
    expect(fixture.novelTitle.toLowerCase()).toBe("obsessed");
    expect(fixture.chapter.ordinal).toBe(25);
    expect(fixture.chapter.sourceBody.length).toBeGreaterThan(0);
    expect(fixture.chapter.translatedBody.length).toBeGreaterThan(0);
  });

  it("contains no private schema or prompt fields", () => {
    expect(serialized).not.toMatch(/importId|created_by|source_url|request_id|model|cost|token/iu);
    expect(serialized).not.toMatch(/prompt|editorPrompt|tlNotePrompt/iu);
    expect(serialized).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/iu);
  });

  it("rejects unknown top-level fields", () => {
    expect(
      PreviewFixtureSchema.safeParse({
        ...rawFixture,
        unexpected: "private",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown chapter detail fields", () => {
    expect(
      PreviewFixtureSchema.safeParse({
        ...rawFixture,
        chapter: {
          ...rawFixture.chapter,
          unexpected: "private",
        },
      }).success,
    ).toBe(false);
  });

  it("rejects unknown chapter summary fields", () => {
    expect(
      PreviewFixtureSchema.safeParse({
        ...rawFixture,
        chapters: rawFixture.chapters.map((chapter, index) =>
          index === 0 ? { ...chapter, unexpected: "private" } : chapter,
        ),
      }).success,
    ).toBe(false);
  });

  it("rejects unknown glossary fields", () => {
    expect(
      PreviewFixtureSchema.safeParse({
        ...rawFixture,
        chapter: {
          ...rawFixture.chapter,
          relevantGlossary: rawFixture.chapter.relevantGlossary.map(
            (entry, index) =>
              index === 0 ? { ...entry, unexpected: "private" } : entry,
          ),
        },
      }).success,
    ).toBe(false);
  });

  it("has exact adjacent chapter summaries without prose", () => {
    const fixture = PreviewFixtureSchema.parse(rawFixture);

    expect(fixture.chapters.map(({ ordinal }) => ordinal)).toEqual([24, 25, 26]);
    for (const summary of fixture.chapters) {
      expect(summary).not.toHaveProperty("sourceTitle");
      expect(summary).not.toHaveProperty("sourceBody");
      expect(summary).not.toHaveProperty("translatedBody");
    }
  });

  it("keeps chapter 25 summary and detail metadata consistent", () => {
    const fixture = PreviewFixtureSchema.parse(rawFixture);
    const summary = fixture.chapters.find(({ ordinal }) => ordinal === 25);

    expect(summary).toEqual({
      ordinal: fixture.chapter.ordinal,
      isPlaceholder: fixture.chapter.isPlaceholder,
      translatedTitle: fixture.chapter.translatedTitle,
      pipelineStatus: fixture.chapter.pipelineStatus,
      approvalStatus: fixture.chapter.approvalStatus,
      editingPassCount: fixture.chapter.editingPassCount,
      adminEdited: fixture.chapter.adminEdited,
      hasTlNote: fixture.chapter.hasTlNote,
    });
  });

  it("contains only enabled glossary entries present in the source", () => {
    const fixture = PreviewFixtureSchema.parse(rawFixture);
    const source = `${fixture.chapter.sourceTitle}\n${fixture.chapter.sourceBody}`;

    expect(fixture.chapter.relevantGlossary.length).toBeGreaterThan(0);
    for (const entry of fixture.chapter.relevantGlossary) {
      expect(entry.enabled).toBe(true);
      expect(source).toContain(entry.source);
    }
  });

  it("derives TL note status from a translated-body suffix", () => {
    const fixture = PreviewFixtureSchema.parse(rawFixture);
    const hasTlNoteSuffix = /(?:^|\n)\s*TL Note:\s*\S[\s\S]*$/u.test(
      fixture.chapter.translatedBody,
    );

    expect(fixture.chapter.hasTlNote).toBe(hasTlNoteSuffix);
  });
});
