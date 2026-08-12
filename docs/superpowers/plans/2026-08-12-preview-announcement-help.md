# Preview Announcement and Help Drawer Implementation Plan

**Goal:** Add the approved announcement and right-side feature drawer to the standalone public preview.

**Architecture:** A focused `PreviewAnnouncementHelp` component owns mount-local visibility and focus restoration. `PreviewChapterReviewer` receives synchronous open-state updates for Escape handling and filters hidden or inert controls from its focus trap. CSS keeps the bar in normal flex layout and the drawer absolutely overlaid.

## Task 1: Component behavior and reviewer integration

- Add failing component tests for exact copy, remount reset, all feature descriptions, exclusive X dismissal, focus restoration, Escape suppression, and Tab boundaries.
- Create `PreviewAnnouncementHelp.tsx` with no persistence, APIs, environment values, or admin imports.
- Mount it before the reviewer header and synchronously mirror drawer state in the reviewer key handler.
- Run focused tests, then commit.

## Task 2: Visual contract and browser acceptance

- Add the fixed-height mustard bar, circular controls, black Figtree overlay drawer, responsive width, slide transition, and reduced-motion CSS.
- Extend Playwright coverage for released height, settled right/top geometry, unchanged pane widths, hover/focus styles, narrow width, and reduced motion.
- Run focused tests and E2E, then commit.

## Task 3: Public-preview verification

- Run `npm run test`, `npm run lint`, `npm run build`, `npm run scan:public`, and `npm run test:e2e`.
- Review the final diff for forbidden public data and unrelated changes.
