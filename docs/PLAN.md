# Redevelopment plan — frontend/backend split

_Written 2026-10-04. Identical copy in `pickle-clb-frontend/docs/PLAN.md`; when you change one, change both. Status column is the to-do list: update it as tickets land._

## Goal

Turn the `pickle-c-lb` monolith into two repos that run and are tested on a local machine first:

- **`pickle-clb-backend`** — Express REST API over Firestore (Admin SDK), Firebase Authentication behind the API, the matchmaking engine (server-side only), the evaluation harness, a labelled sample dataset.
- **`pickle-clb-frontend`** — the Expo app. It talks only to the API in `docs/API.md`: no Firebase SDK, no engine, no mock or seed data.

End goals beyond the code: every tab works against the local backend; the algorithm described in the paper is present and testable from inside the system; a new Chapters 1–5 DOCX matches the new architecture.

## Decisions already made by Kiel (do not re-ask)

| Topic | Decision |
|---|---|
| Backend | Express API over Firestore; local = Firebase emulators (Auth + Firestore) |
| Passwords | Firebase Authentication, reached only through `/auth/*` on our API |
| Engine | Server side only. The paper is rewritten to match |
| Frontend data | Zero mock data. Everything comes from the API |
| Sample data | Lives in the backend seed only; `isSample: true`; "Sample" badge in the UI; excluded from leaderboards and stats; one command wipes it |
| Match results | Only the opponent or an admin confirms. The author may only accept a counter-score the opponent proposed |
| Doubles | Default mode. Partner can be picked freely **and** there is an invite/accept flow. Opposing teams = every pair of opted-in players who pass the deterministic gate with each other |
| Doubles evaluation | Provisional rubric mirroring singles, labelled provisional until the expert panel reviews it. Numbers only from running the harness |
| Algorithm testability | Admin "Algorithm Lab" screen + "why this match" for every player |
| Location | Device GPS (private) + coarse home area (public) |
| Broken tabs | Kiel named **Chat** and **Community**. Reproduce and diagnose before rebuilding them |
| Platform | iOS is the main platform; no Apple Developer account. Verify in a browser at 375 px, then Expo Go on Kiel's iPhone |
| Paper | Build a new Chapters 1–5 DOCX. Chapters 4–5 hold real surveys answered by real players and court owners after they test the system — those tables stay empty until then |
| Git | Commit locally for every feature. Never push. No Claude co-author or session lines in commit messages |
| Weather radar | Dropped |

## Tickets

Each ticket is a vertical slice: backend route + API test, frontend module + screen, and an end-to-end check. `BE` / `FE` say which repo the part lives in. A ticket is done only when its acceptance line passes.

