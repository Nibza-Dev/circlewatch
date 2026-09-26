/**
 * Checks for CircleWatch safety sessions that are still "active" past their
 * expected arrival time, and alerts the owner's trusted circle if so - this
 * is the actual missed-check-in detector for the app.
 *
 * This intentionally runs here (server-side, on a schedule) rather than as
 * a client-side timer inside the app. A timer running on the tracked
 * person's own phone can't be trusted to fire in exactly the scenario this
 * feature exists to catch: their phone loses signal, the battery dies, the
 * OS kills the backgrounded app, or someone takes the phone from them.
 * Running the check here means the circle still gets alerted regardless of
 * what's happening to that phone.
 *
 * Intended to run on a schedule (see
 * .github/workflows/check-missed-sessions.yml), not manually. Requires:
 *   FIREBASE_SERVICE_ACCOUNT - the full JSON contents of a Firebase
 *                              service account key, as a single string.
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const SERVICE_ACCOUNT_RAW = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!SERVICE_ACCOUNT_RAW) {
    console.error('Missing FIREBASE_SERVICE_ACCOUNT env var.');
    process.exit(1);
}

const serviceAccount = JSON.parse(SERVICE_ACCOUNT_RAW);
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function getPushTokens(uids) {
    const tokens = [];
    for (const uid of uids) {
        const snap = await db.collection('pushTokens').doc(uid).get();
        const token = snap.data()?.token;
        if (token) tokens.push(token);
    }
    return tokens;
}

async function sendPushAlert(tokens, title, body, data) {
    if (tokens.length === 0) return;
    const messages = tokens.map((to) => ({ to, sound: 'default', title, body, data, priority: 'high' }));
    await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate', 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
    });
}

async function run() {
    // Equality-only filter so this never needs a Firestore composite index -
    // the number of concurrently active sessions for an app like this stays
    // small, so filtering the deadline in JS below is plenty efficient.
    const snapshot = await db.collection('sessions').where('status', '==', 'active').get();
    console.log(`Checking ${snapshot.size} active session(s).`);

    const now = Date.now();
    let missedCount = 0;

    for (const docSnap of snapshot.docs) {
        const session = docSnap.data();
        const deadline = session.expectedArrivalAt?.toDate?.();
        if (!deadline || now <= deadline.getTime() || session.alertSent) continue;

        const tokens = await getPushTokens(session.circleUserIds ?? []);
        await sendPushAlert(
            tokens,
            'CircleWatch Alert',
            `${session.ownerName ?? 'Someone in your circle'} missed their check-in and may need help.`,
            { sessionId: docSnap.id, type: 'missed-checkin' }
        );

        await docSnap.ref.update({ alertSent: true, status: 'missed' });
        missedCount += 1;
        console.log(`Marked session ${docSnap.id} as missed and alerted ${tokens.length} circle member(s).`);
    }

    console.log(`Done. ${missedCount} session(s) newly marked as missed.`);
}

run()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('Failed to check missed sessions:', err);
        process.exit(1);
    });
