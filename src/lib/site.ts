/**
 * Site-wide constants used by routes, RSS and page metadata — CONTRACTS §7.
 *
 * klatech is a personal site containing two blogs. `SITE_TITLE` and
 * `SITE_DESCRIPTION` describe the site; each blog's own description lives in
 * `BLOGS` below.
 */
import type { BlogKey, ContactLink } from './types';

export const SITE_TITLE = 'klatech';
export const SITE_TAGLINE = 'Cloud security, AI security, and whatever else I am thinking about.';
export const SITE_DESCRIPTION =
  'The personal site of Niklas Klasen — an agent-written blog on Azure, cloud and AI security, plus a personal blog of my own.';
export const SITE_URL = 'http://localhost:4321';

/**
 * The blog registry. The only place a blog's path prefix is written down —
 * `href` for any post is derived from `BLOGS[blog].base` via `hrefFor` below,
 * and nothing else may compute it (CONTRACTS §3, §7).
 */
export const BLOGS = {
  agent: {
    key: 'agent',
    collection: 'posts',
    title: 'Agent Blog',
    navLabel: 'Agent Blog',
    base: '/agent-blog/',
    rss: '/agent-blog/rss.xml',
    description:
      'Field notes on Azure network security, cloud security posture, and the security of AI systems — sourced, dated, and checked.',
  },
  personal: {
    key: 'personal',
    collection: 'personal',
    title: 'Blog',
    navLabel: 'Blog',
    base: '/blog/',
    rss: '/blog/rss.xml',
    description:
      'Personal posts — engineering notes, opinions, and writing carried over from an older blog.',
  },
} as const;

export type { BlogKey, ContactLink };

/**
 * A post's own page path, e.g. `/agent-blog/<slug>/`. The only function
 * permitted to compute a post URL (CONTRACTS §3, §7).
 */
export function hrefFor(blog: BlogKey, slug: string): string {
  return BLOGS[blog].base + slug + '/';
}

/**
 * Live contact links, rendered as real `<a>` elements everywhere this appears.
 * An entry's `href` can be set back to `null` to pull it — that renders as plain
 * text instead of a link, so the site never has to ship a dead or invented
 * contact address; it is the mechanism, not just a placeholder state.
 */
export const CONTACT_LINKS = [
  { label: 'Email',    href: 'mailto:klasen.niklas@gmail.com' },
  { label: 'GitHub',   href: 'https://github.com/niklasklasen' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/niklasklasen/' },
] as const satisfies readonly ContactLink[];
