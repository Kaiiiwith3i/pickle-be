/**
 * Grants a role: sets the Auth custom claim and mirrors it into users/{uid}.role.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=<service-account.json> \
 *     npx tsx scripts/grant-role.ts <email> <admin|caretaker|player>
 *
 * The user must have signed up already. The client must refresh its ID token
 * (sign out/in) to pick up the new claim.
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const ROLES = ['admin', 'caretaker', 'player'] as const;

async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !ROLES.includes(role as (typeof ROLES)[number])) {
    console.error('Usage: npx tsx scripts/grant-role.ts <email> <admin|caretaker|player>');
    process.exit(1);
  }

  initializeApp({ credential: applicationDefault() });
  const user = await getAuth().getUserByEmail(email);
  await getAuth().setCustomUserClaims(user.uid, {
    admin: role === 'admin',
    caretaker: role === 'caretaker',
  });
  await getFirestore().collection('users').doc(user.uid).set({ role }, { merge: true });
  console.log(`${email} (${user.uid}) is now ${role}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
