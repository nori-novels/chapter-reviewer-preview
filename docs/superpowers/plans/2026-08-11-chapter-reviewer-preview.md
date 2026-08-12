# Chapter Reviewer Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a public, static Vercel preview of the Nori Novels reviewer using chapter 25 of "obsessed" from staging.

**Architecture:** A static Next.js export imports one validated chapter fixture into a client-only preview controller. Pure reviewer UI and QA utilities are ported from `../norinovels-admin`, while all admin API, authentication, database, analytics, and mutation dependencies are replaced by local state or one guarded toast handler.

**Tech Stack:** Next.js 16.2.10, React 19.2.4, TypeScript 5, Zod 4.4.3, Vitest 4.1.10, Testing Library, Playwright 1.61.1, Vercel static hosting

## Global Constraints

- The public repository is `nori-novels/chapter-reviewer-preview`; verify the active GitHub identity is exactly `BDZendure` before creating it or pushing.
- Work on `staging`. Do not push to or merge into `main`.
- Serve the full-screen reviewer at `/` with no landing page or login.
- Include only chapter 25 of "obsessed" as a static, reviewed fixture.
- Include no authentication, Supabase client, API route, analytics client, environment variable, staging URL, internal UUID, model configuration, original prompt, or admin Git history.
- All editable state is browser-memory state and resets on reload.
- The exact guarded-action toast is `This function is not available in the preview.`
- The Retranslate fields are titled `Prompt 1`, `Prompt 2`, and `Prompt 3` and all start with the exact synthetic prompt defined in Task 5.
- Application interactions make no data or mutation network requests after the static application assets load.
- Treat every committed fixture value as permanently public.

## File Structure

```text
chapter-reviewer-preview/
├── CLAUDE.md                         # Repository-specific safety and commands
├── README.md                         # Local setup, verification, and deployment notes
├── e2e/preview.spec.ts               # Desktop/mobile user journey and network assertion
├── playwright.config.ts              # Static preview E2E server
├── public/                           # Only genuinely public static assets
├── scripts/scan-public-build.mjs     # Source/build forbidden-value scanner
├── src/app/globals.css               # Admin-compatible global design tokens
├── src/app/layout.tsx                # Figtree and ToastProvider
├── src/app/page.tsx                  # Validated fixture entry point
├── src/components/Button/*           # Ported button primitive
├── src/components/Toast/*            # Ported toast primitive
├── src/features/preview/
│   ├── copy.ts                       # Exact toast and anonymized prompt constants
│   ├── fixture.json                  # Sanitized chapter 25 snapshot
│   ├── fixture.ts                    # Zod schema and build-time parse
│   ├── fixture.test.ts               # Schema and privacy-contract tests
│   └── types.ts                      # Minimal preview-only domain types
├── src/features/reviewer/
│   ├── PreviewChapterReviewer.tsx    # Full-screen controller and action guard
│   ├── PreviewRetryModal.tsx          # Local anonymized Retranslate modal
│   ├── ChapterComparison.tsx          # Ported source/English panes
│   ├── ChapterIndexMenu.tsx           # Discoverable synthetic chapter navigation
│   ├── ChapterQaSidebar.tsx           # Ported QA rail
│   ├── ChapterReviewMetadata.tsx      # Ported status cluster
│   ├── FindReplacePanel.tsx           # Ported local editing tool
│   ├── *.module.css                   # Reviewer, retry, and index styles
│   ├── chapter-review.ts              # Pure alignment/highlight/preferences logic
│   ├── find-replace.ts                # Pure find/replace logic
│   ├── glossary.ts                    # Minimal glossary normalization/validation
│   ├── han.ts                         # Han detection used by local QA
│   ├── qa-warnings.ts                 # Pure warning collection
│   └── tl-note.ts                     # Pure TL-note parsing/editing
├── src/features/reviewer/*.test.ts    # Pure utility tests
├── src/features/reviewer/*.component.test.tsx
├── vercel.json                        # Static-output Vercel configuration
├── vitest.config.ts                   # jsdom component/unit test configuration
└── vitest.setup.ts                    # jest-dom setup
```

