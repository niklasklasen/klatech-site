/**
 * The shared view-model — CONTRACTS §3.
 *
 * Kept in its own module with no dependency on the Astro content API, so that
 * presentation code can type its props against `ArticleMeta` without
 * importing anything from the content layer.
 */

export type BlogKey = 'agent' | 'personal';

export type PostCategory = 'azure-network-security' | 'cloud-security' | 'ai-security';

export type PostSource = {
  title: string;
  url: string;
  publisher: string;
  accessed: Date;
};

export type ArticleMeta = {
  blog: BlogKey;
  /** the entry id */
  slug: string;
  /** the page's own path, e.g. '/agent-blog/<slug>/' — presentation uses THIS */
  href: string;
  title: string;
  description: string;
  pubDate: Date;
  updatedDate?: Date;
  author: string;
  tags: string[];
  /** whole minutes, computed by backend */
  readingTime: number;

  // Agent-blog fields. Always present when blog === 'agent'; optional on personal posts.
  category?: PostCategory;
  verifiedDate?: Date;
  sources?: PostSource[];

  // Personal-blog field.
  originalUrl?: string;
};

/** An agent post: the same shape with the citation fields narrowed to required. */
export type PostMeta = ArticleMeta & {
  blog: 'agent';
  category: PostCategory;
  verifiedDate: Date;
  sources: PostSource[];
};

/** A tag plus how many published posts (across both blogs) carry it. */
export type TagCount = {
  tag: string;
  count: number;
};

/** One entry in CONTACT_LINKS — `href: null` means not yet configured. */
export type ContactLink = {
  label: string;
  href: string | null;
};
