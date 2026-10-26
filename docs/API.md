# Pickle C-LB API contract (v1)

The single agreement between `pickle-clb-backend` and `pickle-clb-frontend`. The frontend talks to nothing else: no Firebase SDK, no direct database access, no matchmaking logic. Change this file first, then the code on both sides.

## Conventions

- Base URL: `http://localhost:4000` locally (`EXPO_PUBLIC_API_URL` in the frontend). JSON in, JSON out.
- Auth: `Authorization: Bearer <idToken>` on every route except `/healthz`, `/config`, `/geo/resolve`, `/auth/*`.
- Errors: HTTP status + `{ "error": { "code": string, "message": string } }`. Codes: `invalid` 400, `unauthenticated` 401, `forbidden` 403, `not_found` 404, `conflict` 409.
- Ids are server-generated unless stated. Times are ISO-8601 strings; `dateISO` is `YYYY-MM-DD`; `*Min` is minutes since midnight.
- Validation: an id (in a path, query or body) that is empty, longer than 128 characters or contains `/`, an impossible date, a malformed or oversized (> 100 kB) JSON body, and any missing or out-of-range field all answer 400 `invalid`. A well-formed id that matches nothing answers 404 `not_found`.
- `isSample: true` marks seeded sample records (players, courts, sessions, posts). The server sets it; clients never send it.
- Roles: `player` (default), `caretaker`, `admin` — from Auth custom claims, mirrored in `AppUser.role`. Clients cannot set a role.

## Types

`src/types.ts` in the backend is the source; the frontend mirrors it in `src/api/types.ts`.

- `PlayerProfile`, `AvailabilityWindow`, `SkillTier`, `MatchCandidate`, `MatchResult`, `GateReport`, `DoublesCandidate`, `DoublesMatchResult` — as defined by the engine.
- `AppUser` = `PlayerProfile` + `areaLabel`, `bio?`, name fields, `username?`, `homeCourtId?`, `joinedAt`, `onboarded`, `role?`, `communityRole?`, `facilityProfile?`, `doublesPartnerId?`, `partnerConfirmed?`, `isSample?`, `deactivated?`, `emailVerified?`, `authProvider?`, and — **only on `/me`** — `email`, `phone?`, `preciseLocation?`.
- `PublicPlayer` = `AppUser` without `email`, `phone`, `preciseLocation`. `location` is the coarse home-area centroid.
- `Court` (+ `openMin?`, `closeMin?`, `advanceBookingDays?`, `landmark?`, `submittedBy?`, `isSample?`, and `distanceKm?` on list responses), `OpenPlaySession`, `Booking` (with `courtNo`), `Post`, `ChatThread` (with `unreadCount`), `ChatMessage`, `MatchProposal` — as in the monolith's `src/data/types.ts`.
- `LeaderboardEntry` = `{ userId, displayName, tier, rating?, homeCourtId?, matchesPlayed, wins, losses, winRate }`.
- `PlatformTelemetry` = `{ totalPlayers, totalCourts, verifiedCourts, indoorCourts, outdoorCourts, totalMatches, confirmedMatches, disputedMatches, totalSessions }`.

## Routes

### Health and config (public)
| Method | Path | Response |
|---|---|---|
| GET | `/healthz` | `{ ok: true }` |
| GET | `/config` | `{ areas: {label,lat,lng}[], tierBands: Record<SkillTier,{min,max}>, tau: number, tauLadder: number[], bookingSlots: {startMin,endMin,stepMin} }` |
| POST | `/geo/resolve` | Body `{ lat, lng }` → `{ inCorridor: boolean, nearestArea: {label,lat,lng} \| null }`. Public because onboarding classifies the GPS fix before the account exists; `nearestArea` is null outside the corridor |

