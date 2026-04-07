import type { ClefKind, MusicFact } from "@/lib/facts";

/**
 * Diatonic steps from the bottom staff line upward:
 * - Treble: bottom line = E4
 * - Bass: bottom line = G2
 */
/** E4 on the bottom line = 0; each integer is one staff position (line/space). */
const TREBLE_STEP: Readonly<Record<number, number>> = {
  53: -6,
  55: -5,
  57: -4,
  59: -3,
  60: -2,
  61: -2,
  62: -1,
  63: 0,
  64: 0,
  65: 1,
  66: 1,
  67: 2,
  68: 2,
  69: 3,
  70: 4,
  71: 4,
  72: 5,
  73: 5,
  74: 6,
  76: 7,
  77: 8,
  78: 8,
  79: 9,
  81: 10,
  83: 11,
  84: 12,
  86: 13,
};

/** G2 on the bottom line = 0. */
const BASS_STEP: Readonly<Record<number, number>> = {
  35: -5,
  36: -4,
  38: -3,
  40: -2,
  41: -1,
  43: 0,
  45: 1,
  47: 2,
  48: 3,
  50: 4,
  52: 5,
  53: 6,
  54: 6,
  55: 7,
  56: 7,
  57: 8,
  58: 9,
  59: 9,
  60: 10,
  62: 11,
  64: 12,
  65: 13,
};

export function staffStepForMidi(clef: ClefKind, midi: number): number {
  if (clef === "treble") {
    const s = TREBLE_STEP[midi];
    if (typeof s === "number") return s;
  }
  if (clef === "bass") {
    const s = BASS_STEP[midi];
    if (typeof s === "number") return s;
  }
  return 0;
}

/** Half-line spacing in SVG units (one diatonic step). */
const STEP_DY = 6;
const TREBLE_STAFF_BOTTOM_Y = 92;
const BASS_STAFF_BOTTOM_Y = 92;

export function noteCenterY(clef: ClefKind, midi: number): number {
  const step = staffStepForMidi(clef, midi);
  const base = clef === "bass" ? BASS_STAFF_BOTTOM_Y : TREBLE_STAFF_BOTTOM_Y;
  return base - STEP_DY * step;
}

export type LedgerSegment = { y: number; x1: number; x2: number };

export function ledgerRangesForStep(
  clef: ClefKind,
  step: number,
  noteX: number,
  headW: number,
): LedgerSegment[] {
  /** Main staff spans five lines; positions 0 and 8 are outer lines. */
  const bottom = 0;
  const top = 8;
  const out: LedgerSegment[] = [];
  if (step < bottom) {
    for (let s = bottom - 1; s >= step; s--) {
      if (s % 2 === 0) {
        const y =
          (clef === "bass" ? BASS_STAFF_BOTTOM_Y : TREBLE_STAFF_BOTTOM_Y) - STEP_DY * s;
        out.push({ y, x1: noteX - headW * 1.1, x2: noteX + headW * 1.1 });
      }
    }
  } else if (step > top) {
    for (let s = top + 1; s <= step; s++) {
      if (s % 2 === 0) {
        const y =
          (clef === "bass" ? BASS_STAFF_BOTTOM_Y : TREBLE_STAFF_BOTTOM_Y) - STEP_DY * s;
        out.push({ y, x1: noteX - headW * 1.1, x2: noteX + headW * 1.1 });
      }
    }
  }
  return out;
}

export function accidentalDisplay(f: MusicFact): string {
  if (f.accidental === "sharp") return "♯";
  if (f.accidental === "flat") return "♭";
  return "";
}

export function answerLabel(f: MusicFact): string {
  const acc = accidentalDisplay(f);
  return `${f.letter}${acc}`;
}
