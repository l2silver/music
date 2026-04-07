export type ClefKind = "treble" | "bass" | "piano";

export type AccidentalKind = "natural" | "sharp" | "flat";

export type DiatonicLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type MusicFact = {
  id: string;
  /** MIDI note number (12 = C0; 60 = middle C). */
  midi: number;
  letter: DiatonicLetter;
  accidental: AccidentalKind;
  clef: ClefKind;
  kind: "piano" | "staff";
};

/** Curriculum units 1–10 (see docs/DESIGN.md). */
export const UNIT_COUNT = 10;

export const UNIT_TITLES: readonly string[] = [
  "Piano keys (C4–B4)",
  "Treble — line notes",
  "Treble — space notes (FACE)",
  "Bass — line notes",
  "Bass — space notes",
  "Below treble staff",
  "Above bass staff",
  "Below bass staff",
  "Above treble staff",
  "Sharps and flats",
];

const UNITS: readonly MusicFact[][] = [
  // 1 — piano white keys one octave
  [
    {
      id: "piano-c4",
      midi: 60,
      letter: "C",
      accidental: "natural",
      clef: "piano",
      kind: "piano",
    },
    {
      id: "piano-d4",
      midi: 62,
      letter: "D",
      accidental: "natural",
      clef: "piano",
      kind: "piano",
    },
    {
      id: "piano-e4",
      midi: 64,
      letter: "E",
      accidental: "natural",
      clef: "piano",
      kind: "piano",
    },
    {
      id: "piano-f4",
      midi: 65,
      letter: "F",
      accidental: "natural",
      clef: "piano",
      kind: "piano",
    },
    {
      id: "piano-g4",
      midi: 67,
      letter: "G",
      accidental: "natural",
      clef: "piano",
      kind: "piano",
    },
    {
      id: "piano-a4",
      midi: 69,
      letter: "A",
      accidental: "natural",
      clef: "piano",
      kind: "piano",
    },
    {
      id: "piano-b4",
      midi: 71,
      letter: "B",
      accidental: "natural",
      clef: "piano",
      kind: "piano",
    },
  ],
  // 2 — treble lines EGBDF
  [
    { id: "t-line-e4", midi: 64, letter: "E", accidental: "natural", clef: "treble", kind: "staff" },
    { id: "t-line-g4", midi: 67, letter: "G", accidental: "natural", clef: "treble", kind: "staff" },
    { id: "t-line-b4", midi: 71, letter: "B", accidental: "natural", clef: "treble", kind: "staff" },
    { id: "t-line-d5", midi: 74, letter: "D", accidental: "natural", clef: "treble", kind: "staff" },
    { id: "t-line-f5", midi: 77, letter: "F", accidental: "natural", clef: "treble", kind: "staff" },
  ],
  // 3 — treble spaces FACE
  [
    { id: "t-sp-f4", midi: 65, letter: "F", accidental: "natural", clef: "treble", kind: "staff" },
    { id: "t-sp-a4", midi: 69, letter: "A", accidental: "natural", clef: "treble", kind: "staff" },
    { id: "t-sp-c5", midi: 72, letter: "C", accidental: "natural", clef: "treble", kind: "staff" },
    { id: "t-sp-e5", midi: 76, letter: "E", accidental: "natural", clef: "treble", kind: "staff" },
  ],
  // 4 — bass lines GBDFA
  [
    { id: "b-line-g2", midi: 43, letter: "G", accidental: "natural", clef: "bass", kind: "staff" },
    { id: "b-line-b2", midi: 47, letter: "B", accidental: "natural", clef: "bass", kind: "staff" },
    { id: "b-line-d3", midi: 50, letter: "D", accidental: "natural", clef: "bass", kind: "staff" },
    { id: "b-line-f3", midi: 53, letter: "F", accidental: "natural", clef: "bass", kind: "staff" },
    { id: "b-line-a3", midi: 57, letter: "A", accidental: "natural", clef: "bass", kind: "staff" },
  ],
  // 5 — bass spaces ACEG
  [
    { id: "b-sp-a2", midi: 45, letter: "A", accidental: "natural", clef: "bass", kind: "staff" },
    { id: "b-sp-c3", midi: 48, letter: "C", accidental: "natural", clef: "bass", kind: "staff" },
    { id: "b-sp-e3", midi: 52, letter: "E", accidental: "natural", clef: "bass", kind: "staff" },
    { id: "b-sp-g3", midi: 55, letter: "G", accidental: "natural", clef: "bass", kind: "staff" },
  ],
  // 6 — below treble
  [
    { id: "t-bel-d4", midi: 62, letter: "D", accidental: "natural", clef: "treble", kind: "staff" },
    { id: "t-bel-c4", midi: 60, letter: "C", accidental: "natural", clef: "treble", kind: "staff" },
    { id: "t-bel-b3", midi: 59, letter: "B", accidental: "natural", clef: "treble", kind: "staff" },
    { id: "t-bel-a3", midi: 57, letter: "A", accidental: "natural", clef: "treble", kind: "staff" },
    { id: "t-bel-g3", midi: 55, letter: "G", accidental: "natural", clef: "treble", kind: "staff" },
  ],
  // 7 — above bass
  [
    { id: "b-abo-b3", midi: 59, letter: "B", accidental: "natural", clef: "bass", kind: "staff" },
    { id: "b-abo-c4", midi: 60, letter: "C", accidental: "natural", clef: "bass", kind: "staff" },
    { id: "b-abo-d4", midi: 62, letter: "D", accidental: "natural", clef: "bass", kind: "staff" },
    { id: "b-abo-e4", midi: 64, letter: "E", accidental: "natural", clef: "bass", kind: "staff" },
    { id: "b-abo-f4", midi: 65, letter: "F", accidental: "natural", clef: "bass", kind: "staff" },
  ],
  // 8 — below bass
  [
    { id: "b-bel-f2", midi: 41, letter: "F", accidental: "natural", clef: "bass", kind: "staff" },
    { id: "b-bel-e2", midi: 40, letter: "E", accidental: "natural", clef: "bass", kind: "staff" },
    { id: "b-bel-d2", midi: 38, letter: "D", accidental: "natural", clef: "bass", kind: "staff" },
    { id: "b-bel-c2", midi: 36, letter: "C", accidental: "natural", clef: "bass", kind: "staff" },
    { id: "b-bel-b1", midi: 35, letter: "B", accidental: "natural", clef: "bass", kind: "staff" },
  ],
  // 9 — above treble
  [
    { id: "t-abo-g5", midi: 79, letter: "G", accidental: "natural", clef: "treble", kind: "staff" },
    { id: "t-abo-a5", midi: 81, letter: "A", accidental: "natural", clef: "treble", kind: "staff" },
    { id: "t-abo-b5", midi: 83, letter: "B", accidental: "natural", clef: "treble", kind: "staff" },
    { id: "t-abo-c6", midi: 84, letter: "C", accidental: "natural", clef: "treble", kind: "staff" },
    { id: "t-abo-d6", midi: 86, letter: "D", accidental: "natural", clef: "treble", kind: "staff" },
  ],
  // 10 — accidentals (explicit spelling)
  [
    { id: "acc-fs3", midi: 54, letter: "F", accidental: "sharp", clef: "bass", kind: "staff" },
    { id: "acc-gs3", midi: 56, letter: "G", accidental: "sharp", clef: "bass", kind: "staff" },
    { id: "acc-bb3", midi: 58, letter: "B", accidental: "flat", clef: "bass", kind: "staff" },
    { id: "acc-cs4", midi: 61, letter: "C", accidental: "sharp", clef: "treble", kind: "staff" },
    { id: "acc-eb4", midi: 63, letter: "E", accidental: "flat", clef: "treble", kind: "staff" },
    { id: "acc-fs4", midi: 66, letter: "F", accidental: "sharp", clef: "treble", kind: "staff" },
    { id: "acc-gs4", midi: 68, letter: "G", accidental: "sharp", clef: "treble", kind: "staff" },
    { id: "acc-bb4", midi: 70, letter: "B", accidental: "flat", clef: "treble", kind: "staff" },
    { id: "acc-cs5", midi: 73, letter: "C", accidental: "sharp", clef: "treble", kind: "staff" },
    { id: "acc-fs5", midi: 78, letter: "F", accidental: "sharp", clef: "treble", kind: "staff" },
  ],
];

