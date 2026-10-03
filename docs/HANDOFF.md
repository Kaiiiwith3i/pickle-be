# HANDOFF — Pickle C-LB (read this first)

> **Documentation Hub**: [README](README.md) · [Master Specification](propose_enhancement.md) · [Changelog](CHANGELOG.md) · [Release Notes](TODAYS_CHANGES.md) · [Handoff](HANDOFF.md)

Written 2026-07-11 by Claude (Fable 5) for future model sessions (Opus, Sonnet, or any
agent) picking up this project cold. Everything below is verified fact from the built
system, not aspiration. When this file and the code disagree, trust the code and update
this file.

## 1. What this project is (two things at once)

**Pickle C-LB** is BOTH:

1. **A BSCS thesis** at City College of Calamba — *"Pickle C-LB: Specialized
   Cross-Platform Mobile Application with Hybrid Filtering and Geospatial Event Indexing
   for the Pickleball Community in Calamba and Los Baños, Laguna."*
   Team: Cortez, **Navasero (= Kiel, the user, kielarthur.navasero@gmail.com)**, Ordoñez.
   The panel required revisions of Chapters 1–3 plus new Chapters 4–5. Done — see §6.
2. **A real product for a real client** (a corridor pickleball community). Kiel was
   explicit: *not* a throwaway thesis demo — production quality, polished mobile-first
   UI/UX, deployable. Treat every change as shipping to real users.

These interlock: app screenshots, computed metrics, and (later) pilot-user data feed the
thesis. The thesis's methodology constrains the app's algorithm design.

## 2. Where everything lives

