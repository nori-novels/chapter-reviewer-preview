# Preview Announcement and Help Drawer Design

## Goal

Add a temporary announcement bar and an in-context feature guide to the public chapter reviewer preview. The feature is entirely client-side and contains no private or operational data.

## Announcement

The mustard announcement is the first child of the full-screen reviewer dialog, above the existing chapter header. It says:

> This is a preview. Click help for details about reviewer features.

A circular question-mark button opens Help. A far-right X dismisses the announcement for the current mounted preview only. A reload or fresh mount restores it. Removing the bar returns its full height to the existing flex layout.

The announcement uses the same inherited Figtree treatment as Find and replace. Its X uses the same 28-pixel circular hover and focus pattern as the Find and replace close control.

## Help drawer

Help slides in as an opaque black overlay from the reviewer's right edge. It covers the reviewer without resizing the QA rail or source and translation panes. While the announcement is visible, the drawer starts below it. If the announcement is dismissed while Help is open, the drawer remains open and extends to the top edge.

The Figtree drawer contains white text describing the QA rail, warning navigation, Find and replace, Align paragraphs, Sync scrolling, glossary editing, and Retranslate. It contains no staging values, identifiers, prompts, or backend details.

Only the drawer's own circular X closes it. The Help button, outside clicks, Escape, and announcement dismissal do not close it. Opening focuses the drawer X. Closing restores focus to Help when available, otherwise to the English title. The existing reviewer focus trap excludes hidden or inert drawer controls.

The drawer is at most 380 pixels wide, never wider than the viewport, and disables motion under `prefers-reduced-motion: reduce`.

## Verification

Component tests cover session reset, exact public copy, feature descriptions, exclusive dismissal, focus restoration, Escape suppression, and focus-trap boundaries. Static and Playwright coverage verify layout height recovery, right-side overlay geometry, circular hover/focus treatment, narrow width, and reduced motion. The public-source/build scanner and no-application-network E2E contract remain green.