### Auth (public)
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/register` | `{ email, password }` | 201 `{ uid, idToken, refreshToken, expiresIn }`; 409 `conflict` if the email exists |
| POST | `/auth/login` | `{ email, password }` | 200 same shape; 401 `unauthenticated` on bad credentials |
| POST | `/auth/refresh` | `{ refreshToken }` | 200 `{ idToken, refreshToken, expiresIn }` |

### Profile and players
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/me` | — | `AppUser`; 404 when the account has no profile yet |
| PUT | `/me` | `AppUser` without `id`, `role`, `isSample` | `AppUser`. The server sets `id` = uid and `role` from the token, validates name/tier/availability, requires `areaLabel` to be one of the `/config` areas and always sets the public `location` to that area's centroid. `preciseLocation` must be inside the corridor (400 otherwise). `doublesPartnerId` and `partnerConfirmed` are ignored here |
| POST | `/me/push-token` | `{ token }` | 204 |
| DELETE | `/me/push-token` | — | 204 (deletes stored push token for the caller) |
| DELETE | `/me` | — | 204 (RA 10173 account deactivation: anonymizes public user to 'Deactivated Player', destroys private profile/GPS, disables Auth) |
| PUT | `/me/partner` | `{ partnerId: string \| null }` | `AppUser` (sets `doublesPartnerId`, `partnerConfirmed: false`; `null` clears both). 400 for yourself, 404 for an unknown player. A previous partner who pointed back at the caller is released |
| GET | `/players` | — | `PublicPlayer[]` (matchmaking opt-in only) |

### Doubles partner invites
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/partner-invites` | — | `{ incoming: PartnerInvite[], outgoing: PartnerInvite[] }` |
| POST | `/partner-invites` | `{ toId }` | 201 `PartnerInvite` (`{ id, fromId, toId, status: 'pending'\|'accepted'\|'declined', createdAt }`); 400 for yourself, 404 unknown player, 409 when a pending invite already exists between the two (either direction) |
| POST | `/partner-invites/:id/respond` | `{ accept: boolean }` | `PartnerInvite` — the invitee only (403), pending only (409). On accept both players get each other as `doublesPartnerId` with `partnerConfirmed: true`, and each one's previous partner is released |

### Courts and bookings
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/courts` | — | `Court[]`, each with `distanceKm` from the caller (precise location when stored, else home area), nearest first |
| POST | `/courts` | `Court` without `id`, `verified`, `submittedBy` | 201 `Court` (`verified: false`); accepts `openMin`, `closeMin`, `advanceBookingDays`, `landmark`; 400 `invalid` outside the corridor |
| PATCH | `/courts/:id` | `{ verified? }` (admin) / `{ maintenanceStatus? }` (admin or caretaker) | `Court`; 403 otherwise |
| POST | `/courts/status` | `{ courtIds: string[], status }` (admin or caretaker) | `Court[]` |
| GET | `/courts/:id/bookings?date=YYYY-MM-DD` | — | `Booking[]` |
| POST | `/bookings` | `{ courtId, dateISO, startMin }` | 201 `Booking` (server assigns the lowest free `courtNo`); 409 `conflict` when every court is taken or the caller already holds a court in that slot; 400 for a past date (Philippine time) or a `startMin` that is not a `/config` booking slot |
| GET | `/me/bookings` | — | `Booking[]` (today onward) |
| DELETE | `/bookings/:id` | — | 204 (owner only) |

### OpenPlay sessions
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/sessions` | — | `OpenPlaySession[]` by `startsAt` |
| POST | `/sessions` | session without `id`, `hostId`, `attendeeIds` | 201 `OpenPlaySession` (host is the caller and first attendee); notifies eligible nearby players. 400 when `startsAt` is in the past |
| DELETE | `/sessions/:id` | — | 204 (host only) |
| POST | `/sessions/:id/attendance` | — | `OpenPlaySession` (toggles the caller); 409 when full, when the session has already started, or when the host tries to leave (the host deletes the session instead) |

### Community feed and match results
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/posts` | — | `Post[]` newest first |
| POST | `/posts` | `{ body, kind, scoreLine?, opponentId?, winnerId?, courtId? }` | 201 `Post`. A `match_summary` always starts `verificationStatus: 'pending'`, `confirmed: false`; the score line is validated server-side |
| POST | `/posts/:id/like` | — | `Post` (toggles the caller) |
| POST | `/posts/:id/confirm` | — | `Post` — **opponent only** |
| POST | `/posts/:id/dispute` | — | `Post` — opponent only |
| POST | `/posts/:id/counter-score` | `{ scoreLine }` | `Post` — opponent only |
| POST | `/posts/:id/accept-counter` | — | `Post` — author only, and only when a counter-score exists; this confirms the result |
| POST | `/posts/:id/resolve` | `{ action: 'confirm'\|'dismiss'\|'void'\|'re_entry' }` | `Post` — admin only |

