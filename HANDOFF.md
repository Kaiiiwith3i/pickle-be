# HANDOFF — pickle-clb-backend (read this first)

Written 2026-10-04 at the moment the monolith was split. Everything here was checked against the repo on that date. When this file and the code disagree, trust the code and fix this file.

## What this is

The backend half of **Pickle C-LB**, which is two things at once:

1. A **BSCS thesis** at City College of Calamba — *Pickle C-LB: Specialized Cross-Platform Mobile Application with Hybrid Filtering and Geospatial Event Indexing for the Pickleball Community in Calamba and Los Baños, Laguna* (Cortez, **Navasero = Kiel, the user**, Ordoñez).
2. A **real product for a real client community**. Production quality is required; it is not a demo.

This repo will hold the Express REST API, the matchmaking engine, the evaluation harness that produces the thesis numbers, and the sample dataset. Its sibling `../pickle-clb-frontend` is the Expo app and talks only to this API. `../pickle-c-lb` is the old monolith, kept as a read-only archive and reference implementation.

**State today:** scaffold only. The engine, its tests, the harness and docs are here. The API does not exist yet — `docs/PLAN.md` ticket 01 creates it. `docs/API.md` is the agreed contract.

## Stack & layout

Node ≥ 20 (machine has v26), TypeScript ~6.0.3, Express ^4.21, firebase-admin ^14, firebase-functions ^7.4, Jest 30 + ts-jest.

| Path | What it is |
|---|---|
| `src/engine/` | Hybrid Filtering Engine, pure TypeScript, zero runtime dependencies. The only copy anywhere |
| `tests/engine/` | Engine Jest suites (10 suites, 77 tests) |
| `scripts/evaluate.ts` | Thesis evaluation harness → writes `thesis-artifacts/` |
| `scripts/grant-role.ts` | Sets `admin` / `caretaker` custom claims (Admin SDK) |
| `thesis-artifacts/` | Harness output, expert labeling sheet, ISO 25010 questionnaires, citation audit |
| `docs/API.md` | The API contract shared with the frontend |
| `docs/PLAN.md` | Decisions, the 18 tickets and their order — **the to-do list** |
| `docs/HANDOFF-monolith-2026-07.md` | The monolith's old handoff: thesis background, citation history. Paths in it are stale |
| `docs/redevelopment-plan.md` | Pre-split analysis and what was verified on 2026-10-03 |
| `firebase.json`, `firestore.indexes.json` | Emulator ports (Auth 9099, Firestore 8080) and indexes |

## Invariants (hard rules)

- **Never fabricate data.** No invented survey results, metrics, citations or test output. ISO 25010 result tables stay empty until real players and court owners answer the surveys. Sample records are always labelled (`isSample: true`).
- **Thesis numbers come only from running the harness.** Current: τ* = 0.90, F1 = 0.878, P = 0.947, R = 0.818 (cold start). If you touch `src/engine/content.ts`, `hybrid.ts`, `collaborative.ts` or `deterministic.ts`, rerun `npm run evaluate` and every quoted number must be updated. Do not tune to get a nicer number.
- **One engine.** `scorePair()` in `src/engine/hybrid.ts` is the only singles scoring path. No second implementation, no copy in the frontend.
- **Boost-only collaborative filtering**: `S = content + w·cf·(1 − content)`. Do not change the formula without asking.
- **Privacy (RA 10173):** email, phone and the device GPS fix never appear in a response about another player.
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

Continue the redevelopment: open `docs/PLAN.md`, take the first ticket whose blockers are done (ticket 01 now), build it test-first, commit.

Emulators (needed from ticket 01 on; no Firebase login required with a `demo-` project id):

```bash
PATH=/opt/homebrew/opt/openjdk/bin:$PATH npx -y firebase-tools --non-interactive \
  emulators:start --only auth,firestore --project demo-pickleclb
```

## Definition of done

`npm run typecheck` clean, `npm test` green, the ticket's API test green against the emulators, the ticket's acceptance line in `docs/PLAN.md` demonstrated, the status column updated, one local commit. If a step was skipped, say which and why.

## Environment gotchas

- **Java** is keg-only at `/opt/homebrew/opt/openjdk/bin` — add it to `PATH` for the emulators.
- macOS has **no `timeout` command**.
- Jest suites that touch Firebase need **`--forceExit`**, otherwise the run hangs with no output.
- `firebase-functions` must stay **^7** — v6 rejects `firebase-admin` 14.
- `npm install` reported esbuild's postinstall as pending approval (`npm approve-scripts esbuild`); the bundle build is **unverified** in this repo.
- `scripts/seed.ts` was not carried over (it imported frontend seed data); ticket 13 rebuilds it here.
- Do not run git from `~/Documents` — there is an unrelated git repo up there. Check `git rev-parse --show-toplevel`.
- No Xcode, no Android Studio. The manuscript build pipeline (`thesis_v3/`) is missing; the current manuscript is `~/Downloads/PickleCLB_Thesis_Ch1-5_v3.docx`.
- Kiel's own Expo dev server may be on port 8081; pick other ports.