---

### Task 1: Static application scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next-env.d.ts`
- Create: `eslint.config.mjs`
- Create: `next.config.ts`
- Create: `vercel.json`
- Create: `.gitignore`
- Create: `CLAUDE.md`
- Create: `README.md`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `src/app/page.component.test.tsx`
- Copy: `../norinovels-admin/src/components/Button/*` to `src/components/Button/`
- Copy: `../norinovels-admin/src/components/Toast/*` to `src/components/Toast/`

**Interfaces:**
- Consumes: The clean repository and approved design spec.
- Produces: `npm run dev`, `npm run test`, `npm run lint`, `npm run build`, and the `@/*` alias. `src/app/page.tsx` initially renders `Chapter reviewer preview` as a scaffold assertion.

- [ ] **Step 1: Write the failing page smoke test**

```tsx
// src/app/page.component.test.tsx
import { render, screen } from "@testing-library/react";
import Page from "./page";

it("renders the chapter reviewer preview entry point", () => {
  render(<Page />);
  expect(screen.getByText("Chapter reviewer preview")).toBeInTheDocument();
});
```

- [ ] **Step 2: Add exact package and test configuration**

```json
{
  "name": "chapter-reviewer-preview",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "npx serve out",
    "lint": "eslint .",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "scan:public": "node scripts/scan-public-build.mjs"
  },
  "dependencies": {
    "next": "16.2.10",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@playwright/test": "1.61.1",
    "@testing-library/jest-dom": "6.9.1",
    "@testing-library/react": "16.3.2",
    "@testing-library/user-event": "14.6.3",
    "@types/node": "20.19.9",
    "@types/react": "19.1.9",
    "@types/react-dom": "19.1.7",
    "eslint": "9.32.0",
    "eslint-config-next": "16.2.10",
    "jsdom": "29.1.1",
    "serve": "14.2.4",
    "typescript": "5.9.2",
    "vitest": "4.1.10"
  }
}
```

```ts
// next.config.ts
import type { NextConfig } from "next";

const config: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default config;
```

```ts
// vitest.config.ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.component.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

- [ ] **Step 3: Add the minimal page, layout, static Vercel config, repository guidance, and copied primitives**

```tsx
// src/app/page.tsx
export default function Page() {
  return <main>Chapter reviewer preview</main>;
}
```

```json
// vercel.json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": "out"
}
```

In `CLAUDE.md`, record the Global Constraints above and the five npm verification commands. In `README.md`, describe the public-static purpose, `npm install`, `npm run dev`, verification commands, and that the fixture is public and frontend-only. Copy the Button and Toast directories mechanically, preserving their current CSS.

- [ ] **Step 4: Install and prove the scaffold**

Run: `npm install`

Run: `npm run test -- src/app/page.component.test.tsx`

Expected: one passing test and no unhandled jsdom errors.

Run: `npm run lint && npm run build`

Expected: lint exits 0 and Next produces `out/index.html` without server routes.

- [ ] **Step 5: Commit the scaffold**

```bash
git add .gitignore CLAUDE.md README.md package.json package-lock.json tsconfig.json next-env.d.ts eslint.config.mjs next.config.ts vercel.json vitest.config.ts vitest.setup.ts src/app src/components
git commit -m "chore: scaffold static reviewer preview"
```

---

### Task 2: Validated and sanitized chapter fixture

**Files:**
- Create: `src/features/preview/types.ts`
- Create: `src/features/preview/fixture.ts`
- Create: `src/features/preview/fixture.json`
- Create: `src/features/preview/fixture.test.ts`
- Modify: `.gitignore`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: A one-time, read-only staging query for the latest exact-title match `obsessed` and ordinal `25`.
- Produces: `PreviewFixture`, `PreviewChapter`, `PreviewChapterSummary`, `GlossaryEntry`, and `previewFixture`, containing no database identity or prompts.

- [ ] **Step 1: Write schema and privacy-contract tests**

```ts
// src/features/preview/fixture.test.ts
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
```

- [ ] **Step 2: Define the minimal preview schema**

```ts
// src/features/preview/fixture.ts
import { z } from "zod";
import rawFixture from "./fixture.json";

