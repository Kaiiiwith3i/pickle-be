# Doubles evaluation (provisional) — for Chapter 3

Status: **PROVISIONAL**. The ground-truth rubric below was written by the developers to mirror the singles rubric. It has not been reviewed by the expert panel, and every output that quotes it says so. Numbers come only from running the harness; the rubric and data were not adjusted after the first run.

## What is evaluated

The doubles engine path in `src/engine/doubles.ts`: Stage 1 `evaluateDoublesGate` (team centroids in the corridor and within 15 km, composite tier distance at most 1, 4-way shared schedule of at least 60 min) and Stage 2 `scoreDoublesPair` (content fused as 0.40 skill + 0.35 distance + 0.25 schedule, plus the boost-only CF term `S = content + w·cf·(1 − content)` averaged over the four cross-team player pairs). A pair is predicted compatible when the gate passes and `S >= τ`, for τ in {0.75, 0.80, 0.85, 0.90, 0.95}. Precision, recall and F1 use the same `computeMetrics` as singles.

## Evaluation set

`scripts/evaluate.ts` reuses the singles simulation (60 simulated players with latent true rating and true availability, and observed self-assessed tier and possibly incomplete schedule). Doubles draws use their own RNG stream (`SEED ^ 0xd0b1e5`), so adding this condition cannot change any singles number.

Pairs are team-vs-team: a seeker team of two random players against a candidate team of two other players (four distinct players, no repeated quad). Draws continue until there are 22 positive and 28 negative pairs (the same stratification as singles, 50 pairs in total) or 20,000 draws are used. The two conditions are the same as singles: cold start (empty interaction matrix) and post-adoption (the same simulated co-play history).

## Provisional rubric (judged on latent truth, mirrors the singles rubric)

A team pair is compatible when all hold:

| Rule | Singles | Doubles |
|---|---|---|
| Rating | gap between the two players <= 0.75 | gap between the two team mean true ratings <= 0.75 |
| Shared time | >= 90 min in the players' true availability | >= 90 min common to all four players' true availability |
| Distance | <= 12 km between the players | <= 12 km between the two team centroids |
| Intent | the two intents are equal or one is `both` | the stated (non-`both`) intents of the four players do not disagree |

The constants are the singles `RUBRIC` object, reused unchanged.

## Reproduce

```bash
npm run evaluate
```

Writes, besides the singles outputs:

- `thesis-artifacts/evaluation-summary.json` — new top-level `doubles` key (`provisional: true`, `labelSource`, rubric, pair counts, `cold_start` and `post_adoption` sweeps).
- `thesis-artifacts/metrics.md` — a final section headed "Doubles (PROVISIONAL ...)".

The singles sections are unchanged by this condition: tau* 0.90, F1 0.878, P 0.947, R 0.818 (cold start). `--labels <csv>` replaces the singles labels only; doubles labels stay on the provisional rubric until the panel reviews them.

## Result of the run (seed 20260711)

50 pairs (22 positive, 28 negative). Cold start and post-adoption are identical on this set (no sampled quad had a co-play history that moved a score).

| tau | TP | FP | FN | TN | Precision | Recall | F1 |
|---|---|---|---|---|---|---|---|
| 0.75 | 16 | 1 | 6 | 27 | 0.941 | 0.727 | 0.821 |
| 0.80 | 13 | 0 | 9 | 28 | 1.000 | 0.591 | 0.743 |
| 0.85 | 7 | 0 | 15 | 28 | 1.000 | 0.318 | 0.483 |
| 0.90 | 6 | 0 | 16 | 28 | 1.000 | 0.273 | 0.429 |
| 0.95 | 1 | 0 | 21 | 28 | 1.000 | 0.045 | 0.087 |

Reading it: on this provisional set the best tau is 0.75, not the singles 0.90. At the production tau of 0.90 the doubles path has precision 1.000 but recall 0.273, so it is conservative. This is reported as found. The production tau for doubles is unchanged (`CALIBRATED_TAU`); whether to calibrate a separate doubles tau is a decision for Kiel and the panel, not something this harness was tuned to decide.
