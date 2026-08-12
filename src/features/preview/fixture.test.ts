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
});
