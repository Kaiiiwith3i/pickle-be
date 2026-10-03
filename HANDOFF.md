# HANDOFF — pickle-clb-backend (read this first)

Written 2026-10-04 at the split, refreshed the same day after the backend tickets landed. Checked against the repo on that date. When this file and the code disagree, trust the code and fix this file.

## What this is

The backend half of **Pickle C-LB**, which is two things at once:

1. A **BSCS thesis** at City College of Calamba — *Pickle C-LB: Specialized Cross-Platform Mobile Application with Hybrid Filtering and Geospatial Event Indexing for the Pickleball Community in Calamba and Los Baños, Laguna* (Cortez, **Navasero = Kiel, the user**, Ordoñez).
2. A **real product for a real client community**. Production quality is required; it is not a demo.

This repo holds the Express REST API, the matchmaking engine, the evaluation harness that produces the thesis numbers, and the sample dataset. Its sibling `../pickle-clb-frontend` is the Expo app and talks only to this API. `../pickle-c-lb` is the old monolith, kept as a read-only archive and reference implementation.

**State today:** the API exists and runs against the Firebase emulators. Backend parts of tickets 01, 03–11, 13 and 16 are done; ticket 12 (backend only) is done. Remaining: 14, 15, 17, 18 and the frontend halves (the Status column in `docs/PLAN.md` is the truth). `docs/API.md` is the contract.

Verified 2026-10-04: `npm run typecheck` clean; `npm test` 12 suites / 97 tests; `npm run test:api` 14 suites / 135 tests (twice on a fresh empty emulator, once from a fresh clone); `npm run evaluate` reproduces the numbers below; `npm run build` produces `dist/functions.js` and it loads. **Not verified:** any real Firebase deployment, real Expo push delivery, `npm run emulators` from a fresh clone (ports were busy; it ran in the main checkout).

## Stack & layout

Node ≥ 20 (machine has v26), TypeScript ~6.0.3, Express ^4.21, firebase-admin ^14, firebase-functions ^7.4, Jest 30 + ts-jest.

| Path | What it is |
|---|---|
| `src/engine/` | Hybrid Filtering Engine, pure TypeScript, zero runtime dependencies. The only copy anywhere |
| `src/app.ts` | `createApp()`. Route files declare full paths; `/auth/*` and `/geo/resolve` are mounted before the token check |
| `src/server.ts`, `src/functions.ts` | Local server (port 4000) / Cloud Functions wrapper (`npm run build` bundles it to `dist/functions.js`) |
| `src/http.ts` | `ApiError`, `handle`, `requireAuth`, `requireRole`, `docId`, `isDateISO`, `text`/`int` validators, `errorHandler` |
| `src/routes/*.ts` | auth, me, geo, partner, courts, bookings, sessions, posts, chats, matchmake, algorithm |
| `src/firebase.ts`, `src/config.ts`, `src/types.ts` | Admin SDK init, env config, DTOs |
| `src/data.ts`, `src/matching.ts` | Firestore loaders (`loadPublicPlayers`, `withPrecise`, `loadEngagements`); scoring loader over the engine |
| `src/push.ts`, `src/match-verification.ts` | Expo push; match-result state machine |
| `src/seed/`, `scripts/seed.ts` | Labelled sample dataset (`isSample: true`) and its seed/wipe script |
| `tests/engine/`, `tests/lib/` | Unit suites (12 suites, 97 tests), no emulators |
| `tests/api/*.api.test.ts`, `tests/api/helper.ts` | API suites (14 suites, 135 tests), need the emulators |
| `scripts/evaluate.ts` | Thesis evaluation harness → writes `thesis-artifacts/` |
| `scripts/grant-role.ts` | Sets `admin` / `caretaker` / `player` custom claims (Admin SDK) |
| `README.md` | Local run steps |
| `firestore.rules` | Deny-all: only the API (Admin SDK) touches Firestore |
| `thesis-artifacts/` | Harness output, expert labeling sheet, ISO 25010 questionnaires, citation audit |
| `docs/API.md` | The API contract shared with the frontend |
| `docs/PLAN.md` | Decisions, the 18 tickets and their order — **the to-do list** |
| `docs/HANDOFF-monolith-2026-07.md` | The monolith's old handoff: thesis background, citation history. Paths in it are stale |
| `docs/redevelopment-plan.md` | Pre-split analysis and what was verified on 2026-10-03 |
| `docs/broken-tabs-diagnosis.md` | Static code-reading diagnosis of the monolith's Chat and Community tabs (not reproduced in a browser) |
| `docs/doubles-evaluation.md` | Provisional doubles evaluation write-up |
| `firebase.json`, `firestore.indexes.json` | Emulator ports (Auth 9099, Firestore 8080, UI 4001), Functions config, indexes |

