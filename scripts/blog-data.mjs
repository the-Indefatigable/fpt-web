/**
 * Blog data for the build.
 *
 * The production build reads the committed snapshot scripts/blog-posts.json, so it needs NO secrets and is
 * reproducible. The snapshot holds only PUBLISHED posts (public content). Regenerate it after publishing or
 * editing a post in Admin:
 *
 *     npm run blog:snapshot -- --env-file=<file that defines FB_PROJECT_ID, FB_CLIENT_EMAIL, FB_PRIVATE_KEY>
 *     git add scripts/blog-posts.json && git commit -m "Update blog snapshot" && git push
 *
 * (Pushing to main redeploys the site, which prerenders the new post for crawlers. Readers see new posts
 * immediately anyway: once the app loads it reads Firestore live.)
 *
 * If the snapshot is missing the build FAILS, so a deploy can never silently ship a site with no blog
 * (the old /blog was a separate app; losing it would drop ~57 indexed pages).
 * Local development without a snapshot: ALLOW_NO_BLOG=1 npm run build  (blog pages are skipped).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SNAPSHOT = join(dirname(fileURLToPath(import.meta.url)), 'blog-posts.json');

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

/** Published posts straight from Firestore (Admin SDK), newest first. Used only by the snapshot script. */
export async function fetchPublishedPosts(env = process.env) {
  const creds = blogCredentials(env);
  if (!creds) {
    throw new Error('[blog] FB_PROJECT_ID / FB_CLIENT_EMAIL / FB_PRIVATE_KEY are not set (pass --env-file=<file>).');
  }
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app = initializeApp({ credential: cert(creds) }, 'blog-snapshot');
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
  posts.sort((a, b) => (b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : a.slug.localeCompare(b.slug)));
  return posts;
}

/** Published posts for the build, newest first. Returns null only when ALLOW_NO_BLOG=1 and no snapshot exists. */
export function loadPublishedPosts(env = process.env, snapshot = SNAPSHOT) {
  if (!existsSync(snapshot)) {
    if (env.ALLOW_NO_BLOG === '1') {
      console.warn('[blog] ALLOW_NO_BLOG=1 and no scripts/blog-posts.json: skipping blog pages.');
      return null;
    }
    throw new Error(
      `[blog] ${snapshot} is missing. The blog is prerendered from this committed snapshot, so the build cannot ` +
      'continue without it. Generate it with: npm run blog:snapshot -- --env-file=<file with FB_* credentials> ' +
      '(or set ALLOW_NO_BLOG=1 to build without the blog, e.g. for local development).'
    );
  }
  const posts = JSON.parse(readFileSync(snapshot, 'utf-8'));
  if (!Array.isArray(posts) || posts.length === 0) {
    throw new Error('[blog] blog-posts.json holds 0 posts: refusing to build a site with an empty blog.');
  }
  console.log(`[blog] loaded ${posts.length} published posts from the snapshot`);
  return posts;
}
