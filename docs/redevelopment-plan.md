# Redevelopment Plan — close the gap between the paper and the system

_2026-10-04. Based on `docs/codebase/*` (same date). Status: decisions recorded; Phases 1–3 implemented and verified locally (see "Build status"); uncommitted. Phases 4–5 and step 2.4 not started._

## Verdict

No rebuild. The engine, the evaluation harness, the UI and demo mode are sound (259 tests pass, both typechecks clean). What does not work is the **production path**: Firestore mode has never been run, and reading the code shows it would fail or contradict the paper in eight places. The fix is roughly a dozen small, targeted changes plus a freeze on everything else.

Rule for this plan: touch the engine's scoring (`content.ts`, `scorePair`) **never**. Every item below leaves Chapter 4's numbers intact; item 2.3 proves it by diffing the harness output.

## Which paper

The uploaded PDF is the May 2026 Chapters 1–3 draft. `HANDOFF.md` marks it superseded by `PickleCLB_Thesis_Ch1-5_v3.docx` (2026-07-11). This plan treats **v3 as the concept** and lists the old PDF's claims only where they differ. Confirm (question 1).

A second upload, `Thesis-Paper-chap123.pdf`, was compared word-for-word with the first (`…_rev.pdf`): same 51 pages and identical text; the only difference is that the `_rev` copy contains the Figure 1-1 IPO chart image and the other has the caption with no figure. It changes nothing below.

## Drift: paper vs. system

| # | Paper promises (v3 unless noted) | System today | Verdict |
|---|---|---|---|
| D1 | Matchmaking runs server-side; other players' coordinates never leave the server | Client downloads all user docs (location, email, phone) and scores locally; `/matchmake` is never called | **Broken claim** |
| D2 | Step 7 feedback loop: attendance and match outcomes feed the co-engagement matrix | Nothing writes `engagements`; production CF weight is always 0; demo uses static seed | **Core feature missing** |
| D3 | FR6 proximity push for new eligible sessions | Push token fetched then discarded; trigger finds no tokens | **Non-functional** |
| D4 | FR4 hourly booking **with conflict prevention** | No server-side uniqueness; whole venue blocked by one booking; no cancel / my-bookings | **Underdeveloped** |
| D5 | Community court registration with admin verification | Admin verify UI exists; no way to submit a court | **Half built** |
| D6 | Registration identity + profile persistence | Anonymous auth; password collected and dropped; no sign-in; first-session id ≠ `auth.uid` | **Broken in production** |
| D7 | OpenPlay hosting, join/leave, match summaries, chat proposals (FR5, FR7) | Work in demo; several writes conflict with `firestore.rules` | **Expected to fail in production** (static finding) |
| D8 | Real-time court/session index | Loaded once per screen mount; chat polls | **Weak** |
| D9 | Android 8+ and iOS 16+ builds, evaluated by IT experts on both | Verified only as a web export; web is out of the paper's scope | **Unverified** |
| D10 | Old PDF only: device GPS via geolocation module | Nine preset area centroids; `expo-location` unused. v3 says "coarse home-area coordinates" | Matches v3, drifts from old PDF |
| D11 | Old PDF only: Novice/Beginner/Advanced, ≥ 3.50, ISO 25010:2011, τ on the tier gate, pure-CF Stage 2 | Beginner/Intermediate/Advanced, ≥ 2.51, :2023, τ on hybrid score, content + boost-only CF | Already resolved in v3 |
| D12 | Doubles = future work; no chat, leaderboard, match verification, admin console | All shipped | **System ahead of paper** |
| D13 | — | Docs claim a weather radar that is not in source | Docs ahead of system |

## Phase 0 — Stop the drift (half a day, no code)

| Step | Check |
|---|---|
| 0.1 Answer the questions at the bottom | Answers recorded here |
| 0.2 Feature freeze: no new features until Phase 3 is green | — |
| 0.3 Commit or revert the pending `package.json` bump | `git status` clean |
| 0.4 Locate `thesis_v3/` (missing from the `HANDOFF.md` path) | `node build.js` produces the DOCX |
| 0.5 Create a dev Firebase project; add `.env` to `.gitignore` first | App boots in Firestore mode |

Cost flag: Cloud Functions need the Blaze plan (`docs/handover.md` expects ₱0 at this scale). Rules tests need the emulator, which needs a JRE (free, local).