const GlossaryEntrySchema = z.object({
  source: z.string().min(1).max(100),
  target: z.string().min(1).max(150),
  acceptedTargets: z.array(z.string().min(1).max(150)).max(12),
  kind: z.enum(["character", "title", "place", "organization", "term"]),
  gender: z.enum(["female", "male", "nonbinary", "unknown"]),
  note: z.string().max(300),
  enabled: z.boolean(),
});

const ChapterSummarySchema = z.object({
  ordinal: z.number().int().positive(),
  isPlaceholder: z.literal(false),
  translatedTitle: z.string().nullable(),
  pipelineStatus: z.string(),
  approvalStatus: z.string(),
  editingPassCount: z.union([z.literal(0), z.literal(1)]),
  adminEdited: z.boolean(),
  hasTlNote: z.boolean(),
});

export const PreviewFixtureSchema = z.object({
  novelTitle: z.string().min(1).max(200),
  chapters: z.array(ChapterSummarySchema).length(3),
  chapter: ChapterSummarySchema.extend({
    ordinal: z.literal(25),
    sourceTitle: z.string(),
    sourceBody: z.string().min(1),
    translatedBody: z.string().min(1),
    deterministicQaCodes: z.array(z.string()),
    relevantGlossary: z.array(GlossaryEntrySchema),
  }),
});

export type PreviewFixture = z.infer<typeof PreviewFixtureSchema>;
const parsedFixture = PreviewFixtureSchema.safeParse(rawFixture);
export const previewFixture: PreviewFixture | null = parsedFixture.success
  ? parsedFixture.data
  : null;
```

```ts
// src/features/preview/types.ts
import type { PreviewFixture } from "./fixture";

export type PreviewChapter = PreviewFixture["chapter"];
export type PreviewChapterSummary = PreviewFixture["chapters"][number];
export type GlossaryEntry = PreviewChapter["relevantGlossary"][number];
```

This file defines no database or importer identity types.

- [ ] **Step 3: Read chapter 25 from staging without reading prompts**

Using the project-connected Supabase staging tool authenticated as `BDZendure`, run this single read-only select so no import UUID appears in the returned export:

```sql
with chosen_import as (
  select id, title, chapter_count, glossary
  from public.novel_imports
  where lower(title) = 'obsessed'
  order by updated_at desc
  limit 1
)
select i.title, i.chapter_count, i.glossary,
       c.ordinal, c.source_title, c.source_body,
       c.translated_title, c.translated_body,
       c.pipeline_status, c.approval_status,
       c.editing_pass_count, c.admin_edited,
       c.qa_findings, c.error_code
