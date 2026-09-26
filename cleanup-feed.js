const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

(async () => {
    const snapshot = await db.collection('safetyFeed').get();
    console.log(`Found ${snapshot.size} documents.`);
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    console.log(`Deleted ${snapshot.size} documents.`);
    process.exit(0);
})().catch((err) => {
    console.error('Cleanup failed:', err);
    process.exit(1);
});
