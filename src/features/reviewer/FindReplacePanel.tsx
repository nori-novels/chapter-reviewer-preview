"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import { useToast } from "@/components/Toast/Toast";
import {
  type FindCurrentMatch,
  findMatches,
  MAX_REVIEW_BODY_CHARACTERS,
  replaceAllMatches,
  replaceMatchAt,
} from "./find-replace";
import styles from "./chapterReview.module.css";

export interface FindReplaceState {
  query: string;
  replacement: string;
  caseSensitive: boolean;
}

interface FindReplacePanelProps {
  body: string;
  state: FindReplaceState;
  disabled: boolean;
  findInputRef: RefObject<HTMLInputElement | null>;
  onStateChange: (state: FindReplaceState) => void;
  onBodyChange: (value: string) => void;
  onNavigate: (paragraph: number) => void;
  onCurrentMatchChange: (match: FindCurrentMatch | null) => void;
  onClose: () => void;
}

// Non-blocking floating window over the review panes. The query/replace/case
// state is owned by ChapterReviewModal so it survives chapter navigation;
// only the current-match cursor lives here, resetting per chapter. Never
// autofocuses: the modal focuses findInputRef on shortcut-open, so remounts
// after navigation do not steal focus.
export function FindReplacePanel({
  body,
  state,
  disabled,
  findInputRef,
  onStateChange,
  onBodyChange,
  onNavigate,
  onCurrentMatchChange,
  onClose,
}: FindReplacePanelProps) {
  const { show: showToast } = useToast();
  const [cursor, setCursor] = useState(0);
  // Tracks whether the current query/case combination has been navigated to
  // at least once. Resets alongside the cursor (query change, case toggle)
  // so the first Enter/Next/Previous after those changes scrolls to the
  // current match (cursor unchanged) instead of skipping past it; every
  // subsequent activation advances/retreats as normal.
  const [visited, setVisited] = useState(false);
  const matches = useMemo(
    () => findMatches(body, state.query, state.caseSensitive),
    [body, state.caseSensitive, state.query],
  );
  const current = matches.length === 0 ? null : Math.min(cursor, matches.length - 1);
  const counter = state.query.length === 0
    ? ""
    : current === null
      ? "No matches"
      : `${current + 1} of ${matches.length}`;

  // Report the selected match up so the comparison backdrop can highlight it
  // distinctly from the others. Derived from `current`, so it also updates when
  // the query, case, or body changes (which reclamp the cursor).
  useEffect(() => {
    if (current === null) {
      onCurrentMatchChange(null);
      return;
    }
    const match = matches[current];
    let indexInParagraph = 0;
    for (let index = 0; index < current; index += 1) {
      if (matches[index].paragraph === match.paragraph) indexInParagraph += 1;
    }
    onCurrentMatchChange({ ordinal: current, paragraph: match.paragraph, indexInParagraph });
  }, [current, matches, onCurrentMatchChange]);

  function navigate(delta: number) {
    if (current === null) return;
    if (!visited) {
      setVisited(true);
      onNavigate(matches[current].paragraph);
      return;
    }
    const next = (current + delta + matches.length) % matches.length;
    setCursor(next);
    onNavigate(matches[next].paragraph);
  }

  function applyBody(next: string): boolean {
    if (next.length > MAX_REVIEW_BODY_CHARACTERS) {
      showToast("Replacement would exceed the chapter length limit.");
      return false;
    }
    onBodyChange(next);
    return true;
  }

  function handleReplace() {
    if (current === null) return;
    const match = matches[current];
    const nextBody = replaceMatchAt(body, match, state.replacement);
    if (!applyBody(nextBody)) return;
    // Jump to the next match: the first one starting at or after the inserted
    // replacement (which also skips a match the replacement itself creates),
    // wrapping to the first remaining match when none follow.
    const nextMatches = findMatches(nextBody, state.query, state.caseSensitive);
    if (nextMatches.length === 0) {
      setCursor(0);
      return;
    }
    const insertedEnd = match.start + state.replacement.length;
    const after = nextMatches.findIndex((candidate) => candidate.start >= insertedEnd);
    const nextIndex = after >= 0 ? after : 0;
    setCursor(nextIndex);
    setVisited(true);
    onNavigate(nextMatches[nextIndex].paragraph);
  }

  function handleReplaceAll() {
    if (matches.length === 0) return;
    const result = replaceAllMatches(
      body,
      state.query,
      state.caseSensitive,
      state.replacement,
    );
    if (applyBody(result.text)) {
      setCursor(0);
      setVisited(false);
      showToast(result.count === 1
        ? "Replaced 1 match."
        : `Replaced ${result.count} matches.`);
    }
  }

  return (
    <div
      className={styles.findPanel}
      role="dialog"
      aria-label="Find and replace"
      data-testid="find-replace-panel"
    >
      <input
        ref={findInputRef}
        className={styles.findInput}
        aria-label="Find"
        placeholder="Find"
        value={state.query}
        disabled={disabled}
        onChange={(event) => {
          setCursor(0);
          setVisited(false);
          onStateChange({ ...state, query: event.target.value });
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            navigate(event.shiftKey ? -1 : 1);
          }
        }}
      />
      <div className={styles.findControls}>
        <button
          className={styles.findToggle}
          type="button"
          aria-label="Match case"
          aria-pressed={state.caseSensitive}
          disabled={disabled}
          onClick={() => {
            setCursor(0);
            setVisited(false);
            onStateChange({ ...state, caseSensitive: !state.caseSensitive });
          }}
        >
          Aa
        </button>
        <span
          className={styles.findCounter}
          data-testid="find-counter"
          aria-live="polite"
        >
          {counter}
        </span>
        <button
          className={styles.findIconButton}
          type="button"
          aria-label="Previous match"
          disabled={disabled || current === null}
          onClick={() => navigate(-1)}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
        <button
          className={styles.findIconButton}
          type="button"
          aria-label="Next match"
          disabled={disabled || current === null}
          onClick={() => navigate(1)}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <button
          className={styles.findIconButton}
          type="button"
          aria-label="Close find and replace"
          disabled={disabled}
          onClick={onClose}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <input
        className={styles.findInput}
        aria-label="Replace with"
        placeholder="Replace with"
        value={state.replacement}
        disabled={disabled}
        onChange={(event) => onStateChange({
          ...state,
          replacement: event.target.value,
        })}
      />
      <div className={styles.findControls}>
        <button
          className={styles.findAction}
          type="button"
          disabled={disabled || current === null}
          onClick={handleReplace}
        >
          Replace
        </button>
        <button
          className={styles.findAction}
          type="button"
          disabled={disabled || matches.length === 0}
          onClick={handleReplaceAll}
        >
          Replace all
        </button>
      </div>
    </div>
  );
}
