"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Button } from "@/components/Button/Button";
import { PREVIEW_PROMPT } from "@/features/preview/copy";
import type { GlossaryEntry } from "@/features/preview/types";
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

const GLOSSARY_GENDERS: GlossaryEntry["gender"][] = [
  "female",
  "male",
  "nonbinary",
  "unknown",
];

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
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [prompts, setPrompts] = useState([
    PREVIEW_PROMPT,
    PREVIEW_PROMPT,
    PREVIEW_PROMPT,
  ]);
  const [entries, setEntries] = useState<GlossaryEntry[]>(() => glossary.map((entry) => ({
    ...entry,
    acceptedTargets: [...entry.acceptedTargets],
  })));
  const [acceptedTargetInputs, setAcceptedTargetInputs] = useState(() => (
    glossary.map((entry) => entry.acceptedTargets.join("\n"))
  ));

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
    setEntries((current) => current.map((entry, currentIndex) => (
      currentIndex === index ? { ...entry, ...patch } : entry
    )));
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

          <section className={styles.glossarySection} aria-label="Relevant glossary entries">
            <h3>Glossary entries used in this chapter</h3>
            {entries.length === 0 ? (
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
                    {entries.map((entry, index) => (
                      <tr
                        key={index}
                        className={entry.enabled ? undefined : styles.disabledRow}
                        aria-label={`Toggle enabled state for ${entry.source}. Currently ${entry.enabled ? "enabled" : "disabled"}.`}
                        tabIndex={0}
                        onClick={(event) => handleRowClick(index, entry.enabled, event)}
                        onKeyDown={(event) => handleRowKeyDown(index, entry.enabled, event)}
                      >
                        <td><span className={styles.sourceToggle}>{entry.source}</span></td>
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
                            value={acceptedTargetInputs[index] ?? ""}
                            onChange={(event) => setAcceptedTargetInputs((current) => current.map(
                              (value, currentIndex) => (
                                currentIndex === index ? event.target.value : value
                              ),
                            ))}
                            placeholder="One variant per line"
                          />
                        </td>
                        <td>
                          <label className={styles.srOnly} htmlFor={`retry-kind-${index}`}>
                            Kind for {entry.source}
                          </label>
                          <select
                            id={`retry-kind-${index}`}
                            role="combobox"
                            value={entry.kind}
                            onChange={(event) => updateEntry(index, {
                              kind: event.target.value as GlossaryEntry["kind"],
                            })}
                          >
                            {GLOSSARY_KINDS.map((kind) => (
                              <option key={kind} value={kind}>{kind}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {entry.kind === "character" && (
                            <>
                              <label className={styles.srOnly} htmlFor={`retry-gender-${index}`}>
                                Gender for {entry.source}
                              </label>
                              <select
                                id={`retry-gender-${index}`}
                                role="combobox"
                                value={entry.gender}
                                onChange={(event) => updateEntry(index, {
                                  gender: event.target.value as GlossaryEntry["gender"],
                                })}
                              >
                                {GLOSSARY_GENDERS.map((gender) => (
                                  <option key={gender} value={gender}>{gender}</option>
                                ))}
                              </select>
                            </>
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
          <Button type="button" variant="soft" onClick={onSubmit}>
            Retry translation
          </Button>
        </footer>
      </div>
    </div>
  );
}
