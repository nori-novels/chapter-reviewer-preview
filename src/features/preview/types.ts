import type { PreviewFixture } from "./fixture";

export type PreviewChapter = PreviewFixture["chapter"];
export type PreviewChapterSummary = PreviewFixture["chapters"][number];
export type GlossaryEntry = PreviewChapter["relevantGlossary"][number];
