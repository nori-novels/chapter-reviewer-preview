"use client";

import type { ReactElement } from "react";
import type { GlossaryEntry } from "@/features/preview/types";
import styles from "./glossaryReview.module.css";

type PickableGender = Extract<GlossaryEntry["gender"], "male" | "female" | "unknown">;

const PICKABLE_GENDERS: readonly PickableGender[] = ["male", "female", "unknown"];

export interface GlossaryGenderPickerProps {
  label: string;
  value: GlossaryEntry["gender"];
  disabled?: boolean;
  onChange: (gender: GlossaryEntry["gender"]) => void;
}

function MaleIcon(): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true" focusable="false">
      <circle cx="8" cy="4.9" r="3.3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 15.1 L5.9 10.3 L10.1 10.3 Z" fill="currentColor" />
    </svg>
  );
}

function FemaleIcon(): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true" focusable="false">
      <circle cx="8" cy="4.9" r="3.3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 10.3 L5.9 15.1 L10.1 15.1 Z" fill="currentColor" />
    </svg>
  );
}

const GENDER_ICONS: Record<PickableGender, ReactElement> = {
  male: <MaleIcon />,
  female: <FemaleIcon />,
  unknown: <span aria-hidden="true">?</span>,
};

// Three-way gender toggle replacing the old dropdown. Legacy "nonbinary"
// values render with no icon selected and are preserved until an icon is
// clicked.
export function GlossaryGenderPicker({
  label,
  value,
  disabled = false,
  onChange,
}: GlossaryGenderPickerProps) {
  return (
    <div className={styles.genderGroup} role="group" aria-label={label}>
      {PICKABLE_GENDERS.map((gender) => (
        <button
          key={gender}
          type="button"
          className={styles.genderButton}
          data-gender={gender}
          aria-pressed={value === gender}
          aria-label={`${label}: ${gender}`}
          disabled={disabled}
          onClick={() => onChange(gender)}
        >
          {GENDER_ICONS[gender]}
        </button>
      ))}
    </div>
  );
}
