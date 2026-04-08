"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./MusicGame.module.css";
import { PianoKeyboard } from "@/components/PianoKeyboard";
import { StaffSvg } from "@/components/StaffSvg";
import {
  allFactsForUnit,
  maxUnit,
  parseFactKey,
  SELECTABLE_UNITS,
  UNIT_TITLES,
  type AccidentalKind,
  type DiatonicLetter,
} from "@/lib/facts";
import {
  GAME_MODES,
  modeIsUnlocked,
  modeTitle,
  secondsForMode,
} from "@/lib/modes";
import {
  applyFactCorrect,
  applyFactWrong,
  formatNextRewardPreview,
  formatPointsDisplay,
  rewardWeightForFact,
  roundMeetsPassAccuracy,
} from "@/lib/points";
import {
  clearGame,
  defaultSavedGame,
  ensureFullQuizState,
  ensureNarrowQuizState,
  goToMenu,
  goToModePicker,
  isPackCompletedForUnit,
  loadGame,
  mapActiveMode,
  saveGame,
  selectMode,
  selectUnit,
  startRetryAfterReview,
  restartCurrentQuizRound,
  restartPackFromLessonWithPointPenalty,
  withPackMedalBonusIfEligible,
  type ModeProgress,
  type SavedGame,
} from "@/lib/persistence";
import { answerLabel } from "@/lib/staffModel";

const REDEEM_PASSWORD = "1234";
const IS_DEV = process.env.NODE_ENV === "development";
const LETTERS: readonly DiatonicLetter[] = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
];

function unitMnemonic(unit: number): string | null {
  switch (unit) {
    case 2:
      return "Lines: Every Good Boy Deserves Fudge — E, G, B, D, F.";
    case 3:
      return "Spaces spell FACE — F, A, C, E.";
    case 4:
      return "Bass lines: Good Boys Do Fine Always — G, B, D, F, A.";
    case 5:
      return "Bass spaces: All Cows Eat Grass — A, C, E, G.";
    default:
      return null;
  }
}

function answerMatches(
  fact: { letter: DiatonicLetter; accidental: AccidentalKind },
  unit: number,
  letter: DiatonicLetter | null,
  acc: AccidentalKind | null,
): boolean {
  if (!letter) return false;
  if (unit === 10) {
    const a = acc ?? "natural";
    return letter === fact.letter && a === fact.accidental;
  }
  return letter === fact.letter;
}

