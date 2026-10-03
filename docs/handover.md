# Pickle C-LB — Client Handover Guide

The app runs in two modes. **Demo mode** (no configuration): seeded courts,
players, and sessions; everything works offline — this is what you have today.
**Production mode**: real Firebase backend. Switching takes ~15 minutes of
key-plugging once the accounts below exist.

## Accounts you need (one-time)

| Account | Cost | Used for |
|---|---|---|
| Firebase (Google) | Free (Spark tier is enough for this community size) | Auth, database, backend functions* |
| Expo / EAS | Free tier OK | Building installable Android/iOS apps |
| Google Maps Platform | Free tier OK ($200/mo credit) | Map on Android builds only |
| Apple Developer | $99/year — optional, decide later | iOS distribution (TestFlight/App Store). Android-first is fine: ~88% of PH mobile is Android (Statcounter, June 2026). |

*Cloud Functions deployment requires the Blaze (pay-as-you-go) plan, but at
this usage level the bill stays at ₱0 — Blaze includes the same free quota.

## 15-minute production setup

1. **Create the Firebase project** at console.firebase.google.com → Add project
   (name: `pickle-clb`). Enable **Authentication → Email/Password**, and
   **Firestore Database** (location: `asia-southeast1`).
2. **Register a Web app** in Project settings → copy the config values into
   `.env` (copy `.env.example` first). Every field maps 1:1.
3. **Install the Firebase CLI** and deploy rules + backend:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use <your-project-id>
   firebase deploy --only firestore:rules,firestore:indexes
   npm --prefix functions install && firebase deploy --only functions
   ```
4. **Seed the court directory** (after validating it — see below):
   ```bash
   # Service account: Project settings → Service accounts → Generate key
   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npx tsx scripts/seed.ts
   ```
   Grant admin/caretaker roles (the user must have signed up first):
   `GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npx tsx scripts/grant-role.ts <email> <admin|caretaker|player>`
5. **Run the app against production**: `npx expo start` — the presence of
   `EXPO_PUBLIC_FIREBASE_API_KEY` in `.env` switches the data layer
   automatically. Nothing else changes.

## Building installable apps (EAS)

```bash
npm i -g eas-cli
eas login
eas build --profile preview --platform android   # shareable APK for the pilot
eas build --profile production --platform android # Play Store AAB
```
Maps on Android needs `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY` in the build
environment (`eas env:create` or eas.json `env`). iOS uses Apple Maps — no key.

## Seed data validation (do this with the client before launch)

`src/data/seed.ts` ships **sample** court entries for known playing venues in
the corridor. Before seeding production, confirm for each court: exact name,
coordinates (drop a pin in Google Maps), fee, hours, court count, amenities,
and whether it should start `verified: true`. Community members can submit
missing courts in-app; those start unverified until an admin approves.

## What's deliberately out of v1

Payments (bookings are pay-at-venue), Google sign-in (Email/Password auth is
active), iOS store distribution (client decision),
web deployment. All are documented as future extensions in the thesis.

## Support artifacts

- `docs/privacy-policy.md` — publish this (required by RA 10173 and Play Store).
- `docs/runbook.md` — operating the backend, moderation, data requests.
- `docs/design-spec.md` — design tokens and component conventions.
- `thesis-artifacts/` — evaluation metrics, labeling sheets, screenshots.