from chosen_import i
join public.novel_import_chapters c on c.import_id = i.id
where c.ordinal = 25;
```

Do not select `prompt`, `editor_prompt`, `tl_note_prompt`, model-call rows, user IDs, URLs, events, token fields, or costs. Keep any raw connector output outside the repository. Add `.private/` to `.gitignore` before using a temporary local export.

- [ ] **Step 4: Reduce the result to the explicit fixture schema**

Create `fixture.json` with only the schema fields. Set synthetic summaries for ordinals 24 and 26 so navigation is discoverable, but include no prose for them. Filter the import glossary to entries whose enabled source occurs in chapter 25 source title/body, then remove `origin` and any fields outside `GlossaryEntrySchema`. Derive `hasTlNote` from the translated body. Copy only `qa_findings.deterministicCodes` into `deterministicQaCodes`.

- [ ] **Step 5: Verify the fixture before allowing UI work**

Run: `npm run test -- src/features/preview/fixture.test.ts`

Expected: both schema and privacy tests pass.

Run: `rg -n -i 'prompt|supabase|https?://|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' src/features/preview/fixture.json`

Expected: no matches.

- [ ] **Step 6: Commit the public fixture boundary**

```bash
git add .gitignore src/features/preview src/app/page.tsx
git commit -m "feat: add sanitized obsessed chapter fixture"
```

---

### Task 3: Pure reviewer utilities and presentation dependencies

**Files:**
- Create: `src/features/reviewer/chapter-review.ts`
- Create: `src/features/reviewer/find-replace.ts`
- Create: `src/features/reviewer/glossary.ts`
- Create: `src/features/reviewer/han.ts`
- Create: `src/features/reviewer/qa-warnings.ts`
- Create: `src/features/reviewer/tl-note.ts`
- Create: `src/features/reviewer/copy-to-clipboard.ts`
- Create: `src/features/reviewer/chapter-review.test.ts`
- Create: `src/features/reviewer/find-replace.test.ts`
- Create: `src/features/reviewer/qa-warnings.test.ts`

**Interfaces:**
- Consumes: `GlossaryEntry` from `@/features/preview/types`.
- Produces: `ComparisonPreferences`, paragraph pairing and replacement functions, `collectQaWarnings`, `qaWarningKey`, find/replace match functions, TL-note editing functions, and clipboard support with no server imports.

- [ ] **Step 1: Port the existing pure tests first**

Copy and retarget these tests from `../norinovels-admin/src/app/imports` and `../norinovels-admin/src/features/importer`:

```bash
cp ../norinovels-admin/src/app/imports/chapter-review.test.ts src/features/reviewer/chapter-review.test.ts
cp ../norinovels-admin/src/app/imports/find-replace.test.ts src/features/reviewer/find-replace.test.ts
cp ../norinovels-admin/src/features/importer/qa-warnings.test.ts src/features/reviewer/qa-warnings.test.ts
```

Change only import paths to the preview-local modules. Remove tests for saved-server merge helpers because those helpers must not exist in the preview.

- [ ] **Step 2: Run the tests to prove the modules are absent**

Run: `npm run test -- src/features/reviewer/chapter-review.test.ts src/features/reviewer/find-replace.test.ts src/features/reviewer/qa-warnings.test.ts`

Expected: FAIL with unresolved local reviewer modules.

- [ ] **Step 3: Port and isolate the pure implementations**

Copy the implementations from the admin repository, then make the boundary explicit:

```bash
cp ../norinovels-admin/src/app/imports/chapter-review.ts src/features/reviewer/chapter-review.ts
cp ../norinovels-admin/src/app/imports/find-replace.ts src/features/reviewer/find-replace.ts
cp ../norinovels-admin/src/app/imports/copy-to-clipboard.ts src/features/reviewer/copy-to-clipboard.ts
cp ../norinovels-admin/src/features/importer/qa-warnings.ts src/features/reviewer/qa-warnings.ts
cp ../norinovels-admin/src/features/importer/han.ts src/features/reviewer/han.ts
cp ../norinovels-admin/src/features/importer/tl-note.ts src/features/reviewer/tl-note.ts
```

Replace admin type imports with `@/features/preview/types`. Remove `SavedReviewChapter`, `mergeSavedReviewChapter`, `confirmReviewChapterApproval`, `ImporterError`, and every API-specific export. Extract only the glossary normalization used by QA into `glossary.ts`; it must accept a string and return a normalized comparison string without importing model schemas.

- [ ] **Step 4: Prove behavior and isolation**

Run: `npm run test -- src/features/reviewer/chapter-review.test.ts src/features/reviewer/find-replace.test.ts src/features/reviewer/qa-warnings.test.ts`

Expected: all ported pure tests pass.

Run: `rg -n 'features/importer/client|supabase|ImporterApiError|fetch\(' src/features/reviewer`

Expected: no matches.

- [ ] **Step 5: Commit the pure reviewer layer**

```bash
git add src/features/reviewer
git commit -m "feat: port pure reviewer behavior"
```

---

### Task 4: Full-screen local reviewer controller

**Files:**
- Create: `src/features/preview/copy.ts`
- Create: `src/features/reviewer/PreviewChapterReviewer.tsx`
- Create: `src/features/reviewer/ChapterComparison.tsx`
- Create: `src/features/reviewer/ChapterIndexMenu.tsx`
- Create: `src/features/reviewer/ChapterIndexMarkers.tsx`
- Create: `src/features/reviewer/ChapterQaSidebar.tsx`
- Create: `src/features/reviewer/ChapterReviewMetadata.tsx`
- Create: `src/features/reviewer/FindReplacePanel.tsx`
- Copy: reviewer CSS modules from `../norinovels-admin/src/app/imports/`
- Create: `src/features/reviewer/PreviewChapterReviewer.component.test.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.component.test.tsx`

**Interfaces:**
- Consumes: `previewFixture`, pure reviewer utilities, `ToastProvider`, and `useToast`.
- Produces: `PreviewChapterReviewer({ fixture }: { fixture: PreviewFixture })`, a full-screen interactive reviewer whose guarded actions all call `showPreviewUnavailable()`.

- [ ] **Step 1: Write failing interaction-boundary tests**

```tsx
// src/features/reviewer/PreviewChapterReviewer.component.test.tsx
if (!previewFixture) throw new Error("The committed preview fixture must be valid.");

