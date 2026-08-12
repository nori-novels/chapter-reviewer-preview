"use client";

import {
  type Dispatch,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
  type SetStateAction,
  useMemo,
  useRef,
  useState,
} from "react";
import { useToast } from "@/components/Toast/Toast";
import type { GlossaryEntry } from "@/features/preview/types";
import { copyToClipboard } from "./copy-to-clipboard";
import {
  commitAcceptedTargetInput,
  updateAcceptedTargetInput,
  type GlossaryReviewDraft,
} from "./glossary-review-draft";
import { GlossaryGenderPicker } from "./GlossaryGenderPicker";
import { GlossaryKindIcon } from "./GlossaryKindIcon";
import {
  GlossarySegmentedControl,
  type GlossarySegmentedControlHandle,
  type GlossarySegmentOption,
} from "./GlossarySegmentedControl";
import { GlossarySelect, type GlossarySelectOption } from "./GlossarySelect";
import styles from "./glossaryReview.module.css";

const GLOSSARY_KINDS: GlossaryEntry["kind"][] = [
  "character",
  "title",
  "place",
  "organization",
  "term",
];
type EnabledFilter = "all" | "enabled" | "disabled";
type KindFilter = "all" | GlossaryEntry["kind"];

const ENABLED_FILTER_SEGMENTS: readonly GlossarySegmentOption<EnabledFilter>[] = [
  { value: "all", label: "All" },
  { value: "enabled", label: "Enabled" },
  { value: "disabled", label: "Disabled" },
];
const KIND_OPTIONS: readonly GlossarySelectOption<GlossaryEntry["kind"]>[] = GLOSSARY_KINDS.map(
  (kind) => ({ value: kind, label: kind }),
);
const KIND_FILTER_SEGMENTS: readonly GlossarySegmentOption<KindFilter>[] = [
  { value: "all", label: "All", ariaLabel: "All kinds" },
  ...GLOSSARY_KINDS.map((kind) => ({
    value: kind,
    label: <GlossaryKindIcon kind={kind} />,
    ariaLabel: kind,
    tooltip: kind,
  })),
];

function rowClassName(invalid: boolean, enabled: boolean): string | undefined {
  const classes = [invalid ? styles.invalidRow : null, enabled ? null : styles.disabledRow]
    .filter((value): value is string => value !== null);
  return classes.length > 0 ? classes.join(" ") : undefined;
}

interface GlossaryEntriesEditorProps {
  draft: GlossaryReviewDraft;
  onDraftChange: Dispatch<SetStateAction<GlossaryReviewDraft>>;
  usageBySource: ReadonlyMap<string, number>;
  busy: boolean;
  invalidRows: ReadonlySet<number>;
  validationMessages: string[];
  searchInputRef?: RefObject<HTMLInputElement | null>;
}

