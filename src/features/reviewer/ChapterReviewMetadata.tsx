import styles from "./chapterReview.module.css";

interface ChapterReviewMetadataProps {
  pipelineStatus: string;
  hasTlNote: boolean;
}

function statusLabel(status: string): string {
  return status
    .split(/[_-]/u)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

export function ChapterReviewMetadata({
  pipelineStatus,
  hasTlNote,
}: ChapterReviewMetadataProps) {
  return (
    <div className={styles.headerMeta} data-testid="chapter-review-metadata">
      <div className={styles.statusCluster} data-testid="chapter-review-status-cluster">
        <span className={styles.statusBadge}>{statusLabel(pipelineStatus)}</span>
        {hasTlNote && <span className={styles.headerTlNote}>TL note</span>}
      </div>
    </div>
  );
}