it.each([
  "Previous chapter",
  "Next chapter",
  "Save changes",
  "Approve",
  "Close chapter review",
])("guards %s with the exact preview toast", async (name) => {
  const user = userEvent.setup();
  render(<ToastProvider><PreviewChapterReviewer fixture={previewFixture} /></ToastProvider>);
  await user.click(screen.getByRole("button", { name }));
  expect(screen.getByText(PREVIEW_UNAVAILABLE_MESSAGE)).toHaveAttribute("data-show", "true");
});

it("keeps title and body edits local", async () => {
  const user = userEvent.setup();
  render(<ToastProvider><PreviewChapterReviewer fixture={previewFixture} /></ToastProvider>);
  const title = screen.getByRole("textbox", { name: /english title/iu });
  await user.clear(title);
  await user.type(title, "Local draft title");
  expect(title).toHaveValue("Local draft title");
});
```

Add separate tests for chapter-index selection, opening Find and replace, toggling Align paragraphs and Sync scrolling, QA selection, and the glossary action toast.

- [ ] **Step 2: Add exact shared preview copy**

```ts
// src/features/preview/copy.ts
export const PREVIEW_UNAVAILABLE_MESSAGE = "This function is not available in the preview.";

export type PreviewGuard = () => void;
```

- [ ] **Step 3: Port presentation components and styles**

Copy `ChapterComparison.tsx`, `ChapterIndexMenu.tsx`, `ChapterIndexMarkers.tsx`, `ChapterQaSidebar.tsx`, `ChapterReviewMetadata.tsx`, `FindReplacePanel.tsx`, `chapterReview.module.css`, and `chapterIndexMarkers.module.css`. Retarget imports to preview types and reviewer utilities. Replace `requiresOverrideReview` with a local expression checking `pipelineStatus === "needs_override" && approvalStatus === "pending"`. Replace `statusLabel` with a local display formatter in `ChapterReviewMetadata.tsx`.

Do not copy `ImporterView`, admin client code, retry client code, glossary mutation modal, state reconciliation, or approval result types.

- [ ] **Step 4: Implement the local controller**

`PreviewChapterReviewer` initializes `title` and `body` from `fixture.chapter`, recomputes warnings locally with `collectQaWarnings`, and owns alignment, sync-scroll, find/replace, warning-selection, index, sidebar, and retry-modal state. Define one stable guard:

```tsx
const { show } = useToast();
const showPreviewUnavailable = useCallback(
  () => show(PREVIEW_UNAVAILABLE_MESSAGE),
  [show],
);
```

Pass this callback to previous/next navigation, non-current chapter index selection, Save, Approve, glossary mutation, and Close. Keep those buttons enabled. Preserve current modal focus trapping and responsive layout, but remove loading, fetch, busy mutation, failed-translation, publication, and unavailable-server branches.

- [ ] **Step 5: Render the validated fixture at the root**

```tsx
// src/app/page.tsx
import { previewFixture } from "@/features/preview/fixture";
import { PreviewChapterReviewer } from "@/features/reviewer/PreviewChapterReviewer";