export function MusicGame() {
  const [game, setGame] = useState<SavedGame | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [quizDeadline, setQuizDeadline] = useState<number | null>(null);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemPwd, setRedeemPwd] = useState("");
  const [redeemError, setRedeemError] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<DiatonicLetter | null>(null);
  const [selectedAccidental, setSelectedAccidental] =
    useState<AccidentalKind | null>(null);
  const handleTimeoutRef = useRef<() => void>(() => {});
  const timeoutFiredRef = useRef(false);
  const [pointsBumpKey, setPointsBumpKey] = useState(0);
  const [lessonPeekOpen, setLessonPeekOpen] = useState(false);
  const [lessonPeekIndex, setLessonPeekIndex] = useState(0);

  const openLessonPeek = useCallback(() => {
    setLessonPeekIndex(0);
    setLessonPeekOpen(true);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const loaded = loadGame() ?? defaultSavedGame();
      setGame({ ...loaded, screen: "pickMode" });
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (game) saveGame(game);
  }, [game]);

  const persist = useCallback((updater: (g: SavedGame) => SavedGame) => {
    setGame((g) => (g ? updater(g) : g));
  }, []);

  const tryRedeem = useCallback(() => {
    if (redeemPwd === REDEEM_PASSWORD) {
      persist((g) => ({ ...g, totalPoints: 0, factRewardWeight: {} }));
      setRedeemPwd("");
      setRedeemOpen(false);
      setRedeemError(false);
    } else {
      setRedeemError(true);
    }
  }, [redeemPwd, persist]);

  const handleReset = useCallback(() => {
    clearGame();
    setGame(defaultSavedGame());
    setRedeemOpen(false);
    setRedeemPwd("");
    setRedeemError(false);
    setPointsBumpKey(0);
    setSelectedLetter(null);
    setSelectedAccidental(null);
  }, []);

  const startQuizFromIntro = useCallback((g: SavedGame): SavedGame => {
    return mapActiveMode({ ...g, screen: "play" }, (p) => ({
      ...p,
      introIndex: 0,
      phase: "quiz",
      quizScope: "narrow",
      quiz: ensureNarrowQuizState(p.unit, null),
      reviewWrongKeys: undefined,
      hadMissThisUnit: undefined,
    }));
  }, []);

  const introNext = useCallback(() => {
    persist((g) => {
      if (g.screen !== "play") return g;
      const p = g.progress[g.activeMode]!;
      const introLen = allFactsForUnit(p.unit).length;
      if (introLen === 0) return g;
      if (p.introIndex + 1 >= introLen) {
        return startQuizFromIntro(g);
      }
      return mapActiveMode(g, (pr) => ({
        ...pr,
        introIndex: pr.introIndex + 1,
      }));
    });
    setLessonPeekOpen(false);
    setSelectedLetter(null);
    setSelectedAccidental(null);
  }, [persist, startQuizFromIntro]);

  const advanceAfterQuizAnswer = useCallback(
    (correct: boolean) => {
      persist((g) => {
        if (g.screen !== "play") return g;
        const p = g.progress[g.activeMode]!;
        if (p.phase !== "quiz" || !p.quiz) return g;
        const q = p.quiz;
        const currentKey = q.roundKeys[q.roundIndex];
        if (currentKey === undefined) return g;

        const mergeHadMiss = (pr: ModeProgress) =>
          pr.hadMissThisUnit === true || !correct ? true : undefined;

        const pointScale = g.progress[g.activeMode]!.packPointScale ?? 1;

        const withPoints = (next: SavedGame): SavedGame => {
          if (correct) {
            const { totalPoints, factRewardWeight } = applyFactCorrect(
              next.totalPoints,
              next.factRewardWeight,
              currentKey,
              pointScale,
            );
            return { ...next, totalPoints, factRewardWeight };
          }
          return {
            ...next,
            factRewardWeight: applyFactWrong(next.factRewardWeight, currentKey),
          };
        };

        const wrong = new Set(q.wrongThisRound);
        if (!correct) wrong.add(currentKey);
        const wrongArr = [...wrong];

        const scope = p.quizScope ?? "full";

        const nextIndex = q.roundIndex + 1;
        if (nextIndex < q.roundKeys.length) {
          return withPoints(
            mapActiveMode(g, (pr) => ({
              ...pr,
              hadMissThisUnit: mergeHadMiss(pr),
              quiz: {
                ...q,
                roundIndex: nextIndex,
                wrongThisRound: wrongArr,
              },
            })),
          );
        }

        const roundPasses =
          scope === "narrow"
            ? wrongArr.length === 0
            : roundMeetsPassAccuracy(wrongArr.length, q.roundKeys.length);

        if (roundPasses) {
          if (scope === "narrow") {
            return withPoints(
              mapActiveMode(g, (pr) => ({
                ...pr,
                phase: "fullMixBridge",
                quizScope: undefined,
                quiz: null,
                reviewWrongKeys: undefined,
              })),
            );
          }
          return withPoints(
            mapActiveMode(g, (pr) => ({
              ...pr,
              quiz: null,
              quizScope: undefined,
              phase: "intro",
              introIndex: 0,
              awaitingUnitAdvance: true,
              reviewWrongKeys: undefined,
            })),
          );
        }

        return withPoints(
          mapActiveMode(g, (pr) => ({
            ...pr,
            hadMissThisUnit: mergeHadMiss(pr),
            phase: "review",
            quiz: null,
            quizScope: scope,
            reviewWrongKeys: wrongArr,
          })),
        );
      });
      setSelectedLetter(null);
      setSelectedAccidental(null);
    },
    [persist],
  );

  const submitAnswer = useCallback(() => {
    if (!game || game.screen !== "play") return;
    const p = game.progress[game.activeMode]!;
    if (p.phase !== "quiz" || !p.quiz) return;
    const key = p.quiz.roundKeys[p.quiz.roundIndex];
    if (key === undefined) return;
    const fact = parseFactKey(key);
    if (p.unit === 10 && selectedAccidental === null) return;
    if (selectedLetter === null) return;
    const ok = answerMatches(fact, p.unit, selectedLetter, selectedAccidental);
    advanceAfterQuizAnswer(ok);
    if (ok) setPointsBumpKey((k) => k + 1);
  }, [
    game,
    selectedLetter,
    selectedAccidental,
    advanceAfterQuizAnswer,
  ]);

  useEffect(() => {
    handleTimeoutRef.current = () => {
      advanceAfterQuizAnswer(false);
    };
  }, [advanceAfterQuizAnswer]);

  const answerMs = useMemo(
    () => (game ? secondsForMode(game.activeMode) * 1000 : 8000),
    [game],
  );

  useEffect(() => {
    if (!game || game.screen !== "play") {
      const clearId = window.setTimeout(() => setQuizDeadline(null), 0);
      return () => window.clearTimeout(clearId);
    }
    const p = game.progress[game.activeMode]!;
    if (p.phase !== "quiz" || !p.quiz) {
      const clearId = window.setTimeout(() => setQuizDeadline(null), 0);
      return () => window.clearTimeout(clearId);
    }
    const key = p.quiz.roundKeys[p.quiz.roundIndex];
    if (key === undefined) {
      const clearId = window.setTimeout(() => setQuizDeadline(null), 0);
      return () => window.clearTimeout(clearId);
    }

    const deadline = Date.now() + secondsForMode(game.activeMode) * 1000;
    const schedId = window.setTimeout(() => setQuizDeadline(deadline), 0);
    timeoutFiredRef.current = false;

    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= deadline && !timeoutFiredRef.current) {
        timeoutFiredRef.current = true;
        handleTimeoutRef.current();
      }
    }, 50);
    return () => {
      window.clearTimeout(schedId);
      window.clearInterval(id);
    };
  }, [game]);

  const timerWidthPct = useMemo(() => {
    if (!game || game.screen !== "play") return 100;
    const p = game.progress[game.activeMode]!;
    if (p.phase !== "quiz" || !p.quiz || quizDeadline === null) return 100;
    const left = Math.max(0, quizDeadline - now);
    return Math.min(100, (left / answerMs) * 100);
  }, [game, now, quizDeadline, answerMs]);

  const pointsTotal = game?.totalPoints ?? 0;
  const topBar = (
    <div className={styles.topBar}>
      <div className={styles.topBarCluster}>
        <div className={styles.topBarRow}>
          <span
            key={pointsBumpKey}
            className={`${styles.pointsPill} ${pointsBumpKey > 0 ? styles.pointsPillWin : ""}`}
            title="Earned on timed questions. Each repeat correct on the same fact pays a bit less (toward a small floor) until you miss it — then the next correct pays extra again."
          >
            {formatPointsDisplay(pointsTotal)} pts
          </span>
          <button
            type="button"
            className={styles.redeemBtn}
            disabled={!game}
            aria-expanded={redeemOpen}
            onClick={() => {
              if (!game) return;
              setRedeemOpen((o) => !o);
              setRedeemError(false);
            }}
          >
            Redeem
          </button>
        </div>
        {redeemOpen && game ? (
          <div
            className={styles.redeemPanel}
            role="dialog"
            aria-label="Redeem points"
          >
            <label className={styles.redeemLabel} htmlFor="redeem-password">
              Password
            </label>
            <input
              id="redeem-password"
              type="password"
              className={styles.redeemInput}
              value={redeemPwd}
              autoComplete="off"
              onChange={(e) => {
                setRedeemPwd(e.target.value);
                setRedeemError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") tryRedeem();
              }}
            />
            {redeemError ? (
              <p className={styles.redeemError}>Incorrect password.</p>
            ) : null}
            <div className={styles.redeemActions}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => tryRedeem()}
              >
                Clear points
              </button>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => {
                  setRedeemOpen(false);
                  setRedeemPwd("");
                  setRedeemError(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (!game) {
    return (
      <div className={styles.root}>
        {topBar}
        <p className={styles.subtitle}>Loading…</p>
      </div>
    );
  }

  const unlockState = {
    silverUnlocked: game.silverUnlocked,
    goldUnlocked: game.goldUnlocked,
  };

  if (game.grandComplete) {
    return (
      <div className={styles.root}>
        {topBar}
        <div className={styles.centerStack}>
          <h1 className={styles.title}>Gold complete!</h1>
          <p className={styles.subtitle}>
            You&apos;ve worked through every music unit in{" "}
            <strong>Bronze</strong>, <strong>Silver</strong>, and{" "}
            <strong>Gold</strong> pacing.
          </p>
          <div className={styles.card}>
            <p className={styles.tip}>
              Come back anytime to sharpen staff reading and keyboard names — speed
              and accuracy both stick with repetition.
            </p>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() =>
                persist((g) => ({
                  ...g,
                  grandComplete: false,
                  screen: "pickMode",
                }))
              }
            >
              Back to modes
            </button>
            {IS_DEV ? (
              <button
                type="button"
                className={styles.ghostBtn}
                style={{ marginTop: "0.65rem", width: "100%" }}
                onClick={handleReset}
              >
                Reset all progress
              </button>
            ) : null}
          </div>
          <p className={styles.footerNote}>Progress is stored on this device.</p>
        </div>
      </div>
    );
  }

  const p = game.progress[game.activeMode]!;
  const lessonFacts = allFactsForUnit(p.unit);
  const peekFact =
    lessonPeekOpen && lessonFacts[lessonPeekIndex] !== undefined
      ? lessonFacts[lessonPeekIndex]
      : null;
  const peekMnemonic = unitMnemonic(p.unit);
  const lessonPeekLayer =
    lessonPeekOpen && peekFact ? (
      <div
        className={styles.lessonPeekBackdrop}
        onClick={() => setLessonPeekOpen(false)}
        role="presentation"
      >
        <div
          className={styles.lessonPeekPanel}
          role="dialog"
          aria-label="Lesson cards"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.lessonPeekHeader}>
            <span>
              Lesson — card {lessonPeekIndex + 1} of {lessonFacts.length}
            </span>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => setLessonPeekOpen(false)}
            >
              Close
            </button>
          </div>
          {peekFact.kind === "piano" ? (
            <>
              <PianoKeyboard highlightMidi={peekFact.midi} showKeyLabels />
              <p className={styles.prompt}>White key highlighted — letter name</p>
            </>
          ) : (
            <StaffSvg fact={peekFact} className={styles.staffWrap} />
          )}
          <div className={styles.answerLine}>{answerLabel(peekFact)}</div>
          {peekMnemonic ? (
            <div className={styles.tip}>
              <div className={styles.tipLabel}>Mnemonic</div>
              {peekMnemonic}
            </div>
          ) : null}
          <div className={styles.lessonPeekNav}>
            <button
              type="button"
              className={styles.ghostBtn}
              disabled={lessonPeekIndex <= 0}
              onClick={() => setLessonPeekIndex((i) => Math.max(0, i - 1))}
            >
              Back
            </button>
            <button
              type="button"
              className={styles.ghostBtn}
              disabled={lessonPeekIndex + 1 >= lessonFacts.length}
              onClick={() =>
                setLessonPeekIndex((i) =>
                  Math.min(lessonFacts.length - 1, i + 1),
                )
              }
            >
              Next
            </button>
          </div>
        </div>
      </div>
    ) : null;

  if (p.awaitingUnitAdvance) {
    const isFinalUnit = p.unit >= maxUnit();
    const hadSlips = p.hadMissThisUnit === true;
    return (
      <div className={styles.root}>
        {topBar}
        <div className={styles.centerStack}>
          <h1 className={styles.title}>
            {isFinalUnit
              ? `${modeTitle(game.activeMode)} — unit complete!`
              : "Nice work!"}
          </h1>
          <p className={styles.subtitle}>
            {isFinalUnit
              ? game.activeMode === "gold"
                ? "You finished the final unit in Gold. The full medal path is yours."
                : `You've finished every unit in ${modeTitle(game.activeMode)}. The next mode unlocks on the map.`
              : hadSlips
                ? "You scored above 89% on the full mix for this unit — enough to move on. You can always replay from the map for more practice."
                : "You scored above 89% on the full mix through this unit. The next lesson is now on the map."}
          </p>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => {
              persist((g) => {
                const m = g.activeMode;
                const pr = g.progress[m]!;
                const nextUnlock = Math.min(
                  maxUnit(),
                  Math.max(pr.highestUnlockedUnit, pr.unit + 1),
                );
                const finalU = pr.unit >= maxUnit();

                if (finalU) {
                  const cleared: ModeProgress = {
                    ...pr,
                    highestUnlockedUnit: maxUnit(),
                    awaitingUnitAdvance: false,
                    modeComplete: true,
                    quiz: null,
                    quizScope: undefined,
                    phase: "intro",
                    introIndex: 0,
                    reviewWrongKeys: undefined,
                    hadMissThisUnit: undefined,
                    packPointScale: undefined,
                  };
                  let nextGame: SavedGame;
                  if (m === "bronze") {
                    nextGame = {
                      ...g,
                      screen: "pickMode",
                      silverUnlocked: true,
                      progress: { ...g.progress, bronze: cleared },
                    };
                  } else if (m === "silver") {
                    nextGame = {
                      ...g,
                      screen: "pickMode",
                      goldUnlocked: true,
                      progress: { ...g.progress, silver: cleared },
                    };
                  } else {
                    nextGame = {
                      ...g,
                      screen: "pickMode",
                      grandComplete: true,
                      progress: { ...g.progress, gold: cleared },
                    };
                  }
                  return withPackMedalBonusIfEligible(nextGame, m, pr.unit);
                }
                const continued: ModeProgress = {
                  ...pr,
                  highestUnlockedUnit: nextUnlock,
                  awaitingUnitAdvance: false,
                  quiz: null,
                  quizScope: undefined,
                  phase: "intro",
                  introIndex: 0,
                  reviewWrongKeys: undefined,
                  hadMissThisUnit: undefined,
                  packPointScale: undefined,
                };
                return withPackMedalBonusIfEligible(
                  {
                    ...g,
                    screen: "menu",
                    progress: { ...g.progress, [m]: continued },
                  },
                  m,
                  pr.unit,
                );
              });
            }}
          >
            {isFinalUnit && game.activeMode === "gold"
              ? "Continue"
              : isFinalUnit
                ? "Back to modes"
                : "Back to lessons"}
          </button>
        </div>
      </div>
    );
  }

  if (game.screen === "pickMode") {
    return (
      <div className={styles.root}>
        {topBar}
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Choose a mode</h1>
            <p className={styles.subtitle}>
              Clear all <strong>10 lessons</strong> in <strong>Bronze</strong> to unlock{" "}
              <strong>Silver</strong>, then Silver to unlock <strong>Gold</strong>.
              Each step uses a shorter timer per question.
            </p>
          </div>
          {IS_DEV ? (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={handleReset}
              >
                Reset progress
              </button>
            </div>
          ) : null}
        </div>
        <div className={styles.modeGrid} role="list">
          {GAME_MODES.map((mode) => {
            const unlocked = modeIsUnlocked(unlockState, mode);
            const prog = game.progress[mode]!;
            const done = prog.modeComplete === true;
            const seconds = secondsForMode(mode);
            return (
              <button
                key={mode}
                type="button"
                role="listitem"
                disabled={!unlocked}
                className={
                  unlocked
                    ? done
                      ? styles.modeCellDone
                      : styles.modeCell
                    : styles.modeCellLocked
                }
                onClick={() => {
                  if (!unlocked) return;
                  persist((g) => selectMode(g, mode));
                  setSelectedLetter(null);
                  setSelectedAccidental(null);
                }}
              >
                <span className={styles.modeCellTitle}>{modeTitle(mode)}</span>
                <span className={styles.modeCellMeta}>
                  {unlocked
                    ? `${seconds}s per question`
                    : "Complete the prior mode"}
                </span>
                {done ? (
                  <span className={styles.modeCellBadge}>Complete</span>
                ) : null}
              </button>
            );
          })}
        </div>
        <p className={styles.footerNote}>
          Timers: Bronze {secondsForMode("bronze")}s · Silver{" "}
          {secondsForMode("silver")}s · Gold {secondsForMode("gold")}s per question.
        </p>
      </div>
    );
  }

  if (game.screen === "menu") {
    const progMenu = game.progress[game.activeMode]!;
    const inProgressUnit =
      !progMenu.awaitingUnitAdvance &&
      (progMenu.phase === "quiz" ||
        progMenu.phase === "review" ||
        progMenu.phase === "fullMixBridge" ||
        (progMenu.phase === "intro" && progMenu.introIndex > 0))
        ? progMenu.unit
        : null;
    const sec = secondsForMode(game.activeMode);

    return (
      <div className={styles.root}>
        {topBar}
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>
              {modeTitle(game.activeMode)} · Lessons
            </h1>
            <p className={styles.subtitle}>
              {sec} seconds per timed question. Each pack: intro cards, a timed round on{" "}
              <strong>this unit only</strong>, a short full-mix heads-up, then the{" "}
              <strong>cumulative</strong> timed mix (units 1–U). You need a score{" "}
              <strong>above 89%</strong> on that full mix to unlock the next lesson. The
              narrow round must be <strong>perfect</strong> (no misses) before the bridge.
            </p>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => persist((g) => goToModePicker(g))}
            >
              Modes
            </button>
            {IS_DEV ? (
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={handleReset}
              >
                Reset progress
              </button>
            ) : null}
          </div>
        </div>
        <div className={styles.unitGrid} role="list">
          {SELECTABLE_UNITS.map((u) => {
            const unlocked = u <= progMenu.highestUnlockedUnit;
            const completed = isPackCompletedForUnit(
              game,
              game.activeMode,
              u,
            );
            const playable = unlocked;
            const inProgress = inProgressUnit === u;
            const title = UNIT_TITLES[u - 1] ?? `Unit ${u}`;
            return (
              <button
                key={u}
                type="button"
                role="listitem"
                disabled={!playable}
                className={
                  !unlocked
                    ? styles.unitCellLocked
                    : completed
                      ? styles.unitCellDone
                      : inProgress
                        ? styles.unitCellActive
                        : styles.unitCell
                }
                onClick={() => {
                  if (!playable) return;
                  persist((g) => selectUnit(g, u));
                  setSelectedLetter(null);
                  setSelectedAccidental(null);
                }}
              >
                <span className={styles.unitCellNum}>{u}</span>
                <span className={styles.unitCellHint}>
                  {!unlocked
                    ? "Locked"
                    : completed
                      ? "Replay"
                      : inProgress
                        ? "Continue"
                        : title}
                </span>
              </button>
            );
          })}
        </div>
        <p className={styles.footerNote}>
          Narrow round = new unit only. Full mix = everything from unit 1 through the
          current unit, shuffled. Review retries keep the same scope as the round you
          missed.
        </p>
      </div>
    );
  }

  if (p.phase === "fullMixBridge") {
    const sec = secondsForMode(game.activeMode);
    const u = p.unit;
    const mixLabel =
      u <= 1
        ? "unit 1 only (same set as the first round — reshuffled for practice)"
        : `units 1 through ${u}`;

    return (
      <div className={styles.root}>
        {topBar}
        {lessonPeekLayer}
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>
              {modeTitle(game.activeMode)} · Unit {p.unit}
            </h1>
            <p className={styles.subtitle}>
              You cleared the first timed round (this unit only). Next: a timed mix of
              everything you&apos;ve covered so far in this path.
            </p>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={openLessonPeek}
            >
              Review lesson
            </button>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => persist((g) => goToMenu(g))}
            >
              Lessons
            </button>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => persist((g) => goToModePicker(g))}
            >
              Modes
            </button>
            {IS_DEV ? (
              <button type="button" className={styles.ghostBtn} onClick={handleReset}>
                Reset progress
              </button>
            ) : null}
          </div>
        </div>
        <div className={styles.card}>
          <p className={styles.subtitle} style={{ marginBottom: "1rem" }}>
            The full round includes {mixLabel}, shuffled, at {sec} second
            {sec === 1 ? "" : "s"} per question. You pass this unit when you score{" "}
            <strong>above 89%</strong> on this cumulative round (timeouts count as misses).
          </p>
          <div className={styles.quizToolRow}>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => persist((g) => restartPackFromLessonWithPointPenalty(g))}
            >
              Start pack over from lesson
            </button>
          </div>
          <button
            type="button"
            className={styles.primaryBtn}
            style={{ width: "100%" }}
            onClick={() => {
              persist((g) =>
                mapActiveMode(g, (pr) => ({
                  ...pr,
                  phase: "quiz",
                  quizScope: "full",
                  quiz: ensureFullQuizState(pr.unit, null),
                  reviewWrongKeys: undefined,
                })),
              );
              setSelectedLetter(null);
              setSelectedAccidental(null);
            }}
          >
            Start full mix
          </button>
        </div>
      </div>
    );
  }

  if (p.phase === "review" && p.reviewWrongKeys && p.reviewWrongKeys.length > 0) {
    const uniqueKeys = [...new Set(p.reviewWrongKeys)];
    const facts = uniqueKeys.map((k) => parseFactKey(k));
    const sec = secondsForMode(game.activeMode);

    return (
      <div className={styles.root}>
        {topBar}
        {lessonPeekLayer}
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Reviewing hard questions</h1>
            <p className={styles.subtitle}>
              You missed {uniqueKeys.length} fact
              {uniqueKeys.length === 1 ? "" : "s"} this round. Here are the
              answers — then a timed pass with just these ({sec}s each).
            </p>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => persist((g) => goToMenu(g))}
            >
              Lessons
            </button>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => persist((g) => goToModePicker(g))}
            >
              Modes
            </button>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={openLessonPeek}
            >
              Review lesson
            </button>
            {IS_DEV ? (
              <button type="button" className={styles.ghostBtn} onClick={handleReset}>
                Reset progress
              </button>
            ) : null}
          </div>
        </div>
        <div className={styles.card}>
          <ul className={styles.reviewList}>
            {facts.map((f) => (
              <li key={f.id} className={styles.reviewItem}>
                <span className={styles.reviewEquation}>{answerLabel(f)}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className={styles.primaryBtn}
            style={{ marginTop: "1.25rem", width: "100%" }}
            onClick={() => {
              persist((g) => startRetryAfterReview(g));
              setSelectedLetter(null);
              setSelectedAccidental(null);
            }}
          >
            Practice these questions
          </button>
          <button
            type="button"
            className={styles.ghostBtn}
            style={{ marginTop: "0.65rem", width: "100%" }}
            onClick={() => persist((g) => restartPackFromLessonWithPointPenalty(g))}
          >
            Start pack over from lesson (points for this pack halve)
          </button>
        </div>
      </div>
    );
  }

  if (p.phase === "intro") {
    const facts = allFactsForUnit(p.unit);
    const fact = facts[p.introIndex];
    if (!fact) {
      return (
        <div className={styles.root}>
          {topBar}
          <p className={styles.subtitle}>
            {IS_DEV
              ? "Something went wrong. Try reset."
              : "Something went wrong. Reload the page to try again."}
          </p>
          {IS_DEV ? (
            <button type="button" className={styles.primaryBtn} onClick={handleReset}>
              Reset progress
            </button>
          ) : null}
        </div>
      );
    }
    const mnemonic = unitMnemonic(p.unit);
    const introLen = facts.length;
    const lastCard = p.introIndex + 1 >= introLen;
    const sec = secondsForMode(game.activeMode);

    return (
      <div className={styles.root}>
        {topBar}
        {lessonPeekLayer}
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>
              {modeTitle(game.activeMode)} · Unit {p.unit}
            </h1>
            <p className={styles.subtitle}>
              {UNIT_TITLES[p.unit - 1] ?? `Unit ${p.unit}`} — card{" "}
              {p.introIndex + 1} of {introLen}. Timed round: {sec}s per question.
            </p>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={openLessonPeek}
            >
              Browse lesson
            </button>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => persist((g) => goToMenu(g))}
            >
              Lessons
            </button>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => persist((g) => goToModePicker(g))}
            >
              Modes
            </button>
            {IS_DEV ? (
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={handleReset}
              >
                Reset progress
              </button>
            ) : null}
          </div>
        </div>
        <div className={styles.card}>
          {fact.kind === "piano" ? (
            <>
              <PianoKeyboard highlightMidi={fact.midi} showKeyLabels />
              <p className={styles.prompt}>White key highlighted — letter name</p>
            </>
          ) : (
            <StaffSvg fact={fact} className={styles.staffWrap} />
          )}
          <div className={styles.answerLine}>{answerLabel(fact)}</div>
          {mnemonic ? (
            <div className={styles.tip}>
              <div className={styles.tipLabel}>Mnemonic</div>
              {mnemonic}
            </div>
          ) : null}
          <button
            type="button"
            className={styles.primaryBtn}
            style={{ marginTop: "1.25rem", width: "100%" }}
            onClick={introNext}
          >
            {lastCard ? "Start timed practice" : "Next"}
          </button>
        </div>
        <p className={styles.footerNote}>
          After intro cards: timed narrow round with <strong>no misses</strong>, then the{" "}
          <strong>full cumulative mix</strong> (score <strong>above 89%</strong>) to finish
          the unit.
        </p>
      </div>
    );
  }

  if (p.phase !== "quiz") {
    return (
      <div className={styles.root}>
        {topBar}
        <p className={styles.subtitle}>
          {IS_DEV
            ? "Lesson state missing. Try reset."
            : "Something went wrong. Reload the page to try again."}
        </p>
        {IS_DEV ? (
          <button type="button" className={styles.primaryBtn} onClick={handleReset}>
            Reset progress
          </button>
        ) : null}
      </div>
    );
  }

  const q = p.quiz;
  if (!q || q.roundKeys.length === 0) {
    return (
      <div className={styles.root}>
        {topBar}
        <p className={styles.subtitle}>
          {IS_DEV
            ? "Quiz state missing. Try reset."
            : "Something went wrong. Reload the page to try again."}
        </p>
        {IS_DEV ? (
          <button type="button" className={styles.primaryBtn} onClick={handleReset}>
            Reset progress
          </button>
        ) : null}
      </div>
    );
  }

  const key = q.roundKeys[q.roundIndex];
  if (key === undefined) {
    return (
      <div className={styles.root}>
        {topBar}
        <p className={styles.subtitle}>Loading question…</p>
      </div>
    );
  }

  const fact = parseFactKey(key);
  const total = q.roundKeys.length;
  const position = q.roundIndex + 1;
  const misses = new Set(q.wrongThisRound).size;
  const sec = secondsForMode(game.activeMode);

  const canCheck =
    selectedLetter !== null &&
    (p.unit < 10 || selectedAccidental !== null);

  return (
    <div className={styles.root}>
      {topBar}
      {lessonPeekLayer}
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>
            {modeTitle(game.activeMode)} · Unit {p.unit}
          </h1>
          <p className={styles.subtitle}>
            {p.quizScope === "narrow"
              ? `This round: ${UNIT_TITLES[p.unit - 1] ?? `Unit ${p.unit}`} only. `
              : `This round: full mix (units 1–${p.unit}). `}
            {sec}s per question. Timeouts count as misses.
            {p.packPointScale !== undefined && p.packPointScale < 1
              ? ` Pack redo: each correct answer earns ${(p.packPointScale * 100).toFixed(
                  0,
                )}% of the usual points.`
              : null}
          </p>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={openLessonPeek}
          >
            Review lesson
          </button>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => persist((g) => goToMenu(g))}
          >
            Lessons
          </button>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => persist((g) => goToModePicker(g))}
          >
            Modes
          </button>
          {IS_DEV ? (
            <button type="button" className={styles.ghostBtn} onClick={handleReset}>
              Reset progress
            </button>
          ) : null}
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.progressMeta}>
          <span>
            {p.quizScope === "narrow" ? "Narrow" : "Full mix"} · {position} / {total}
          </span>
          <span>Misses this round: {misses}</span>
          <span className={styles.rewardHint}>
            +
            {formatNextRewardPreview(
              rewardWeightForFact(game.factRewardWeight, key) *
                (p.packPointScale ?? 1),
            )}{" "}
            if correct
          </span>
        </div>
        <div className={styles.quizToolRow}>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => {
              persist((g) => restartCurrentQuizRound(g));
              setSelectedLetter(null);
              setSelectedAccidental(null);
            }}
          >
            Restart this timed round
          </button>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => persist((g) => restartPackFromLessonWithPointPenalty(g))}
          >
            Start pack over from lesson
          </button>
        </div>
        <div className={styles.timerTrack} aria-hidden>
          <div
            className={styles.timerFill}
            style={{ width: `${timerWidthPct}%` }}
          />
        </div>
        {fact.kind === "piano" ? (
          <>
            <PianoKeyboard highlightMidi={fact.midi} />
            <p className={styles.equation}>Name this white key</p>
          </>
        ) : (
          <>
            <StaffSvg fact={fact} className={styles.staffWrap} />
            <p className={styles.equation}>Name this note</p>
          </>
        )}
        <div className={styles.letterGrid} role="group" aria-label="Letter name">
          {LETTERS.map((L) => (
            <button
              key={L}
              type="button"
              className={
                selectedLetter === L
                  ? `${styles.letterBtn} ${styles.letterBtnSelected}`
                  : styles.letterBtn
              }
              onClick={() => setSelectedLetter(L)}
            >
              {L}
            </button>
          ))}
        </div>
        {p.unit === 10 ? (
          <>
            <div className={styles.accLabel}>Accidental</div>
            <div className={styles.accRow}>
              {(
                [
                  ["natural", "♮"] as const,
                  ["sharp", "♯"] as const,
                  ["flat", "♭"] as const,
                ] as const
              ).map(([kind, sym]) => (
                <button
                  key={kind}
                  type="button"
                  className={
                    selectedAccidental === kind
                      ? `${styles.letterBtn} ${styles.letterBtnSelected}`
                      : styles.letterBtn
                  }
                  onClick={() => setSelectedAccidental(kind)}
                >
                  {sym}
                </button>
              ))}
            </div>
          </>
        ) : null}
        <div className={styles.checkRow}>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={!canCheck}
            onClick={submitAnswer}
          >
            Check
          </button>
        </div>
      </div>
      <p className={styles.footerNote}>
        Misses open a review, then a retry with the same scope. A round with a score{" "}
        Narrow rounds must be <strong>perfect</strong>; the full mix passes with a score{" "}
        <strong>above 89%</strong>. Starting the pack over from the lesson halves points for
        that pack.
      </p>
    </div>
  );
}