const ALL_FACTS_MAP: Map<string, MusicFact> = (() => {
  const m = new Map<string, MusicFact>();
  for (const list of UNITS) {
    for (const f of list) {
      m.set(f.id, f);
    }
  }
  return m;
})();

export function maxUnit(): number {
  return UNIT_COUNT;
}

export function isValidUnit(unit: number): boolean {
  return Number.isInteger(unit) && unit >= 1 && unit <= maxUnit();
}

export function allFactsForUnit(unit: number): MusicFact[] {
  if (!isValidUnit(unit)) return [];
  return [...UNITS[unit - 1]!];
}

/** Intro walks every fact in the unit (ordered). */
export function introFactsForUnit(unit: number): MusicFact[] {
  return allFactsForUnit(unit);
}

export function factIdsForUnit(unit: number): string[] {
  return allFactsForUnit(unit).map((f) => f.id);
}

/** All fact ids from units 1 … `unit` (inclusive), for the “full mix” timed round. */
export function factIdsCumulativeThroughUnit(unit: number): string[] {
  if (!isValidUnit(unit)) return [];
  const out: string[] = [];
  for (let u = 1; u <= unit; u++) {
    out.push(...factIdsForUnit(u));
  }
  return out;
}

export function getFactById(id: string): MusicFact | undefined {
  return ALL_FACTS_MAP.get(id);
}

export function factKey(f: MusicFact): string {
  return f.id;
}

export function parseFactKey(key: string): MusicFact {
  const f = ALL_FACTS_MAP.get(key);
  if (!f) throw new Error(`Invalid fact key: ${key}`);
  return f;
}

export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export const SELECTABLE_UNITS: readonly number[] = Array.from(
  { length: UNIT_COUNT },
  (_, i) => i + 1,
);
