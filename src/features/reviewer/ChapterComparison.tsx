"use client";

import {
  useCallback,
  useEffect,
  type RefObject,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/components/Toast/Toast";
import type { GlossaryEntry } from "@/features/preview/types";
import type { QaWarningOccurrence, QaWarningParagraph } from "./qa-warnings";
import {
  type ComparisonPreferences,
  type ReviewParagraphDraft,
  highlightSourceText,
  MISSING_SOURCE_MESSAGE,
  normalizeReviewParagraphInput,
  pairEditableReviewParagraphs,
  proportionalScrollTop,
  replaceReviewParagraphByIdentity,
} from "./chapter-review";
import styles from "./chapterReview.module.css";
import {
  type FindCurrentMatch,
  type FindHighlightQuery,
  splitByMatches,
} from "./find-replace";
import {
  describeTlNoteRegion,
  MAX_TL_NOTE_ITEM_CHARACTERS,
  removeAllTlNotes,
  removeTlNoteAt,
} from "./tl-note";
import { copyToClipboard } from "./copy-to-clipboard";

export interface ComparisonScrollTarget {
  // Translation-side row (or "title"); glossary occurrences may pair it with
  // a different source-side row after editorial merges/splits.
  paragraph: QaWarningParagraph;
  sourceParagraph?: QaWarningParagraph;
  nonce: number;
}

interface ChapterComparisonProps {
  preferences: ComparisonPreferences;
  missingSource: boolean;
  sourceTitle: string;
  sourceBody: string;
  glossaryMismatches: GlossaryEntry[];
  title: string;
  body: string;
  disabled: boolean;
  titleInputRef: RefObject<HTMLInputElement | null>;
  privacyRoot: HTMLDivElement | null;
  tooltipBoundaryRef: RefObject<HTMLDivElement | null>;
  scrollTarget?: ComparisonScrollTarget | null;
  highlightedOccurrence?: QaWarningOccurrence | null;
  findQuery?: FindHighlightQuery | null;
  findCurrent?: FindCurrentMatch | null;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
}

interface ActiveTranslationDraft extends ReviewParagraphDraft {
  sourceTitle: string;
  sourceBody: string;
  expectedBody: string;
}

function HighlightedSource({
  text,
  glossaryMismatches,
  tooltipId,
  onBlurTooltip,
  onFocusTooltip,
  onHoverTooltip,
  onLeaveTooltip,
  onCopy,
}: Pick<ChapterComparisonProps, "glossaryMismatches"> & {
  text: string;
  tooltipId: string;
  onBlurTooltip: (anchor: HTMLElement) => void;
  onFocusTooltip: (anchor: HTMLElement, target: string) => void;
  onHoverTooltip: (anchor: HTMLElement, target: string) => void;
  onLeaveTooltip: (anchor: HTMLElement) => void;
  onCopy: (term: string) => void;
}) {
  return highlightSourceText(text, glossaryMismatches).map((segment, index) => (
    segment.target === undefined ? (
      <span key={`${index}-${segment.text}`}>{segment.text}</span>
    ) : (
      <button
        type="button"
        className={styles.glossaryHighlightWrap}
        key={`${index}-${segment.text}`}
        aria-describedby={tooltipId}
        onClick={() => onCopy(segment.text)}
        onMouseEnter={(event) => onHoverTooltip(event.currentTarget, segment.target!)}
        onMouseLeave={(event) => onLeaveTooltip(event.currentTarget)}
        onFocus={(event) => onFocusTooltip(event.currentTarget, segment.target!)}
        onBlur={(event) => onBlurTooltip(event.currentTarget)}
      >
        <mark
          className={styles.glossaryHighlight}
          data-testid={`glossary-highlight-${segment.text}`}
        >
          {segment.text}
        </mark>
      </button>
    )
  ));
}

function scrollableRange(element: HTMLElement): number {
  return Math.max(0, element.scrollHeight - element.clientHeight);
}

function readScrollRatio(element: HTMLElement): number {
  const range = scrollableRange(element);
  return range === 0 ? 0 : element.scrollTop / range;
}

function applyScrollRatio(element: HTMLElement | null, ratio: number) {
  if (!element) return;
  const range = scrollableRange(element);
  if (range > 0) element.scrollTop = ratio * range;
}

// Textareas cannot contain markup, so find matches are highlighted by a
// mirror layer rendered behind each transparent-background field. The layer
// repeats the field's exact text (transparent) so the yellow marks line up
// with the characters the reviewer sees.
function FindBackdrop({
  text,
  query,
  currentIndex = -1,
}: {
  text: string;
  query: FindHighlightQuery;
  currentIndex?: number;
}) {
  return (
    <div className={styles.findBackdrop} aria-hidden="true">
      {splitByMatches(text, query.query, query.caseSensitive, currentIndex).map((segment, index) => (
        segment.match
          ? (
            <mark
              key={index}
              className={segment.current ? styles.findMatchMarkCurrent : styles.findMatchMark}
            >
              {segment.text}
            </mark>
          )
          : <span key={index}>{segment.text}</span>
      ))}
      {/* Zero-width space keeps a trailing empty line the same height the
          textarea gives it. */}
      {"​"}
    </div>
  );
}

export function ChapterComparison({
  preferences,
  missingSource,
  sourceTitle,
  sourceBody,
  glossaryMismatches,
  title,
  body,
  disabled,
  titleInputRef,
  privacyRoot,
  tooltipBoundaryRef,
  scrollTarget,
  highlightedOccurrence,
  findQuery,
  findCurrent,
  onTitleChange,
  onBodyChange,
}: ChapterComparisonProps) {
  const highlightedSourceParagraph = highlightedOccurrence?.paragraph ?? null;
  const highlightedTranslationParagraph = highlightedOccurrence
    ? highlightedOccurrence.translationParagraph ?? highlightedOccurrence.paragraph
    : null;
  const { show: showToast } = useToast();
  const sourceHeadingId = useId();
  const englishHeadingId = useId();
  const glossaryTooltipId = useId();
  const sourceScrollerRef = useRef<HTMLElement | null>(null);
  const englishScrollerRef = useRef<HTMLElement | null>(null);
  const sourceRowRefs = useRef(new Map<number, HTMLDivElement>());
  const englishRowRefs = useRef(new Map<number, HTMLElement>());
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const scrollGuardRef = useRef(false);
  // Both layouts scroll the same two panes, so the reviewer's position is
  // carried across an Align paragraphs toggle proportionally (see below).
  const sourceRatioRef = useRef(0);
  const englishRatioRef = useRef(0);
  const alignParagraphsRef = useRef(preferences.alignParagraphs);
  const lastScrollTargetNonceRef = useRef(scrollTarget?.nonce ?? 0);
  const pendingRestoreRef = useRef<{ source: number; english: number } | null>(null);
  const [alignedRowHeights, setAlignedRowHeights] = useState<Record<number, number>>({});
  type TooltipTarget = {
    anchor: HTMLElement;
    target: string;
  };
  const [hoveredTooltip, setHoveredTooltip] = useState<TooltipTarget | null>(null);
  const [focusedTooltip, setFocusedTooltip] = useState<TooltipTarget | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ left: 0, top: 0 });
  const [activeTranslationDraft, setActiveTranslationDraft] =
    useState<ActiveTranslationDraft | null>(null);
  const activeTooltip = hoveredTooltip ?? focusedTooltip;
  const currentTranslationDraft = activeTranslationDraft?.sourceTitle === sourceTitle
    && activeTranslationDraft.sourceBody === sourceBody
    && activeTranslationDraft.expectedBody === body
    ? activeTranslationDraft
    : undefined;

  const blurTooltip = useCallback((anchor: HTMLElement) => {
    setFocusedTooltip((current) => current?.anchor === anchor ? null : current);
  }, []);

  const focusTooltip = useCallback((anchor: HTMLElement, target: string) => {
    setFocusedTooltip({ anchor, target });
  }, []);

  const hoverTooltip = useCallback((anchor: HTMLElement, target: string) => {
    setHoveredTooltip({ anchor, target });
  }, []);

  const leaveTooltip = useCallback((anchor: HTMLElement) => {
    setHoveredTooltip((current) => current?.anchor === anchor ? null : current);
  }, []);

  const copyGlossaryTerm = useCallback((term: string) => {
    copyToClipboard(term);
    showToast("Term copied to clipboard");
  }, [showToast]);

  const clearTooltipAnchor = useCallback((anchor: HTMLElement) => {
    setHoveredTooltip((current) => current?.anchor === anchor ? null : current);
    setFocusedTooltip((current) => current?.anchor === anchor ? null : current);
  }, []);

  useLayoutEffect(() => {
    if (!activeTooltip || !tooltipRef.current || !tooltipBoundaryRef.current) return;
    const tooltipState = activeTooltip;

    function positionTooltip() {
      const tooltip = tooltipRef.current;
      const boundary = tooltipBoundaryRef.current;
      if (!tooltip || !boundary) return;
      if (!tooltipState.anchor.isConnected) {
        clearTooltipAnchor(tooltipState.anchor);
        return;
      }
      const anchorBox = tooltipState.anchor.getBoundingClientRect();
      const tooltipBox = tooltip.getBoundingClientRect();
      const boundaryBox = boundary.getBoundingClientRect();
      const gap = 8;
      const inset = 8;
      const minLeft = Math.max(0, boundaryBox.left) + inset;
      const maxRight = Math.min(window.innerWidth, boundaryBox.right) - inset;
      const minTop = Math.max(0, boundaryBox.top) + inset;
      const maxBottom = Math.min(window.innerHeight, boundaryBox.bottom) - inset;
      const maxLeft = Math.max(minLeft, maxRight - tooltipBox.width);
      const left = Math.min(
        maxLeft,
        Math.max(minLeft, anchorBox.left + anchorBox.width / 2 - tooltipBox.width / 2),
      );
      const above = anchorBox.top - tooltipBox.height - gap;
      const preferredTop = above >= minTop ? above : anchorBox.bottom + gap;
      const maxTop = Math.max(minTop, maxBottom - tooltipBox.height);
      setTooltipPosition({
        left,
        top: Math.min(maxTop, Math.max(minTop, preferredTop)),
      });
    }

    positionTooltip();
    window.addEventListener("resize", positionTooltip);
    window.addEventListener("scroll", positionTooltip, true);
    return () => {
      window.removeEventListener("resize", positionTooltip);
      window.removeEventListener("scroll", positionTooltip, true);
    };
  }, [activeTooltip, clearTooltipAnchor, tooltipBoundaryRef]);

  function handlePaneScroll(
    source: HTMLElement,
    sourceRatio: RefObject<number>,
    target: HTMLElement | null,
  ) {
    sourceRatio.current = readScrollRatio(source);
    if (!preferences.syncScrolling || scrollGuardRef.current || !target) return;
    scrollGuardRef.current = true;
    target.scrollTop = proportionalScrollTop(source, target);
    requestAnimationFrame(() => {
      scrollGuardRef.current = false;
    });
  }

  // Jump to a QA warning occurrence. Scrolling the English row fires the
  // existing proportional sync toward the source pane; when sync scrolling is
  // off, both rows scroll explicitly.
  useEffect(() => {
    if (!scrollTarget) return;
    if (scrollTarget.paragraph === "title") {
      titleInputRef.current?.scrollIntoView({ block: "center", behavior: "instant" });
      return;
    }
    const englishRow = englishRowRefs.current.get(scrollTarget.paragraph);
    englishRow?.scrollIntoView({ block: "center", behavior: "instant" });
    if (!preferences.syncScrolling) {
      const sourceParagraph = scrollTarget.sourceParagraph ?? scrollTarget.paragraph;
      if (sourceParagraph !== "title") {
        sourceRowRefs.current.get(sourceParagraph)
          ?.scrollIntoView({ block: "center", behavior: "instant" });
      }
    }
    // Re-scroll only on a new navigation request, not on preference changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTarget]);

  const alignedPairs = pairEditableReviewParagraphs(
    sourceBody,
    body,
    currentTranslationDraft,
  );
  const nextAppendableTranslation = alignedPairs.find(
    (pair) => pair.translationEditable && pair.translationLineIndex === null,
  );

  const tlRegion = describeTlNoteRegion(body);
  const classifiedRows = alignedPairs.map((pair) => {
    if (!tlRegion || pair.translationLineIndex === null) {
      return { pair, role: "prose" as const, noteIndex: -1 };
    }
    if (pair.translationLineIndex === tlRegion.headerLineIndex) {
      return { pair, role: "header" as const, noteIndex: -1 };
    }
    const noteIndex = tlRegion.noteLineIndices.indexOf(pair.translationLineIndex);
    return noteIndex >= 0
      ? { pair, role: "note" as const, noteIndex }
      : { pair, role: "prose" as const, noteIndex: -1 };
  });

  useLayoutEffect(() => {
    const pairedIndices = new Set(
      Array.from({ length: alignedPairs.length }, (_, index) => index),
    );
    const measureRows = () => {
      setAlignedRowHeights((current) => {
        const next: Record<number, number> = {};

        for (const index of pairedIndices) {
          const sourceRow = sourceRowRefs.current.get(index);
          const englishRow = englishRowRefs.current.get(index);
          if (sourceRow && englishRow) {
            next[index] = Math.max(sourceRow.scrollHeight, englishRow.scrollHeight);
          }
        }

        const currentIndices = Object.keys(current).map(Number);
        const changed = currentIndices.length !== Object.keys(next).length
          || currentIndices.some((index) => current[index] !== next[index]);
        return changed ? next : current;
      });
    };

    if (!preferences.alignParagraphs) {
      measureRows();
      return;
    }

    measureRows();
    if (typeof ResizeObserver === "undefined") return;

    const observers = [
      ...sourceRowRefs.current.entries(),
      ...englishRowRefs.current.entries(),
    ].flatMap(([index, row]) => {
      if (!pairedIndices.has(index)) return [];
      const observer = new ResizeObserver(measureRows);
      observer.observe(row);
      return [observer];
    });

    return () => observers.forEach((observer) => observer.disconnect());
  }, [alignedPairs.length, preferences.alignParagraphs]);

  // Toggling Align paragraphs swaps what the panes contain but keeps the same
  // scroll containers, and the two layouts have different content heights, so
  // the reviewer would otherwise be dropped back near the top (or, once the
  // shorter layout clamps scrollTop, to the bottom). The ratios are snapshotted
  // synchronously - the swap clamps scrollTop and fires scroll events, which
  // would overwrite them - then reapplied on every commit until a frame has
  // passed. Reapplying is what keeps the position stable through the commit
  // that adds the measured aligned row heights: both commits land before the
  // browser paints, so the reviewer never sees an intermediate position.
  // A QA-warning or find jump can turn alignment on as part of the same update;
  // that jump owns the position, so the carried-over one is dropped.
  useLayoutEffect(() => {
    const nonce = scrollTarget?.nonce ?? 0;
    const jumped = nonce !== lastScrollTargetNonceRef.current;
    lastScrollTargetNonceRef.current = nonce;
    if (alignParagraphsRef.current !== preferences.alignParagraphs) {
      alignParagraphsRef.current = preferences.alignParagraphs;
      pendingRestoreRef.current = jumped
        ? null
        : { source: sourceRatioRef.current, english: englishRatioRef.current };
    }
    const pending = pendingRestoreRef.current;
    if (!pending) return;
    const restore = () => {
      // With sync scrolling on, the source pane follows the English one through
      // the existing proportional sync. Restoring it as well would have the two
      // panes fight over each other's snapshots - and a pane that was too short
      // to scroll in the previous layout would drag its partner to the top.
      if (!preferences.syncScrolling) {
        applyScrollRatio(sourceScrollerRef.current, pending.source);
      }
      applyScrollRatio(englishScrollerRef.current, pending.english);
    };
    restore();
    const frame = requestAnimationFrame(() => {
      restore();
      pendingRestoreRef.current = null;
    });
    return () => cancelAnimationFrame(frame);
  });

  // One shell for both layouts: the pane headers, the editable title and the
  // divider above the panes are identical whether or not paragraphs are
  // aligned, and only the pane contents swap (aligned rows, or the chapter as
  // continuous prose). The panes themselves are the scroll containers in both
  // layouts, which is also what lets the toggle preserve reading position.
  return (
    <div className={styles.comparison}>
      <div className={styles.comparisonLayout}>
        <div className={styles.comparisonHeader}>
          <div>
            <div className={styles.paneHeader}>
              <h3 id={sourceHeadingId}>Chinese source</h3>
              <span>Read only</span>
            </div>
            {!missingSource && (
              <div className={styles.sourceTitle} data-testid="chapter-source-title">
                <HighlightedSource
                  text={sourceTitle}
                  glossaryMismatches={glossaryMismatches}
                  tooltipId={glossaryTooltipId}
                  onCopy={copyGlossaryTerm}
                  onBlurTooltip={blurTooltip}
                  onFocusTooltip={focusTooltip}
                  onHoverTooltip={hoverTooltip}
                  onLeaveTooltip={leaveTooltip}
                />
              </div>
            )}
          </div>
          <div>
            <div className={styles.paneHeader}>
              <h3 id={englishHeadingId}>English</h3>
              <span>Editable</span>
            </div>
            <div className={styles.field}>
              <input
                ref={titleInputRef}
                aria-label="English title"
                className={`${styles.input} ${
                  highlightedTranslationParagraph === "title" ? styles.warningTargetField : ""
                }`}
                data-testid="chapter-english-title"
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                disabled={disabled}
                maxLength={300}
              />
            </div>
          </div>
        </div>
        <div className={styles.comparisonPanes}>
          <section
            ref={sourceScrollerRef}
            className={`${styles.paneScroller} ${
              missingSource ? styles.missingSourceRows : ""
            }`}
            data-testid="chapter-source-scroller"
            aria-labelledby={sourceHeadingId}
            onScroll={(event) => handlePaneScroll(
              event.currentTarget,
              sourceRatioRef,
              englishScrollerRef.current,
            )}
          >
            {missingSource ? (
              <div className={styles.missingSourcePanel}>{MISSING_SOURCE_MESSAGE}</div>
            ) : preferences.alignParagraphs ? classifiedRows.map(({ pair, role }) => {
              const isTlNoteRow = role !== "prose";
              return (
                <div
                  ref={(node) => {
                    if (node) sourceRowRefs.current.set(pair.index, node);
                    else sourceRowRefs.current.delete(pair.index);
                  }}
                  className={`${styles.alignedSource} ${
                    highlightedSourceParagraph === pair.index ? styles.warningTargetRow : ""
                  }`}
                  key={pair.index}
                  {...(isTlNoteRow
                    ? {}
                    : { role: "group", "aria-label": `Paragraph ${pair.index + 1}` })}
                  style={{ minHeight: alignedRowHeights[pair.index] }}
                >
                  {!isTlNoteRow && (
                    <>
                      <span className={styles.paragraphLabel}>
                        Paragraph {pair.index + 1}
                      </span>
                      <div className={styles.paragraphContent}>
                        <HighlightedSource
                          text={pair.source}
                          glossaryMismatches={glossaryMismatches}
                          tooltipId={glossaryTooltipId}
                          onCopy={copyGlossaryTerm}
                          onBlurTooltip={blurTooltip}
                          onFocusTooltip={focusTooltip}
                          onHoverTooltip={hoverTooltip}
                          onLeaveTooltip={leaveTooltip}
                        />
                      </div>
                    </>
                  )}
                </div>
              );
            }) : (
              <div className={styles.proseColumn}>
                <div className={styles.sourceBody} data-testid="chapter-source-body">
                  <HighlightedSource
                    text={sourceBody}
                    glossaryMismatches={glossaryMismatches}
                    tooltipId={glossaryTooltipId}
                    onCopy={copyGlossaryTerm}
                    onBlurTooltip={blurTooltip}
                    onFocusTooltip={focusTooltip}
                    onHoverTooltip={hoverTooltip}
                    onLeaveTooltip={leaveTooltip}
                  />
                </div>
              </div>
            )}
          </section>
          <section
            ref={englishScrollerRef}
            className={styles.paneScroller}
            data-testid="chapter-english-scroller"
            aria-labelledby={englishHeadingId}
            onScroll={(event) => handlePaneScroll(
              event.currentTarget,
              englishRatioRef,
              sourceScrollerRef.current,
            )}
          >
            {preferences.alignParagraphs ? classifiedRows.map(({ pair, role, noteIndex }) => {
              if (role === "header") {
                return (
                  <div
                    ref={(node) => {
                      if (node) englishRowRefs.current.set(pair.index, node);
                      else englishRowRefs.current.delete(pair.index);
                    }}
                    className={styles.alignedEnglish}
                    key={pair.translationKey}
                    style={{ minHeight: alignedRowHeights[pair.index] }}
                  >
                    <span className={styles.tlNoteLabelRow}>
                      <span className={styles.paragraphLabel}>Translator Notes</span>
                      <button
                        type="button"
                        className={styles.tlDeleteButton}
                        aria-label="Delete all translator notes"
                        disabled={disabled}
                        onClick={() => onBodyChange(removeAllTlNotes(body))}
                      >
                        Delete all
                      </button>
                    </span>
                  </div>
                );
              }
              if (role === "note") {
                return (
                  <div
                    ref={(node) => {
                      if (node) englishRowRefs.current.set(pair.index, node);
                      else englishRowRefs.current.delete(pair.index);
                    }}
                    className={styles.alignedEnglish}
                    key={pair.translationKey}
                    style={{ minHeight: alignedRowHeights[pair.index] }}
                  >
                    <span className={styles.tlNoteLabelRow}>
                      <span className={styles.paragraphLabel}>Translator Note</span>
                      <button
                        type="button"
                        className={styles.tlDeleteButton}
                        aria-label={`Delete translator note ${noteIndex + 1}`}
                        disabled={disabled}
                        onClick={() => onBodyChange(removeTlNoteAt(body, noteIndex))}
                      >
                        Delete
                      </button>
                    </span>
                    <div className={styles.findFieldWrap}>
                      {findQuery && (
                        <FindBackdrop
                          text={pair.translation}
                          query={findQuery}
                          currentIndex={findCurrent && findCurrent.paragraph === pair.index
                            ? findCurrent.indexInParagraph
                            : -1}
                        />
                      )}
                      <textarea
                        className={styles.alignedInput}
                        aria-label={`Translator Note ${noteIndex + 1}`}
                        value={pair.translation}
                        onFocus={() => setActiveTranslationDraft({
                          rowIndex: pair.index,
                          backingLineIndex: pair.translationLineIndex,
                          key: pair.translationKey,
                          value: pair.translation,
                          sourceTitle,
                          sourceBody,
                          expectedBody: body,
                        })}
                        onBlur={() => setActiveTranslationDraft((current) => (
                          current?.key === pair.translationKey ? null : current
                        ))}
                        onChange={(event) => {
                          const value = normalizeReviewParagraphInput(event.target.value);
                          if (value.trim().length === 0) {
                            setActiveTranslationDraft(null);
                            onBodyChange(removeTlNoteAt(body, noteIndex));
                            return;
                          }
                          const identity = currentTranslationDraft?.key === pair.translationKey
                            ? currentTranslationDraft
                            : {
                                rowIndex: pair.index,
                                backingLineIndex: pair.translationLineIndex,
                              };
                          const replacement = replaceReviewParagraphByIdentity(
                            body,
                            identity,
                            value,
                          );
                          setActiveTranslationDraft({
                            rowIndex: pair.index,
                            backingLineIndex: replacement.backingLineIndex,
                            key: pair.translationKey,
                            value,
                            sourceTitle,
                            sourceBody,
                            expectedBody: replacement.text,
                          });
                          onBodyChange(replacement.text);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                            event.preventDefault();
                          }
                        }}
                        disabled={disabled}
                        maxLength={MAX_TL_NOTE_ITEM_CHARACTERS}
                        rows={1}
                      />
                    </div>
                  </div>
                );
              }
              return (
                <label
                  ref={(node) => {
                    if (node) englishRowRefs.current.set(pair.index, node);
                    else englishRowRefs.current.delete(pair.index);
                  }}
                  className={`${styles.alignedEnglish} ${
                    highlightedTranslationParagraph === pair.index ? styles.warningTargetRow : ""
                  }`}
                  key={pair.translationKey}
                  style={{ minHeight: alignedRowHeights[pair.index] }}
                >
                  <span className={styles.paragraphLabel}>Translation {pair.index + 1}</span>
                  <div className={styles.findFieldWrap}>
                    {findQuery && (
                      <FindBackdrop
                        text={pair.translation}
                        query={findQuery}
                        currentIndex={findCurrent && findCurrent.paragraph === pair.index
                          ? findCurrent.indexInParagraph
                          : -1}
                      />
                    )}
                    <textarea
                      className={styles.alignedInput}
                      aria-label={`Translation ${pair.index + 1}`}
                      value={pair.translation}
                      onFocus={() => setActiveTranslationDraft({
                        rowIndex: pair.index,
                        backingLineIndex: pair.translationLineIndex,
                        key: pair.translationKey,
                        value: pair.translation,
                        sourceTitle,
                        sourceBody,
                        expectedBody: body,
                      })}
                      onBlur={() => setActiveTranslationDraft((current) => (
                        current?.key === pair.translationKey ? null : current
                      ))}
                      onChange={(event) => {
                        if (!pair.translationEditable) return;
                        const value = normalizeReviewParagraphInput(event.target.value);
                        const identity = currentTranslationDraft?.key === pair.translationKey
                          ? currentTranslationDraft
                          : {
                              rowIndex: pair.index,
                              backingLineIndex: pair.translationLineIndex,
                            };
                        const replacement = replaceReviewParagraphByIdentity(
                          body,
                          identity,
                          value,
                        );
                        setActiveTranslationDraft({
                          rowIndex: pair.index,
                          backingLineIndex: replacement.backingLineIndex,
                          key: pair.translationKey,
                          value,
                          sourceTitle,
                          sourceBody,
                          expectedBody: replacement.text,
                        });
                        onBodyChange(replacement.text);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                          event.preventDefault();
                        }
                      }}
                      disabled={disabled || !pair.translationEditable}
                      title={!pair.translationEditable && nextAppendableTranslation
                        ? `Fill Translation ${nextAppendableTranslation.index + 1} first.`
                        : undefined}
                      maxLength={500_000}
                      rows={1}
                    />
                  </div>
                </label>
              );
            }) : (
              <div className={styles.proseColumn}>
                <div className={`${styles.findFieldWrap} ${styles.bodyFieldWrap}`}>
                  {findQuery && (
                    <FindBackdrop
                      text={body}
                      query={findQuery}
                      currentIndex={findCurrent ? findCurrent.ordinal : -1}
                    />
                  )}
                  <textarea
                    className={styles.bodyInput}
                    aria-label="English body"
                    data-testid="chapter-english-body"
                    value={body}
                    onChange={(event) => onBodyChange(event.target.value)}
                    disabled={disabled}
                    maxLength={500_000}
                    rows={1}
                  />
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
      {activeTooltip && privacyRoot && createPortal(
        <span
          ref={tooltipRef}
          id={glossaryTooltipId}
          className={styles.glossaryTooltip}
          role="tooltip"
          style={{ left: tooltipPosition.left, top: tooltipPosition.top }}
        >
          {activeTooltip.target}
        </span>,
        privacyRoot,
      )}
    </div>
  );
}
