import {
    collection, query, orderBy, getDocs, setDoc, deleteDoc, doc,
    where, Timestamp, serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';

export interface BlogPost {
    id?: string;
    slug: string;
    title: string;
    description: string;
    content: string;
    tag: string;
    published: boolean;
    createdAt: Timestamp | null;
    updatedAt: Timestamp | null;
}

const COL = 'posts';

/* ── Fetch all posts (admin sees drafts too) ── */
export async function fetchAllPosts(): Promise<BlogPost[]> {
    const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as BlogPost));
}

/* ── Fetch published posts only (public blog) ── */
export async function fetchPublishedPosts(): Promise<BlogPost[]> {
    // Ask Firestore for published posts only: drafts must never reach a visitor's browser.
    // Equality-only filter, so no composite index is needed; sort newest first here.
    const q = query(collection(db, COL), where('published', '==', true));
    const snap = await getDocs(q);
    const ms = (p: BlogPost) => p.createdAt?.toMillis?.() ?? 0;
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as BlogPost))
        .sort((a, b) => ms(b) - ms(a));
}

/* ── Fetch single published post by slug (drafts are never returned to the public site) ── */
export async function fetchPostBySlug(slug: string): Promise<BlogPost | null> {
    const q = query(collection(db, COL), where('slug', '==', slug), where('published', '==', true));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as BlogPost;
}

/* ── Save (create or update) ── */
export async function savePost(post: BlogPost): Promise<void> {
    const id = post.id || post.slug;
    const data: Record<string, unknown> = {
        slug: post.slug,
        title: post.title,
        description: post.description,
        content: post.content,
        tag: post.tag,
        published: post.published,
        updatedAt: serverTimestamp(),
    };
    // Only set createdAt on first save
    if (!post.id) {
        data.createdAt = serverTimestamp();
    }
    await setDoc(doc(db, COL, id), data, { merge: true });
}

/* ── Delete ── */
export async function deletePost(id: string): Promise<void> {
    await deleteDoc(doc(db, COL, id));
}

/* ── Helper: slugify a title ── */
export function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

/* ── Reading time estimate ── */
export function readingTime(content: string): string {
    const words = content.trim().split(/\s+/).length;
    const min = Math.max(1, Math.ceil(words / 200));
    return `${min} min read`;
}
