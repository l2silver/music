"use client";

import styles from "./PianoKeyboard.module.css";

/** G3–E5 white keys: three extra left of C4, three extra right of B4. */
const WHITE_KEYS: { midi: number; label: string }[] = [
  { midi: 55, label: "G3" },
  { midi: 57, label: "A3" },
  { midi: 59, label: "B3" },
  { midi: 60, label: "C4" },
  { midi: 62, label: "D4" },
  { midi: 64, label: "E4" },
  { midi: 65, label: "F4" },
  { midi: 67, label: "G4" },
  { midi: 69, label: "A4" },
  { midi: 71, label: "B4" },
  { midi: 72, label: "C5" },
  { midi: 74, label: "D5" },
  { midi: 76, label: "E5" },
];

/** Black keys: MIDI + index of white key immediately to the left. */
const BLACK_KEYS: { midi: number; afterWhiteIndex: number }[] = [
  { midi: 56, afterWhiteIndex: 0 },
  { midi: 58, afterWhiteIndex: 1 },
  { midi: 61, afterWhiteIndex: 3 },
  { midi: 63, afterWhiteIndex: 4 },
  { midi: 66, afterWhiteIndex: 6 },
  { midi: 68, afterWhiteIndex: 7 },
  { midi: 70, afterWhiteIndex: 8 },
  { midi: 73, afterWhiteIndex: 10 },
];

type PianoKeyboardProps = {
  highlightMidi: number;
  className?: string;
  /** Letter hints under white keys (e.g. intro only — hide during quizzes). */
  showKeyLabels?: boolean;
};

export function PianoKeyboard({
  highlightMidi,
  className,
  showKeyLabels = false,
}: PianoKeyboardProps) {
  const n = WHITE_KEYS.length;
  return (
    <div className={`${styles.wrap} ${className ?? ""}`} aria-hidden>
      <div className={styles.whiteRow}>
        {WHITE_KEYS.map((k) => (
          <div
            key={k.midi}
            className={
              showKeyLabels ? styles.whiteKeyOuter : styles.whiteKeyOuterCompact
            }
          >
            <div
              className={
                k.midi === highlightMidi
                  ? `${styles.whiteKey} ${styles.whiteKeyHighlight}`
                  : styles.whiteKey
              }
            />
            {showKeyLabels ? (
              <span className={styles.keyHint}>{k.label}</span>
            ) : null}
          </div>
        ))}
      </div>
      <div className={styles.blackRow}>
        {BLACK_KEYS.map((k) => {
          const leftPct = ((k.afterWhiteIndex + 1) / n) * 100;
          return (
            <div
              key={k.midi}
              className={styles.blackKeySlot}
              style={{ left: `calc(${leftPct}% - 0.65rem)` }}
            >
              <div
                className={
                  k.midi === highlightMidi
                    ? `${styles.blackKey} ${styles.blackKeyHighlight}`
                    : styles.blackKey
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
