import {
  packMedalCompletionBonus,
  type GameMode,
} from "@/lib/modes";
import { POINT_FLOOR, POINT_PEAK } from "@/lib/points";
import {
  allFactsForUnit,
  factIdsCumulativeThroughUnit,
  factIdsForUnit,
  getFactById,
  isValidUnit,
  maxUnit,
  shuffle,
} from "@/lib/facts";

export const STORAGE_KEY = "music-tutor-v1";

export type Phase = "intro" | "fullMixBridge" | "quiz" | "review";

/** `narrow` = current unit only; `full` = cumulative facts from units 1 … current unit. */
export type QuizScope = "narrow" | "full";

export type QuizSlice = {
  roundKeys: string[];
  roundIndex: number;
  wrongThisRound: string[];
};

export type Screen = "pickMode" | "menu" | "play";

export type ModeProgress = {
  highestUnlockedUnit: number;
  unit: number;
  phase: Phase;
  introIndex: number;
  quiz: QuizSlice | null;
  /** Set during `quiz` and `review`; cleared during `intro` and `fullMixBridge`. */
  quizScope?: QuizScope;
  reviewWrongKeys?: string[];
  hadMissThisUnit?: boolean;
  awaitingUnitAdvance?: boolean;
  modeComplete?: boolean;
  /**
   * Correct-answer points in timed quizzes for this pack are multiplied by this
   * (implicit 1 if omitted). Halves when the learner restarts the pack from the lesson.
   */
  packPointScale?: number;
};

export type SavedGame = {
  v: 2;
  screen: Screen;
  activeMode: GameMode;
  silverUnlocked: boolean;
  goldUnlocked: boolean;
  progress: Record<GameMode, ModeProgress>;
  totalPoints: number;
  factRewardWeight: Record<string, number>;
  /**
   * Per mode: unit indices (1…maxUnit) that already received the one-time medal bonus
   * for first passing that unit’s pack (cumulative quiz) in this mode.
   */
  packMedalBonusesAtUnit?: Partial<Record<GameMode, number[]>>;
  grandComplete?: boolean;
};

type SavedGameV1 = {
  v: 1;
  screen: Screen;
  activeMode: GameMode;
  silverUnlocked: boolean;
  goldUnlocked: boolean;
  progress: Record<GameMode, ModeProgressV1Payload>;
  totalPoints: number;
  factRewardWeight: Record<string, number>;
  grandComplete?: boolean;
};

type ModeProgressV1Payload = {
  highestUnlockedUnit: number;
  unit: number;
  phase: "intro" | "quiz" | "review";
  introIndex: number;
  quiz: QuizSlice | null;
  reviewWrongKeys?: string[];
  hadMissThisUnit?: boolean;
  awaitingUnitAdvance?: boolean;
  modeComplete?: boolean;
};

function narrowSet(unit: number): Set<string> {
  return new Set(factIdsForUnit(unit));
}

function fullSet(unit: number): Set<string> {
  return new Set(factIdsCumulativeThroughUnit(unit));
}

function validateNarrowKeys(keys: string[], unit: number): boolean {
  const allowed = narrowSet(unit);
  return keys.every((k) => allowed.has(k) && getFactById(k) !== undefined);
}

function validateFullKeys(keys: string[], unit: number): boolean {
  const allowed = fullSet(unit);
  return keys.every((k) => allowed.has(k) && getFactById(k) !== undefined);
}

function coerceQuizScope(x: unknown): QuizScope | undefined {
  if (x === "narrow" || x === "full") return x;
  return undefined;
}

function inferQuizScopeFromKeys(
  roundKeys: string[],
  wrongKeys: string[],
  unit: number,
): QuizScope | null {
  if (roundKeys.length === 0) return null;
  if (validateFullKeys(roundKeys, unit) && validateFullKeys(wrongKeys, unit)) {
    return "full";
  }
  if (validateNarrowKeys(roundKeys, unit) && validateNarrowKeys(wrongKeys, unit)) {
    return "narrow";
  }
  return null;
}

