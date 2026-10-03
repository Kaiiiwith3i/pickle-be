/**
 * Sample dataset. `npm run seed:sample` writes labelled sample players, courts, sessions and posts;
 * `npm run seed:wipe-sample` removes exactly the documents with `isSample: true` (and their private
 * subcollections) and nothing else. Run it only against the emulators or a throwaway project.
 */
import { db } from '../src/firebase';
import { SAMPLE_COURTS } from '../src/seed/courts';
import { samplePlayers, samplePosts, sampleSessions } from '../src/seed/community';

/** Collections that carry `isSample`. */
const COLLECTIONS = ['users', 'courts', 'sessions', 'posts'] as const;

/** Idempotent: fixed ids, so re-running refreshes the relative dates instead of duplicating. */
export async function seedSample(now = new Date()): Promise<Record<(typeof COLLECTIONS)[number], number>> {
  const sets = {
    users: samplePlayers(now),
    courts: SAMPLE_COURTS,
    sessions: sampleSessions(now),
    posts: samplePosts(now),
  };
  const batch = db.batch();
  for (const name of COLLECTIONS) for (const doc of sets[name]) batch.set(db.collection(name).doc(doc.id), doc);
  await batch.commit();
  return { users: sets.users.length, courts: sets.courts.length, sessions: sets.sessions.length, posts: sets.posts.length };
}

export async function wipeSample(): Promise<Record<(typeof COLLECTIONS)[number], number>> {
  const removed = { users: 0, courts: 0, sessions: 0, posts: 0 };
  for (const name of COLLECTIONS) {
    const snap = await db.collection(name).where('isSample', '==', true).get();
    // recursiveDelete also takes the users/{uid}/private subcollection with the profile.
    await Promise.all(snap.docs.map((d) => db.recursiveDelete(d.ref)));
    removed[name] = snap.size;
  }
  return removed;
}

if (require.main === module) {
  (process.argv.includes('--wipe') ? wipeSample() : seedSample()).then(
    (counts) => {
      console.log(process.argv.includes('--wipe') ? 'Removed sample records:' : 'Seeded sample records:', counts);
      process.exit(0);
    },
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
