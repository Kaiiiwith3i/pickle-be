# Pickle C-LB — backend

The REST API, matchmaking engine, evaluation harness and sample dataset for Pickle C-LB (pickleball matchmaking for Calamba and Los Baños, Laguna). The Expo app lives in the sibling repo `pickle-clb-frontend` and talks only to this API. The contract is [`docs/API.md`](docs/API.md).

Everything below runs locally and costs nothing. No Firebase account or login is needed: the project id `demo-pickleclb` keeps the emulators fully offline.

## Requirements

- Node 20 or newer (`node -v`)
- A Java runtime for the Firebase emulators. On macOS: `brew install openjdk` (the `emulators` script already adds Homebrew's keg-only Java to `PATH`)

## Run the local stack

```bash
npm install

# Terminal 1 — Firebase Auth (9099) and Firestore (8080) emulators; Emulator UI on http://127.0.0.1:4001
npm run emulators

# Terminal 2 — the API on http://localhost:4000 (reloads on save)
npm run dev
```

Check it: `curl http://localhost:4000/healthz` answers `{"ok":true}`.

The emulators keep data in memory. Stopping them empties the database.

## Sample data

```bash
npm run seed:sample        # sample players, courts, sessions and posts — every record has isSample: true
npm run seed:wipe-sample   # removes exactly the sample records and nothing else
```

Sample records are illustrative, not real community data. The app shows a "Sample" badge on them and leaves them out of leaderboards and statistics.

## Make yourself an admin (Algorithm Lab, court verification, dispute resolution)

Register in the app (or `POST /auth/register`), then:

```bash
npm run grant-role -- you@example.com admin      # or: caretaker, player
```

Sign out and in again so the new token carries the role.

## Use it from the app

Start the frontend with `EXPO_PUBLIC_API_URL=http://localhost:4000` for the browser. For Expo Go on a phone, the phone and this machine must be on the same Wi-Fi and the URL must use this machine's LAN address, for example `http://192.168.1.37:4000` (`ipconfig getifaddr en0` prints it). The frontend README has the full steps.

## Tests and checks

```bash
npm run typecheck   # tsc --noEmit
npm test            # unit tests (engine and pure logic); no emulators needed
npm run test:api    # API tests; needs `npm run emulators` running. Starts the app in-process, so `npm run dev` is optional
npm run evaluate    # reruns the thesis evaluation harness and rewrites thesis-artifacts/
```

`npm run evaluate` is the only source of the thesis numbers. It rewrites `generatedAt`; the metrics must not move unless the engine changed.

## Layout

| Path | What it is |
|---|---|
| `src/app.ts`, `src/server.ts` | The Express app and the local entry point |
| `src/routes/` | One file per resource; each declares full paths |
| `src/http.ts` | Token check, roles, error format |
| `src/engine/` | Hybrid Filtering Engine (pure TypeScript) — the only scoring implementation |
| `src/types.ts` | DTOs shared with the frontend |
| `scripts/` | `evaluate.ts` (harness), `seed.ts` (sample data), `grant-role.ts` |
| `tests/api/` | One API suite per resource, run against the emulators |
| `thesis-artifacts/` | Harness output and survey instruments |
| `docs/` | `API.md` (contract), `PLAN.md` (tickets and decisions) |

## Deploying (not done yet)

`npm run build` bundles `src/functions.ts` into `dist/functions.js`, a single HTTPS Cloud Function (`api`, region `asia-southeast1`) serving the same Express app. Deploying needs a real Firebase project on the Blaze (pay-as-you-go) plan, `FIREBASE_WEB_API_KEY` set for the `/auth/*` routes, and `firebase deploy --only functions,firestore`. This has not been run against a real project.