`docs/handover.md` and `docs/runbook.md` are monolith-era (demo mode, Firebase client SDK) and stale for this repo; `docs/match-result-integrity-spec.md`, `docs/privacy-policy.md` and `docs/councils/` were carried over unchanged.

## Invariants (hard rules)

- **Never fabricate data.** No invented survey results, metrics, citations or test output. ISO 25010 result tables stay empty until real players and court owners answer the surveys. Sample records are always labelled (`isSample: true`).
- **Thesis numbers come only from running the harness.** Current: τ* = 0.90, F1 = 0.878, P = 0.947, R = 0.818 (cold start). If you touch `src/engine/content.ts`, `hybrid.ts`, `collaborative.ts` or `deterministic.ts`, rerun `npm run evaluate` and every quoted number must be updated. Do not tune to get a nicer number.
- **One engine.** `scorePair()` in `src/engine/hybrid.ts` is the only singles scoring path. No second implementation, no copy in the frontend.
- **Boost-only collaborative filtering**: `S = content + w·cf·(1 − content)`. Do not change the formula without asking.
- **Privacy (RA 10173):** email, phone and the device GPS fix never appear in a response about another player. Matchmaking, doubles, explain and the Algorithm Lab apply a GPS fix to the **caller's own entry only**; everyone else is scored on their public home-area `location` (otherwise a caller could trilaterate others from exact distances). `withPrecise` is used only for the session proximity push, whose result never leaves the server.
- **Every id** from a path, query or body goes through `docId()` before `.doc()`.
- **Sessions:** no past `startsAt`; attendance is closed once a session has started (otherwise collaborative history could be forged).
- **Doubles** is provisional: the rubric is not yet reviewed by the expert panel. `GET /matchmake/doubles` returns at most the 50 best-ranked teams (pair formation is still O(n²) per request). Harness output on the provisional set (50 pairs: 22 positive, 28 negative): best τ = 0.75, F1 = 0.821 (P 0.941, R 0.727); at production τ = 0.90, F1 = 0.429 (P 1.000, R 0.273). Production τ stays 0.90; do not tune.
- **Only the opponent or an admin confirms a match result.**
- **Git:** commit locally for every feature; never push; no Claude co-author or session lines in commit messages.
- **`../pickle-c-lb` is read-only.**
- The API contract changes in `docs/API.md` first, and the frontend copy is updated in the same sitting.

## How Kiel works here

- Lead with the outcome. Recommend one option with a reason; do not present menus.
- Plan with a check per step, state assumptions, then execute surgically. Run the thing before calling it done.
- "Ponytail" mode is on: the smallest change that works, reuse before writing, no new dependencies or abstractions without need — but never cut validation, authorization or anything that prevents data loss.
- For multi-step builds he wants Sonnet sub-agents working in parallel under an orchestrator; see "Running parallel workers" in `docs/PLAN.md`.
- All product decisions for this redevelopment are already made and listed in `docs/PLAN.md`. Do not re-ask them.
- Free and local by default (M4 Air, 16 GB). Flag anything paid.