function isQuizSlice(x: unknown): x is QuizSlice {
  if (!x || typeof x !== "object") return false;
  const q = x as QuizSlice;
  return (
    Array.isArray(q.roundKeys) &&
    q.roundKeys.every((k) => typeof k === "string") &&
    typeof q.roundIndex === "number" &&
    Array.isArray(q.wrongThisRound) &&
    q.wrongThisRound.every((k) => typeof k === "string")
  );
}

function coerceHadMiss(p: ModeProgress): boolean {
  return p.hadMissThisUnit === true;
}

function coercePackPointScaleField(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
  if (raw <= 0 || raw > 1) return undefined;
  return Math.round(raw * 1e9) / 1e9;
}

function attachPackPointScale(raw: unknown, prog: ModeProgress): ModeProgress {
  const ps = coercePackPointScaleField(
    (raw as Record<string, unknown>)?.packPointScale,
  );
  if (ps === undefined) return prog;
  return { ...prog, packPointScale: ps };
}

function parseModeProgress(x: unknown, fallback: ModeProgress): ModeProgress {
  if (!x || typeof x !== "object") return { ...fallback };
  const p = x as ModeProgress;
  if (!isValidUnit(p.unit)) return { ...fallback };
  if (
    typeof p.highestUnlockedUnit !== "number" ||
    !Number.isInteger(p.highestUnlockedUnit)
  )
    return { ...fallback };
  if (p.highestUnlockedUnit < 1 || p.highestUnlockedUnit > maxUnit())
    return { ...fallback };
  if (typeof p.introIndex !== "number" || !Number.isInteger(p.introIndex))
    return { ...fallback };
  if (
    p.phase !== "intro" &&
    p.phase !== "fullMixBridge" &&
    p.phase !== "quiz" &&
    p.phase !== "review"
  )
    return { ...fallback };

  if (p.phase === "intro") {
    if (p.introIndex < 0) return { ...fallback };
    const introLen = allFactsForUnit(p.unit).length;
    if (introLen === 0 || p.introIndex >= introLen) return { ...fallback };
    if (p.quiz !== null) return { ...fallback };
    return attachPackPointScale(x, {
      highestUnlockedUnit: p.highestUnlockedUnit,
      unit: p.unit,
      phase: p.phase,
      introIndex: p.introIndex,
      quiz: null,
      quizScope: undefined,
      awaitingUnitAdvance: p.awaitingUnitAdvance,
      modeComplete: p.modeComplete,
      reviewWrongKeys: undefined,
      hadMissThisUnit: coerceHadMiss(p) ? true : undefined,
    });
  }

  if (p.phase === "fullMixBridge") {
    if (p.introIndex !== 0) return { ...fallback };
    if (p.quiz !== null) return { ...fallback };
    const rk = p.reviewWrongKeys;
    if (Array.isArray(rk) && rk.length > 0) return { ...fallback };
    return attachPackPointScale(x, {
      highestUnlockedUnit: p.highestUnlockedUnit,
      unit: p.unit,
      phase: "fullMixBridge",
      introIndex: 0,
      quiz: null,
      quizScope: undefined,
      awaitingUnitAdvance: p.awaitingUnitAdvance,
      modeComplete: p.modeComplete,
      reviewWrongKeys: undefined,
      hadMissThisUnit: coerceHadMiss(p) ? true : undefined,
    });
  }

  if (p.phase === "review") {
    if (p.introIndex !== 0) return { ...fallback };
    if (p.quiz !== null) return { ...fallback };
    const rk = p.reviewWrongKeys;
    if (!Array.isArray(rk) || rk.length === 0) return { ...fallback };
    if (!rk.every((k) => typeof k === "string")) return { ...fallback };
    const reviewScope: QuizScope = coerceQuizScope(p.quizScope) ?? "full";
    if (reviewScope === "narrow") {
      if (!validateNarrowKeys(rk, p.unit)) return { ...fallback };
    } else if (!validateFullKeys(rk, p.unit)) {
      return { ...fallback };
    }
    return attachPackPointScale(x, {
      highestUnlockedUnit: p.highestUnlockedUnit,
      unit: p.unit,
      phase: "review",
      introIndex: 0,
      quiz: null,
      quizScope: reviewScope,
      reviewWrongKeys: rk,
      awaitingUnitAdvance: p.awaitingUnitAdvance,
      modeComplete: p.modeComplete,
      hadMissThisUnit: coerceHadMiss(p) ? true : undefined,
    });
  }

  if (!isQuizSlice(p.quiz)) return { ...fallback };
  const q = p.quiz;
  if (q.roundIndex < 0 || q.roundIndex > q.roundKeys.length) return { ...fallback };
  const declared = coerceQuizScope(p.quizScope);
  let quizScope: QuizScope;
  if (declared === "narrow" || declared === "full") {
    quizScope = declared;
    const ok =
      quizScope === "narrow"
        ? validateNarrowKeys(q.roundKeys, p.unit) &&
          validateNarrowKeys(q.wrongThisRound, p.unit)
        : validateFullKeys(q.roundKeys, p.unit) &&
          validateFullKeys(q.wrongThisRound, p.unit);
    if (!ok) return { ...fallback };
  } else {
    const inferred = inferQuizScopeFromKeys(
      q.roundKeys,
      q.wrongThisRound,
      p.unit,
    );
    if (inferred === null) return { ...fallback };
    quizScope = inferred;
  }
  return attachPackPointScale(x, {
    highestUnlockedUnit: p.highestUnlockedUnit,
    unit: p.unit,
    phase: p.phase,
    introIndex: p.introIndex,
    quiz: q,
    quizScope,
    awaitingUnitAdvance: p.awaitingUnitAdvance,
    modeComplete: p.modeComplete,
    reviewWrongKeys: undefined,
    hadMissThisUnit: coerceHadMiss(p) ? true : undefined,
  });
}