| # | Ticket | Repo | Blocked by | Acceptance | Status |
|---|---|---|---|---|---|
| 01 | **API foundation** — Express app, token-verifying middleware, error format, Firestore/Auth admin init that honours emulator env vars, `/healthz`, `/config`, `/geo/resolve`, deny-all `firestore.rules`, shared DTO types, one route file per resource (mounted, returning 501), scripts `emulators`, `dev`, `test:api`, API test helper (register user, call route) | BE | — | `npm run test:api` passes: 401 without token, `/config` returns areas and tier bands, `/geo/resolve` classifies an inside and an outside point | done |
| 02 | **API client foundation** — `fetch` client with token storage (AsyncStorage) and refresh, DTO types mirroring the contract, one `ApiRepository` behind the existing `Repository` interface, provider uses it exclusively | FE | — | App boots against a running backend and shows the sign-in/onboarding screen; unit test covers token refresh on 401 | done |
| 03 | **Accounts and profile** — register, login, refresh, `GET/PUT /me`, `/players`; onboarding, sign-in, profile edit; areas and tier bands from `/config`; GPS through `/geo/resolve` | BE+FE | 01, 02 | Register → onboard → sign out → sign in keeps the profile; a second user's `/players` response has no email, phone or precise location | BE done, FE done (`/geo/resolve` is public now, so onboarding GPS is unblocked) |
| 04 | **Courts and bookings** — list with distance, submit court (rejected outside corridor), admin verify, caretaker status, book / cancel / my bookings | BE+FE | 01, 02 | Two users cannot hold the same court number for one slot; cancel frees it; submitted court shows unverified until an admin verifies | BE done, FE done |
| 05 | **OpenPlay sessions** — list, host, delete, join/leave with capacity; proximity notification sent inline on create | BE+FE | 01, 02 | Join is refused when full; only the host deletes; eligible nearby player's push token is selected | BE done, FE done |
| 06 | **Community feed and match results** (reported broken) — first reproduce what fails in the monolith's Community tab and write it down; then posts, likes, match logging, opponent-only confirm, dispute, counter-score, admin resolve | BE+FE | 01, 02 | Author cannot confirm their own result (403); opponent confirm moves it to approved; leaderboard counts only confirmed, non-sample results | BE done, FE done |
| 07 | **Chat** (reported broken) — first reproduce what fails in the monolith's Chat tab; then threads, messages, match proposals, read/unread counts | BE+FE | 01, 02 | Two signed-in users exchange messages in two browser contexts; unread badge rises and clears; only the recipient can answer a proposal | BE done, FE done |
| 08 | **Singles matchmaking + why this match** — `/matchmake`, `/algorithm/explain/:playerId`; match card detail showing each gate and each score component | BE+FE | 03 | Response contains no private fields; explain totals equal the engine's `scorePair` for the same pair | BE done, FE done |
| 09 | **Doubles** — saved partner (`PUT /me/partner`), real opposing-team formation, `/matchmake/doubles`; Matches tab uses the saved partner | BE+FE | 03 | No partner → clear prompt, not an auto-assigned stranger; opposing teams are real player pairs that pass the gate with each other | BE done, FE done |
| 10 | **Partner invites** — send, list, accept/decline; accepted pair is marked confirmed | BE+FE | 09 | Accepting sets both players' partner and `partnerConfirmed` | BE done, FE done |
| 11 | **Algorithm Lab** — `/algorithm/lab/:seekerId`, `/algorithm/evaluation`; admin screen: Stage 1 pass/fail per rule, Stage 2 content and collaborative scores, threshold sweep with precision/recall/F1 | BE+FE | 08 | Non-admin gets 403; the sweep table equals `thesis-artifacts/evaluation-summary.json` | BE done, FE done |
| 12 | **Doubles evaluation** — doubles condition in the harness with the provisional rubric; documented in `docs/` for Chapter 3 | BE | 09 | `npm run evaluate` writes a doubles section; singles numbers unchanged (τ* 0.90, F1 0.878) | done |
| 13 | **Sample dataset** — `seed:sample` and `seed:wipe-sample`; dates relative to seed time; "Sample" badge; excluded from leaderboards and stats | BE+FE | 03–06 | After seeding, every sample item shows the badge; wipe removes exactly the sample records | BE done |
| 14 | **Contract step** — delete from the frontend: `packages/engine`, `src/data/local.ts`, `firestore.ts`, `seed.ts`, fixtures, the `firebase` dependency, `isDemo` and demo-only UI, stale scripts and tests | FE | 03–11 | `grep -r "@engine\|firebase\|SEED_" src` is empty; typecheck and tests pass | todo |
| 15 | **Full-stack end-to-end** — one scripted run walks every tab and core flow at 375 px in light and dark against the local stack | FE | 13, 14 | The script passes from a clean database with zero console errors and no horizontal scroll | todo |
| 16 | **Packaging and run docs** — Cloud Functions wrapper and build, README in both repos, exact steps for Expo Go on Kiel's iPhone over Wi-Fi | BE+FE | 01 | A fresh clone reaches a running local stack by following the README only | BE done |
| 17 | **Paper** — new Chapters 1–5 DOCX: server-side engine, doubles, chat, verification, leaderboards, admin, Algorithm Lab; harness-produced metrics only; survey tables empty | BE (`thesis/`) | 12, 15 | DOCX builds; every reference verified; no invented result anywhere | todo |
| 18 | **Refresh handoff** — update `HANDOFF.md` and this plan in both repos | BE+FE | 17 | A fresh session can continue from the docs alone | todo |

### Order of work

1. **Wave 1 (parallel):** 01 in the backend, 02 in the frontend.
2. **Wave 2 (parallel, after wave 1):** backend parts of 03–09 and 11–12 split across workers by route file; frontend parts of 03–09 and 11 split by screen. Frontend workers code against `docs/API.md` and integrate as the routes land.
3. **Wave 3:** 10, 13, then 14, then 15 and 16.
4. **Wave 4:** 17, 18.

## Running parallel workers (what worked on 2026-10-03)

- Write the contract first, then give each worker a **disjoint file list**. Backend: one route file + its test per worker. Frontend: one `src/api/<resource>.ts` + its screens per worker.
- One owner per shared resource. The orchestrator starts the emulators and the API dev server once; workers' API tests connect to the running emulators and start the app in-process on a random port. Unique emails/ids per test file.
- The Playwright MCP browser is a single shared instance — parallel workers must use scripted Playwright (`playwright` is a dev dependency) with their own headless browser and their own web port.
- Commit only your own paths: `git add <paths> && git commit -m "…" -- <paths>`. Retry if `index.lock` exists.
- Sonnet workers, "ponytail" rules in every prompt: smallest diff, reuse what exists, no new dependencies, one runnable check per piece of logic, never simplify away validation, authorization or data-loss handling.
- Matt Pocock skills are installed globally (`tdd`, `diagnosing-bugs`, `to-tickets`, `implement`, `codebase-design`, `domain-modeling`, `research`, `handoff`, …). Use `tdd` for each ticket and `diagnosing-bugs` for tickets 06 and 07.

## Where the reference implementation is

The archive `../pickle-c-lb` (branch `feature/doubles-and-platform-enhancements`, commit `44de87c`) is read-only. Port from it; do not edit it.

| Need | Look at |
|---|---|
| Every write shape and query | `src/data/firestore.ts`, `src/data/repository.ts`, `src/data/types.ts` |
| Authorization semantics to re-express as API checks | `firestore.rules`, `scripts/__tests__/firestore-rules.emulator.test.ts` |
| Matchmaking endpoint, push fan-out | `functions/src/index.ts` |
| Match verification state machine | `src/lib/match-verification.ts`, `src/lib/dispute-audit.ts`, `docs/match-result-integrity-spec.md` |
| Sample records to move into the backend seed | `src/data/seed.ts`, `src/data/fixtures/courts.json` |
| Yesterday's analysis | `docs/redevelopment-plan.md` (pre-split; its "Build status" lists what was verified) |
