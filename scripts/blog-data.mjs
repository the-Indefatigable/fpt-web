/**
 * Build-time blog data: reads the published posts from Firestore with the Admin SDK.
 *
 * Needs FB_PROJECT_ID, FB_CLIENT_EMAIL and FB_PRIVATE_KEY in the build environment.
 * If they are missing the build FAILS, so a deploy can never silently ship a site with no blog
 * (the old /blog was a separate app; losing it would drop ~57 indexed pages).
 * Local development without credentials: ALLOW_NO_BLOG=1 npm run build  (blog pages are skipped).
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export function blogCredentials(env = process.env) {
  const projectId = env.FB_PROJECT_ID;
  const clientEmail = env.FB_CLIENT_EMAIL;
  const raw = env.FB_PRIVATE_KEY;
  if (!projectId || !clientEmail || !raw) return null;
  // .env files and CI dashboards store the key with literal "\n" escapes
  const privateKey = raw.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
  return { projectId, clientEmail, privateKey };
}

const iso = (ts) => ts?.toDate?.()?.toISOString() || '';

/** Published posts, newest first. Returns null only when ALLOW_NO_BLOG=1 and no credentials. */
export async function loadPublishedPosts(env = process.env) {
  const creds = blogCredentials(env);
  if (!creds) {
    if (env.ALLOW_NO_BLOG === '1') {
      console.warn('[blog] ALLOW_NO_BLOG=1 and no FB_* credentials: skipping blog pages.');
      return null;
    }
    throw new Error(
      '[blog] FB_PROJECT_ID / FB_CLIENT_EMAIL / FB_PRIVATE_KEY are not set. ' +
      'The blog is prerendered from Firestore at build time, so the build cannot continue without them ' +
      '(set ALLOW_NO_BLOG=1 to build without the blog, e.g. for local development).'
    );
  }
  const app = initializeApp({ credential: cert(creds) }, 'blog-prerender');
  const snap = await getFirestore(app).collection('posts').where('published', '==', true).get();
  const posts = snap.docs
    .map((d) => {
      const x = d.data();
      return {
        slug: x.slug, title: x.title, description: x.description || '', content: x.content || '',
        tag: x.tag || '', createdAt: iso(x.createdAt), updatedAt: iso(x.updatedAt),
      };
    })
    .filter((p) => p.slug && p.title);
  posts.sort((a, b) => (b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0));
  if (posts.length === 0) {
    throw new Error('[blog] Firestore returned 0 published posts: refusing to build a site with an empty blog.');
  }
  console.log(`[blog] loaded ${posts.length} published posts`);
  return posts;
}
