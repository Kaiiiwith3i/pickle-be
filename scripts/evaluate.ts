/**
 * Pickle C-LB — Algorithm Performance Evaluation Harness (Chapter 4).
 *
 * Implements the Chapter 3 protocol: 50 simulated player-profile pairs are
 * labeled for ground-truth compatibility and the Hybrid Filtering Engine is
 * evaluated at τ ∈ {0.75, 0.80, 0.85, 0.90, 0.95} with Precision / Recall / F1.
 *
 * Anti-circularity design: every simulated player has LATENT truth (true USA
 * Pickleball rating, true weekly schedule) and OBSERVED onboarding data (a
 * possibly mis-self-assessed tier, an incompletely entered schedule). The
 * ground-truth rubric judges pairs on latent truth; the engine only ever sees
 * observed data. Misclassifications therefore arise exactly the way they do in
 * production: over-rated self-assessments create false positives, un-entered
 * availability creates false negatives.
 *
 * Ground-truth labels produced here are PROVISIONAL (rubric-based). The
 * generated expert-labeling sheet lets the five-player expert panel replace
 * them per the manuscript's protocol; re-running this script with
 * --labels <csv> recomputes all metrics from the panel's answers.
 *
 * Usage: npx tsx scripts/evaluate.ts [--labels thesis-artifacts/expert-labels.csv]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const outDir = path.resolve(process.cwd(), 'thesis-artifacts');

import type {
  AvailabilityWindow,
  EngagementRecord,
  PlayerProfile,
  SkillTier,
} from '../src/engine';
import {
  CALIBRATED_TAU,
  DEFAULT_CONFIG,
  InteractionMatrix,
  computeTeamCentroid,
  evaluateDoublesGate,
  evaluateGate,
  haversineKm,
  scoreDoublesPair,
  scorePair,
  sharedAvailability,
  tierFromRating,
} from '../src/engine';

// ---------------------------------------------------------------------------
// Deterministic RNG (mulberry32) — the whole experiment is reproducible.
// ---------------------------------------------------------------------------
const SEED = 20260711;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
/** Doubles draws come from their own stream so adding the doubles condition cannot move any singles number. */
const randDoubles = mulberry32(SEED ^ 0xd0b1e5);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const chance = (p: number): boolean => rand() < p;

// ---------------------------------------------------------------------------
// Simulation model
// ---------------------------------------------------------------------------
const TAUS = [0.75, 0.8, 0.85, 0.9, 0.95] as const;
const POPULATION = 60;
const PAIR_COUNT = 50;

/** Realistic recurring slots for the corridor (weekday evenings, weekend AMs). */
const SLOT_LIBRARY: AvailabilityWindow[] = [
  { day: 1, startMin: 1080, endMin: 1260 }, // Mon 6–9 pm
  { day: 2, startMin: 1080, endMin: 1260 },
  { day: 3, startMin: 1080, endMin: 1260 },
  { day: 4, startMin: 1080, endMin: 1260 },
  { day: 5, startMin: 1080, endMin: 1320 }, // Fri 6–10 pm
  { day: 6, startMin: 360, endMin: 600 },   // Sat 6–10 am
  { day: 6, startMin: 960, endMin: 1200 },  // Sat 4–8 pm
  { day: 0, startMin: 360, endMin: 600 },   // Sun 6–10 am
  { day: 0, startMin: 900, endMin: 1140 },  // Sun 3–7 pm
  { day: 3, startMin: 360, endMin: 540 },   // Wed 6–9 am (morning regulars)
];

/** Sampling areas roughly matching community hubs in the corridor. */
const AREAS = [
  { name: 'Calamba Poblacion', lat: 14.2117, lng: 121.1653 },
  { name: 'Brgy. Mayapa', lat: 14.2246, lng: 121.1265 },
  { name: 'Brgy. Canlubang', lat: 14.2634, lng: 121.0873 },
  { name: 'Brgy. Pansol', lat: 14.1893, lng: 121.1998 },
  { name: 'Los Baños Poblacion', lat: 14.1699, lng: 121.2441 },
  { name: 'UPLB / Batong Malake', lat: 14.1652, lng: 121.2417 },
  { name: 'Brgy. Anos', lat: 14.1755, lng: 121.2245 },
] as const;

