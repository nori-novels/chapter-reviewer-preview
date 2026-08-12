"use client";

import { useEffect, useMemo, useRef } from "react";
import type { PreviewChapterSummary } from "@/features/preview/types";
import { ChapterIndexMarkers } from "./ChapterIndexMarkers";
import styles from "./chapterReview.module.css";

interface ChapterIndexMenuProps {
  chapters: PreviewChapterSummary[];
  currentOrdinal: number;
  open: boolean;
  disabled: boolean;
  onToggle: (opener: HTMLElement) => void;
  onClose: (restoreFocus?: boolean) => void;
  onNavigate: (ordinal: number) => void;
}

// Chapter index button and dropdown for the review modal header, mirroring the
// reader webapp's chapter index. Approved chapters render faded but stay
// clickable; markers come from ChapterIndexMarkers, shared with the import
// tab's chapter index dialog so both surfaces read the same.
export function ChapterIndexMenu({
  chapters,
  currentOrdinal,
  open,
  disabled,
  onToggle,
  onClose,
  onNavigate,
}: ChapterIndexMenuProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const currentRowRef = useRef<HTMLButtonElement | null>(null);

  const sorted = useMemo(
    () => [...chapters].sort((left, right) => left.ordinal - right.ordinal),
    [chapters],
  );

  useEffect(() => {
    if (!open) return;
    currentRowRef.current?.scrollIntoView({ block: "center", behavior: "instant" });
    function handleOutside(event: MouseEvent) {
      const target = event.target instanceof Node ? event.target : null;
      if (target && wrapRef.current?.contains(target)) return;
      onClose(false);
    }
    document.addEventListener("mousedown", handleOutside, true);
    return () => document.removeEventListener("mousedown", handleOutside, true);
  }, [open, onClose]);

  return (
    <div className={styles.indexWrap} ref={wrapRef}>
      <button
        className={styles.iconButton}
        type="button"
        aria-label="Chapter index"
        aria-expanded={open}
        disabled={disabled || sorted.length === 0}
        onClick={(event) => onToggle(event.currentTarget)}
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
        {/* An open dropdown owns the space the tooltip would occupy. */}
        {!open && <span className={styles.iconTip} aria-hidden="true">Chapter index</span>}
      </button>
      {open && (
        <div className={styles.indexDropdown} data-testid="chapter-index-dropdown">
          {sorted.map((chapter) => {
            const approved = chapter.approvalStatus !== "pending";
            const current = chapter.ordinal === currentOrdinal;
            const rowClasses = [
              styles.indexRow,
              current ? styles.indexRowCurrent : "",
              approved ? styles.indexRowApproved : "",
            ].filter(Boolean).join(" ");
            return (
              <button
                key={chapter.ordinal}
                ref={current ? currentRowRef : undefined}
                className={rowClasses}
                type="button"
                aria-current={current || undefined}
                onClick={() => {
                  onClose(true);
                  if (!current) onNavigate(chapter.ordinal);
                }}
              >
                <span className={styles.indexNum}>{chapter.ordinal}</span>
                <span className={styles.indexTitle}>
                  {chapter.translatedTitle || `Chapter ${chapter.ordinal}`}
                </span>
                <ChapterIndexMarkers chapter={chapter} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
