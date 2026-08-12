"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./chapterReview.module.css";

interface PreviewAnnouncementHelpProps {
  fallbackFocus: () => void;
  onDrawerOpenChange: (open: boolean) => void;
}

const FEATURES = [
  ["QA rail", "Hovering over the QA rail to the left automatically expands it to show errors. Summarizes warnings, expands for details, and jumps to affected source and translation text."],
  ["Warning navigation", "Moves among repeated occurrences of the selected issue."],
  ["Find and replace", "Searches the English draft, navigates matches, and replaces one or all matches. Found terms are highlighted in orange, and the term to be replaced is highlighted in yellow."],
  ["Align paragraphs", "Pairs source and translation paragraphs for direct comparison and editing."],
  ["Sync scrolling", "Keeps the source and translation panes moving together."],
  ["Glossary editing", "Opens the relevant glossary entry so terminology can be corrected at its source. Glossary mismatch QA is live, and applying changes rechecks the term across every chapter."],
  ["Retranslate", "Allows the translator to adjust glossary terms found in the chapter and prompts and send the chapter back to the model for retranslation."],
] as const;

function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function PreviewAnnouncementHelp({
  fallbackFocus,
  onDrawerOpenChange,
}: PreviewAnnouncementHelpProps) {
  const [announcementVisible, setAnnouncementVisible] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const helpRef = useRef<HTMLButtonElement | null>(null);
  const announcementRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const drawerCloseRef = useRef<HTMLButtonElement | null>(null);

  function focusNext(target: HTMLElement | null, fallback?: () => void) {
    requestAnimationFrame(() => {
      if (target?.isConnected) target.focus({ preventScroll: true });
      else fallback?.();
    });
  }

  function openDrawer() {
    if (drawerOpen) return;
    setDrawerOpen(true);
    onDrawerOpenChange(true);
    focusNext(drawerCloseRef.current);
  }

  const closeDrawer = useCallback((restoreFocus = true) => {
    setDrawerOpen(false);
    onDrawerOpenChange(false);
    if (restoreFocus) focusNext(helpRef.current, fallbackFocus);
  }, [fallbackFocus, onDrawerOpenChange]);

  // Any press outside the drawer dismisses it, except on the announcement bar
  // that owns the help toggle. The press keeps its normal effect on whatever it
  // landed on, so focus is only pulled back to the help button when the press
  // left nothing focused and the drawer would otherwise go inert around it.
  useEffect(() => {
    if (!drawerOpen) return;
    function handlePressOutside(event: MouseEvent) {
      const target = event.target instanceof Node ? event.target : null;
      if (!target) return;
      if (drawerRef.current?.contains(target)) return;
      if (announcementRef.current?.contains(target)) return;
      const drawer = drawerRef.current;
      closeDrawer(false);
      requestAnimationFrame(() => {
        const active = document.activeElement;
        const stranded = !active || active === document.body || !!drawer?.contains(active);
        if (stranded) focusNext(helpRef.current, fallbackFocus);
      });
    }
    document.addEventListener("mousedown", handlePressOutside);
    return () => document.removeEventListener("mousedown", handlePressOutside);
  }, [closeDrawer, drawerOpen, fallbackFocus]);

  function dismissAnnouncement() {
    setAnnouncementVisible(false);
    if (drawerOpen) focusNext(drawerCloseRef.current);
  }

  return (
    <>
      {announcementVisible && (
        <div ref={announcementRef} className={styles.previewAnnouncement} data-testid="reviewer-preview-announcement" role="note">
          <span aria-hidden="true" />
          <div className={styles.previewMessage}>
            <span>This is a preview. Click help for details about reviewer features.</span>
            <button
              ref={helpRef}
              className={styles.previewHelpButton}
              type="button"
              aria-label="Reviewer feature help"
              aria-expanded={drawerOpen}
              aria-controls="chapter-review-feature-help"
              onClick={() => (drawerOpen ? closeDrawer() : openDrawer())}
            >
              <span aria-hidden="true">?</span>
            </button>
          </div>
          <button
            className={styles.previewCloseButton}
            type="button"
            aria-label="Dismiss preview announcement"
            onClick={dismissAnnouncement}
          >
            <CloseGlyph />
          </button>
        </div>
      )}
      <aside
        ref={drawerRef}
        id="chapter-review-feature-help"
        className={styles.previewHelpDrawer}
        data-testid="reviewer-help-drawer"
        data-open={drawerOpen}
        data-announcement-visible={announcementVisible}
        aria-label="Chapter reviewer features"
        aria-hidden={!drawerOpen || undefined}
        inert={!drawerOpen || undefined}
      >
        <div className={styles.previewHelpHeader}>
          <h3>Chapter reviewer features</h3>
          <button
            ref={drawerCloseRef}
            className={styles.drawerCloseButton}
            type="button"
            aria-label="Close reviewer feature help"
            onClick={() => closeDrawer()}
          >
            <CloseGlyph />
          </button>
        </div>
        <dl className={styles.previewFeatureList}>
          {FEATURES.map(([term, description]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </>
  );
}
