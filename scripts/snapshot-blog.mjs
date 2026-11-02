#!/usr/bin/env node
/**
 * Regenerate scripts/blog-posts.json from Firestore (published posts only).
 *
 *   npm run blog:snapshot -- --env-file=<file that defines FB_PROJECT_ID, FB_CLIENT_EMAIL, FB_PRIVATE_KEY>
 *
 * Then commit and push scripts/blog-posts.json so the next deploy prerenders the new post.
 * The credentials are read here, on your machine, and are never written to the snapshot or to Vercel.
 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { fetchPublishedPosts, SNAPSHOT } from './blog-data.mjs';

// --env-file=<path> loads FB_* into this process only (node's own --env-file flag must precede the script name)
const envArg = process.argv.find((a) => a.startsWith('--env-file='));
if (envArg) process.loadEnvFile(envArg.slice('--env-file='.length));

const posts = await fetchPublishedPosts();
if (posts.length === 0) {
  console.error('[blog] Firestore returned 0 published posts: refusing to overwrite the snapshot.');
  process.exit(1);
}
const before = existsSync(SNAPSHOT) ? JSON.parse(readFileSync(SNAPSHOT, 'utf-8')) : [];
writeFileSync(SNAPSHOT, JSON.stringify(posts, null, 2) + '\n');
const had = new Set(before.map((p) => p.slug));
const added = posts.filter((p) => !had.has(p.slug)).map((p) => p.slug);
const gone = before.filter((p) => !posts.some((q) => q.slug === p.slug)).map((p) => p.slug);
console.log(`[blog] wrote ${posts.length} posts to scripts/blog-posts.json (new: ${added.length}, removed: ${gone.length})`);
if (added.length) console.log('  new: ' + added.join(', '));
if (gone.length) console.log('  removed: ' + gone.join(', '));
