// Single definition of untranslated Han residue. Repair target selection,
// deterministic QA, and override gating must agree on what counts as Han
// text, so they all import from here instead of redeclaring the pattern.
export const HAN_CHARACTER = /\p{Script=Han}/u;
export const HAN_RUN = /\p{Script=Han}+/gu;

export function countHanCharacters(value: string): number {
  return value.match(/\p{Script=Han}/gu)?.length ?? 0;
}