Every action on a match result answers 403 to anyone but the named party (an admin uses `/resolve`, not `/confirm`) and 409 `conflict` when the result is not in a state that allows it (for example confirming a result that is already approved or voided).

### Chat
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/chats` | — | `ChatThread[]` newest first, each with `unreadCount` for the caller |
| POST | `/chats` | `{ userId }` | 200 `ChatThread` (existing or new; id is `chat_<sorted uids>`); 400 for yourself, 404 unknown user |
| GET | `/chats/:id/messages` | — | `ChatMessage[]` oldest first (participants only; last 30 days) |
| POST | `/chats/:id/messages` | `{ text, courtId?, proposal? }` | 201 `ChatMessage`; notifies the other participant. `text` is required even with a proposal; a new proposal always starts `pending` |
| POST | `/chats/:id/messages/:messageId/proposal` | `{ status: 'accepted'\|'declined'\|'rescheduled' }` | `ChatMessage` — the non-sender only (403); an answer is final (409 once answered) |
| POST | `/chats/:id/read` | — | 204 |

### Matchmaking and the algorithm
| Method | Path | Response |
|---|---|---|
| GET | `/matchmake` | `MatchResult` at τ = `CALIBRATED_TAU` (optional `?tau=` clamped to the ladder's range, 0.75–0.95; a non-numeric value is ignored). Scoring uses the caller's own private GPS fix and the engagement history; every other player is scored on their public home-area `location`, so no distance or score reveals another player's GPS fix. Every `profile` returned is a `PublicPlayer`. 404 when the caller has no profile or has not opted in |
| GET | `/matchmake/doubles?partnerId=` | `DoublesMatchResult`; `partnerId` defaults to the caller's saved partner; 400 `invalid` when there is none. Opposing teams are every pair of opted-in players who pass the deterministic gate with each other; `recommended` and `scored` each hold at most the 50 best-ranked teams |
| GET | `/algorithm/explain/:playerId` | 400 for yourself, 404 for an unknown or opted-out player. Why this player is or is not recommended to the caller: `{ gate: GateReport, content: { skill, schedule, distance, intent, format, weights, total }, cf: { similarity: number\|null, weight, sharedItems: number }, score, tau, recommended }` |
| GET | `/algorithm/lab/:seekerId` | Admin only. `{ seeker: PublicPlayer, config, candidates: [{ profile, gate, contentScore, cfScore, cfWeight, score }] }` for every opted-in player, including those the gate rejects (load order, not ranked). Scored on public home-area locations |
| GET | `/algorithm/evaluation` | Any signed-in user. The stored harness output (`thesis-artifacts/evaluation-summary.json`): threshold sweep with TP/FP/FN/TN, precision, recall, F1, ranking metrics, label source |

### Platform and leaderboard
| Method | Path | Response |
|---|---|---|
| GET | `/leaderboard` | `LeaderboardEntry[]` sorted by wins descending, computed from confirmed non-sample matches |
| GET | `/platform/telemetry` | `PlatformTelemetry` reporting counts of players, courts, matches and sessions for the admin dashboard |

## Not in the API (deliberate)

- Live updates are polling (3–5 s) on the list routes. No websockets.
- `tierRestriction` on a session is advisory: it selects who is notified, and the app shows it, but joining is not refused by tier (as in the monolith).
- Unverified courts can be booked; `verified` is a badge, not a gate.
