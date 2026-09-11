/**
 * View-model types for the presentation layer — CONTRACTS §3.
 *
 * Deliberately declared here rather than imported from `src/lib/`: components
 * must never depend on the data layer, and these types are structural, so the
 * object backend-dev builds satisfies them without either side importing the
 * other. (@lead confirmed 2026-09-09: this duplication is deliberate — it is
 * what enforces the no-data-layer-import rule at the type level.)
 */

export type BlogKey = 'agent' | 'personal';

export type PostCategory =
  | 'azure-network-security'
  | 'cloud-security'
  | 'ai-security';

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

/**
 * A contact/profile link (email, GitHub, LinkedIn, ...). `href: null` means
 * "not configured yet" — ContactLinks.astro renders that entry as plain,
 * muted text rather than a dead or placeholder link.
 */
export type ContactLink = {
  label: string;
  href: string | null;
};