interface SimulatedPlayer {
  profile: PlayerProfile;          // what the engine sees (observed)
  trueRating: number;              // latent
  trueAvailability: AvailabilityWindow[]; // latent
  area: string;
}

function sampleTrueRating(): number {
  // Community skew: many beginners, fewer advanced (matches a young community).
  const r = rand();
  if (r < 0.4) return 2.0 + rand() * 0.9;   // 2.0–2.9
  if (r < 0.8) return 3.0 + rand() * 0.9;   // 3.0–3.9
  return 4.0 + rand() * 1.0;                // 4.0–5.0
}

function sampleWindows(): AvailabilityWindow[] {
  const n = 2 + Math.floor(rand() * 3); // 2–4 weekly slots
  const chosen = new Set<AvailabilityWindow>();
  while (chosen.size < n) chosen.add(pick(SLOT_LIBRARY));
  return [...chosen];
}

function simulatePlayer(i: number): SimulatedPlayer {
  const area = pick(AREAS);
  const jitter = () => (rand() - 0.5) * 0.03; // ≈ ±1.6 km
  const trueRating = sampleTrueRating();

  // Self-assessment noise: 25% over-rate by ~0.5, 12% under-rate by ~0.5.
  const noiseRoll = rand();
  const selfError = noiseRoll < 0.25 ? 0.5 : noiseRoll < 0.37 ? -0.5 : 0;
  const selfRating = Math.min(5.5, Math.max(2.0, trueRating + selfError));

  // Observed schedule: 25% of players forget to enter one of their real slots.
  const trueAvailability = sampleWindows();
  const observedAvailability =
    trueAvailability.length > 2 && chance(0.25)
      ? trueAvailability.slice(0, trueAvailability.length - 1)
      : trueAvailability;

  const tier: SkillTier = tierFromRating(selfRating);
  return {
    trueRating,
    trueAvailability,
    area: area.name,
    profile: {
      id: `sim-${String(i).padStart(2, '0')}`,
      displayName: `Player ${i}`,
      tier,
      rating: chance(0.4) ? selfRating : undefined, // 40% supply a numeric rating
      location: { lat: area.lat + jitter(), lng: area.lng + jitter() },
      availability: observedAvailability,
      format: pick(['singles', 'doubles', 'both'] as const),
      intent: pick(['casual', 'competitive', 'both'] as const),
      matchmakingOptIn: true,
    },
  };
}

// ---------------------------------------------------------------------------
// Ground-truth rubric (documented in Chapter 4; provisional until the expert
// panel's sheets replace it). Judged on LATENT truth.
// ---------------------------------------------------------------------------
const RUBRIC = {
  maxRatingGap: 0.75,   // USA Pickleball guidance: within ~0.5–1.0 plays well
  minSharedMinutes: 90, // at least 1.5 h of genuinely shared weekly time
  maxDistanceKm: 12,    // realistically reachable within the corridor
};

function intentCompatible(a: PlayerProfile, b: PlayerProfile): boolean {
  return a.intent === 'both' || b.intent === 'both' || a.intent === b.intent;
}

function rubricLabel(a: SimulatedPlayer, b: SimulatedPlayer): boolean {
  const ratingOk =
    Math.abs(a.trueRating - b.trueRating) <= RUBRIC.maxRatingGap;
  const shared = sharedAvailability(a.trueAvailability, b.trueAvailability);
  const timeOk = shared.totalMinutes >= RUBRIC.minSharedMinutes;
  const distOk =
    haversineKm(a.profile.location, b.profile.location) <= RUBRIC.maxDistanceKm;
  return ratingOk && timeOk && distOk && intentCompatible(a.profile, b.profile);
}

