# Pickle C-LB — Operations Runbook

## Daily/weekly operations

- **Court verification**: community-submitted courts appear with
  `verified: false`. Review in Firebase console → Firestore → `courts`; set
  `verified: true` after confirming details. (Admin custom claim required for
  in-rules updates: `firebase auth:import` or a one-off script setting
  `{ admin: true }` on the operator's account.)
- **Moderation**: posts live in `posts`; delete offending documents from the
  console. Repeat offenders: revoke via Authentication → disable user.
- **Session hygiene**: past sessions stay for engagement history (they feed
  the matchmaking model) — do not bulk-delete.

## Monitoring

- `GET https://asia-southeast1-<project>.cloudfunctions.net/api/healthz`
  should return `{"ok":true}`. Add it to UptimeRobot (free) at 5-min intervals.
- Functions logs: `firebase functions:log` or the Cloud console.
- Budget guard: set a Google Cloud budget alert at ₱100/month — expected spend
  is ₱0 at community scale.

## Data subject requests (RA 10173)

- **Export**: Firestore console → `users/{uid}` + subcollections → export JSON.
- **Erasure**: delete `users/{uid}`, their `bookings`, `posts`, `pushTokens`;
  anonymize their id in `engagements` (replace with `deleted-user`).
- Log each request and response date in the client's records (15-working-day
  statutory window).

## Incident quick fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| App shows demo data in production | `.env` missing/not loaded in build | Rebuild with env set (`eas env:list` to confirm) |
| Matches empty for everyone | `users` docs missing `matchmakingOptIn: true` | Check onboarding writes; Firestore query needs the field present |
| No push notifications | FCM credentials not linked in EAS | `eas credentials` → Android → FCM V1 key |
| Map blank on Android build | Maps key missing/restricted | Google Cloud console → key restrictions include Android app + Maps SDK |
| 401 from /matchmake | Client not sending Firebase ID token | Ensure `Authorization: Bearer <idToken>` header |

## Release process

1. `npx tsc --noEmit && npx jest` must pass.
2. `eas build --profile preview --platform android` → smoke-test the APK.
3. `eas build --profile production --platform android` → upload to Play console.
4. Tag the repo: `git tag v1.x.y && git push --tags`.
