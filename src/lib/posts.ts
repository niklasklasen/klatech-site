import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import { hrefFor } from './site';
import type { ArticleMeta, BlogKey, PostMeta, TagCount } from './types';

export type { ArticleMeta, BlogKey, PostCategory, PostMeta, PostSource, TagCount } from './types';

export type AgentEntry = CollectionEntry<'posts'>;
export type PersonalEntry = CollectionEntry<'personal'>;
export type AnyEntry = AgentEntry | PersonalEntry;

const WORDS_PER_MINUTE = 200;

/**
 * Whole minutes at 200 wpm, rounded up, never below 1.
 * Counts the raw markdown body — close enough, and stable across renderers.
 */
export function readingTime(body: string | undefined): number {
  const words = (body ?? '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

/** Drafts are visible while authoring, gone from the production build. Works for either collection. */
export function isPublished(entry: AnyEntry): boolean {
  return !(import.meta.env.PROD && entry.data.draft);
}

/** Newest first. Does not mutate the input. */
export function sortByDate<T extends { pubDate: Date }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
}

/**
 * Map a collection entry from **either** collection to the shared `ArticleMeta`
 * view-model (CONTRACTS §3). `body` defaults to the entry's raw body; pass it
 * explicitly to override.
 */
export function toArticleMeta(
  entry: AnyEntry,
  blog: BlogKey,
  body: string | undefined = entry.body,
): ArticleMeta {
  const { data } = entry;
  const meta: ArticleMeta = {
    blog,
    slug: entry.id,
    href: hrefFor(blog, entry.id),
    title: data.title,
    description: data.description,
    pubDate: data.pubDate,
    author: data.author,
    tags: data.tags,
    readingTime: readingTime(body),
  };
  if (data.updatedDate) meta.updatedDate = data.updatedDate;
  if ('category' in data && data.category) meta.category = data.category;
  if (data.verifiedDate) meta.verifiedDate = data.verifiedDate;
  if (data.sources && data.sources.length > 0) meta.sources = data.sources;
  if ('originalUrl' in data && data.originalUrl) meta.originalUrl = data.originalUrl;
  return meta;
}

/**
 * Map an agent-blog (`posts`) entry to the narrowed `PostMeta` shape — the
 * compile-time proof that an agent post carries its citation fields.
 */
export function toPostMeta(entry: AgentEntry, body: string | undefined = entry.body): PostMeta {
  const { data } = entry;
  const meta: PostMeta = {
    blog: 'agent',
    slug: entry.id,
    href: hrefFor('agent', entry.id),
    title: data.title,
    description: data.description,
    pubDate: data.pubDate,
    verifiedDate: data.verifiedDate,
    author: data.author,
    category: data.category,
    tags: data.tags,
    readingTime: readingTime(body),
    sources: data.sources,
  };
  if (data.updatedDate) meta.updatedDate = data.updatedDate;
  return meta;
}

/** Every publishable agent-blog entry, newest first. */
export async function getAgentEntries(): Promise<AgentEntry[]> {
  const entries = await getCollection('posts', isPublished);
  return [...entries].sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** Every publishable personal-blog entry, newest first. */
export async function getPersonalEntries(): Promise<PersonalEntry[]> {
  const entries = await getCollection('personal', isPublished);
  return [...entries].sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** Every publishable agent post as `ArticleMeta`, newest first. */
export async function getAgentMetas(): Promise<ArticleMeta[]> {
  const entries = await getAgentEntries();
  return entries.map((entry) => toArticleMeta(entry, 'agent'));
}

/** Every publishable personal post as `ArticleMeta`, newest first. */
export async function getPersonalMetas(): Promise<ArticleMeta[]> {
  const entries = await getPersonalEntries();
  return entries.map((entry) => toArticleMeta(entry, 'personal'));
}

/** Both blogs merged, newest first — used by `/`, `/tags/**` and `/rss.xml`. */
export async function getAllMetas(): Promise<ArticleMeta[]> {
  const [agent, personal] = await Promise.all([getAgentMetas(), getPersonalMetas()]);
  return sortByDate([...agent, ...personal]);
}

/** Tags across the given articles, most used first, then alphabetical. */
export function collectTags(posts: ArticleMeta[]): TagCount[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** Articles carrying `tag`, order preserved. */
export function filterByTag<T extends { tags: string[] }>(posts: T[], tag: string): T[] {
  return posts.filter((post) => post.tags.includes(tag));
}