function coerceTotalPoints(x: unknown): number {
  if (typeof x !== "number" || !Number.isFinite(x) || x < 0) return 0;
  return x;
}

function coerceFactRewardWeight(x: unknown): Record<string, number> {
  if (!x || typeof x !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    if (typeof k !== "string" || k.length === 0) continue;
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    out[k] = Math.min(POINT_PEAK, Math.max(POINT_FLOOR, v));
  }
  return out;
}

function coercePackMedalBonuses(
  raw: unknown,
): SavedGame["packMedalBonusesAtUnit"] {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const modes: GameMode[] = ["bronze", "silver", "gold"];
  const out: Partial<Record<GameMode, number[]>> = {};
  for (const mode of modes) {
    const arr = o[mode];
    if (!Array.isArray(arr)) continue;
    const units = [
      ...new Set(
        arr.filter(
          (x): x is number =>
            typeof x === "number" &&
            Number.isInteger(x) &&
            isValidUnit(x),
        ),
      ),
    ].sort((a, b) => a - b);
    if (units.length > 0) out[mode] = units;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Add medal pack bonus for `completedUnit` in `mode` if not already awarded. */
export function withPackMedalBonusIfEligible(
  g: SavedGame,
  mode: GameMode,
  completedUnit: number,
): SavedGame {
  if (!isValidUnit(completedUnit)) return g;
  const at = g.packMedalBonusesAtUnit;
  const nextRecord: Record<GameMode, number[]> = {
    bronze: [...(at?.bronze ?? [])],
    silver: [...(at?.silver ?? [])],
    gold: [...(at?.gold ?? [])],
  };
  const modeList = nextRecord[mode];
  if (modeList.includes(completedUnit)) return g;
  modeList.push(completedUnit);
  modeList.sort((a, b) => a - b);
  return {
    ...g,
    totalPoints: g.totalPoints + packMedalCompletionBonus(mode),
    packMedalBonusesAtUnit: nextRecord,
  };
}

export function isPackCompletedForUnit(
  g: SavedGame,
  mode: GameMode,
  unit: number,
): boolean {
  const list = g.packMedalBonusesAtUnit?.[mode];
  return Array.isArray(list) && list.includes(unit);
}

function mergePackMedalsWithModeComplete(
  coerced: SavedGame["packMedalBonusesAtUnit"],
  progress: Record<GameMode, ModeProgress>,
): SavedGame["packMedalBonusesAtUnit"] {
  const modes: GameMode[] = ["bronze", "silver", "gold"];
  const out: Partial<Record<GameMode, number[]>> = {};
  for (const mode of modes) {
    const set = new Set<number>(coerced?.[mode] ?? []);
    if (progress[mode]?.modeComplete === true) {
      for (let u = 1; u <= maxUnit(); u++) {
        set.add(u);
      }
    }
    const arr = [...set].sort((a, b) => a - b);
    if (arr.length > 0) out[mode] = arr;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function migrateV1ToV2(g: SavedGameV1): SavedGame {
  const modes: GameMode[] = ["bronze", "silver", "gold"];
  const progress = {} as Record<GameMode, ModeProgress>;
  for (const m of modes) {
    const p = g.progress[m]!;
    progress[m] = migrateModeProgressV1(p);
  }
  return {
    v: 2,
    screen: g.screen,
    activeMode: g.activeMode,
    silverUnlocked: g.silverUnlocked,
    goldUnlocked: g.goldUnlocked,
    progress,
    totalPoints: g.totalPoints,
    factRewardWeight: g.factRewardWeight,
    grandComplete: g.grandComplete,
  };
}

function migrateModeProgressV1(p: ModeProgressV1Payload): ModeProgress {
  const base: ModeProgress = {
    highestUnlockedUnit: p.highestUnlockedUnit,
    unit: p.unit,
    phase: "intro",
    introIndex: 0,
    quiz: null,
    awaitingUnitAdvance: p.awaitingUnitAdvance,
    modeComplete: p.modeComplete,
  };
  if (!isValidUnit(p.unit)) return { ...defaultModeProgress(), modeComplete: p.modeComplete };

  if (p.phase === "intro") {
    const introLen = allFactsForUnit(p.unit).length;
    const idx =
      p.introIndex >= 0 && p.introIndex < introLen ? p.introIndex : 0;
    return {
      ...base,
      phase: "intro",
      introIndex: idx,
      highestUnlockedUnit: p.highestUnlockedUnit,
      unit: p.unit,
      hadMissThisUnit: p.hadMissThisUnit === true ? true : undefined,
    };
  }

  if (p.phase === "quiz" && p.quiz && isQuizSlice(p.quiz)) {
    const u = p.unit;
    const q = p.quiz;
    if (
      validateNarrowKeys(q.roundKeys, u) &&
      validateNarrowKeys(q.wrongThisRound, u)
    ) {
      return {
        highestUnlockedUnit: p.highestUnlockedUnit,
        unit: p.unit,
        phase: "quiz",
        introIndex: 0,
        quiz: q,
        quizScope: "narrow",
        hadMissThisUnit: p.hadMissThisUnit === true ? true : undefined,
        awaitingUnitAdvance: p.awaitingUnitAdvance,
        modeComplete: p.modeComplete,
      };
    }
    return {
      ...base,
      highestUnlockedUnit: p.highestUnlockedUnit,
      unit: p.unit,
      hadMissThisUnit: undefined,
    };
  }

  if (p.phase === "review" && p.reviewWrongKeys?.length) {
    const u = p.unit;
    const rk = p.reviewWrongKeys;
    const scope: QuizScope | null = validateNarrowKeys(rk, u)
      ? "narrow"
      : validateFullKeys(rk, u)
        ? "full"
        : null;
    if (scope !== null) {
      return {
        highestUnlockedUnit: p.highestUnlockedUnit,
        unit: p.unit,
        phase: "review",
        introIndex: 0,
        quiz: null,
        quizScope: scope,
        reviewWrongKeys: rk,
        hadMissThisUnit: p.hadMissThisUnit === true ? true : undefined,
        awaitingUnitAdvance: p.awaitingUnitAdvance,
        modeComplete: p.modeComplete,
      };
    }
  }

  return {
    ...base,
    highestUnlockedUnit: p.highestUnlockedUnit,
    unit: p.unit,
    hadMissThisUnit: undefined,
  };
}

function parseSavedGamePayload(data: Record<string, unknown>): SavedGame | null {
  if (data.v !== 2) return null;
  if (data.screen !== "pickMode" && data.screen !== "menu" && data.screen !== "play")
    return null;
  if (typeof data.silverUnlocked !== "boolean" || typeof data.goldUnlocked !== "boolean")
    return null;
  const active = data.activeMode;
  if (active !== "bronze" && active !== "silver" && active !== "gold") return null;

  const fb = defaultModeProgress();
  const rawProg = data.progress;
  if (!rawProg || typeof rawProg !== "object") return null;

  const progress: Record<GameMode, ModeProgress> = {
    bronze: parseModeProgress((rawProg as Record<string, unknown>).bronze, fb),
    silver: parseModeProgress((rawProg as Record<string, unknown>).silver, fb),
    gold: parseModeProgress((rawProg as Record<string, unknown>).gold, fb),
  };

  const totalPoints = coerceTotalPoints(data.totalPoints);
  const factRewardWeight = coerceFactRewardWeight(data.factRewardWeight);

  const packMedalBonusesAtUnit = mergePackMedalsWithModeComplete(
    coercePackMedalBonuses(data.packMedalBonusesAtUnit),
    progress,
  );

  const base: SavedGame = {
    v: 2,
    screen: data.screen as Screen,
    activeMode: active,
    silverUnlocked: data.silverUnlocked,
    goldUnlocked: data.goldUnlocked,
    progress,
    totalPoints,
    factRewardWeight,
    ...(packMedalBonusesAtUnit ? { packMedalBonusesAtUnit } : {}),
  };

  if (data.grandComplete === true) {
    return { ...base, grandComplete: true };
  }

  return base;
}

export function parseSavedGame(raw: string): SavedGame | null {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return null;
    const rec = data as Record<string, unknown>;
    if (rec.v === 1) {
      return migrateV1ToV2(rec as unknown as SavedGameV1);
    }
    return parseSavedGamePayload(rec);
  } catch {
    return null;
  }
}

export function loadGame(): SavedGame | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return parseSavedGame(raw);
}

export function saveGame(state: SavedGame): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearGame(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function defaultModeProgress(): ModeProgress {
  return {
    highestUnlockedUnit: 1,
    unit: 1,
    phase: "intro",
    introIndex: 0,
    quiz: null,
  };
}

export function defaultSavedGame(): SavedGame {
  const p = defaultModeProgress();
  return {
    v: 2,
    screen: "pickMode",
    activeMode: "bronze",
    silverUnlocked: false,
    goldUnlocked: false,
    progress: {
      bronze: { ...p },
      silver: { ...p },
      gold: { ...p },
    },
    totalPoints: 0,
    factRewardWeight: {},
  };
}

export function ensureNarrowQuizState(
  unit: number,
  quiz: QuizSlice | null,
): QuizSlice {
  if (
    quiz &&
    validateNarrowKeys(quiz.roundKeys, unit) &&
    quiz.roundKeys.length > 0
  ) {
    const clampedIndex = Math.min(
      Math.max(0, quiz.roundIndex),
      quiz.roundKeys.length,
    );
    return {
      roundKeys: quiz.roundKeys,
      roundIndex: clampedIndex,
      wrongThisRound: [...new Set(quiz.wrongThisRound)].filter((k) =>
        validateNarrowKeys([k], unit),
      ),
    };
  }
  const keys = shuffle(factIdsForUnit(unit));
  return { roundKeys: keys, roundIndex: 0, wrongThisRound: [] };
}

export function ensureFullQuizState(unit: number, quiz: QuizSlice | null): QuizSlice {
  if (
    quiz &&
    validateFullKeys(quiz.roundKeys, unit) &&
    quiz.roundKeys.length > 0
  ) {
    const clampedIndex = Math.min(
      Math.max(0, quiz.roundIndex),
      quiz.roundKeys.length,
    );
    return {
      roundKeys: quiz.roundKeys,
      roundIndex: clampedIndex,
      wrongThisRound: [...new Set(quiz.wrongThisRound)].filter((k) =>
        validateFullKeys([k], unit),
      ),
    };
  }
  const keys = shuffle(factIdsCumulativeThroughUnit(unit));
  return { roundKeys: keys, roundIndex: 0, wrongThisRound: [] };
}

export function mapActiveMode(
  g: SavedGame,
  fn: (p: ModeProgress) => ModeProgress,
): SavedGame {
  const m = g.activeMode;
  return {
    ...g,
    progress: { ...g.progress, [m]: fn(g.progress[m]!) },
  };
}

export function startRetryAfterReview(g: SavedGame): SavedGame {
  return mapActiveMode(g, (pr) => {
    const keys = pr.reviewWrongKeys;
    if (!keys?.length) return pr;
    const scope = pr.quizScope ?? "full";
    return {
      ...pr,
      phase: "quiz",
      reviewWrongKeys: undefined,
      quizScope: scope,
      quiz: {
        roundKeys: shuffle([...new Set(keys)]),
        roundIndex: 0,
        wrongThisRound: [],
      },
    };
  });
}

/** Reshuffle the current timed round from question 1 (same scope / full deck or retry subset). */
export function restartCurrentQuizRound(g: SavedGame): SavedGame {
  return mapActiveMode(g, (pr) => {
    if (pr.phase !== "quiz" || !pr.quiz || !pr.quizScope) return pr;
    const q = pr.quiz;
    const u = pr.unit;
    const scope = pr.quizScope;
    const fullDeck =
      scope === "narrow"
        ? q.roundKeys.length === factIdsForUnit(u).length
        : q.roundKeys.length === factIdsCumulativeThroughUnit(u).length;
    const nextQuiz: QuizSlice = fullDeck
      ? scope === "narrow"
        ? ensureNarrowQuizState(u, null)
        : ensureFullQuizState(u, null)
      : {
          roundKeys: shuffle([...q.roundKeys]),
          roundIndex: 0,
          wrongThisRound: [],
        };
    return { ...pr, quiz: nextQuiz };
  });
}

/** Back to intro cards; halves point scale for this pack (redo penalty). */
export function restartPackFromLessonWithPointPenalty(g: SavedGame): SavedGame {
  return mapActiveMode(g, (pr) => ({
    ...pr,
    phase: "intro",
    introIndex: 0,
    quiz: null,
    quizScope: undefined,
    reviewWrongKeys: undefined,
    hadMissThisUnit: undefined,
    packPointScale: (pr.packPointScale ?? 1) * 0.5,
  }));
}

export function goToMenu(g: SavedGame): SavedGame {
  return { ...g, screen: "menu" };
}

export function goToModePicker(g: SavedGame): SavedGame {
  return { ...g, screen: "pickMode" };
}

export function selectMode(g: SavedGame, mode: GameMode): SavedGame {
  if (mode === "silver" && !g.silverUnlocked) return g;
  if (mode === "gold" && !g.goldUnlocked) return g;
  return { ...g, activeMode: mode, screen: "menu" };
}

export function selectUnit(g: SavedGame, unit: number): SavedGame {
  const mode = g.activeMode;
  const p = g.progress[mode]!;
  if (!isValidUnit(unit)) return g;
  if (unit > p.highestUnlockedUnit) return g;
  const resume =
    p.unit === unit &&
    !p.awaitingUnitAdvance &&
    (p.phase === "quiz" ||
      p.phase === "review" ||
      p.phase === "fullMixBridge" ||
      (p.phase === "intro" && p.introIndex > 0));
  const next: ModeProgress = resume
    ? { ...p }
    : {
        ...p,
        unit,
        phase: "intro",
        introIndex: 0,
        quiz: null,
        quizScope: undefined,
        awaitingUnitAdvance: false,
        reviewWrongKeys: undefined,
        hadMissThisUnit: false,
        packPointScale: undefined,
      };
  return {
    ...g,
    screen: "play",
    progress: {
      ...g.progress,
      [mode]: { ...next, modeComplete: p.modeComplete },
    },
  };
}
