import type { ReactElement } from "react";
import type { GlossaryEntry } from "@/features/preview/types";

const KIND_SHAPES: Record<GlossaryEntry["kind"], ReactElement> = {
  character: (
    <>
      <circle cx="8" cy="5.1" r="2.7" />
      <path d="M2.9 13.6 C3.3 10.5 5.3 9.1 8 9.1 C10.7 9.1 12.7 10.5 13.1 13.6" />
    </>
  ),
  title: (
    <>
      <path d="M8 3.6 L10.3 7.8 L13.6 5.2 L12.4 11.3 H3.6 L2.4 5.2 L5.7 7.8 Z" />
      <path d="M4 13.7 H12" />
    </>
  ),
  place: (
    <>
      <path d="M8 14.2 C5.2 11.1 3.9 9 3.9 6.9 A4.1 4.1 0 0 1 12.1 6.9 C12.1 9 10.8 11.1 8 14.2 Z" />
      <circle cx="8" cy="6.9" r="1.5" />
    </>
  ),
  organization: (
    <>
      <path d="M2.9 6.2 L8 3.2 L13.1 6.2 Z" />
      <path d="M4.4 8.4 V11.4 M8 8.4 V11.4 M11.6 8.4 V11.4" />
      <path d="M3 13.6 H13" />
    </>
  ),
  term: (
    <>
      <path d="M8 4.6 C7.2 3.4 5.9 2.9 2.7 2.9 V12.1 C5.9 12.1 7.2 12.6 8 13.4 C8.8 12.6 10.1 12.1 13.3 12.1 V2.9 C10.1 2.9 8.8 3.4 8 4.6 Z" />
      <path d="M8 4.6 V13.4" />
    </>
  ),
};

export function GlossaryKindIcon({ kind }: { kind: GlossaryEntry["kind"] }): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {KIND_SHAPES[kind]}
    </svg>
  );
}