## Common tasks

```bash
npm test                 # engine unit tests
npm run typecheck        # tsc --noEmit
npm run evaluate         # regenerate thesis-artifacts/ (rewrites generatedAt; metrics must not move)
```

Continue the redevelopment: open `docs/PLAN.md`, take the first ticket whose Status is open and whose blockers are done (remaining: 14, 15, 17, 18 and frontend halves), build it test-first, commit.

```bash
npm run emulators        # Auth 9099, Firestore 8080, Emulator UI 4001 (in-memory; restart for a clean DB)
npm run dev              # API on :4000, needs the emulators
npm run test:api         # API suites against the emulators on 8080 / 9099
npm run build            # esbuild -> dist/functions.js
npm run seed:sample      # / npm run seed:wipe-sample
npm run grant-role -- <email> <admin|caretaker|player>
```

Emulators need no Firebase login (`demo-` project id); `npm run emulators` already puts Java on `PATH`.

## Definition of done

`npm run typecheck` clean, `npm test` green, the ticket's API test green against the emulators, the ticket's acceptance line in `docs/PLAN.md` demonstrated, the status column updated, one local commit. If a step was skipped, say which and why.

## Environment gotchas

- **Java** is keg-only at `/opt/homebrew/opt/openjdk/bin` — add it to `PATH` for the emulators.
- macOS has **no `timeout` command**.
- Jest suites that touch Firebase need **`--forceExit`**, otherwise the run hangs with no output (`test:api` has it).
- `test:api` needs `NODE_OPTIONS=--experimental-vm-modules` (already in the script): firebase-admin pulls in an ESM-only dependency (`jose`) Jest cannot `require`. For the same reason anything importing firebase-admin cannot run under plain `npm test`.
- API tests get a 30 s timeout (`jest.config.js`); the helper deletes the users each suite registers. A long-lived emulator still accumulates other test records, so restart `npm run emulators` for a clean DB.
- To run the API suite against a different emulator pair, call jest directly with your own `FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST` (the script hardcodes 8080 / 9099).
- Emulator UI is on **4001** (`firebase.json`); the API owns **4000**.
- Production needs `FIREBASE_WEB_API_KEY` for `/auth/*` (they return a logged 500 without it) and the Blaze plan for Cloud Functions (**paid** — flag before deploying).
- `firebase-functions` must stay **^7** — v6 rejects `firebase-admin` 14.
- `npm install` reported esbuild's postinstall as pending approval (`npm approve-scripts esbuild`); `npm run build` was run and loads (see State).
- Do not run git from `~/Documents` — there is an unrelated git repo up there. Check `git rev-parse --show-toplevel`.
- No Xcode, no Android Studio. The manuscript build pipeline (`thesis_v3/`) is missing; the current manuscript is `~/Downloads/PickleCLB_Thesis_Ch1-5_v3.docx`.
- Kiel's own Expo dev server may be on port 8081; pick other ports.

## Open items for Kiel

1. Doubles threshold: does doubles get its own τ? Decide with the expert panel; do not tune.
2. The `docs/API.md` line about scoring with private GPS was reworded (privacy fix): confirm.
3. Sample courts carry invented caretaker names and placeholder 555 numbers under real-sounding venue names (copied from the monolith fixture, all `isSample: true`). Validate real court data with the client before any real seeding.
4. `seed:wipe-sample` removes exactly the sample records; real users' bookings, chats or saved partner pointing at a sample record are left dangling.
5. Sample sessions and confirmed results feed the collaborative matrix while seeded (excluded only from leaderboards and stats, which the frontend computes).
6. `tierRestriction` is advisory (not enforced on join) and closed or unverified courts can be booked, both as in the monolith (written into `docs/API.md`).
7. Ceilings at a few hundred players: per-request full reads of users, sessions and posts for matchmaking; per-poll unread counts in chat.