export default function Page() {
  if (!previewFixture) {
    return <main role="alert">Preview unavailable</main>;
  }
  return <PreviewChapterReviewer fixture={previewFixture} />;
}
```

Update `src/app/page.component.test.tsx` to assert the chapter 25 dialog instead of the removed scaffold text.

- [ ] **Step 6: Run component tests and inspect the page**

Run: `npm run test -- src/features/reviewer/PreviewChapterReviewer.component.test.tsx`

Expected: local tools work and all guarded actions show the exact toast.

Run: `npm run dev -- --port 3200`

Expected visual result: `/` opens directly to the full-screen chapter 25 reviewer with the admin reviewer layout, source/English panes, QA rail, controls, and footer visible.

- [ ] **Step 7: Commit the full reviewer shell**

```bash
git add src/app src/features/preview/copy.ts src/features/reviewer
git commit -m "feat: add interactive static reviewer"
```

---

### Task 5: Anonymized Retranslate modal

**Files:**
- Modify: `src/features/preview/copy.ts`
- Create: `src/features/reviewer/PreviewRetryModal.tsx`
- Copy: `src/features/reviewer/chapterRetry.module.css`
- Create: `src/features/reviewer/PreviewRetryModal.component.test.tsx`
- Modify: `src/features/reviewer/PreviewChapterReviewer.tsx`

**Interfaces:**
- Consumes: `PREVIEW_PROMPT`, `PREVIEW_UNAVAILABLE_MESSAGE`, relevant glossary fixture entries, and the shared preview guard.
- Produces: `PreviewRetryModal({ ordinal, glossary, onClose, onSubmit })`, with local editable fields and no network dependency.

- [ ] **Step 1: Write failing anonymization and submission tests**

```tsx
function RetryHarness() {
  const { show } = useToast();
  return (
    <PreviewRetryModal
      ordinal={25}
      glossary={[]}
      onClose={() => {}}
      onSubmit={() => show(PREVIEW_UNAVAILABLE_MESSAGE)}
    />
  );
}

function renderRetryModal() {
  return render(<ToastProvider><RetryHarness /></ToastProvider>);
}

it("shows three anonymized prompts with the synthetic value", () => {
  renderRetryModal();
  for (const label of ["Prompt 1", "Prompt 2", "Prompt 3"]) {
    expect(screen.getByRole("textbox", { name: label })).toHaveValue(PREVIEW_PROMPT);
  }
  expect(screen.queryByText(/Translation prompt|Editor prompt|TL note prompt/iu)).toBeNull();
});

