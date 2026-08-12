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
import {
  PREVIEW_UNAVAILABLE_MESSAGE,
  type PreviewGuard,
} from "@/features/preview/copy";
import type { PreviewFixture } from "@/features/preview/fixture";
import type { GlossaryEntry } from "@/features/preview/types";
import { ChapterComparison, type ComparisonScrollTarget } from "./ChapterComparison";
import { ChapterIndexMenu } from "./ChapterIndexMenu";
import { ChapterQaSidebar } from "./ChapterQaSidebar";
import { ChapterReviewMetadata } from "./ChapterReviewMetadata";
import { FindReplacePanel, type FindReplaceState } from "./FindReplacePanel";
import { PreviewAnnouncementHelp } from "./PreviewAnnouncementHelp";
import { PreviewGlossaryModal } from "./PreviewGlossaryModal";
import { PreviewRetryModal } from "./PreviewRetryModal";
import {
  type ComparisonPreferences,
  requiresApprovalOverride,
} from "./chapter-review";
import type { FindCurrentMatch } from "./find-replace";
import { glossaryUsageBySource } from "./glossary";
import {
  collectQaWarnings,
  qaWarningKey,
  type QaWarningOccurrence,
} from "./qa-warnings";
import styles from "./chapterReview.module.css";

const FOCUSABLE = [
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function readActiveSelection(): string {
  const active = document.activeElement;
  if (!(active instanceof HTMLTextAreaElement) && !(active instanceof HTMLInputElement)) {
    return "";
  }
  const { selectionStart, selectionEnd, value } = active;
  if (selectionStart === null || selectionEnd === null) return "";
  return value.slice(selectionStart, selectionEnd).replace(/\r\n?|\n/gu, " ").trim();
}

function isUsableFocusTarget(target: HTMLElement): boolean {
  return target.isConnected
    && !target.hidden
    && !target.matches(":disabled")
    && target.getAttribute("aria-disabled") !== "true"
    && !target.closest("[inert], [aria-hidden='true']");
}

function trapTab(event: KeyboardEvent, container: HTMLElement | null) {
  if (event.key !== "Tab" || !container) return;
  const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter(isUsableFocusTarget);
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

export function PreviewChapterReviewer({ fixture }: { fixture: PreviewFixture }) {
  const { show } = useToast();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const indexOpenerRef = useRef<HTMLElement | null>(null);
  const findOpenerRef = useRef<HTMLElement | null>(null);
  const retryOpenerRef = useRef<HTMLElement | null>(null);
  const glossaryOpenerRef = useRef<HTMLElement | null>(null);
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const findOpenRef = useRef(false);
  const helpDrawerOpenRef = useRef(false);
  const [title, setTitle] = useState(fixture.chapter.translatedTitle ?? "");
  const [body, setBody] = useState(fixture.chapter.translatedBody);
  const [privacyRoot, setPrivacyRoot] = useState<HTMLDivElement | null>(null);
  const [indexOpen, setIndexOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [selectedWarning, setSelectedWarning] = useState<{
    key: string;
    occurrenceIndex: number;
  } | null>(null);
  const [scrollTarget, setScrollTarget] = useState<ComparisonScrollTarget | null>(null);
  const [preferences, setPreferences] = useState<ComparisonPreferences>({
    alignParagraphs: true,
    syncScrolling: true,
  });
  const [findOpen, setFindOpen] = useState(false);
  const [findState, setFindState] = useState<FindReplaceState>({
    query: "",
    replacement: "",
    caseSensitive: false,
  });
  const [findCurrent, setFindCurrent] = useState<FindCurrentMatch | null>(null);
  const [retryOpen, setRetryOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  // The working glossary. Editing it re-runs mismatch and pronoun detection
  // against the current draft, exactly as saving does in the real reviewer.
  const [glossary, setGlossary] = useState<GlossaryEntry[]>(
    () => fixture.chapter.relevantGlossary.map((entry) => ({
      ...entry,
      acceptedTargets: [...entry.acceptedTargets],
    })),
  );

  const showPreviewUnavailable: PreviewGuard = useCallback(
    () => show(PREVIEW_UNAVAILABLE_MESSAGE),
    [show],
  );

  const focusInsideDialog = useCallback((preferred: HTMLElement | null = null) => {
    requestAnimationFrame(() => {
      const focusTarget = preferred?.isConnected
        ? preferred
        : titleInputRef.current ?? closeButtonRef.current ?? dialogRef.current;
      focusTarget?.focus({ preventScroll: true });
    });
  }, []);

  const closeFindPanel = useCallback(() => {
    findOpenRef.current = false;
    setFindOpen(false);
    setFindCurrent(null);
    focusInsideDialog(findOpenerRef.current);
  }, [focusInsideDialog]);

  const closeIndexMenu = useCallback((restoreFocus = false) => {
    setIndexOpen(false);
    if (restoreFocus) focusInsideDialog(indexOpenerRef.current);
  }, [focusInsideDialog]);

  const closeRetryModal = useCallback(() => {
    setSidebarExpanded(true);
    setRetryOpen(false);
    focusInsideDialog(retryOpenerRef.current);
  }, [focusInsideDialog]);

  const closeGlossaryModal = useCallback(() => {
    setSidebarExpanded(true);
    setGlossaryOpen(false);
    focusInsideDialog(glossaryOpenerRef.current);
  }, [focusInsideDialog]);

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
      if (retryOpen || glossaryOpen) return;
      if (helpDrawerOpenRef.current && event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.metaKey && event.altKey && event.code === "KeyF") {
        event.preventDefault();
        event.stopPropagation();
        if (findOpenRef.current) {
          closeFindPanel();
          return;
        }
        findOpenerRef.current = document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
        const selection = readActiveSelection();
        if (selection) setFindState((current) => ({ ...current, query: selection }));
        findOpenRef.current = true;
        setFindOpen(true);
        requestAnimationFrame(() => findInputRef.current?.focus());
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (indexOpen) {
          closeIndexMenu(true);
        } else if (findOpenRef.current) {
          closeFindPanel();
        } else {
          showPreviewUnavailable();
        }
        return;
      }
      trapTab(event, dialogRef.current);
    }
    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [
    closeFindPanel,
    closeIndexMenu,
    glossaryOpen,
    indexOpen,
    retryOpen,
    showPreviewUnavailable,
  ]);

  function togglePreference(key: keyof ComparisonPreferences) {
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
  }

  const approvalRequiresOverride = requiresApprovalOverride(fixture.chapter);

  const warnings = useMemo(() => collectQaWarnings({
    sourceTitle: fixture.chapter.sourceTitle,
    sourceBody: fixture.chapter.sourceBody,
    translatedTitle: title,
    translatedBody: body,
    glossary,
  }), [body, fixture.chapter, glossary, title]);
  const usageBySource = useMemo(() => glossaryUsageBySource(
    `${fixture.chapter.sourceTitle}\n${fixture.chapter.sourceBody}`,
    glossary.map((entry) => entry.source),
  ), [fixture.chapter, glossary]);
  const glossaryMismatches = useMemo(() => warnings.flatMap((warning) => (
    warning.type === "glossary_mismatch" ? [warning.entry] : []
  )), [warnings]);
  const pipelineNotices = fixture.chapter.deterministicQaCodes.filter((code) => (
    code === "editing_failed" || code === "tl_note_failed"
  ));
  const activeWarning = selectedWarning
    ? warnings.find((warning) => qaWarningKey(warning) === selectedWarning.key) ?? null
    : null;
  const highlightedOccurrence: QaWarningOccurrence | null = activeWarning && selectedWarning
    ? activeWarning.occurrences[
      Math.min(selectedWarning.occurrenceIndex, activeWarning.occurrences.length - 1)
    ] ?? null
    : null;

  function handleSelectWarning(key: string, occurrenceIndex: number) {
    const warning = warnings.find((candidate) => qaWarningKey(candidate) === key);
    if (!warning) return;
    const clamped = Math.max(0, Math.min(occurrenceIndex, warning.occurrences.length - 1));
    const occurrence = warning.occurrences[clamped];
    if (!occurrence) return;
    if (!preferences.alignParagraphs) togglePreference("alignParagraphs");
    setSelectedWarning({ key, occurrenceIndex: clamped });
    setScrollTarget((current) => ({
      paragraph: occurrence.translationParagraph ?? occurrence.paragraph,
      sourceParagraph: occurrence.paragraph,
      nonce: (current?.nonce ?? 0) + 1,
    }));
  }

  function handleFindNavigate(paragraph: number) {
    if (!preferences.alignParagraphs) togglePreference("alignParagraphs");
    setSelectedWarning(null);
    setScrollTarget((current) => ({
      paragraph,
      nonce: (current?.nonce ?? 0) + 1,
    }));
  }

  return (
    <div
      ref={setPrivacyRoot}
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) showPreviewUnavailable();
      }}
    >
      <div
        className={styles.dialog}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden={(retryOpen || glossaryOpen) || undefined}
        inert={(retryOpen || glossaryOpen) || undefined}
        tabIndex={-1}
      >
        <PreviewAnnouncementHelp
          fallbackFocus={() => focusInsideDialog(titleInputRef.current)}
          onDrawerOpenChange={(open) => {
            helpDrawerOpenRef.current = open;
          }}
        />
        <header className={styles.header}>
          <div className={styles.headingGroup}>
            <span className={styles.chapterNumber}>Chapter {fixture.chapter.ordinal}</span>
            <div className={styles.headingTitleRow}>
              <h2 id={titleId}>{title || `Chapter ${fixture.chapter.ordinal}`}</h2>
              <ChapterReviewMetadata
                pipelineStatus={fixture.chapter.pipelineStatus}
                hasTlNote={fixture.chapter.hasTlNote}
              />
            </div>
          </div>
          <div className={styles.chapterNav}>
            <button
              className={styles.iconButton}
              type="button"
              aria-label="Previous chapter"
              onClick={showPreviewUnavailable}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              <span className={styles.iconTip} aria-hidden="true">Previous chapter</span>
            </button>
            <ChapterIndexMenu
              chapters={fixture.chapters}
              currentOrdinal={fixture.chapter.ordinal}
              open={indexOpen}
              disabled={false}
              onToggle={(opener) => {
                indexOpenerRef.current = opener;
                setIndexOpen((current) => !current);
              }}
              onClose={closeIndexMenu}
              onNavigate={showPreviewUnavailable}
            />
            <button
              className={styles.iconButton}
              type="button"
              aria-label="Next chapter"
              onClick={showPreviewUnavailable}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
              <span className={styles.iconTip} aria-hidden="true">Next chapter</span>
            </button>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.toggleButton}
              type="button"
              aria-pressed={preferences.alignParagraphs}
              onClick={() => togglePreference("alignParagraphs")}
            >
              Align paragraphs
            </button>
            <button
              className={styles.toggleButton}
              type="button"
              aria-pressed={preferences.syncScrolling}
              onClick={() => togglePreference("syncScrolling")}
            >
              Sync scrolling
            </button>
            <button
              className={styles.iconButton}
              type="button"
              aria-label="Find and replace"
              aria-pressed={findOpen}
              onClick={(event) => {
                if (findOpen) {
                  closeFindPanel();
                  return;
                }
                findOpenerRef.current = event.currentTarget;
                findOpenRef.current = true;
                setFindOpen(true);
                requestAnimationFrame(() => findInputRef.current?.focus());
              }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <span className={styles.iconTip} aria-hidden="true">Find and replace</span>
            </button>
            <button
              ref={closeButtonRef}
              className={`${styles.iconButton} ${styles.closeButton}`}
              type="button"
              aria-label="Close chapter review"
              onClick={showPreviewUnavailable}
            >
              <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                <path d="M3.5 3.5 L12.5 12.5 M12.5 3.5 L3.5 12.5" />
              </svg>
            </button>
          </div>
          {/* The panel hangs off the header so it stays under the find icon
              whether or not the preview announcement is showing. */}
          {findOpen && (
            <FindReplacePanel
              body={body}
              state={findState}
              disabled={false}
              findInputRef={findInputRef}
              onStateChange={setFindState}
              onBodyChange={setBody}
              onNavigate={handleFindNavigate}
              onCurrentMatchChange={setFindCurrent}
              onClose={closeFindPanel}
            />
          )}
        </header>

        <div className={styles.main}>
          <ChapterQaSidebar
            warnings={warnings}
            pipelineNotices={pipelineNotices}
            expanded={sidebarExpanded}
            disabled={false}
            selectedKey={activeWarning && selectedWarning ? selectedWarning.key : null}
            selectedOccurrence={selectedWarning?.occurrenceIndex ?? 0}
            retranslateReason={null}
            onExpand={() => setSidebarExpanded(true)}
            onCollapse={() => setSidebarExpanded(false)}
            onSelectWarning={handleSelectWarning}
            onRetranslate={(opener) => {
              retryOpenerRef.current = opener;
              setRetryOpen(true);
            }}
            onOpenGlossary={(opener) => {
              glossaryOpenerRef.current = opener;
              setGlossaryOpen(true);
            }}
          />
          <ChapterComparison
            preferences={preferences}
            missingSource={fixture.chapter.sourceBody.trim().length === 0}
            sourceTitle={fixture.chapter.sourceTitle}
            sourceBody={fixture.chapter.sourceBody}
            glossaryMismatches={glossaryMismatches}
            title={title}
            body={body}
            disabled={false}
            titleInputRef={titleInputRef}
            privacyRoot={privacyRoot}
            tooltipBoundaryRef={dialogRef}
            scrollTarget={scrollTarget}
            highlightedOccurrence={highlightedOccurrence}
            findQuery={findOpen && findState.query.length > 0
              ? { query: findState.query, caseSensitive: findState.caseSensitive }
              : null}
            findCurrent={findOpen ? findCurrent : null}
            onTitleChange={setTitle}
            onBodyChange={setBody}
          />
        </div>

        <footer className={styles.footer}>
          <div className={styles.footerLeft} />
          <div className={styles.footerRight}>
            <Button type="button" variant="soft" onClick={showPreviewUnavailable}>
              Save changes
            </Button>
            <Button
              type="button"
              variant={approvalRequiresOverride ? "danger" : "primary"}
              onClick={showPreviewUnavailable}
            >
              {approvalRequiresOverride ? "Approve with override" : "Approve"}
            </Button>
          </div>
        </footer>
      </div>
      {retryOpen && (
        <PreviewRetryModal
          ordinal={fixture.chapter.ordinal}
          glossary={glossary}
          onClose={closeRetryModal}
          onSubmit={showPreviewUnavailable}
        />
      )}
      {glossaryOpen && (
        <PreviewGlossaryModal
          entries={glossary}
          usageBySource={usageBySource}
          onClose={closeGlossaryModal}
          onSave={setGlossary}
        />
      )}
    </div>
  );
}
