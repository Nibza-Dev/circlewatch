/**
 * Pulls recent South Africa safety/crime-related headlines from NewsAPI
 * and writes any new ones into the Firestore "safetyFeed" collection,
 * which the app's SafetyFeedScreen listens to live. Also prunes anything
 * older than RETENTION_DAYS so the feed doesn't accumulate stale news
 * forever.
 *
 * Intended to run on a schedule (see .github/workflows/safety-feed.yml),
 * not manually. Requires two env vars:
 *   NEWSAPI_KEY            - free key from https://newsapi.org
 *   FIREBASE_SERVICE_ACCOUNT - the full JSON contents of a Firebase
 *                              service account key, as a single string.
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

const NEWSAPI_KEY = process.env.NEWSAPI_KEY;
const SERVICE_ACCOUNT_RAW = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!NEWSAPI_KEY) {
    console.error('Missing NEWSAPI_KEY env var.');
    process.exit(1);
}
if (!SERVICE_ACCOUNT_RAW) {
    console.error('Missing FIREBASE_SERVICE_ACCOUNT env var.');
    process.exit(1);
}

const serviceAccount = JSON.parse(SERVICE_ACCOUNT_RAW);

const app = initializeApp({
    credential: cert(serviceAccount),
});

const db = getFirestore(app);

// How long an article stays in the feed before it's treated as stale and
// removed. Crime/safety news is only actionable while it's recent - a
// two-week-old hijacking report doesn't help anyone make a decision today,
// and showing stale news undermines trust in a safety app. Tune as needed.
const RETENTION_DAYS = 0; // TEMP: one-time wipe of pre-fix backlog. Revert to 14 after this run.

// Keywords that make a headline relevant to personal/community safety.
// Kept specific on purpose - broad words like bare "fire" or "safety" alone
// pull in a lot of noise (sports teams, unrelated "safety award" pieces, etc.).
// Narrowed on purpose to violent-crime and women's-safety news specifically
// (hijacking, kidnapping, GBV, etc.) rather than general civil-emergency
// topics like protests or load shedding.
const SAFETY_KEYWORDS = [
    'hijacking', 'kidnapping', 'robbery', 'murder', 'shooting', 'stabbing',
    'assault', 'gang violence', 'rape', 'gender-based violence', 'domestic violence',
];

// South-Africa place/institution names. Instead of restricting by which
// domain published an article (NewsAPI's crawler turned out to have very
// thin coverage of specific SA news sites), we require the article to
// actually MENTION South Africa - this works regardless of which outlet
// NewsAPI happens to have indexed it from.
const SA_PLACES = [
    'South Africa', 'Johannesburg', 'Cape Town', 'Pretoria', 'Durban',
    'Gauteng', 'KwaZulu-Natal', 'SAPS',
];

const buildQuery = () => {
    const safety = SAFETY_KEYWORDS.map((k) => `"${k}"`).join(' OR ');
    const places = SA_PLACES.map((p) => `"${p}"`).join(' OR ');
    return `(${safety}) AND (${places})`;
};

const textIncludesAny = (text, terms) => {
    const lower = text.toLowerCase();
    return terms.some((term) => lower.includes(term.toLowerCase()));
};

// NewsAPI's `q` matches anywhere in the article's full indexed text, not
// just the title/description it returns to us. That means a long article
// about, say, Netanyahu or Trump can satisfy our (safety) AND (SA place)
// query by mentioning "South Africa" once (the ICJ genocide case, tariffs,
// AGOA, etc.) and a safety keyword once (e.g. "rape" in unrelated Gaza-war
// coverage), with the two completely unrelated to each other in that
// article. We re-check against just title+description - the part a human
// would actually judge a "SA crime headline" by - before trusting a match.
const isGenuinelyRelevant = (article) => {
    const text = `${article.title || ''} ${article.description || ''}`;
    return textIncludesAny(text, SA_PLACES) && textIncludesAny(text, SAFETY_KEYWORDS);
};

async function fetchHeadlines() {
    const params = new URLSearchParams({
        q: buildQuery(),
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: '20',
        apiKey: NEWSAPI_KEY,
    });
    const res = await fetch(`https://newsapi.org/v2/everything?${params.toString()}`);
    const data = await res.json();
    if (data.status !== 'ok') {
        throw new Error(`NewsAPI error: ${data.code} - ${data.message}`);
    }
    console.log(`NewsAPI search: totalResults=${data.totalResults}, returned=${(data.articles || []).length}`);
    return data.articles || [];
}

async function alreadyStored(url) {
    const snapshot = await db.collection('safetyFeed').where('url', '==', url).limit(1).get();
    return !snapshot.empty;
}

// Deletes any safetyFeed doc older than RETENTION_DAYS. Firestore batches
// are capped at 500 writes, and the first time this runs it may need to
// clear out everything accumulated since the feed was first built, so we
// delete in pages instead of one giant batch.
async function pruneOldArticles() {
    const cutoff = Timestamp.fromMillis(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const staleQuery = db.collection('safetyFeed').where('createdAt', '<', cutoff);

    let totalDeleted = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const snapshot = await staleQuery.limit(400).get();
        if (snapshot.empty) break;

        const batch = db.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();

        totalDeleted += snapshot.size;
        if (snapshot.size < 400) break;
    }

    return totalDeleted;
}

async function run() {
    const removed = await pruneOldArticles();
    console.log(`Removed ${removed} article(s) older than ${RETENTION_DAYS} days.`);

    const articles = await fetchHeadlines();
    console.log(`Fetched ${articles.length} candidate articles from NewsAPI.`);

    const relevant = articles.filter(isGenuinelyRelevant);
    console.log(`${relevant.length} of ${articles.length} passed the title/description relevance check.`);

    let added = 0;
    for (const article of relevant) {
        if (!article.url || !article.title) continue;
        const exists = await alreadyStored(article.url);
        if (exists) continue;

        await db.collection('safetyFeed').add({
            title: article.title,
            body: article.description || '',
            source: article.source?.name || 'News',
            url: article.url,
            createdAt: FieldValue.serverTimestamp(),
        });
        added += 1;
    }

    console.log(`Added ${added} new safety update(s) to Firestore.`);
}

run()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('Failed to refresh safety feed:', err);
        process.exit(1);
    });