"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  qaWarningKey,
  type QaWarning,
  type QaWarningParagraph,
} from "./qa-warnings";
import styles from "./chapterReview.module.css";

const HOVER_EXPAND_DELAY_MS = 250;
const MAX_LISTED_PARAGRAPHS = 12;

const WARNING_LABELS: Record<QaWarning["type"], string> = {
  glossary_mismatch: "Glossary mismatch",
  han_residue: "Han residue",
  pronoun: "Pronoun usage",
  paragraph_breaks: "Paragraph breaks",
};

const PIPELINE_NOTICES: Record<string, string> = {
  editing_failed: "The editing pass failed; this chapter shows the unedited translation.",
  tl_note_failed: "The TL-note pass failed for this chapter.",
};

function paragraphLabel(paragraph: QaWarningParagraph): string {
  return paragraph === "title" ? "Title" : String(paragraph + 1);
}

function paragraphsSummary(warning: QaWarning): string {
  const labels = warning.occurrences
    .slice(0, MAX_LISTED_PARAGRAPHS)
    .map((occurrence) => paragraphLabel(occurrence.paragraph));
  const overflow = warning.occurrences.length - labels.length;
  return overflow > 0
    ? `${labels.join(", ")} +${overflow} more`
    : labels.join(", ");
}

function warningDetail(warning: QaWarning): ReactNode {
  switch (warning.type) {
    case "glossary_mismatch":
      return (
        <>
          <strong>{warning.entry.source}</strong> → {warning.entry.target}
          {warning.entry.acceptedTargets.length > 0 && (
            <small>Accepted: {warning.entry.acceptedTargets.join(", ")}</small>
          )}
        </>
      );
    case "han_residue":
      return (
        <>
          Untranslated Chinese remains in the English text.
          {warning.snippets.length > 0 && (
            <small lang="zh">{warning.snippets.join("、")}</small>
          )}
        </>
      );
    case "pronoun":
      return (
        <>
          <strong>{warning.character.source}</strong> ({warning.character.target}) should
          use {warning.expectedPronouns}.
        </>
      );
    case "paragraph_breaks":
      return (
        <>
          Source has {warning.sourceCount} paragraphs; translation
          has {warning.translationCount}.
        </>
      );
  }
}

function GlossaryIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function PronounIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="7.5" r="3.6" />
      <path d="M5.4 20.4a6.6 6.6 0 0 1 13.2 0" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  );
}

function warningIcon(type: QaWarning["type"]): ReactNode {
  switch (type) {
    case "glossary_mismatch":
      return <GlossaryIcon />;
    case "han_residue":
      return <span className={styles.qaIconGlyph} aria-hidden="true">文</span>;
    case "pronoun":
      return <PronounIcon />;
    case "paragraph_breaks":
      return <span className={styles.qaIconGlyph} aria-hidden="true">¶</span>;
  }
}

interface ChapterQaSidebarProps {
  warnings: QaWarning[];
  pipelineNotices: string[];
  expanded: boolean;
  disabled: boolean;
  selectedKey: string | null;
  selectedOccurrence: number;
  retranslateReason: string | null;
  onExpand: () => void;
  onCollapse: () => void;
  onSelectWarning: (key: string, occurrence: number) => void;
  onRetranslate: (opener: HTMLElement) => void;
  onOpenGlossary: (opener: HTMLElement) => void;
}

