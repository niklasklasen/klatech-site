/**
 * Site chrome strings and display labels.
 *
 * CONTRACTS §7 makes `src/lib/site.ts` the single source of truth for site
 * identity (including the tagline, as of amendment 2026-09-09b) and the blog
 * registry, so this module re-exports rather than declaring a second copy.
 * Reading across the boundary is allowed — docs/OWNERSHIP.md: "Write only to
 * paths you own. Read anything." — and `src/lib/site.ts` has no dependency on
 * the content collection API, so the §3 import ban is untouched. (Do not name
 * the banned specifier in this file even in prose: the ban is enforced by a
 * plain text search over the source.)
 */

import { BLOGS, CONTACT_LINKS, SITE_DESCRIPTION, SITE_TAGLINE, SITE_TITLE } from '../lib/site';
import type { BlogKey, PostCategory } from './types';

export { BLOGS, CONTACT_LINKS, SITE_DESCRIPTION, SITE_TAGLINE, SITE_TITLE };

/**
 * Presentation-only strings that have no counterpart in `src/lib/site.ts`.
 * `locale` stays here because §7 does not define one and src/lib is not mine
 * to write.
 */
export const SITE = {
  locale: 'en',
} as const;

/** CONTRACTS §7 — fixed order. */
export const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/blog/', label: 'Blog' },
  { href: '/agent-blog/', label: 'Agent Blog' },
  { href: '/tags/', label: 'Tags' },
  { href: '/about/', label: 'About' },
] as const;

export const CATEGORY_LABEL: Record<PostCategory, string> = {
  'azure-network-security': 'Azure network security',
  'cloud-security': 'Cloud security',
  'ai-security': 'AI security',
};

/** Category label that tolerates an unmapped value rather than rendering blank. */
export function categoryLabel(category: string): string {
  return (
    CATEGORY_LABEL[category as PostCategory] ??
    category.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())
  );
}

/** Which blog a post belongs to, for the `showBlog` badge on PostCard. */
export function blogLabel(blog: BlogKey): string {
  return BLOGS[blog].navLabel;
}

/** ISO-8601 date, both as the `datetime` attribute and as display text. */
export function isoDate(value: Date | string | number): string {
  return new Date(value).toISOString().slice(0, 10);
}
