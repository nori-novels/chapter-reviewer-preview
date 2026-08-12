import { z } from "zod";
import rawFixture from "./fixture.json";

const GlossaryEntrySchema = z
  .object({
    source: z.string().min(1).max(100),
    target: z.string().min(1).max(150),
    acceptedTargets: z.array(z.string().min(1).max(150)).max(12),
    kind: z.enum(["character", "title", "place", "organization", "term"]),
    gender: z.enum(["female", "male", "nonbinary", "unknown"]),
    note: z.string().max(300),
    enabled: z.boolean(),
  })
  .strict();

const ChapterSummarySchema = z
  .object({
    ordinal: z.number().int().positive(),
    isPlaceholder: z.literal(false),
    translatedTitle: z.string().nullable(),
    pipelineStatus: z.string(),
    approvalStatus: z.string(),
    editingPassCount: z.union([z.literal(0), z.literal(1)]),
    adminEdited: z.boolean(),
    hasTlNote: z.boolean(),
  })
  .strict();

const ChapterDetailSchema = ChapterSummarySchema.extend({
  ordinal: z.literal(25),
  sourceTitle: z.string(),
  sourceBody: z.string().min(1),
  translatedBody: z.string().min(1),
  deterministicQaCodes: z.array(z.string()),
  relevantGlossary: z.array(GlossaryEntrySchema),
}).strict();

export const PreviewFixtureSchema = z
  .object({
    novelTitle: z.string().min(1).max(200),
    chapters: z.array(ChapterSummarySchema).length(3),
    chapter: ChapterDetailSchema,
  })
  .strict();

export type PreviewFixture = z.infer<typeof PreviewFixtureSchema>;

const parsedFixture = PreviewFixtureSchema.safeParse(rawFixture);

export const previewFixture: PreviewFixture | null = parsedFixture.success
  ? parsedFixture.data
  : null;