// ---------------------------------------------------------------------------
// Doubles ground truth — PROVISIONAL rubric mirroring the singles one. Judged
// on latent truth for all four players; documented in docs/doubles-evaluation.md.
// ---------------------------------------------------------------------------
type DoublesQuad = [SimulatedPlayer, SimulatedPlayer, SimulatedPlayer, SimulatedPlayer];

function doublesRubricLabel([a, b, c, d]: DoublesQuad): boolean {
  const ratingGap = Math.abs((a.trueRating + b.trueRating) / 2 - (c.trueRating + d.trueRating) / 2);
  const shared = sharedAvailability(
    sharedAvailability(a.trueAvailability, b.trueAvailability).windows,
    sharedAvailability(c.trueAvailability, d.trueAvailability).windows,
  );
  const distanceKm = haversineKm(
    computeTeamCentroid(a.profile, b.profile),
    computeTeamCentroid(c.profile, d.profile),
  );
  // Intent mirrors the singles rule: 'both' fits anyone, otherwise nobody may disagree.
  const stated = new Set([a, b, c, d].map((p) => p.profile.intent).filter((i) => i !== 'both'));
  return (
    ratingGap <= RUBRIC.maxRatingGap &&
    shared.totalMinutes >= RUBRIC.minSharedMinutes &&
    distanceKm <= RUBRIC.maxDistanceKm &&
    stated.size <= 1
  );
}

// ---------------------------------------------------------------------------
// Engine scoring for a pair (content path + optional CF condition)
// ---------------------------------------------------------------------------
function pairScore(
  a: SimulatedPlayer,
  b: SimulatedPlayer,
  matrix: InteractionMatrix,
): { gatePassed: boolean; score: number } {
  const gate = evaluateGate(a.profile, b.profile, DEFAULT_CONFIG);
  if (!gate.passed) return { gatePassed: false, score: 0 };
  // Exactly the engine's scoring path — the evaluation measures production code.
  return { gatePassed: true, score: scorePair(a.profile, b.profile, matrix, DEFAULT_CONFIG).score };
}

interface Metrics {
  tau: number;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  precision: number;
  recall: number;
  f1: number;
}

function computeMetrics(
  pairs: Array<{ label: boolean; gatePassed: boolean; score: number }>,
  tau: number,
): Metrics {
  let tp = 0,
    fp = 0,
    fn = 0,
    tn = 0;
  for (const p of pairs) {
    const predicted = p.gatePassed && p.score >= tau;
    if (predicted && p.label) tp++;
    else if (predicted && !p.label) fp++;
    else if (!predicted && p.label) fn++;
    else tn++;
  }
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 =
    precision + recall === 0
      ? 0
      : (2 * precision * recall) / (precision + recall);
  return { tau, tp, fp, fn, tn, precision, recall, f1 };
}

// ---------------------------------------------------------------------------
// Main experiment
// ---------------------------------------------------------------------------
function windowLabel(w: AvailabilityWindow): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hhmm = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return `${days[w.day]} ${hhmm(w.startMin)}–${hhmm(w.endMin)}`;
}

