import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPublishedPosts, blogCredentials } from './blog-data.mjs';

const missing = join(tmpdir(), 'no-such-blog-posts.json');
const tmpFile = (text) => {
  const f = join(mkdtempSync(join(tmpdir(), 'blog-')), 'blog-posts.json');
  writeFileSync(f, text);
  return f;
};

describe('blog snapshot loader', () => {
  it('fails loudly when the snapshot is missing', () => {
    expect(() => loadPublishedPosts({}, missing)).toThrow(/blog-posts\.json|snapshot/i);
  });

  it('skips the blog only when ALLOW_NO_BLOG=1', () => {
    expect(loadPublishedPosts({ ALLOW_NO_BLOG: '1' }, missing)).toBeNull();
  });

  it('refuses an empty snapshot', () => {
    expect(() => loadPublishedPosts({}, tmpFile('[]'))).toThrow(/0 posts/);
  });

  it('reads posts from the snapshot', () => {
    expect(loadPublishedPosts({}, tmpFile(JSON.stringify([{ slug: 'a', title: 'A', content: 'x' }])))).toHaveLength(1);
  });

  it('unescapes a private key stored with literal \\n', () => {
    const c = blogCredentials({ FB_PROJECT_ID: 'p', FB_CLIENT_EMAIL: 'e', FB_PRIVATE_KEY: '"a\\nb"' });
    expect(c.privateKey).toBe('a\nb');
  });

  it('the committed snapshot has published posts only and unique slugs', () => {
    const posts = loadPublishedPosts({});
    expect(posts.length).toBeGreaterThanOrEqual(50);
    expect(new Set(posts.map((p) => p.slug)).size).toBe(posts.length);
    expect(posts.some((p) => 'published' in p)).toBe(false);
  });
});
