# Chapter Reviewer Preview Design

## Purpose

Create a public, frontend-only preview of the Nori Novels chapter reviewer at a dedicated Vercel deployment. The preview gives visitors a realistic view of the translator workflow while preventing access to admin systems and server-backed mutations.

The preview contains one static snapshot: chapter 25 of the novel "obsessed" from the staging database.

## Repository and deployment

- Create a new public repository named `chapter-reviewer-preview` in the Nori Novels GitHub organization.
- Start from a clean repository. Do not fork the admin repository or copy its Git history.
- Use a standalone Next.js application deployed on Vercel.
- Serve the full-screen reviewer at the root URL.
- Require no runtime environment variables, authentication, Supabase connection, API routes, or other backend services.
- Use `staging` as the working branch and leave production promotion to the repository owner.

## Architecture

The preview consists of three boundaries:

1. **Static fixture**: A validated, public snapshot containing only the chapter source, translation, glossary entries, QA inputs, and display metadata needed by the reviewer.
2. **Reviewer presentation**: The reusable reviewer components, styles, icons, and pure client-side utilities extracted from the admin application.
3. **Preview controller**: Owns the local draft state and replaces server-backed callbacks with guarded preview actions.

The browser imports the fixture into local React state. Normal reviewer interactions update only that in-memory state. Reloading the page restores the original fixture.

No preview code may import the admin API client, Supabase libraries, admin authentication, importer mutation functions, analytics, model configuration, or server-only modules.

## Chapter snapshot

Chapter 25 of "obsessed" will be exported from the staging database once during development. Before it is committed, the export will be reduced to an explicit preview schema and checked for unnecessary internal data.

The committed fixture may include:

- Public-facing novel and chapter names
- Chapter ordinal and display status
- Source title and body
- Translated title and body
- Glossary terms needed for visible highlighting
- Deterministic QA codes and inputs needed to reproduce visible warnings
- Synthetic adjacent chapter entries needed to render discoverable navigation controls

The committed fixture must exclude:

- Database and import UUIDs
- User or reviewer identity
- Original translation, editing, and translator-note prompts
- Model names, configuration, usage, and costs
- Queue, retry, worker, and staging infrastructure metadata
- Credentials, environment values, API URLs, and private operational notes

The fixture will be validated at build time. Invalid fixture data produces a small static "Preview unavailable" state without rendering raw diagnostics to the visitor.

## User experience

The root URL opens directly into the full-screen chapter reviewer. There is no landing page or login screen.

The following interactions work locally:

- Edit the translated title and body
- Find and replace
- Toggle paragraph alignment
- Toggle synchronized scrolling
- Navigate QA warnings and their occurrences
- View glossary highlighting and copy highlighted terms
- Expand and collapse reviewer panels
- Open, edit, and close the Retranslate modal

The existing responsive reviewer behavior will be retained at narrow widths. The preview will not introduce a separate mobile interface.

## Guarded actions

Controls remain visually enabled so visitors can discover the real workflow. The preview controller intercepts actions that would normally navigate away or mutate server state.

The following actions show a toast and perform no navigation, persistence, or network request:

- Previous chapter
- Next chapter
- Selecting another chapter from the chapter index
- Save changes
- Approve or Approve with override
- Submit Retranslate
- Open or submit glossary mutation functionality
- Close the full-screen reviewer

Every guarded action uses this exact message:

> This function is not available in the preview.

Local editing remains available even though Save is guarded. Refreshing the browser resets all local changes.

## Retranslate prompt anonymization

The Retranslate modal contains three editable prompt fields titled `Prompt 1`, `Prompt 2`, and `Prompt 3`. Each field has the same synthetic value below. No original staging prompt text may enter the preview repository or production bundle.

```text
placeholder text
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
mollia cum duris, sine pondere, habentia pondus.
```

Submitting the modal is a guarded action. It shows the standard preview toast and leaves the modal open so visitors can continue exploring it.

## Data flow and network policy

```text
Static chapter fixture
        |
        v
Preview reviewer controller
        |----------------------|
        v                      v
Local reviewer state     Guarded action handler
                               |
                               v
                         Preview toast only
```

The deployed application must work after its initial static assets have loaded without making application data requests. Vercel may serve framework assets, but visitor interactions must not call Nori APIs, Supabase, analytics, or mutation endpoints.

## Testing and verification

Automated tests will cover:

- Preview fixture schema validation
- Immediate rendering of chapter 25
- Local title and body editing
- Find and replace
- Alignment and synchronized scrolling toggles
- QA warning navigation
- Glossary highlight behavior
- Exact anonymized prompt labels and values
- Standard toast behavior for every guarded action
- Reset to the original fixture on a new page load
- Absence of application data and mutation requests during the main interaction journey

Playwright smoke tests will exercise the preview at desktop and mobile viewport widths. Visual inspection will confirm that the public preview matches the current admin reviewer layout.

Before deployment, scan source files and the production build output for:

- Supabase URLs and keys
- Staging hostnames and internal identifiers
- Admin API paths
- Original prompt fragments
- Model configuration
- Unexpected secrets and environment-dependent values

Run lint, unit or component tests, the production build, and the Playwright preview journey before publishing.

## Vercel and GitHub safety

- Verify the active GitHub identity is `BDZendure` before creating or pushing the repository.
- Create the remote under the Nori Novels organization only after confirming its exact organization slug.
- Configure Vercel as a static frontend with no secrets or database integration.
- Do not push to or merge into `main`. Work on `staging`; production promotion remains human-controlled.
- Treat every committed fixture value as permanently public and review the final diff accordingly.

## Acceptance criteria

The preview is complete when:

1. Its public Vercel URL opens directly into the full-screen reviewer for "obsessed" chapter 25.
2. All specified local reviewer interactions work without a backend.
3. Every server-backed or out-of-scope action stays on the preview and displays the exact standard toast.
4. The Retranslate modal contains only the three anonymized prompt fields and supplied synthetic text.
5. No application interaction sends chapter data or mutation requests over the network.
6. The fixture and production bundle contain no excluded staging or operational data.
7. Desktop and mobile smoke tests, lint, and the production build pass.
