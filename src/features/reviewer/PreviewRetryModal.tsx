"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Button } from "@/components/Button/Button";
import { useToast } from "@/components/Toast/Toast";
import { PREVIEW_PROMPT } from "@/features/preview/copy";
import type { GlossaryEntry } from "@/features/preview/types";
import { copyToClipboard } from "./copy-to-clipboard";
import {
  commitAcceptedTargetInput,
  createGlossaryReviewDraft,
  normalizedGlossaryEntries,
  updateAcceptedTargetInput,
  type GlossaryReviewDraft,
} from "./glossary-review-draft";
import {
  glossaryValidationMessages,
  validateGlossaryEntryIssues,
} from "./glossary-validation";
import { GlossaryGenderPicker } from "./GlossaryGenderPicker";
import { GlossarySelect, type GlossarySelectOption } from "./GlossarySelect";
import styles from "./chapterRetry.module.css";

interface PreviewRetryModalProps {
  ordinal: number;
  glossary: GlossaryEntry[];
  onClose: () => void;
  onSubmit: () => void;
}

const FOCUSABLE = [
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const GLOSSARY_KINDS: GlossaryEntry["kind"][] = [
  "character",
  "title",
  "place",
  "organization",
  "term",
];
const KIND_OPTIONS: readonly GlossarySelectOption<GlossaryEntry["kind"]>[] = GLOSSARY_KINDS.map(
  (kind) => ({ value: kind, label: kind }),
);

function rowClassName(invalid: boolean, enabled: boolean): string | undefined {
  const classes = [invalid ? styles.invalidRow : null, enabled ? null : styles.disabledRow]
    .filter((value): value is string => value !== null);
  return classes.length > 0 ? classes.join(" ") : undefined;
}

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

export function PreviewRetryModal({
  ordinal,
  glossary,
  onClose,
  onSubmit,
}: PreviewRetryModalProps) {
  const { show } = useToast();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [prompts, setPrompts] = useState([
    PREVIEW_PROMPT,
    PREVIEW_PROMPT,
    PREVIEW_PROMPT,
  ]);
  const [draft, setDraft] = useState<GlossaryReviewDraft>(
    () => createGlossaryReviewDraft(glossary),
  );

  const normalizedEntries = useMemo(() => normalizedGlossaryEntries(draft), [draft]);
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
  const promptsValid = prompts.every((prompt) => prompt.trim().length > 0);
  const canSubmit = promptsValid && validationIssues.length === 0;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

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
        onClose();
        return;
      }
      trapTab(event, dialogRef.current);
    }
    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [onClose]);

  function updateEntry(index: number, patch: Partial<GlossaryEntry>) {
    setDraft((current) => ({
      ...current,
      entries: current.entries.map((entry, currentIndex) => (
        currentIndex === index ? { ...entry, ...patch } : entry
      )),
    }));
  }

  function handleRowClick(
    index: number,
    enabled: boolean,
    event: ReactMouseEvent<HTMLTableRowElement>,
  ) {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest("button, input, textarea, select, a, label")) return;
    if (window.getSelection()?.toString()) return;
    updateEntry(index, { enabled: !enabled });
  }

  function handleRowKeyDown(
    index: number,
    enabled: boolean,
    event: ReactKeyboardEvent<HTMLTableRowElement>,
  ) {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    updateEntry(index, { enabled: !enabled });
  }

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={`${titleId}-warning`}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Retry translation</span>
            <h2 id={titleId}>Revise chapter {ordinal}</h2>
            <p>Edit the prompts and glossary entries used for this chapter, then retry.</p>
          </div>
          <button
            className={styles.iconButton}
            type="button"
            aria-label="Close retry"
            onClick={onClose}
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

        <div className={styles.body}>
          <section className={styles.prompts} aria-label="Chapter prompts">
            {prompts.map((prompt, index) => (
              <label className={styles.field} key={index}>
                <span>Prompt {index + 1}</span>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompts((current) => current.map(
                    (value, currentIndex) => currentIndex === index ? event.target.value : value,
                  ))}
                  maxLength={20_000}
                  rows={4}
                />
              </label>
            ))}
          </section>

          {validationIssues.length > 0 && (
            <section
              className={styles.validation}
              aria-live="polite"
              aria-label="Glossary validation"
            >
              <strong>Resolve the highlighted glossary entries before retrying.</strong>
              <ul>{validationMessages.map((message, index) => (
                <li key={`${index}-${message}`}>{message}</li>
              ))}</ul>
            </section>
          )}

          <section className={styles.glossarySection} aria-label="Relevant glossary entries">
            <h3>Glossary entries used in this chapter</h3>
            {draft.entries.length === 0 ? (
              <p className={styles.emptyTable}>No glossary entries apply to this chapter.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Source</th>
                      <th scope="col">Canonical target</th>
                      <th scope="col">Accepted targets</th>
                      <th scope="col">Kind</th>
                      <th scope="col">Gender</th>
                      <th scope="col">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.entries.map((entry, index) => (
                      <tr
                        key={index}
                        className={rowClassName(invalidRows.has(index), entry.enabled)}
                        aria-invalid={invalidRows.has(index) || undefined}
                        aria-label={`Toggle enabled state for ${entry.source}. Currently ${entry.enabled ? "enabled" : "disabled"}.`}
                        tabIndex={0}
                        onClick={(event) => handleRowClick(index, entry.enabled, event)}
                        onKeyDown={(event) => handleRowKeyDown(index, entry.enabled, event)}
                      >
                        <td>
                          <button
                            type="button"
                            className={styles.sourceToggle}
                            aria-label={`Copy ${entry.source}`}
                            onClick={() => {
                              copyToClipboard(entry.source);
                              show("Term copied to clipboard");
                            }}
                          >
                            {entry.source}
                          </button>
                        </td>
                        <td>
                          <label className={styles.srOnly} htmlFor={`retry-target-${index}`}>
                            Canonical target for {entry.source}
                          </label>
                          <input
                            id={`retry-target-${index}`}
                            value={entry.target}
                            onChange={(event) => updateEntry(index, { target: event.target.value })}
                            maxLength={150}
                          />
                        </td>
                        <td>
                          <label className={styles.srOnly} htmlFor={`retry-variants-${index}`}>
                            Accepted targets for {entry.source}
                          </label>
                          <textarea
                            id={`retry-variants-${index}`}
                            rows={1}
                            value={draft.acceptedTargetInputs[index] ?? ""}
                            onChange={(event) => setDraft((current) => (
                              updateAcceptedTargetInput(current, index, event.target.value)
                            ))}
                            onBlur={() => setDraft((current) => (
                              commitAcceptedTargetInput(current, index)
                            ))}
                            placeholder="One variant per line"
                          />
                        </td>
                        <td>
                          <GlossarySelect
                            label={`Kind for ${entry.source}`}
                            value={entry.kind}
                            options={KIND_OPTIONS}
                            onChange={(kind) => updateEntry(index, { kind })}
                          />
                        </td>
                        <td>
                          {entry.kind === "character" && (
                            <GlossaryGenderPicker
                              label={`Gender for ${entry.source}`}
                              value={entry.gender}
                              onChange={(gender) => updateEntry(index, { gender })}
                            />
                          )}
                        </td>
                        <td>
                          <label className={styles.srOnly} htmlFor={`retry-note-${index}`}>
                            Note for {entry.source}
                          </label>
                          <textarea
                            id={`retry-note-${index}`}
                            rows={1}
                            value={entry.note}
                            onChange={(event) => updateEntry(index, { note: event.target.value })}
                            maxLength={300}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <p id={`${titleId}-warning`} className={styles.warning}>
          Retrying discards this chapter&apos;s current draft and any admin edits, then starts a
          fresh translation using the prompts and glossary above.
        </p>

        <footer className={styles.footer}>
          <Button type="button" variant="danger" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="soft" disabled={!canSubmit} onClick={onSubmit}>
            Retry translation
          </Button>
        </footer>
      </div>
    </div>
  );
}