function main(): void {
  const labelsArg = process.argv.indexOf('--labels');
  const expertLabelsPath = labelsArg > -1 ? process.argv[labelsArg + 1] : null;

  const players = Array.from({ length: POPULATION }, (_, i) => simulatePlayer(i + 1));

  // --- Build the 50-pair evaluation set: stratified so both classes appear ---
  const allPairs: Array<[SimulatedPlayer, SimulatedPlayer]> = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      allPairs.push([players[i], players[j]]);
    }
  }
  // Shuffle deterministically, then take a stratified sample.
  for (let i = allPairs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [allPairs[i], allPairs[j]] = [allPairs[j], allPairs[i]];
  }
  const positives = allPairs.filter(([a, b]) => rubricLabel(a, b));
  const negatives = allPairs.filter(([a, b]) => !rubricLabel(a, b));
  const nPos = Math.min(22, positives.length);
  const evalPairs = [
    ...positives.slice(0, nPos),
    ...negatives.slice(0, PAIR_COUNT - nPos),
  ];

  // --- Optional: replace rubric labels with the expert panel's majority vote ---
  let expertLabels: Map<string, boolean> | null = null;
  if (expertLabelsPath) {
    expertLabels = new Map();
    const rows = fs.readFileSync(expertLabelsPath, 'utf8').trim().split('\n').slice(1);
    for (const row of rows) {
      const cols = row.split(',');
      expertLabels.set(cols[0], cols[cols.length - 1].trim().toUpperCase().startsWith('Y'));
    }
  }

  // --- Condition A: cold start (launch conditions — content-based only) ------
  const emptyMatrix = new InteractionMatrix();

  // --- Condition B: post-adoption (~3 months of operation). Truly-compatible
  // players tend to have co-played repeatedly (p=0.6, 2–5 sessions); OpenPlay
  // sessions also mix some incompatible pairs (p=0.08, 1–2 sessions), so the
  // engagement matrix carries realistic noise rather than mirroring the labels. --
  const records: EngagementRecord[] = [];
  let sessionSeq = 0;
  for (const [a, b] of allPairs) {
    const compatible = rubricLabel(a, b);
    const coPlays = compatible
      ? chance(0.6)
        ? 2 + Math.floor(rand() * 4)
        : 0
      : chance(0.08)
        ? 1 + Math.floor(rand() * 2)
        : 0;
    for (let s = 0; s < coPlays; s++) {
      const itemId = `co-${sessionSeq++}`;
      records.push({ playerId: a.profile.id, itemId });
      records.push({ playerId: b.profile.id, itemId });
    }
  }
  const adoptedMatrix = new InteractionMatrix(records);

  const conditions = [
    { name: 'cold_start', matrix: emptyMatrix },
    { name: 'post_adoption', matrix: adoptedMatrix },
  ] as const;

  fs.mkdirSync(outDir, { recursive: true });


  const summary: Record<string, unknown> = {
    seed: SEED,
    population: POPULATION,
    pairs: PAIR_COUNT,
    rubric: RUBRIC,
    labelSource: expertLabelsPath ? 'expert-panel' : 'provisional-rubric',
    generatedAt: new Date().toISOString(),
  };

  const mdLines: string[] = [
    '# Pickle C-LB — Hybrid Filtering Engine Evaluation',
    '',
    `Seed ${SEED} · population ${POPULATION} · ${PAIR_COUNT} labeled pairs · label source: ${
      expertLabelsPath ? 'EXPERT PANEL' : 'provisional USAPA rubric (pending expert validation)'
    }`,
    '',
  ];

  for (const cond of conditions) {
    const scored = evalPairs.map(([a, b], idx) => {
      const pairId = `pair-${String(idx + 1).padStart(2, '0')}`;
      const s = pairScore(a, b, cond.matrix);
      const label = expertLabels?.has(pairId)
        ? expertLabels.get(pairId)!
        : rubricLabel(a, b);
      return { pairId, a, b, label, ...s };
    });

    const metrics = TAUS.map((tau) => computeMetrics(scored, tau));
    const best = metrics.reduce((m, x) => (x.f1 > m.f1 ? x : m));
    (summary as Record<string, unknown>)[cond.name] = { metrics, bestTau: best.tau, bestF1: best.f1 };

    // CSV
    const csv = [
      'tau,tp,fp,fn,tn,precision,recall,f1',
      ...metrics.map(
        (m) =>
          `${m.tau},${m.tp},${m.fp},${m.fn},${m.tn},${m.precision.toFixed(4)},${m.recall.toFixed(4)},${m.f1.toFixed(4)}`,
      ),
    ].join('\n');
    fs.writeFileSync(path.join(outDir, `metrics-${cond.name}.csv`), csv);

    // Markdown table for the manuscript
    mdLines.push(
      `## Condition: ${cond.name.replace('_', ' ')}`,
      '',
      '| τ | TP | FP | FN | TN | Precision | Recall | F1 |',
      '|---|----|----|----|----|-----------|--------|-----|',
      ...metrics.map(
        (m) =>
          `| ${m.tau.toFixed(2)} | ${m.tp} | ${m.fp} | ${m.fn} | ${m.tn} | ${m.precision.toFixed(3)} | ${m.recall.toFixed(3)} | ${m.f1.toFixed(3)}${m.tau === best.tau ? ' ★' : ''} |`,
      ),
      '',
      `Optimal τ* = ${best.tau.toFixed(2)} (F1 = ${best.f1.toFixed(3)})`,
      '',
    );
  }

  // --- Expert labeling sheet (observed data only — no latent truth leaked) ---
  const sheet = [
    'pair_id,player_a,a_tier,a_self_rating,a_area,a_availability,player_b,b_tier,b_self_rating,b_area,b_availability,distance_km,shared_windows,expert_compatible_YN',
    ...evalPairs.map(([a, b], idx) => {
      const shared = sharedAvailability(a.profile.availability, b.profile.availability);
      const cells = [
        `pair-${String(idx + 1).padStart(2, '0')}`,
        a.profile.displayName,
        a.profile.tier,
        a.profile.rating?.toFixed(1) ?? 'n/a',
        a.area,
        a.profile.availability.map(windowLabel).join(' / '),
        b.profile.displayName,
        b.profile.tier,
        b.profile.rating?.toFixed(1) ?? 'n/a',
        b.area,
        b.profile.availability.map(windowLabel).join(' / '),
        haversineKm(a.profile.location, b.profile.location).toFixed(2),
        shared.windows.map(windowLabel).join(' / ') || 'none',
        '',
      ];
      return cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');
    }),
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'expert-labeling-sheet.csv'), sheet);

  // --- Ranking experiment: CF's contribution appears in ordering quality ------
  // For every seeker, rank all gate-passing candidates by hybrid score and
  // compare against rubric labels: Precision@3 and Mean Average Precision.
  const byId = new Map(players.map((p) => [p.profile.id, p]));
  function rankingMetrics(matrix: InteractionMatrix): { pAt3: number; map: number; seekers: number } {
    let sumP3 = 0;
    let sumAP = 0;
    let counted = 0;
    for (const seeker of players) {
      const candidates = players
        .filter(
          (c) =>
            c.profile.id !== seeker.profile.id &&
            evaluateGate(seeker.profile, c.profile, DEFAULT_CONFIG).passed,
        )
        .map((c) => ({
          sim: c,
          score: scorePair(seeker.profile, c.profile, matrix, DEFAULT_CONFIG).score,
          label: rubricLabel(seeker, c),
        }))
        .sort(
          (x, y) =>
            y.score - x.score || x.sim.profile.id.localeCompare(y.sim.profile.id),
        );
      const relevant = candidates.filter((c) => c.label).length;
      if (relevant === 0 || candidates.length < 3) continue;
      counted++;
      sumP3 += candidates.slice(0, 3).filter((c) => c.label).length / 3;
      let hits = 0;
      let ap = 0;
      candidates.forEach((c, i) => {
        if (c.label) {
          hits++;
          ap += hits / (i + 1);
        }
      });
      sumAP += ap / relevant;
    }
    return { pAt3: sumP3 / counted, map: sumAP / counted, seekers: counted };
  }

  const rankCold = rankingMetrics(emptyMatrix);
  const rankAdopted = rankingMetrics(adoptedMatrix);
  summary.ranking = { cold_start: rankCold, post_adoption: rankAdopted };
  mdLines.push(
    '## Ranking quality (all gate-passing candidates per seeker)',
    '',
    '| Condition | Seekers | Precision@3 | MAP |',
    '|-----------|---------|-------------|-----|',
    `| Cold start | ${rankCold.seekers} | ${rankCold.pAt3.toFixed(3)} | ${rankCold.map.toFixed(3)} |`,
    `| Post-adoption | ${rankAdopted.seekers} | ${rankAdopted.pAt3.toFixed(3)} | ${rankAdopted.map.toFixed(3)} |`,
    '',
  );

  // --- Doubles condition (PROVISIONAL rubric) ----------------------------------
  // 50 team-vs-team pairs drawn from the same population: seeker team = two
  // random players, candidate team = two others. Same stratification as singles
  // (up to 22 positives, the rest negatives). Scored by the doubles engine path.
  const quads: DoublesQuad[] = [];
  const seenQuads = new Set<string>();
  const DOUBLES_DRAW_CAP = 20000;
  const wantPos = 22;
  let pos = 0;
  let neg = 0;
  for (let draw = 0; draw < DOUBLES_DRAW_CAP && (pos < wantPos || neg < PAIR_COUNT - wantPos); draw++) {
    const ids = new Set<number>();
    while (ids.size < 4) ids.add(Math.floor(randDoubles() * players.length));
    const quad = [...ids].map((i) => players[i]) as DoublesQuad;
    const key = [...ids].join('-');
    if (seenQuads.has(key)) continue;
    seenQuads.add(key);
    if (doublesRubricLabel(quad)) {
      if (pos < wantPos) (quads.push(quad), pos++);
    } else if (neg < PAIR_COUNT - wantPos) (quads.push(quad), neg++);
  }

  const doublesSummary: Record<string, unknown> = {
    provisional: true,
    labelSource: 'provisional-rubric',
    rubric: { ...RUBRIC, teamRating: 'mean of the two partners', sharedTime: 'all four players', distance: 'team centroids' },
    pairs: quads.length,
    positives: pos,
    negatives: neg,
  };
  mdLines.push(
    '## Doubles (PROVISIONAL — rubric mirrors singles; not reviewed by the expert panel)',
    '',
    `${quads.length} team-vs-team pairs (${pos} positive, ${neg} negative) · seed ${SEED} ^ 0xd0b1e5 · see docs/doubles-evaluation.md`,
    '',
  );
  for (const cond of conditions) {
    const scored = quads.map((quad) => {
      const [a, b, c, d] = quad;
      const seekerTeam = { id: 'seeker', player1: a.profile, player2: b.profile };
      const candidateTeam = { id: 'candidate', player1: c.profile, player2: d.profile };
      const gate = evaluateDoublesGate(seekerTeam, candidateTeam, DEFAULT_CONFIG);
      const score = gate.passed ? scoreDoublesPair(seekerTeam, candidateTeam, cond.matrix, DEFAULT_CONFIG).score : 0;
      return { label: doublesRubricLabel(quad), gatePassed: gate.passed, score };
    });
    const metrics = TAUS.map((tau) => computeMetrics(scored, tau));
    const best = metrics.reduce((m, x) => (x.f1 > m.f1 ? x : m));
    doublesSummary[cond.name] = { metrics, bestTau: best.tau, bestF1: best.f1 };
    mdLines.push(
      `### Doubles condition: ${cond.name.replace('_', ' ')}`,
      '',
      '| τ | TP | FP | FN | TN | Precision | Recall | F1 |',
      '|---|----|----|----|----|-----------|--------|-----|',
      ...metrics.map(
        (m) =>
          `| ${m.tau.toFixed(2)} | ${m.tp} | ${m.fp} | ${m.fn} | ${m.tn} | ${m.precision.toFixed(3)} | ${m.recall.toFixed(3)} | ${m.f1.toFixed(3)}${m.tau === best.tau ? ' ★' : ''} |`,
      ),
      '',
      `Best τ on this provisional doubles set = ${best.tau.toFixed(2)} (F1 = ${best.f1.toFixed(3)}). The production τ stays ${CALIBRATED_TAU.toFixed(2)} (singles calibration).`,
      '',
    );
  }
  summary.doubles = doublesSummary;

  fs.writeFileSync(path.join(outDir, 'evaluation-summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(outDir, 'metrics.md'), mdLines.join('\n'));

  console.log(mdLines.join('\n'));
  console.log(`Artifacts written to ${outDir}`);
}

main();