it("keeps the modal open and guards submission", async () => {
  const user = userEvent.setup();
  renderRetryModal();
  await user.click(screen.getByRole("button", { name: "Retry translation" }));
  expect(screen.getByRole("dialog", { name: /Revise chapter 25/iu })).toBeVisible();
  expect(screen.getByText(PREVIEW_UNAVAILABLE_MESSAGE)).toHaveAttribute("data-show", "true");
});
```

- [ ] **Step 2: Add the exact synthetic prompt constant**

```ts
export const PREVIEW_PROMPT = `placeholder text
In nova fert animus mutatas dicere formas
corpora; di, coeptis (nam vos mutastis et illas)
adspirate meis primaque ab origine mundi
ad mea perpetuum deducite tempora carmen.
Ante mare et terras et quod tegit omnia caelum
unus erat toto naturae vultus in orbe,
quem dixere Chaos: rudis indigestaque moles
nec quicquam nisi pondus iners congestaque eodem
non bene iunctarum discordia semina rerum.
Nullus adhuc mundo praebebat lumina Titan,
nec nova crescendo reparabat cornua Phoebe,
nec circumfuso pendebat in aere tellus
ponderibus librata suis, nec bracchia longo
margine terrarum porrexerat Amphitrite;
utque erat et tellus illic et pontus et aer,
sic erat instabilis tellus, innabilis unda,
lucis egens aer; nulli sua forma manebat,
obstabatque aliis aliud, quia corpore in uno
frigida pugnabant calidis, umentia siccis,
mollia cum duris, sine pondere, habentia pondus.`;
```

- [ ] **Step 3: Implement the local modal from the existing reviewer design**

Port the focus trap, header, prompt section, relevant glossary table, warning copy, footer, and CSS from `../norinovels-admin/src/app/imports/ChapterRetryModal.tsx`. Replace its three prompt states with an array initialized to `[PREVIEW_PROMPT, PREVIEW_PROMPT, PREVIEW_PROMPT]`; label by index as `Prompt ${index + 1}`. Keep prompt and glossary inputs locally editable. Remove `importId`, `retryReviewChapter`, `ImporterApiError`, payload construction, unavailable handling, busy network state, and all API imports. `Retry translation` calls `onSubmit` synchronously and leaves the modal open. Cancel, the close button, Escape, and backdrop close only the retry modal because those are normal in-modal interactions.

- [ ] **Step 4: Connect Retranslate to the QA rail**

The Retranslate control opens `PreviewRetryModal`. Its `onSubmit` is `showPreviewUnavailable`; its `onClose` returns focus to the opener. The separate glossary mutation control does not open an admin glossary modal and instead calls the same preview guard.

- [ ] **Step 5: Prove prompt privacy and modal behavior**

Run: `npm run test -- src/features/reviewer/PreviewRetryModal.component.test.tsx src/features/reviewer/PreviewChapterReviewer.component.test.tsx`

Expected: exact labels and values pass, submit leaves the dialog visible, and the guard toast is visible.

Run: `rg -n -i 'translation prompt|editor prompt|tl note prompt|retryReviewChapter|ImporterApiError' src`

Expected: no matches outside tests that assert forbidden labels are absent.

- [ ] **Step 6: Commit the anonymized modal**

```bash
git add src/features/preview/copy.ts src/features/reviewer/PreviewRetryModal.tsx src/features/reviewer/PreviewRetryModal.component.test.tsx src/features/reviewer/PreviewChapterReviewer.tsx src/features/reviewer/chapterRetry.module.css
git commit -m "feat: add anonymized retranslation preview"
```

---

### Task 6: Browser journey, network lock, and public-build scan

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/preview.spec.ts`
- Create: `scripts/scan-public-build.mjs`
- Modify: `README.md`

**Interfaces:**
- Consumes: The complete static preview.
- Produces: Browser-level desktop/mobile proof, an application-request allowlist, and a repeatable forbidden-value scan over `src` and `out`.

- [ ] **Step 1: Write the failing Playwright journey**

```ts
// e2e/preview.spec.ts
import { expect, test } from "@playwright/test";

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`${viewport.name} reviewer preview`, async ({ page }) => {
    const applicationRequests: string[] = [];
    page.on("request", (request) => {
      if (!["document", "stylesheet", "script", "font", "image"].includes(request.resourceType())) {
        applicationRequests.push(request.url());
      }
    });
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Chapter 25", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next chapter" }).click();
    await expect(page.getByText("This function is not available in the preview.")).toBeVisible();
    await page.getByRole("button", { name: /Retranslate/iu }).click();
    await expect(page.getByRole("textbox", { name: "Prompt 1" })).toHaveValue(/placeholder text/iu);
    await page.getByRole("button", { name: "Retry translation" }).click();
    await expect(page.getByRole("dialog", { name: /Revise chapter 25/iu })).toBeVisible();
    expect(applicationRequests).toEqual([]);
  });
}
```

- [ ] **Step 2: Configure Playwright against the static export**