## Phase 1 — Make production mode work (D1, D6, D7)

| Step | Smallest change | Check |
|---|---|---|
| 1.1 One identity | `saveCurrentUser` returns the stored user; `DataProvider.setUser` keeps the returned value. Fixes the `u-local-…` vs `auth.uid` mismatch at the single place all callers pass through | New account → host a session in the same run → write accepted |
| 1.2 Real accounts | Use the password the form already collects: `createUserWithEmailAndPassword` on finish, plus a minimal sign-in screen. Lazier alternative if anonymous-only is wanted: delete the password field | Sign out, sign in on a second browser, same profile |
| 1.3 Server-side matchmaking | Add `matchmake()` to `Repository`. Local: today's on-device call. Firestore: `fetch` `/matchmake` with the ID token. `useMatches` calls `repo.matchmake()` | Network tab shows no other user's coordinates |
| 1.4 Private location | Write `location` to `users/{uid}/private/profile` (rule already exists); public doc keeps `areaLabel`. `/matchmake` reads the private doc | Second account cannot read first account's location |
| 1.5 Rules match writes | Posts: opponent may change verification fields only. Messages: recipient may set `proposal.status`. Chats: one field for both query and rule. Admin: custom claim; role switcher shown in demo mode only | Rules test file: one allow and one deny per write path |
| 1.6 No sample data in production | Delete the `SEED_*` fallbacks in `firestore.ts` | Empty project shows empty states |

Verification for the phase: a two-account script against the emulator walks the full demo path — onboard, match, chat, propose, host session, join, book, log match, opponent confirms.

## Phase 2 — Close the algorithm loop (D2)

| Step | Smallest change | Check |
|---|---|---|
| 2.1 One derivation | Pure function `deriveEngagements(sessions, confirmedMatches)` in `packages/engine` (data shaping only, no scoring). Past sessions → one record per attendee; confirmed, undisputed match posts → one record per player | Jest: 3 cases |
| 2.2 Two callers | `LocalRepository.listEngagements` calls it over stored data instead of returning `SEED_ENGAGEMENTS`; a Firestore trigger writes the same records to `engagements` | Log and confirm a match → CF weight on that pair's card rises |
| 2.3 One τ | Export `CALIBRATED_TAU` from the engine; `hooks.ts` and `functions` import it | `npm run evaluate`, then `git diff thesis-artifacts/` is empty |

## Phase 3 — Finish Court Hub and geospatial (D3, D4, D5, D8)

| Step | Smallest change | Check |
|---|---|---|
| 3.1 Booking conflicts | Document id = `courtId_date_startMin_courtNo`; rule `allow create: if !exists(...)`. The database enforces uniqueness; no transaction code. Slots show `n / courtCount` | Two clients book the same slot: one succeeds |
| 3.2 Cancel + my bookings | Set `status: 'cancelled'` (field exists); list on the profile screen | Cancelled slot is bookable again |
| 3.3 Court submission | `createCourt` on `Repository` + short form (name, barangay, pin). `verified: false` rule and admin tab already exist | Submit → appears unverified → admin verifies |
| 3.4 Push tokens | Save the token `_layout.tsx` already fetches to `pushTokens/{uid}`; chunk the 30-id `in` query | Host a session on phone A → phone B is notified |
| 3.5 Live data | `onSnapshot` for chat, sessions and bookings in the Firestore adapter; drop the `setInterval`s | Booking on device A appears on device B without reload |
| 3.6 Device GPS (required, decision 2) | `expo-location` (installed): "use my location" at onboarding and for "near me" sorting; area list stays as the fallback when permission is denied | Courts re-sort on a real phone |

## Phase 4 — Run it on real phones (D9)

| Step | Check |
|---|---|
| 4.1 Add `expo-location` / `expo-notifications` config plugins; EAS development build for Android (free tier) | APK installs; demo path passes at phone width; map, push and directions work |
| 4.2 iOS build — needs an Apple Developer account ($99/yr) | Same path on an iPhone, or the paper's iOS claim is narrowed |
| 4.3 Deploy rules + functions to the client project; validate the 8 sample courts with the client before seeding | `/healthz` responds; courts confirmed |

## Phase 5 — Sync the paper and evaluate (D12, D13)