| Path | What it is |
|---|---|
| `~/Documents/Development/pickle-clb/` | **This repo.** Expo app + engine + backend + scripts + docs + thesis artifacts. Own git repo (do NOT commit from `~/Documents` — there's an accidental empty git repo up there that once swallowed a commit; always check `git rev-parse --show-toplevel` = this dir). |
| `~/Documents/Development/School/thesis_v3/` | Manuscript build pipeline (Node + `docx` lib): `helpers.js`, `refs.js`, `ch1.js`–`ch5.js`, `build.js`, `make_figures.js`. NOT a git repo. |
| `~/Documents/Development/School/outputs/PickleCLB_Thesis_Ch1-5_v3.docx` | Built manuscript (also copied to `~/Downloads/`). |
| `~/Downloads/Thesis Paper chap123 rev.pdf` | The OLD manuscript the panel reviewed (51 pp, Ch 1–3). Superseded; keep for diffing panel comments. |
| `thesis-artifacts/` (in this repo) | Computed metrics (CSV/MD/JSON), expert labeling sheet, citation-audit ledger, 18 app screenshots (light+dark), manuscript figure PNGs. |

Repo layout:

```
packages/engine/     Pure-TS Hybrid Filtering Engine + 42-test Jest suite. ZERO runtime deps.
src/app/             Expo Router screens: (tabs)/{index,matches,courts,chat,profile},
                     onboarding, court/[id], session/[id], session/new, chat/[id]
src/theme/           Design tokens (light+dark). ALL colors route through here.
src/components/ui/   Primitives: AppText, Button, Card, Chip, TierBadge, ScoreRing, Avatar,
                     Screen, SectionHeader, EmptyState
src/features/        SessionCard, CourtCard, MatchCard, PostCard, AvailabilityGrid,
                     CapacityBar, BackHeader, CourtMap (+ .web.tsx split)
src/data/            Repository pattern: types, seed, local.ts (AsyncStorage demo adapter with 30-day chat),
                     firestore.ts (prod adapter), provider.tsx (env-switched), hooks.ts
src/lib/             explain.ts (match tags), directions.ts (safe map deep-links), notifications.ts (push)
functions/           Express-on-Cloud-Functions backend (esbuild bundle): /matchmake, proximity & chat push
scripts/             evaluate.ts (thesis metrics) · seed.ts (Firestore seeding) ·
                     screenshot.ts (headless-Chrome capture)
docs/                handover.md (client setup), privacy-policy.md (RA 10173), runbook.md,
                     design-spec.md
firestore.rules / firestore.indexes.json / firebase.json / eas.json / app.config.js
```

## 3. Architecture decisions and WHY (do not casually undo these)

- **One engine, imported three times.** `packages/engine` is imported verbatim by the app
  (`@engine` tsconfig alias), by `functions/src/index.ts` (esbuild bundles it in), and by
  `scripts/evaluate.ts`. This makes the thesis's "Unified Logic Layer / identical outputs"
  claim a *verified artifact*. Never fork or duplicate engine logic — an earlier harness
  copy of the blend formula caused a silent bug; `scorePair()` in `hybrid.ts` is the ONLY
  scoring path.
- **Two-stage pipeline.** Stage 1 deterministic gates: Haversine boundary + distance cap,
  ≥60 shared weekly minutes, tier adjacency |Δtier| ≤ 1, matchmaking opt-in. Stage 2:
  calibrated content-based weighted agreement (skill .35, schedule .30, distance .15,
  intent .12, format .08 — ladders in `content.ts` are tuned so real matches land in the
  thesis's fixed τ range 0.75–0.95) plus **boost-only CF**:
  `S = content + w·cfSim·(1−content)`, w = 0.4·min(1, evidence/20).
  Boost-only is deliberate: absence of shared history is not negative evidence
  (cold-start soundness), and behavioral data can never override skill safety. The paper
  defends this; changing the formula invalidates Chapter 4.
- **Express-on-Cloud-Functions** keeps the manuscript's "Node.js/Express.js RESTful API
  layer" literally true while being serverless. `/matchmake` runs server-side so clients
  never receive other players' coordinates (RA 10173 story; responses carry distances,
  scores, shared windows only).
- **Repository pattern with env switch.** No `EXPO_PUBLIC_FIREBASE_API_KEY` → seeded
  `LocalRepository` (offline demo, AsyncStorage persistence). Key present → `FirestoreRepository`
  (anonymous Firebase auth; profile doc at `users/{uid}`). Screens never know which.
- **Maps are platform-split.** Native: `react-native-maps` (Google/Android, MapKit/iOS).
  Web: `court-map.web.tsx`, a branded SVG corridor map projecting real WGS-84 coords —
  exists because this Mac has no Xcode/Android Studio, and web screenshots must always render.
- **Skill tiers = USA Pickleball bands**: beginner ≈2.0–2.5, intermediate 3.0–3.5,
  advanced 4.0+ (`tiers.ts`, `tierMeta` in theme). The old "Novice" naming is dead.
- **Production τ = 0.90** (`CALIBRATED_TAU` in `src/data/hooks.ts`) — the F1-optimal
  threshold from the evaluation. App and manuscript must keep quoting the same number.
- **Match Result Integrity & Two-Phase Commit.** In `src/lib/stats.ts`, `computePlayerCareerStats`
  strictly enforces `confirmed: true` and `!disputed` before any win or match count is credited
  to personal career stats or corridor leaderboards. Unconfirmed match summaries are strictly
  staged claims. See full specification at `docs/match-result-integrity-spec.md` and council
  decision at `docs/councils/2026-09-12-match-result-integrity.md`.

## 4. The evaluation (how the thesis numbers are made — INTEGRITY RULES)

`npx tsx scripts/evaluate.ts` regenerates everything in `thesis-artifacts/`:

- 60 simulated players, seeded RNG (seed 20260711) → reproducible.
- **Anti-circularity:** each player has LATENT truth (true rating, true schedule) vs
  OBSERVED onboarding data with realistic noise (25% over-rate / 12% under-rate by 0.5;
  25% under-enter a window). Ground truth judges latent; the engine sees only observed.
- 50 stratified pairs (22 compatible / 28 not) labeled by a documented USAPA rubric
  (gap ≤ 0.75, ≥90 true shared minutes, ≤12 km, intent-compatible).
- **Current results** (cold start): τ*=0.90, F1=0.878, P=0.947, R=0.818. Post-adoption:
  identical at fixed τ (bounded CF can't cross cells — honest, explained in Ch 4), but
  ranking improves: P@3 0.825→0.831, MAP 0.776→0.786.
- Expert path: `thesis-artifacts/expert-labeling-sheet.csv` (observed data only) goes to
  5 club experts; then `npx tsx scripts/evaluate.ts --labels <their.csv>` recomputes.

**Hard rules, agreed with Kiel:**
1. **Never fabricate human-subject data.** ISO 25010 result tables (manuscript Tables
   4-3/4-4) are EMPTY by design until real surveys are administered. Do not fill them.
2. Metrics must come from actually running the harness against the real engine. If you
   touch engine scoring, re-run the harness, regenerate figures, rebuild the DOCX, and
   update every quoted number (see §7 chain).
3. Simulation parameters may be tuned for realism, but document changes in Ch 3's
   protocol text — never tune to hit a pretty number.

## 5. Citations (the highest-stakes fix — protect it)

The old manuscript contained **8 fabricated references** and invented statistics
(68%/85%/34%/47%/74%, fake Statcounter/DICT figures). All replaced with verified
literature; the full old→new mapping with claim rewrites is
`thesis-artifacts/citation-audit.md` (show this to the adviser if asked).

- The reference list is DATA: `School/thesis_v3/refs.js` (46 IEEE entries, in first-citation
  order). Chapters cite via `cite(n)`; `build.js` **fails the build** if any entry is
  uncited or any citation is out of range. Keep that gate.
- **Never add a reference you have not verified exists** (search/Crossref first). That's
  how the team got burned.
- Real anchor facts now in the paper: Statcounter PH June 2026 = Android 88.23% / iOS
  11.74%; DICT-PSA NICTHS 2024 = CALABARZON 95.8% smartphone ownership among mobile users
  (93.0% national), 48.8% households with internet; PPF = POC-recognized NSA (May 2024),
  250+ clubs, national registry announced Feb 2026.

## 6. Manuscript pipeline (Chapters 1–5)

`node School/thesis_v3/build.js` → `School/outputs/PickleCLB_Thesis_Ch1-5_v3.docx`.
`node School/thesis_v3/make_figures.js` regenerates `figures/f1-curve.png` (reads the
real `evaluation-summary.json` — never hand-draw data) and `figures/architecture.png`.

Fixed vs the panel-reviewed draft: ≥3.50 vs ≥2.51 contradiction (now 2.51 everywhere,
Objective 5 aligned to Table 3-1); τ redefined as the cutoff on the final hybrid score
(the old draft nonsensically attached it to the discrete tier gate); USAPA bands; unique
figure/table numbering; ISO/IEC 25010:**2023**; RA 10173 ethics section; architecture,
requirements (Table 3-3), and specs (Table 3-4) added; Ch 4 (real metrics + screenshots +
scaffolded ISO tables) and Ch 5 written. Chapter text lives in `ch1.js`–`ch5.js` as
docx-object arrays — edit prose there, then rebuild.

Style: Times New Roman 12, double-spaced, justified, first-line indents, CCC page header
(college/department/course) on every content page, IEEE bracket citations.

## 7. If you change X, regenerate Y (the dependency chain)

```
packages/engine/*  ──►  npx jest  ──►  npx tsx scripts/evaluate.ts
                                        │ (updates thesis-artifacts/*.{csv,md,json})
                                        ├──►  node School/thesis_v3/make_figures.js
                                        └──►  update quoted numbers in ch4.js/ch5.js if
                                              τ*/F1/MAP changed (Table 4-1/4-2 auto-read
                                              the JSON; prose numbers are hand-written)
app screens/theme  ──►  npx expo export --platform web
                   ──►  cp serve.json dist/ && npx serve dist -l 4173 &
                   ──►  npx tsx scripts/screenshot.ts   (18 shots, both themes)
anything           ──►  node School/thesis_v3/build.js  (rebuild DOCX, integrity gate runs)
```

Full verification (all must pass; current state = all green):
```bash
cd ~/Documents/Development/pickle-clb
npx jest                          # 42 tests
npx tsc --noEmit                  # app
npx tsc -p tsconfig.node.json     # engine + scripts
npm --prefix functions run typecheck && npm --prefix functions run build
```

## 8. Environment gotchas (each of these cost real debugging time)

- **Shell cwd persists between Bash calls.** A stray `cd functions` once made
  `npm install --save-dev` run in the wrong package (moved `firebase-admin` to
  devDependencies — it MUST stay in `functions` runtime `dependencies` because esbuild
  marks it `--external`). Prefer `npm --prefix functions …` and absolute `cd` prefixes.
- **This Mac has no Xcode.app, no Android Studio, no Java** → no simulators, no Firestore
  emulator. Verification path is: Jest + typechecks + web export + headless-Chrome
  screenshots (`puppeteer-core` drives installed Google Chrome). Device builds happen via
  EAS once Kiel/client supply credentials.
- **react-native-web crashes on style ARRAYS passed to DOM via `asChild`**
  ("Failed to set an indexed property on CSSStyleDeclaration") — the tabs layout wraps its
  `TabList asChild` View style in `StyleSheet.flatten([...])`. Keep it flattened.
- **Static web export + `serve`**: dynamic routes 404 without rewrites; `serve.json` at
  repo root must be copied into `dist/` after every export (screenshot flow does this).
- **Screenshot seeding**: `scripts/screenshot.ts` injects a demo profile into
  localStorage key `pickleclb.user.v1` before load. The DEMO_USER is deliberately
  imperfect (rating 3.0, competitive, singles, 2 windows) so match scores spread
  (98/97/94…) instead of all-100 — keep it imperfect.
- **Expo SDK 57 quirks**: screens live in `src/app/` (not `app/`); `@expo/vector-icons`
  is NOT bundled (explicit dependency); template tabs use `expo-router/ui` headless
  primitives (we style our own bar); React Compiler + typed routes are ON.
- **Three tsconfigs** on purpose: root (app, excludes tests/scripts/functions),
  `tsconfig.node.json` (engine tests + scripts; jest+node types; TS6 — `paths` without
  `baseUrl`), `functions/tsconfig.json` (TS 5.6 — no `ignoreDeprecations`).
- **Jest**: `testMatch: ['**/*.test.ts']` keeps `__tests__/fixtures.ts` from being
  treated as a test suite.
- **sharp** in `School/` needs `npm install --include=optional sharp` after Node upgrades.

## 9. Design system (client-facing quality bar)

Read `docs/design-spec.md` before touching UI. Non-negotiables: all colors from
`src/theme/tokens.ts` (never raw hex in components); every `*Soft` background pairs with
its `on*Soft` foreground (both WCAG-checked per mode); Barlow/Barlow Condensed via
`@expo-google-fonts`; one primary/accent action per screen; tier badges are icon+label+
color (never color-only); Ionicons only; both themes checked via the screenshot run
before calling UI work done.

## 10. What's PENDING (the honest to-do — mostly on Kiel, assist when asked)

1. **Expert-panel labels** → rerun harness with `--labels`, regenerate figures, rebuild
   DOCX, update prose numbers if τ*/F1 moved.
2. **ISO 25010 administration** (5 IT experts + pilot community) → fill Tables 4-3/4-4,
   compute weighted means + Mann–Whitney U (α=.05, procedure fixed in Ch 3), then firm up
   the conditional findings in Ch 5.
3. **Client production setup**: Firebase project + `.env`, deploy rules/functions, Google
   Maps Android key, EAS builds — `docs/handover.md` is the script. Validate/correct the
   8 seeded courts with the client before `scripts/seed.ts` (fees/hours/coords are
   plausible SAMPLES, flagged as such).
4. **Panel comments doc**: if Kiel produces the panel's written revision sheet, diff it
   against §6's fix list and patch any miss.
5. Possible next deliverables Kiel mentioned wanting eventually: defense Q&A pack (model:
   `~/Downloads/PANEL Q.pdf` from their Gemini-PWA defense — categorized questions,
   complete answers, 30-second responses) and a defense PPTX (pipeline pattern:
   `School/built ppt.js` uses pptxgenjs).
6. Word-level visual pass of the DOCX is on Kiel (fonts/tables/page breaks) — text-level
   checks all pass.

## 11. How to work with Kiel

Direct, wants production-grade outcomes, comfortable with autonomy ("auto mode") after a
plan is agreed. School projects often double as client work — ask which mode applies
before scoping small. Never pad results: the integrity rules in §4/§5 exist because this
team once shipped fabricated citations and nearly defended them. Persistent memory notes
live at `~/.claude/projects/-Users-Kai-1/memory/` (`pickle-clb-thesis-and-product`,
`kiel-profile`).