```ts
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: process.env.PREVIEW_BASE_URL ?? "http://127.0.0.1:3200",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  webServer: process.env.PREVIEW_BASE_URL ? undefined : {
    command: "npm run start -- --listen 3200",
    port: 3200,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 3: Add a deterministic public scan**

`scripts/scan-public-build.mjs` recursively reads text files under `src` and `out`, skips test files when checking assertion-only forbidden words, and exits nonzero on UUIDs, `supabase`, `/api/`, `NEXT_PUBLIC_`, `service_role`, staging hostnames, admin client imports, original prompt labels outside tests, or model/cost/token fixture keys. It prints only file paths and rule names, never matched chapter prose.

- [ ] **Step 4: Run the complete local verification**

Run: `npm run test && npm run lint && npm run build && npm run scan:public && npm run test:e2e`

Expected: every command exits 0; `out/index.html` exists; both Playwright viewport journeys pass; no forbidden scan findings occur.

Manually inspect both viewport sizes. Confirm no clipped controls, unreadable columns, misplaced tooltips, focus escape, unexpected horizontal page scroll, or styling regressions compared with the current admin reviewer.

- [ ] **Step 5: Document verification and commit**

Add the exact full verification command to `README.md`, state that reload resets edits, and document which actions intentionally show the preview toast.

```bash
git add playwright.config.ts e2e scripts README.md
git commit -m "test: verify public reviewer preview"
```

---

### Task 7: GitHub publication and Vercel deployment

**Files:**
- Modify: `README.md` only if the final public URL is recorded.
- No source changes are expected.

**Interfaces:**
- Consumes: A clean `staging` branch with all verification passing.
- Produces: Public GitHub repository `nori-novels/chapter-reviewer-preview` and a public Vercel production URL serving the static preview.

- [ ] **Step 1: Re-run release verification from a clean tree**

Run: `git status --short --branch`

Expected: `## staging` and no file changes.

Run: `npm run test && npm run lint && npm run build && npm run scan:public && npm run test:e2e`

Expected: all commands exit 0 immediately before publication.

- [ ] **Step 2: Use the GitHub workflow and verify identity**

Invoke the `github:yeet` skill for publication. Before any mutation, run:

```bash
gh api user --jq .login
```

Expected exact output: `BDZendure`

If the identity differs, stop and reauthenticate. Confirm the organization slug from the existing admin remote is `nori-novels`.

- [ ] **Step 3: Create the public remote without importing history**

Create `nori-novels/chapter-reviewer-preview` as a public, empty repository through the connected GitHub app or `gh` fallback. Do not initialize a remote README, license, or `.gitignore`. Add it as `origin`, push only `staging`, and verify:

```bash
git remote -v
git ls-remote --heads origin
```

Expected: the remote is `git@github.com:nori-novels/chapter-reviewer-preview.git` and only `refs/heads/staging` exists.

- [ ] **Step 4: Link and deploy with Vercel**

Verify the active Vercel account/team before mutation. Link the repository as a new Vercel project named `chapter-reviewer-preview`, configure `staging` as its production branch, and confirm there are no environment variables or integrations. Deploy the already-verified static export using the supported Vercel CLI or dashboard flow.

Expected: Vercel reports a successful production deployment and provides a public HTTPS URL.

- [ ] **Step 5: Verify the deployed preview**

Run the same Playwright journey against the public URL:

```bash
npm run test:e2e
```

Supply the exact HTTPS URL printed by Step 4 as the `PREVIEW_BASE_URL` environment value for that command. Inspect the browser network panel and confirm only same-origin static assets are loaded and guarded interactions create no requests.

Expected: chapter 25 renders, local tools work, guarded actions show exact toast copy, Retranslate has only anonymized prompts, and no application data requests occur.

- [ ] **Step 6: Record the URL and commit only if requested**

If the user wants the deployment URL in `README.md`, add it, rerun lint/build/scan, commit on `staging`, and push the explicit commit after rechecking the `BDZendure` identity. Do not create or push `main`.

---

## Final Acceptance Check

- [ ] The production URL stored in `PREVIEW_BASE_URL` opens directly to "obsessed" chapter 25.
- [ ] Editing, find/replace, alignment, sync scrolling, QA navigation, glossary highlights, copying, and Retranslate exploration work locally.
- [ ] Previous, next, chapter index, Save, Approve, glossary mutation, Retranslate submission, and Close show `This function is not available in the preview.`
- [ ] Retranslate contains `Prompt 1`, `Prompt 2`, and `Prompt 3`, each with the exact synthetic text.
- [ ] Reload restores the committed chapter fixture.
- [ ] No public source or build contains original prompts, UUIDs, staging infrastructure, Supabase configuration, model metadata, credentials, or admin Git history.
- [ ] No visitor interaction sends application data or mutation requests.
- [ ] Unit, component, E2E, lint, build, scan, and desktop/mobile visual checks pass.
