"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/Button/Button";
import { useToast } from "@/components/Toast/Toast";
import type { GlossaryEntry } from "@/features/preview/types";
import { GlossaryEntriesEditor } from "./GlossaryEntriesEditor";
import {
  createGlossaryReviewDraft,
  isGlossaryDraftDirty,
  normalizedGlossaryEntries,
  type GlossaryReviewDraft,
} from "./glossary-review-draft";
import {
  glossaryValidationMessages,
  validateGlossaryEntryIssues,
} from "./glossary-validation";
import styles from "./glossaryReview.module.css";

interface PreviewGlossaryModalProps {
  entries: GlossaryEntry[];
  usageBySource: ReadonlyMap<string, number>;
  onClose: () => void;
  onSave: (entries: GlossaryEntry[]) => void;
}

const FOCUSABLE = [
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function trapTab(event: KeyboardEvent, container: HTMLElement | null) {
  if (event.key !== "Tab" || !container) return;
  const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) {
    event.preventDefault();
    container.focus();
  } else if (!container.contains(document.activeElement)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

// Review-stage glossary editing. Saving rewrites the chapter's working
// glossary in browser memory, which re-runs mismatch and pronoun detection
// against the current draft translation.
export function PreviewGlossaryModal({
  entries,
  usageBySource,
  onClose,
  onSave,
}: PreviewGlossaryModalProps) {
  const { show } = useToast();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const confirmDialogRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const confirmDiscardButtonRef = useRef<HTMLButtonElement | null>(null);
  const [draft, setDraft] = useState<GlossaryReviewDraft>(
    () => createGlossaryReviewDraft(entries),
  );
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const normalizedEntries = useMemo(() => normalizedGlossaryEntries(draft), [draft]);
  const dirty = isGlossaryDraftDirty(draft, entries);
  const validationIssues = useMemo(
    () => validateGlossaryEntryIssues(normalizedEntries),
    [normalizedEntries],
  );
  const validationMessages = useMemo(
    () => glossaryValidationMessages(normalizedEntries, validationIssues),
    [normalizedEntries, validationIssues],
  );
  const invalidRows = useMemo(
    () => new Set(validationIssues.map(({ rowIndex }) => rowIndex)),
    [validationIssues],
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    requestAnimationFrame(() => searchRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const closeDiscardConfirmation = useCallback(() => {
    setConfirmDiscard(false);
    requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
  }, []);

  const requestClose = useCallback(() => {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    if (confirmDiscard) {
      requestAnimationFrame(() => confirmDiscardButtonRef.current?.focus());
    }
  }, [confirmDiscard]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape" && event.isComposing) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      // An open kind listbox owns Escape and closes itself first.
      if (
        event.key === "Escape"
        && target?.matches("[aria-haspopup='listbox'][aria-expanded='true']")
      ) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (confirmDiscard) closeDiscardConfirmation();
        else requestClose();
        return;
      }
      trapTab(event, confirmDiscard ? confirmDialogRef.current : dialogRef.current);
    }
    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [closeDiscardConfirmation, confirmDiscard, requestClose]);

  function handleSave() {
    if (!dirty || validationIssues.length > 0) return;
    onSave(normalizedEntries);
    setDraft(createGlossaryReviewDraft(normalizedEntries));
    show("Glossary saved. QA checks were updated for this chapter.");
  }

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !confirmDiscard) requestClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Chapter review</span>
            <h2 id={titleId}>Edit glossary</h2>
            <p>Saving re-runs the glossary and pronoun checks for this chapter.</p>
          </div>
          <button
            ref={closeRef}
            className={styles.iconButton}
            type="button"
            aria-label="Close glossary editor"
            onClick={requestClose}
          >
            <svg
              viewBox="0 0 16 16"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M3.5 3.5 L12.5 12.5 M12.5 3.5 L3.5 12.5" />
            </svg>
          </button>
        </header>

        <GlossaryEntriesEditor
          draft={draft}
          onDraftChange={setDraft}
          usageBySource={usageBySource}
          busy={false}
          invalidRows={invalidRows}
          validationMessages={validationMessages}
          searchInputRef={searchRef}
        />

        {/* Same pairing as the retranslate modal: red-bordered discard, filled commit. */}
        <footer className={styles.footer}>
          <Button type="button" variant="danger" onClick={requestClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="soft"
            disabled={!dirty || validationIssues.length > 0}
            onClick={handleSave}
          >
            Save glossary
          </Button>
        </footer>

        {confirmDiscard && (
          <div
            className={styles.confirmOverlay}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeDiscardConfirmation();
            }}
          >
            <div
              ref={confirmDialogRef}
              className={styles.confirmDialog}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={`${titleId}-discard-title`}
              aria-describedby={`${titleId}-discard-description`}
              tabIndex={-1}
            >
              <h3 id={`${titleId}-discard-title`}>Discard glossary changes?</h3>
              <p id={`${titleId}-discard-description`}>
                Your unsaved glossary edits will be lost.
              </p>
              <div className={styles.confirmActions}>
                <Button type="button" variant="soft" onClick={closeDiscardConfirmation}>
                  Keep editing
                </Button>
                <button
                  ref={confirmDiscardButtonRef}
                  className={styles.dangerButton}
                  type="button"
                  onClick={onClose}
                >
                  Discard changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