// Left-hand QA rail of the chapter review screen. Collapsed it shows one icon
// per warning type; hovering (with intent) or activating an icon expands it
// into full warning cards, and any interaction outside the rail collapses it.
export function ChapterQaSidebar({
  warnings,
  pipelineNotices,
  expanded,
  disabled,
  selectedKey,
  selectedOccurrence,
  retranslateReason,
  onExpand,
  onCollapse,
  onSelectWarning,
  onRetranslate,
  onOpenGlossary,
}: ChapterQaSidebarProps) {
  const asideRef = useRef<HTMLElement | null>(null);
  const hoverTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    function handleOutside(event: MouseEvent) {
      const target = event.target instanceof Node ? event.target : null;
      if (target && asideRef.current?.contains(target)) return;
      onCollapse();
    }
    document.addEventListener("mousedown", handleOutside, true);
    return () => document.removeEventListener("mousedown", handleOutside, true);
  }, [expanded, onCollapse]);

  function scheduleExpand() {
    if (expanded || disabled || hoverTimerRef.current !== null) return;
    hoverTimerRef.current = window.setTimeout(() => {
      hoverTimerRef.current = null;
      onExpand();
    }, HOVER_EXPAND_DELAY_MS);
  }

  function cancelScheduledExpand() {
    if (hoverTimerRef.current === null) return;
    window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
  }

  const iconTypes: QaWarning["type"][] = [];
  for (const warning of warnings) {
    if (!iconTypes.includes(warning.type)) iconTypes.push(warning.type);
  }
  const countByType = new Map<QaWarning["type"], number>();
  for (const warning of warnings) {
    countByType.set(warning.type, (countByType.get(warning.type) ?? 0) + 1);
  }

  return (
    <aside
      ref={asideRef}
      className={styles.qaSidebar}
      data-testid="qa-sidebar"
      data-expanded={expanded}
      aria-label="QA warnings"
      onMouseEnter={scheduleExpand}
      onMouseLeave={cancelScheduledExpand}
    >
      <div className={styles.qaSidebarIcons} aria-hidden={expanded || undefined}>
        {iconTypes.length === 0 && pipelineNotices.length === 0 ? (
          <span className={`${styles.qaIconBox} ${styles.qaIconClean}`} title="No QA warnings">
            <CheckIcon />
          </span>
        ) : (
          iconTypes.map((type) => (
            <button
              key={type}
              className={styles.qaIconBox}
              type="button"
              aria-label={`${WARNING_LABELS[type]} warnings`}
              disabled={disabled || expanded}
              onClick={() => {
                cancelScheduledExpand();
                onExpand();
                const first = warnings.find((warning) => warning.type === type);
                if (first) onSelectWarning(qaWarningKey(first), 0);
              }}
            >
              {warningIcon(type)}
              <span className={styles.qaIconCount} aria-hidden="true">
                {countByType.get(type)}
              </span>
            </button>
          ))
        )}
      </div>

      <div className={styles.qaSidebarPanel} aria-hidden={!expanded || undefined}>
        <div className={styles.qaSidebarHeading}>
          <span className={styles.qaEyebrow}>Quality review</span>
          <h3>QA warnings</h3>
        </div>
        <div className={styles.qaWarningList} data-testid="qa-warning-list">
          {warnings.length === 0 && pipelineNotices.length === 0 && (
            <p className={styles.noFindings}>No warnings were detected.</p>
          )}
          {warnings.map((warning) => {
            const key = qaWarningKey(warning);
            const selected = key === selectedKey;
            const occurrenceCount = warning.occurrences.length;
            const position = selected
              ? Math.min(selectedOccurrence, occurrenceCount - 1)
              : 0;
            return (
              <div
                key={key}
                className={`${styles.qaWarningCard} ${selected ? styles.qaWarningCardSelected : ""}`}
                data-testid={`qa-warning-${key}`}
              >
                <button
                  className={styles.qaWarningBody}
                  type="button"
                  disabled={disabled || !expanded}
                  aria-pressed={selected}
                  onClick={() => onSelectWarning(key, 0)}
                >
                  <span className={styles.qaWarningType}>{WARNING_LABELS[warning.type]}</span>
                  <span className={styles.qaWarningDetail}>{warningDetail(warning)}</span>
                  <span className={styles.qaWarningParagraphs}>
                    Paragraphs: {paragraphsSummary(warning)}
                  </span>
                </button>
                {occurrenceCount > 1 && (
                  <div className={styles.qaOccurrenceNav}>
                    <button
                      className={styles.qaOccurrenceButton}
                      type="button"
                      aria-label={`Previous ${WARNING_LABELS[warning.type]} occurrence`}
                      disabled={disabled || !expanded}
                      onClick={() => onSelectWarning(
                        key,
                        (position - 1 + occurrenceCount) % occurrenceCount,
                      )}
                    >
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                    </button>
                    <span aria-live={selected ? "polite" : undefined}>
                      {selected ? position + 1 : 1}/{occurrenceCount}
                    </span>
                    <button
                      className={styles.qaOccurrenceButton}
                      type="button"
                      aria-label={`Next ${WARNING_LABELS[warning.type]} occurrence`}
                      disabled={disabled || !expanded}
                      onClick={() => onSelectWarning(key, (position + 1) % occurrenceCount)}
                    >
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {pipelineNotices.map((code) => (
            <p className={styles.qaPipelineNotice} key={code}>
              {PIPELINE_NOTICES[code] ?? code}
            </p>
          ))}
        </div>
        <div className={styles.qaSidebarFooter}>
          <button
            className={styles.qaFooterButton}
            type="button"
            disabled={disabled || !expanded || Boolean(retranslateReason)}
            title={retranslateReason ?? undefined}
            onClick={(event) => onRetranslate(event.currentTarget)}
          >
            Retranslate
          </button>
          <button
            className={styles.qaFooterButton}
            type="button"
            disabled={disabled || !expanded}
            onClick={(event) => onOpenGlossary(event.currentTarget)}
          >
            Edit glossary
          </button>
        </div>
      </div>
    </aside>
  );
}
