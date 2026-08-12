"use client";

import type { PreviewChapterSummary } from "@/features/preview/types";
import styles from "./chapterIndexMarkers.module.css";

// The marker cluster shared by the chapter reviewer's index dropdown
// (ChapterIndexMenu) and the import tab's chapter index dialog
// (ChapterIndexModal), so the same chapter reads identically in both. Slots
// are fixed-width and always rendered, keeping the columns aligned down the
// list even when a row carries no markers.
//
// NEEDS OVERRIDE and FAILED share one slot because they are mutually exclusive:
// requiresOverrideReview needs pipelineStatus "needs_override", which cannot
// also be "failed". Pending and approved chapters carry no status marker.
export function ChapterIndexMarkers({ chapter }: { chapter: PreviewChapterSummary }) {
  const failed = chapter.pipelineStatus === "failed";
  const needsOverride = chapter.pipelineStatus === "needs_override"
    && chapter.approvalStatus === "pending";

  return (
    <span className={styles.markers}>
      <span className={styles.slot} data-testid="chapter-index-tl-marker">
        {chapter.hasTlNote && <span className={styles.tlNote}>TL</span>}
      </span>
      <span className={styles.slot} data-testid="chapter-index-override-marker">
        {failed && <span className={styles.failed}>Failed</span>}
        {needsOverride && <span className={styles.override}>Needs Override</span>}
      </span>
    </span>
  );
}
