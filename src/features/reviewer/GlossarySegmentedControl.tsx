"use client";

import { useImperativeHandle, useRef, type ReactNode, type Ref } from "react";
import styles from "./glossaryReview.module.css";

export interface GlossarySegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Accessible name for icon-only segments. */
  ariaLabel?: string;
  /** Hover tooltip shown below the segment, like the reader navbar icons. */
  tooltip?: string;
}

export interface GlossarySegmentedControlHandle {
  focus: (options?: FocusOptions) => void;
}

export interface GlossarySegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: readonly GlossarySegmentOption<T>[];
  disabled?: boolean;
  onChange: (value: T) => void;
  ref?: Ref<GlossarySegmentedControlHandle>;
}

// Glossary filter control styled after the reviewer's segmented slider.
export function GlossarySegmentedControl<T extends string>({
  label,
  value,
  options,
  disabled = false,
  onChange,
  ref,
}: GlossarySegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useImperativeHandle(ref, () => ({
    focus: (focusOptions) => {
      const container = containerRef.current;
      const target = container?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
        ?? container?.querySelector<HTMLButtonElement>("button");
      target?.focus(focusOptions);
    },
  }), []);

  return (
    <div ref={containerRef} className={styles.segmentGroup} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.segmentButton}
          aria-pressed={option.value === value}
          aria-label={option.ariaLabel}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.tooltip !== undefined && (
            <span className={styles.segmentTip} aria-hidden="true">{option.tooltip}</span>
          )}
        </button>
      ))}
    </div>
  );
}
