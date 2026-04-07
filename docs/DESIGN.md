# Music staff & keyboard tutor — design

## Product goals

Help learners build fluent recognition of **piano keys** and **notes on the staff** through a **sequential curriculum**, a **learn-then-drill** flow, **timed practice** at three difficulty paces, **targeted retries**, and clear **progression rules**: the **narrow** timed round must be **perfect** (no misses), and the **cumulative / full-mix** round passes with **accuracy above 89%**—that full round gates unlocking the next unit; same idea as in `multiplication/docs/DESIGN.md`.

Core skills (high level):

- Map **staff positions** and **keyboard** to **letter names** (A–G) and optional **octave** disambiguation when needed.
- Start on the **keyboard** (concrete), then **treble** staff (lines, then spaces), then **bass** staff (lines, then spaces), then **ledger-line** extensions, then **accidentals** (sharps and flats).

## Curriculum order (units)

Units unlock **in this order**; each unit completes before the next is available.

| Order | Unit | What the learner identifies |
|------:|------|------------------------------|
| 1 | **Piano keys** | White keys → letter names on the keyboard UI. |
| 2 | **Treble clef — line notes** | The five line pitches (mnemonic **E–G–B–D–F**). |
| 3 | **Treble clef — space (“FACE”) notes** | The four space pitches (**F–A–C–E**). |
| 4 | **Bass clef — line notes** | The five line pitches (mnemonic **G–B–D–F–A**, bottom-to-top). |
| 5 | **Bass clef — space notes** | The four space pitches (mnemonic **A–C–E–G**, “**A**ll **C**ows **E**at **G**rass”). |
| 6 | **Below treble staff** | Ledger lines and steps **below** the treble staff. |
| 7 | **Above bass staff** | Ledger lines and steps **above** the bass staff. |
| 8 | **Below bass staff** | Ledger lines and steps **below** the bass staff. |
| 9 | **Above treble staff** | Ledger lines and steps **above** the treble staff. |
| 10 | **Sharps and flats** | **♯ / ♭** on notes already in scope: staff and/or keyboard. |

**Scope notes**

- **Units 2–5** stay on the **main staff** before **ledger-line** regions (units 6–9).
- **Unit 10** assumes letter-name fluency for natural notes; drills add **accidentals** on a defined pitch set.

## Navigation & modes

1. **Mode picker** — Choose **Bronze**, **Silver**, or **Gold**. Silver unlocks after clearing every unit (1–10) in Bronze; Gold after the same in Silver.
2. **Unit map** — One tile per curriculum unit. Only units up to **`highestUnlockedUnit`** are selectable; cleared packs show **Done** and are not replayed in that mode (same idea as completed levels in multiplication).
3. **Play** — A fixed sequence: **intro cards** (this unit’s facts), **narrow timed quiz** (this unit only), **full-mix bridge** screen, **full timed quiz** (cumulative facts from units **1 … U**), optional **review** rounds, then **pack complete** when the **full** quiz passes the accuracy threshold.

Timer per question (aligned with multiplication):

| Mode   | Seconds per question |
|--------|---------------------:|
| Bronze | 10 |
| Silver | 8 |
| Gold   | 6 |

## Unit model

- Units are **1-indexed** and **ordered** by the curriculum table above.
- Each unit defines a **finite set of facts** (stable string ids); see `src/lib/facts.ts`.
- **Narrow** scope for unit **U** = fact ids in **unit U only**.
- **Full** scope for unit **U** = all fact ids from **units 1 through U** (cumulative), matching the spirit of multiplication’s “everything through this level” round.

## Phases & pack flow

Progress for the active unit is stored in **`ModeProgress`** (`src/lib/persistence.ts`). **`phase`** is one of:

| Phase | Purpose |
|-------|---------|
| **`intro`** | One card per fact **in this unit**, no timer. Mnemonics where useful. |
| **`quiz`** | Timed drill. Scope is **`quizScope`**: **`narrow`** (this unit only) or **`full`** (units 1…U). Shuffled **round**; wrong answers and timeouts add to a **wrong stack** for the round. |
| **`fullMixBridge`** | **Between** a passing **narrow** round and the **full** quiz: non-timed heads-up. **Start full mix** begins **`quiz`** with **`quizScope: "full"`**. |
| **`review`** | After a round that **fails** the accuracy threshold: list missed facts with answers; **Practice these questions** starts another **`quiz`** with **only** those keys (same **`quizScope`** as the failed round). |

**`quizScope`** is stored during **`quiz`** and **`review`**; cleared during **`intro`** and **`fullMixBridge`**. Legacy **`v: 1`** saves infer **`narrow`** vs **`full`** from which fact keys appear in the quiz slice when possible.

### Pass rule (timed rounds)

- **Narrow** (`quizScope: "narrow"`): a round **passes** only with **zero** wrong or timed-out questions (including review retries that still use narrow scope).
- **Full / cumulative** (`quizScope: "full"`): a round **passes** when **more than 89%** of questions are correct (**`roundMeetsPassAccuracy`** in **`src/lib/points.ts`**, `LEVEL_PASS_ACCURACY_THRESHOLD = 0.89`).
- **Narrow** must pass to reach **`fullMixBridge`** and then the **full** cumulative quiz.
- **Unlocking the next unit** is satisfied by passing the **full / cumulative** timed round for that unit (**> 89%**). Earlier slips in the pack do **not** block unlock once that full round passes.

### Typical happy path