| Step | Check |
|---|---|
| 5.1 Update Chapter 3 requirements and Chapter 4 screenshots to what is built; put chat / verification / leaderboard / doubles in scope or label them product extras | `build.js` integrity gate passes |
| 5.2 Expert labels → `npm run evaluate -- --labels …` → regenerate figures → update quoted numbers | `metrics.md` label source no longer "provisional" |
| 5.3 Administer ISO 25010 surveys; fill Tables 4-3 / 4-4 from real responses only | Raw response files archived |
| 5.4 Refresh `HANDOFF.md` and remove the weather-radar claim (or build it) | Docs match code |

## Deliberately skipped

- Rewriting onboarding (1,619 lines): works, leave it.
- Unifying doubles scoring with `scorePair`: label doubles "beta" unless question 4 puts it in the thesis.
- Payments, DUPR sync, CI, lint setup, caching `/matchmake`: not needed for the paper or for 85–120 players.
- Sessions as map markers: court pins already lead to their sessions.

## Decisions (Kiel, 2026-10-04)

| # | Question | Decision | Consequence for the plan |
|---|---|---|---|
| 1 | Reference manuscript | Not answered — v3 assumed, except where a decision below follows the uploaded PDF | — |
| 2 | Location | **Device GPS** | Step 3.6 is required, not optional; onboarding offers "use my location" with the area list as fallback |
| 3 | Accounts | **Real email/password** | Step 1.2 uses Firebase Authentication (email/password) with the profile in Firestore. Assumption: "via database" means this — passwords are never written to Firestore |
| 4 | Doubles | **Doubles is the default mode** | Matches tab opens on doubles; doubles becomes a thesis claim → new step 2.4 |
| 5 | Chat, leaderboards, verification, admin | **Kiel adds them to the paper** | Step 5.1 is Kiel's; the code stays |
| 6 | Location of `thesis_v3/` | Not answered | Still blocks rebuilding the DOCX |
| 7 | Weather radar | **Dropped** | Done: `propose_enhancement.md` now records it as removed in v1.9.4 |
| 8 | Apple Developer account | **None yet** | Phase 4 is Android only; the paper's iOS evaluation claim must be narrowed or deferred |
| 9 | Firebase Blaze project + local JRE | **Yes** | JDK installed for the emulator; creating the real project needs Kiel's `firebase login` |
| 10 | Commit the Expo patch bump | **Yes** | Done: commit `0515d45` |

### Added by decision 4 — step 2.4 Doubles under evaluation

Doubles currently has its own content formula (`scoreDoublesPair`), forms opponent teams by pairing adjacent players in a list, and is not measured by `scripts/evaluate.ts`. As the default mode and a thesis claim it needs: (a) real candidate-team formation, (b) a doubles condition in the harness with its own P/R/F1 table, (c) manuscript text in Chapters 3–4. Singles numbers are unaffected. Check: `thesis-artifacts/metrics.md` gains a doubles section produced by the harness, never by hand.

## Still open

- Question 1 (reference manuscript) and question 6 (`thesis_v3/` location).
- Decision 3 wording: confirm Firebase Authentication is what "via database" meant.
- Decision 8: how the paper should word the iOS claim without an iOS build.

## Build status (2026-10-04, end of day)

Verified on the combined working tree: `npx tsc --noEmit`, `npx tsc -p tsconfig.node.json`, `npm --prefix functions run typecheck` and `build` all clean; `npx jest` 26 suites / 265 tests pass; `npm run test:emulator` 17 / 17 pass against the Auth + Firestore emulators with the real rules; `npm run evaluate` reproduces `thesis-artifacts/` byte-for-byte apart from the `generatedAt` timestamp (Chapter 4 numbers unchanged). UI flows checked on web at 375 px in demo mode.