// The searchable, filterable glossary entry table. Rows sort by usage so the
// terms that carry the chapter come first.
export function GlossaryEntriesEditor({
  draft,
  onDraftChange,
  usageBySource,
  busy,
  invalidRows,
  validationMessages,
  searchInputRef,
}: GlossaryEntriesEditorProps) {
  const { show } = useToast();
  const kindFilterRef = useRef<GlossarySegmentedControlHandle | null>(null);
  const [search, setSearch] = useState("");
  const [enabledFilter, setEnabledFilter] = useState<EnabledFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");

  const filteredEntries = useMemo(() => {
    const searchTerm = search.trim().toLocaleLowerCase();
    return draft.entries.flatMap((entry, index) => {
      if (enabledFilter !== "all" && (enabledFilter === "enabled") !== entry.enabled) return [];
      if (kindFilter !== "all" && entry.kind !== kindFilter) return [];
      if (searchTerm && ![entry.source, entry.target, entry.note].some((value) => (
        value.toLocaleLowerCase().includes(searchTerm)
      ))) return [];
      return [{ entry, index, usageCount: usageBySource.get(entry.source) ?? 0 }];
    }).sort((left, right) => right.usageCount - left.usageCount);
  }, [draft.entries, enabledFilter, kindFilter, search, usageBySource]);

  function updateEntry(index: number, patch: Partial<GlossaryEntry>) {
    onDraftChange((current) => ({
      ...current,
      entries: current.entries.map((entry, currentIndex) => (
        currentIndex === index ? { ...entry, ...patch } : entry
      )),
    }));
  }

  // Changing a row's kind can filter it out from under the cursor, so focus
  // moves to the filter that hid it rather than falling back to the document.
  function updateEntryKind(index: number, kind: GlossaryEntry["kind"]) {
    const rowWillHide = kindFilter !== "all" && kind !== kindFilter;
    updateEntry(index, { kind });
    if (rowWillHide) {
      requestAnimationFrame(() => kindFilterRef.current?.focus({ preventScroll: true }));
    }
  }

  function handleRowClick(index: number, enabled: boolean, event: MouseEvent<HTMLTableRowElement>) {
    if (busy) return;
    if (!(event.target instanceof Element)) return;
    if (event.target.closest("button, input, textarea, select, a, label")) return;
    if (window.getSelection()?.toString()) return;
    updateEntry(index, { enabled: !enabled });
  }

  function handleRowKeyDown(
    index: number,
    enabled: boolean,
    event: KeyboardEvent<HTMLTableRowElement>,
  ) {
    if (busy || event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    updateEntry(index, { enabled: !enabled });
  }

  return (
    <>
      <section className={styles.controls} aria-label="Glossary filters">
        <label className={styles.searchField}>
          <svg
            className={styles.searchIcon}
            viewBox="0 0 16 16"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="7" cy="7" r="4.4" />
            <path d="M10.4 10.4 L13.6 13.6" />
          </svg>
          <input
            ref={searchInputRef}
            aria-label="Search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search source, target, or note"
            disabled={busy}
          />
        </label>
        <div className={styles.filterField}>
          <GlossarySegmentedControl
            label="Entries"
            value={enabledFilter}
            options={ENABLED_FILTER_SEGMENTS}
            onChange={setEnabledFilter}
            disabled={busy}
          />
        </div>
        <div className={styles.filterField}>
          <GlossarySegmentedControl
            ref={kindFilterRef}
            label="Kind"
            value={kindFilter}
            options={KIND_FILTER_SEGMENTS}
            onChange={setKindFilter}
            disabled={busy}
          />
        </div>
      </section>

      {validationMessages.length > 0 && (
        <section className={styles.validation} aria-live="polite" aria-label="Glossary validation">
          <strong>Resolve the highlighted glossary entries before saving.</strong>
          <ul>{validationMessages.map((message, index) => (
            <li key={`${index}-${message}`}>{message}</li>
          ))}</ul>
        </section>
      )}

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
              <th scope="col">Usage</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map(({ entry, index, usageCount }) => (
              <tr
                key={index}
                className={rowClassName(invalidRows.has(index), entry.enabled)}
                aria-invalid={invalidRows.has(index) || undefined}
                aria-disabled={busy || undefined}
                aria-label={`Toggle enabled state for ${entry.source}. Currently ${entry.enabled ? "enabled" : "disabled"}.`}
                tabIndex={busy ? -1 : 0}
                onClick={(event) => handleRowClick(index, entry.enabled, event)}
                onKeyDown={(event) => handleRowKeyDown(index, entry.enabled, event)}
              >
                <td>
                  <button
                    type="button"
                    className={styles.sourceToggle}
                    aria-label={`Copy ${entry.source}`}
                    disabled={busy}
                    onClick={() => {
                      copyToClipboard(entry.source);
                      show("Term copied to clipboard");
                    }}
                  >
                    {entry.source}
                  </button>
                </td>
                <td>
                  <label className={styles.srOnly} htmlFor={`glossary-target-${index}`}>
                    Canonical target for {entry.source}
                  </label>
                  <input
                    id={`glossary-target-${index}`}
                    value={entry.target}
                    onChange={(event) => updateEntry(index, { target: event.target.value })}
                    disabled={busy}
                    maxLength={150}
                  />
                </td>
                <td>
                  <label className={styles.srOnly} htmlFor={`glossary-variants-${index}`}>
                    Accepted targets for {entry.source}
                  </label>
                  <textarea
                    id={`glossary-variants-${index}`}
                    rows={1}
                    value={draft.acceptedTargetInputs[index] ?? ""}
                    onChange={(event) => onDraftChange((current) => (
                      updateAcceptedTargetInput(current, index, event.target.value)
                    ))}
                    onBlur={() => onDraftChange((current) => (
                      commitAcceptedTargetInput(current, index)
                    ))}
                    disabled={busy}
                    placeholder="One variant per line"
                  />
                </td>
                <td>
                  <GlossarySelect
                    label={`Kind for ${entry.source}`}
                    value={entry.kind}
                    options={KIND_OPTIONS}
                    onChange={(kind) => updateEntryKind(index, kind)}
                    disabled={busy}
                  />
                </td>
                <td>
                  {entry.kind === "character" && (
                    <GlossaryGenderPicker
                      label={`Gender for ${entry.source}`}
                      value={entry.gender}
                      disabled={busy}
                      onChange={(gender) => updateEntry(index, { gender })}
                    />
                  )}
                </td>
                <td>
                  <label className={styles.srOnly} htmlFor={`glossary-note-${index}`}>
                    Note for {entry.source}
                  </label>
                  <textarea
                    id={`glossary-note-${index}`}
                    rows={1}
                    value={entry.note}
                    onChange={(event) => updateEntry(index, { note: event.target.value })}
                    disabled={busy}
                    maxLength={300}
                  />
                </td>
                <td className={styles.usageCount}>{usageCount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredEntries.length === 0 && (
          <p className={styles.emptyTable}>No glossary entries match these filters.</p>
        )}
      </div>
    </>
  );
}
