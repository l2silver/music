"use client";

import type { MusicFact } from "@/lib/facts";
import {
  ledgerRangesForStep,
  noteCenterY,
  staffStepForMidi,
} from "@/lib/staffModel";

type StaffSvgProps = {
  fact: MusicFact;
  className?: string;
};

const STEP_DY = 6;
const STAFF_BOTTOM_Y = 92;

function staffLineY(step: number): number {
  return STAFF_BOTTOM_Y - STEP_DY * step;
}

export function StaffSvg({ fact, className }: StaffSvgProps) {
  const clef = fact.clef === "bass" ? "bass" : "treble";
  const step = staffStepForMidi(clef, fact.midi);
  const noteY = noteCenterY(clef, fact.midi);
  const noteX = 138;
  const headW = 7;
  const stemUp = step <= 4;
  const stemX = stemUp ? noteX + 5 : noteX - 5;
  const stemLen = 34;
  const ledgers = ledgerRangesForStep(clef, step, noteX, headW);

  const acc =
    fact.accidental === "sharp"
      ? "♯"
      : fact.accidental === "flat"
        ? "♭"
        : "";

  return (
    <svg
      className={className}
      viewBox="0 0 260 118"
      width="100%"
      height={140}
      role="img"
      aria-label="Staff notation"
    >
      {[0, 2, 4, 6, 8].map((s) => (
        <line
          key={s}
          x1={36}
          x2={240}
          y1={staffLineY(s)}
          y2={staffLineY(s)}
          stroke="currentColor"
          strokeWidth={1.15}
          opacity={0.92}
        />
      ))}

      {ledgers.map((seg, i) => (
        <line
          key={`L-${i}-${seg.y}`}
          x1={seg.x1}
          x2={seg.x2}
          y1={seg.y}
          y2={seg.y}
          stroke="currentColor"
          strokeWidth={1.05}
          opacity={0.92}
        />
      ))}

      <text
        x={clef === "bass" ? 10 : 12}
        y={clef === "bass" ? 78 : 72}
        fontSize={clef === "bass" ? 46 : 52}
        style={{
          fontFamily: 'var(--font-noto-music), "Noto Music", serif',
        }}
      >
        {clef === "bass" ? "𝄢" : "𝄞"}
      </text>

      {acc ? (
        <text x={noteX - 26} y={noteY + 4} fontSize={22} fontWeight={600}>
          {acc}
        </text>
      ) : null}

      <ellipse
        cx={noteX}
        cy={noteY}
        rx={headW}
        ry={5.3}
        fill="currentColor"
        transform={`rotate(${stemUp ? -18 : 18} ${noteX} ${noteY})`}
      />

      <line
        x1={stemX}
        x2={stemX}
        y1={stemUp ? noteY - 4 : noteY + 4}
        y2={stemUp ? noteY - stemLen : noteY + stemLen}
        stroke="currentColor"
        strokeWidth={1.35}
        strokeLinecap="round"
      />
    </svg>
  );
}
