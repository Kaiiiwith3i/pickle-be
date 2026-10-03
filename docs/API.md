# Pickle C-LB API contract (v1)

The single agreement between `pickle-clb-backend` and `pickle-clb-frontend`. The frontend talks to nothing else: no Firebase SDK, no direct database access, no matchmaking logic. Change this file first, then the code on both sides.

## Conventions

- Base URL: `http://localhost:4000` locally (`EXPO_PUBLIC_API_URL` in the frontend). JSON in, JSON out.
- Auth: `Authorization: Bearer <idToken>` on every route except `/healthz`, `/config`, `/auth/*`.
- Errors: HTTP status + `{ "error": { "code": string, "message": string } }`. Codes: `invalid` 400, `unauthenticated` 401, `forbidden` 403, `not_found` 404, `conflict` 409.
- Ids are server-generated unless stated. Times are ISO-8601 strings; `dateISO` is `YYYY-MM-DD`; `*Min` is minutes since midnight.
- `isSample: true` marks seeded sample records (players, courts, sessions, posts). The server sets it; clients never send it.
- Roles: `player` (default), `caretaker`, `admin` — from Auth custom claims, mirrored in `AppUser.role`. Clients cannot set a role.

## Types

`src/types.ts` in the backend is the source; the frontend mirrors it in `src/api/types.ts`.

- `PlayerProfile`, `AvailabilityWindow`, `SkillTier`, `MatchCandidate`, `MatchResult`, `GateReport`, `DoublesCandidate`, `DoublesMatchResult` — as defined by the engine.
- `AppUser` = `PlayerProfile` + `areaLabel`, `bio?`, name fields, `username?`, `homeCourtId?`, `joinedAt`, `onboarded`, `role?`, `communityRole?`, `facilityProfile?`, `doublesPartnerId?`, `partnerConfirmed?`, `isSample?`, and — **only on `/me`** — `email`, `phone?`, `preciseLocation?`.
- `PublicPlayer` = `AppUser` without `email`, `phone`, `preciseLocation`. `location` is the coarse home-area centroid.
- `Court` (+ `submittedBy?`, `isSample?`, and `distanceKm?` on list responses), `OpenPlaySession`, `Booking` (with `courtNo`), `Post`, `ChatThread` (with `unreadCount`), `ChatMessage`, `MatchProposal` — as in the monolith's `src/data/types.ts`.

## Routes

### Health and config (public)
| Method | Path | Response |
|---|---|---|
| GET | `/healthz` | `{ ok: true }` |
| GET | `/config` | `{ areas: {label,lat,lng}[], tierBands: Record<SkillTier,{min,max}>, tau: number, tauLadder: number[], bookingSlots: {startMin,endMin,stepMin} }` |

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
| PUT | `/me` | `AppUser` without `id`, `role`, `isSample` | `AppUser` (server sets `id` = uid, keeps `role`, validates name/tier/availability) |
| POST | `/me/push-token` | `{ token }` | 204 |
| PUT | `/me/partner` | `{ partnerId: string \| null }` | `AppUser` (sets `doublesPartnerId`, `partnerConfirmed: false`) |
| GET | `/players` | — | `PublicPlayer[]` (matchmaking opt-in only) |
| POST | `/geo/resolve` | `{ lat, lng }` | `{ inCorridor: boolean, nearestArea: {label,lat,lng} \| null }` |

### Doubles partner invites
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/partner-invites` | — | `{ incoming: PartnerInvite[], outgoing: PartnerInvite[] }` |
| POST | `/partner-invites` | `{ toId }` | 201 `PartnerInvite` (`{ id, fromId, toId, status: 'pending'\|'accepted'\|'declined', createdAt }`) |
| POST | `/partner-invites/:id/respond` | `{ accept: boolean }` | `PartnerInvite`; on accept both players get each other as `doublesPartnerId` with `partnerConfirmed: true` |

### Courts and bookings
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/courts` | — | `Court[]`, each with `distanceKm` from the caller (precise location when stored, else home area), nearest first |
| POST | `/courts` | `Court` without `id`, `verified`, `submittedBy` | 201 `Court` (`verified: false`); 400 `invalid` outside the corridor |
| PATCH | `/courts/:id` | `{ verified? }` (admin) / `{ maintenanceStatus? }` (admin or caretaker) | `Court`; 403 otherwise |
| POST | `/courts/status` | `{ courtIds: string[], status }` (admin or caretaker) | `Court[]` |
| GET | `/courts/:id/bookings?date=YYYY-MM-DD` | — | `Booking[]` |
| POST | `/bookings` | `{ courtId, dateISO, startMin }` | 201 `Booking` (server assigns the lowest free `courtNo`); 409 `conflict` when every court is taken |
| GET | `/me/bookings` | — | `Booking[]` (today onward) |
| DELETE | `/bookings/:id` | — | 204 (owner only) |

### OpenPlay sessions
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/sessions` | — | `OpenPlaySession[]` by `startsAt` |
| POST | `/sessions` | session without `id`, `hostId`, `attendeeIds` | 201 `OpenPlaySession` (host is the caller and first attendee); notifies eligible nearby players |
| DELETE | `/sessions/:id` | — | 204 (host only) |
| POST | `/sessions/:id/attendance` | — | `OpenPlaySession` (toggles the caller); 409 when full |

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

### Chat
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/chats` | — | `ChatThread[]` newest first, each with `unreadCount` for the caller |
| POST | `/chats` | `{ userId }` | `ChatThread` (existing or new; id is `chat_<sorted uids>`) |
| GET | `/chats/:id/messages` | — | `ChatMessage[]` oldest first (participants only; last 30 days) |
| POST | `/chats/:id/messages` | `{ text, courtId?, proposal? }` | 201 `ChatMessage`; notifies the other participant |
| POST | `/chats/:id/messages/:messageId/proposal` | `{ status: 'accepted'\|'declined'\|'rescheduled' }` | `ChatMessage` — the non-sender only |
| POST | `/chats/:id/read` | — | 204 |

### Matchmaking and the algorithm
| Method | Path | Response |
|---|---|---|
| GET | `/matchmake` | `MatchResult` at τ = `CALIBRATED_TAU` (optional `?tau=` clamped to the ladder). Scoring uses private GPS and engagement history; every `profile` returned is a `PublicPlayer` |
| GET | `/matchmake/doubles?partnerId=` | `DoublesMatchResult`; `partnerId` defaults to the caller's saved partner; 400 `invalid` when there is none. Opposing teams are every pair of opted-in players who pass the deterministic gate with each other |
| GET | `/algorithm/explain/:playerId` | Why this player is or is not recommended to the caller: `{ gate: GateReport, content: { skill, schedule, distance, intent, format, weights, total }, cf: { similarity: number\|null, weight, sharedItems: number }, score, tau, recommended }` |
| GET | `/algorithm/lab/:seekerId` | Admin only. `{ seeker: PublicPlayer, config, candidates: [{ profile, gate, contentScore, cfScore, cfWeight, score }] }` for every opted-in player, including those the gate rejects |
| GET | `/algorithm/evaluation` | The stored harness output (`thesis-artifacts/evaluation-summary.json`): threshold sweep with TP/FP/FN/TN, precision, recall, F1, ranking metrics, label source |

## Not in the API (deliberate)

- Leaderboards and career stats are computed in the frontend from `/posts`, `/sessions`, `/players`, excluding `isSample` records.
- Live updates are polling (3–5 s) on the list routes. No websockets.
