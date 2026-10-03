/**
 * Admin SDK handles. The SDK reads FIRESTORE_EMULATOR_HOST,
 * FIREBASE_AUTH_EMULATOR_HOST and GCLOUD_PROJECT itself, so the same code runs
 * against the local emulators (`npm run dev`, `npm run test:api`) and in
 * Cloud Functions (default credentials).
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
// Optional DTO fields arrive as `undefined`; drop them instead of throwing.
db.settings({ ignoreUndefinedProperties: true });