1. **Intro** — advance through all unit cards → start **narrow** quiz.
2. **Narrow quiz** — **perfect** round → **`fullMixBridge`**.
3. **Full mix bridge** — learner reads the heads-up → **Start full mix**.
4. **Full quiz** — finish with **> 89%** correct → **pack-complete** (awaiting advance).

If a timed phase **does not** pass, flow is **review → retry quiz** (subset or same composition rules as today) until a round passes.

**Unit 1:** narrow and full key sets are the **same** (only unit 1 exists); the learner still goes through **narrow → bridge → full** for a consistent ritual (same as level 1 in multiplication).

### Rounds, retries, and unlocking

- **Round** = one shuffled pass over the current key set (narrow, full, or review subset).
- **Duplicate** misses on the same fact in one round still produce **one** retry entry.
- **`hadMissThisUnit`** is still set when any timed answer is wrong or timed out (pack-wide flag for copy / messaging); it does **not** block unlocking after a passing **full** round.
- Learners can **restart the current timed round** from question 1 (reshuffle; full deck vs subset detected in **`restartCurrentQuizRound`**).
- Learners can **start the pack over from the intro lesson**; each time they do, **`packPointScale`** halves (see Points), applied to correct-answer scoring for that pack until the unit is passed or the pack is re-entered cleanly from the map (fresh **`selectUnit`** clears the scale).

### Lesson review during a pack

From **intro** (browse), **quiz**, **review**, or **fullMixBridge**, the learner can open a **lesson overlay** with the same material as the intro cards for the **current unit**, without leaving the timed flow.

## Points system & backoff

Implemented in **`src/lib/points.ts`**; stored on the save as **`totalPoints`** (cumulative) and **`factRewardWeight`** (per fact id).

### Baseline and bounds

- **`POINT_BASE` (0.1)** — Default **reward weight** for a fact that has no stored weight yet.
- **`POINT_FLOOR` (0.01)** — Minimum weight; decay approaches this from above.
- **`POINT_PEAK` (0.2)** — Weight after a **wrong** or **timeout** on that fact; the **next correct** on that fact pays this much (then backoff applies again).

Intro cards **do not** change points or weights. Only **timed quiz** answers (including review retries) do.

**`packPointScale`** (on **`ModeProgress`**, default implicit **1**): multiplied onto the points added by **`applyFactCorrect`** for that pack attempt. Halves on each **start pack over from lesson** (`restartPackFromLessonWithPointPenalty`).

### On a correct timed answer

1. Add **`packPointScale ×`** the fact’s **current weight** `w` to **`totalPoints`**.
2. **Backoff (decay):** `w' = POINT_FLOOR + (w - POINT_FLOOR) × POINT_WEIGHT_DECAY` with **`POINT_WEIGHT_DECAY = 0.78`**, quantized to three decimals, clamped to **[POINT_FLOOR, POINT_PEAK]**.

### On a wrong answer or timeout

- **`applyFactWrong`** sets that fact’s weight to **`POINT_PEAK`**.

### Medal pack bonus & redeem

- **One-time bonus** when you **first** pass a unit pack in that mode (`packMedalCompletionBonus` in `src/lib/modes.ts`: Bronze **0.5**, Silver **1**, Gold **1.5**), tracked in **`packMedalBonusesAtUnit`** so it is not awarded twice for the same unit in the same mode.
- Total points in the **top-right**; correct answers can **animate** the pill (`prefers-reduced-motion` disables it).
- Quiz UI shows a **preview** of the next reward for the current question (including **`packPointScale`**).
- **Redeem** (parent password **`1234`**) clears **`totalPoints`** and **`factRewardWeight`** (client-only).

## Edge cases

- **Timeout** counts like a wrong answer: wrong stack, **`hadMissThisUnit`**, and **`applyFactWrong`** for points.
- **Enharmonic** display should follow a **single convention** per exercise.

## Persistence

- **`localStorage`** key: `music-tutor-v1`.
- **`v: 2`**: `screen`, `activeMode`, per-mode **`ModeProgress`** (`unit`, **`phase`**: `intro` \| `fullMixBridge` \| `quiz` \| `review`, **`quizScope`**: `narrow` \| `full`, quiz slice, `reviewWrongKeys`, `hadMissThisUnit`, `awaitingUnitAdvance`, `modeComplete`, **`packPointScale`**, …), **`totalPoints`**, **`factRewardWeight`**, **`packMedalBonusesAtUnit`**, mode unlock flags, optional `grandComplete`.
- **`v: 1`** loads are **upgraded** to **`v: 2`** on read (quiz scope inferred where possible).
- **Reset progress** clears storage and returns a fresh game.

## Technical map (repo)

| Area | Location |
|------|-----------|
| Fact keys, cumulative sets, shuffle | `src/lib/facts.ts` |
| Bronze / Silver / Gold timers & pack medal bonus | `src/lib/modes.ts` |
| Points math, pass threshold & backoff | `src/lib/points.ts` |
| Save / load / migrate / quiz scopes | `src/lib/persistence.ts` |
| UI + state machine | `src/components/MusicGame.tsx` |
| Styles | `src/components/MusicGame.module.css` |
| Staff / keyboard | `src/components/StaffSvg.tsx`, `PianoKeyboard.tsx` |
| App entry | `src/app/page.tsx` |

## Future ideas (not required for v1)

- Server-side auth or secure “redeem.”
- Sound, haptics, or extra streak rewards.
- Adjustable timers or accessibility overrides.
- Replay completed units without resetting the whole mode.
- Analytics or accounts for cross-device progress.