| Step | State | Evidence |
|---|---|---|
| 0.3 Expo bump | Done | commit `0515d45` |
| 0.4 `thesis_v3/` | **Open** | location unknown |
| 0.5 Firebase project | Local emulators only; real project needs `firebase login` | `npm run test:emulator` |
| 1.1 One identity | Done | emulator test: stored id = auth uid; stale id rejected |
| 1.2 Real accounts | Done (Firebase email/password + sign-in screen) | emulator test; native session persistence unverified (no device build) |
| 1.3 Server-side matchmaking | Done | server worker ran `/matchmake` under the functions emulator; client `fetch` path not run end to end from the app |
| 1.4 Private location / contact | Done | emulator test: second user sees no email, phone, preciseLocation |
| 1.5 Rules match writes | Done | 7 rules tests, allow + deny per path |
| 1.6 No sample data in production | Done | emulator test |
| 2.1–2.2 Engagement loop | Done (derived on demand; no `engagements` collection) | engine tests; local adapter test |
| 2.3 One τ | Done | harness output unchanged |
| 2.4 Doubles under evaluation | **Not started** — needs Kiel's ground-truth rubric | — |
| 3.1–3.2 Booking conflicts, cancel, my bookings | Done | emulator test + 375 px check |
| 3.3 Court submission | Done | emulator test + 375 px check |
| 3.4 Push tokens | Token saved; session trigger found its recipient under the emulator | Delivery to a phone unverified |
| 3.5 Live data | Done for sessions, bookings, chat messages | Firestore listeners not exercised from a running app |
| 3.6 Device GPS | Done on web (denied / outside / inside corridor) | Real-device GPS unverified |

Known gaps left open on purpose: an author can mark their own match result confirmed (rule not tightened — touches the optimistic-verification behaviour); rules do not bound `courtNo` by `courtCount`; chat unread counts are not computed in Firestore mode; `onChatMessage` trigger and real push delivery untested; `expo-location` / `expo-notifications` config plugins untested (no native build).

## Build contract (Phases 1–3) — shared by all parallel workers

The TypeScript contract is `src/data/repository.ts` + `src/data/types.ts`. Do not change a signature without reporting it. Data shapes below are what `firestore.rules`, the Firestore adapter and Cloud Functions must agree on.

| Thing | Shape |
|---|---|
| Public profile `users/{uid}` | `AppUser` **without** `email`, `phone`, `preciseLocation`. `location` = coarse home-area centroid (same information as `areaLabel`). `role` is not client-writable: absent or `'player'` on create, unchanged on update |
| Private profile `users/{uid}/private/profile` | `{ email, phone?, preciseLocation? }` — owner-only; Cloud Functions read it with the Admin SDK |
| Roles | Auth custom claims `admin: true` / `caretaker: true`, mirrored into `users/{uid}.role` by `scripts/grant-role.ts` (Admin SDK). Admin: verify courts, resolve disputes. Admin or caretaker: change `maintenanceStatus` only |
| Courts | Any member may create with `verified == false` and `submittedBy == uid` |
| Bookings | Doc id `${courtId}_${dateISO}_${startMin}_${courtNo}`, `courtNo` in `1..courtCount`. Create by owner only; a second create on the same id must be denied (it is an update of someone else's doc). Cancel = delete by owner |
| Posts | Author creates. Opponent (`opponentId == uid`) may change only `confirmed`, `disputed`, `verificationStatus`, `counterScoreLine`, `counterProposedBy`. Anyone signed in may change only `likedBy`. Admin claim may change verification fields and `body` |
| Chats | Id `chat_${sorted uids joined by _}`; `participantIds` (size 2) is the only membership field. A participant may `get` a thread that does not exist yet; `list` uses `where('participantIds','array-contains',uid)` |
| Messages | Sender creates. A participant may change only `readBy`; the non-sender may also change `proposal` |
| Push tokens | `pushTokens/{uid}` = `{ userId, token, updatedAt }` |
| Engagements | No collection. `deriveEngagements(sessions, posts)` from `@engine` builds them on demand (server: from `sessions` + `posts`; demo: from stored data) |
| `GET /matchmake` | Returns an engine `MatchResult` (`seekerId`, `tau`, `recommended`, `scored`). Scoring uses `preciseLocation` when present; every `profile` in the response is the **public** profile |

Ownership while workers run in parallel (one working tree, no commits):

- **Server**: `firestore.rules`, `firestore.indexes.json`, `functions/**`, `scripts/grant-role.ts`, `scripts/__tests__/firestore-rules.emulator.test.ts`, `docs/handover.md`. Only this worker runs the Firebase emulators.
- **Data**: `src/data/**`, non-emulator tests in `scripts/__tests__/`, `scripts/__tests__/firestore-emulator.test.ts`.
- **UI**: `src/app/**`, `src/features/**`, `src/lib/notifications.ts`, `app.json`, `app.config.js`. Only this worker runs the web dev server and the browser.
- Nobody edits engine scoring (`content.ts`, `hybrid.ts`, `collaborative.ts`, `deterministic.ts`, `doubles.ts`) or `scripts/evaluate.ts`.
