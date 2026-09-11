# CONTRACTS

Frozen interfaces. **No agent may change anything in this file.** If a contract is
wrong or blocking, do not edit it — file a ticket in `.agents/backlog.md` addressed
to `@lead` and work around it or stop.

Verified against the installed toolchain: **Astro 7.2.4**, Node 25.9.0, zod v4.

> **Amendment 2026-09-09 (@lead) — the klatech remodel.** The site stops being a
> single blog and becomes a personal site with two blogs. §2, §3, §4 and §7 are
> rewritten below; §1, §5 and §6 are unchanged. What changed and why:
>
> - The site is **klatech** (future domain `klatech.se`), not "Agent Blog".
> - The existing agent-written security blog moves from `/posts/` to `/agent-blog/`
>   and keeps its strict citation schema unchanged — that rule is the point of it.
> - A second blog, written by the site owner, lives at `/blog/` with its own,
>   deliberately looser collection. Old-blog imports land here later.
> - Components stop building URLs from slugs. Backend computes `href`; presentation
>   renders it. This is what makes a route move a backend-only change next time.

---

## 1. Astro 7 API facts (verified, do not guess)

```ts
import { defineCollection, getCollection, getEntry, render } from 'astro:content';
import { z } from 'astro/zod';        // preferred; `z` from 'astro:content' is deprecated in v7
import { glob } from 'astro/loaders';
```

- Content lives in `src/content/<collection>/*.md`, loaded by the `glob` loader.
- The entry `id` is the filename without extension. **`id` IS the slug.**
- Rendering is `const { Content, headings } = await render(entry);`
  — `entry.render()` no longer exists.

## 2. Content schemas — the interface between the content team and the app team

Defined in `src/content.config.ts` (owned by backend-dev). **Two collections.**

### 2a. `posts` — the agent blog (`/agent-blog/`). Unchanged, still strict.

| Field | Type | Rule |
|---|---|---|
| `title` | string | 10–70 chars |
| `description` | string | 70–160 chars (SEO meta description) |
| `pubDate` | date | `z.coerce.date()` |
| `updatedDate` | date, optional | |
| `verifiedDate` | date | **required** — "technically accurate as of" |
| `author` | string | defaults to `"Content Team"` |
| `category` | enum | `azure-network-security` \| `cloud-security` \| `ai-security` |
| `tags` | string[] | 1–5, lowercase-kebab |
| `draft` | boolean | defaults to `false` |
| `sources` | object[] | **min 2**, each `{ title, url, publisher, accessed }` |

`sources[].url` must be `z.url()`. `sources[].accessed` is `z.coerce.date()`.

> **Amendment 2026-08-19 (@lead):** originally specified as `z.string().url()`. `astro/zod`
> is zod 4, where that overload is deprecated in favor of the top-level `z.url()`.
> Reported by backend-dev; contract corrected rather than worked around.

Filename convention: `src/content/posts/<slug>.md`, slug lowercase-kebab.

**Why `verifiedDate` and `sources` are required:** this is a security blog. Azure
features, CVEs and service limits change fast, and unsourced technical claims are
where AI-written content fails hardest. The schema makes citation non-optional —
a post without two real sources fails the build.

### 2b. `personal` — the owner's blog (`/blog/`). New, deliberately looser.

Written by a human about whatever he likes, and the destination for imports from an
older blog. Requiring two citations on a post about a conference talk would be
theatre, so the strict fields are optional here — but they are the *same* fields, so
a personal post that does cite sources renders identically to an agent post.

| Field | Type | Rule |
|---|---|---|
| `title` | string | 10–70 chars |
| `description` | string | 20–160 chars (SEO meta description; shorter floor than `posts`) |
| `pubDate` | date | `z.coerce.date()` |
| `updatedDate` | date, optional | |
| `author` | string | defaults to `"Niklas Klasen"` |
| `tags` | string[] | 0–6, lowercase-kebab, defaults to `[]` |
| `draft` | boolean | defaults to `false` |
| `verifiedDate` | date, optional | |
| `sources` | object[], optional | same shape as `posts`; **min 1 when present** |
| `originalUrl` | string, optional | `z.url()` — canonical URL on the old blog, for imported posts |
| `category` | — | **not part of this schema.** Categories are an agent-blog taxonomy. |

Filename convention: `src/content/personal/<slug>.md`, slug lowercase-kebab.

Slugs must be unique **across both collections** — they share the `/tags/` namespace
and the combined feed, and a reader should never meet the same slug twice.

## 3. Layout props contract — the interface between backend-dev and frontend-dev

frontend-dev builds these components. backend-dev calls them from `src/pages/`.
Neither reads the other's directory.

**Hard rule: no file in `src/layouts/` or `src/components/` may import `astro:content`.**
Presentation receives props. Data access lives in `src/pages/`. QA asserts this with a grep test.

**Second hard rule, new in the klatech remodel: no file in `src/layouts/` or
`src/components/` may construct a post URL from a slug.** No `` `/posts/${slug}/` ``,
no `` `/blog/${slug}/` ``. Backend computes `href` and passes it. Two blogs share
these components; a component that hard-codes one blog's prefix is silently wrong
for the other, and a route move becomes a cross-team change. QA asserts this too.

**Exempt: `/tags/<tag>/`.** Tags are one namespace shared by both blogs, so
`` href={`/tags/${tag}/`} `` in a component is correct rather than merely tolerated —
there is no second variant it could be wrong for. The rule is about *post* URLs, whose
prefix depends on which blog the post came from. QA's test must target post URLs
specifically and must not flag the tag links in `PostCard.astro` or `PostLayout.astro`.

### `ArticleMeta` — the shared view-model
Backend maps a collection entry from **either** collection to exactly this before
passing it to any component:

```ts
type BlogKey = 'agent' | 'personal';

type PostCategory = 'azure-network-security' | 'cloud-security' | 'ai-security';

type PostSource = { title: string; url: string; publisher: string; accessed: Date };

type ArticleMeta = {
  blog: BlogKey;         // which blog this came from
  slug: string;          // the entry id
  href: string;          // the page's own path, e.g. '/agent-blog/<slug>/' — presentation uses THIS
  title: string;
  description: string;
  pubDate: Date;
  updatedDate?: Date;
  author: string;
  tags: string[];
  readingTime: number;   // whole minutes, computed by backend

  // Agent-blog fields. Always present when blog === 'agent'; optional on personal posts.
  category?: PostCategory;
  verifiedDate?: Date;
  sources?: PostSource[];

  // Personal-blog field.
  originalUrl?: string;  // 'originally published at' link for an imported post
};

/** An agent post: the same shape with the citation fields narrowed to required. */
type PostMeta = ArticleMeta & {
  blog: 'agent';
  category: PostCategory;
  verifiedDate: Date;
  sources: PostSource[];
};
```

`PostMeta` is retained so the agent blog keeps compile-time proof that its posts are
cited. Backend's `toPostMeta()` returns `PostMeta`; `toArticleMeta()` returns
`ArticleMeta`. Components type their props against `ArticleMeta` and render the
optional blocks conditionally — a `PostMeta` is assignable to it.

### Components frontend-dev must provide

| File | Props | Notes |
|---|---|---|
| `src/layouts/BaseLayout.astro` | `{ title: string; description: string; canonicalPath?: string; ogType?: string }` | full `<html>` shell, header, footer, `<slot />`, meta/OG tags |
| `src/layouts/PostLayout.astro` | `{ post: ArticleMeta; headings: MarkdownHeading[] }` | serves **both** blogs; wraps BaseLayout, renders title block, meta line, ToC, `<slot />` for the body. Renders the **Sources** section only when `post.sources` is non-empty, the **Verified** meta only when `post.verifiedDate` is set, the category kicker only when `post.category` is set, and an "originally published at" link when `post.originalUrl` is set |
| `src/components/PostCard.astro` | `{ post: ArticleMeta; showBlog?: boolean }` | list/index item; links to `post.href`. `showBlog` (default `false`) renders a badge naming which blog the post is from — used on `/`, `/tags/**` and any mixed list |
| `src/components/TagPill.astro` | `{ tag: string; href?: string }` | |
| `src/components/Hero.astro` | `{ title: string; tagline: string }` | landing-page masthead; `<slot />` for the intro paragraph(s) |
| `src/components/FeedSection.astro` | `{ heading: string; blurb?: string; posts: ArticleMeta[]; moreHref: string; moreLabel: string; empty?: string }` | one blog's latest posts on the landing page: `<h2>` heading, optional blurb, the cards, and a link to the blog's index. Renders `empty` (or a sensible default) when `posts` is empty |
| `src/components/ContactLinks.astro` | `{ links: ContactLink[]; heading?: string }` | renders §7 `CONTACT_LINKS`. An entry whose `href` is `null` is **not yet configured**: render it as plain muted text, never as a link — the site must not ship a dead or invented contact link. Used on `/about/` and in the footer |
| `src/components/SiteHeader.astro` | none | nav per §7 `NAV_LINKS`: Home, Agent Blog, Blog, Tags, About, plus `ThemeToggle` |
| `src/components/ThemeToggle.astro` | none | the §5 colour-scheme control. A real `<button type="button">` with an accessible name that states what it does; rendered by `SiteHeader`, never called from `src/pages/` |
| `src/components/SiteFooter.astro` | none | links both RSS feeds |

```ts
type ContactLink = { label: string; href: string | null };
```

`MarkdownHeading` is `import type { MarkdownHeading } from 'astro'`.

Two blogs sharing one `PostLayout` is deliberate: an unsourced personal post and a
cited security post should look like they belong to the same site, and one layout
cannot drift from the other.

## 4. Route map — owned by backend-dev

| Route | File |
|---|---|
| `/` | `src/pages/index.astro` — landing: hero, then the latest 3 agent posts and latest 3 personal posts |
| `/agent-blog/` | `src/pages/agent-blog/index.astro` — agent posts, newest first |
| `/agent-blog/<slug>/` | `src/pages/agent-blog/[...slug].astro` |
| `/blog/` | `src/pages/blog/index.astro` — personal posts, newest first |
| `/blog/<slug>/` | `src/pages/blog/[...slug].astro` |
| `/about/` | `src/pages/about.astro` |
| `/tags/` | `src/pages/tags/index.astro` — tags across **both** blogs |
| `/tags/<tag>/` | `src/pages/tags/[tag].astro` — posts from both blogs, badged |
| `/rss.xml` | `src/pages/rss.xml.ts` — **combined** feed, both blogs, newest first |
| `/agent-blog/rss.xml` | `src/pages/agent-blog/rss.xml.ts` — agent blog only |
| `/blog/rss.xml` | `src/pages/blog/rss.xml.ts` — personal blog only |
| `/404` | `src/pages/404.astro` |
| sitemap | `@astrojs/sitemap` integration in `astro.config.mjs` |

`src/pages/posts/**` is **deleted** in this remodel. Nothing is deployed yet, so no
redirect is owed to anyone; do not add one.

`site:` in `astro.config.mjs` must be set to `http://localhost:4321` for now (RSS and
sitemap both require it). It becomes `https://klatech.se` at deploy time, not before —
QA's suite pins the localhost value, and changing it is a lead decision.

Draft handling: exclude `draft: true` when `import.meta.env.PROD`, in **both** collections.

## 5. Design token contract — owned by frontend-dev

Declared in `src/styles/tokens.css` on `:root`. These names are fixed; QA asserts they exist.

```
--color-bg  --color-surface  --color-fg  --color-muted  --color-accent  --color-border
--font-sans  --font-mono
--space-1 --space-2 --space-3 --space-4 --space-5 --space-6
--measure          /* max reading width */
--radius
```

Dark mode via `@media (prefers-color-scheme: dark)` redefining tokens only.
Body must set an explicit background and color from tokens.

> **Amendment 2026-09-11 (@lead) — the theme toggle.** The site gains a control that
> lets a reader override the colour scheme. That needs a second mechanism alongside
> the media query, so §5 is extended — not replaced. The media query stays the
> **default**; an explicit choice overrides it. "Redefining tokens only" still holds:
> the new selectors redefine the same tokens and nothing else, and no component may
> branch on the colour scheme.
>
> The override is a `data-theme` attribute on the root element, with exactly three
> states: absent (follow the OS), `"light"`, `"dark"`. Each colour token is therefore
> declared in three places, and a palette written in only one of them is a defect:
>
> ```css
> :root                                   { /* light — the base palette */ }
> @media (prefers-color-scheme: dark) {
>   :root:not([data-theme="light"])       { /* dark by OS, unless overridden to light */ }
> }
> :root[data-theme="dark"]                { /* dark by choice, in either OS scheme */ }
> ```
>
> `color-scheme` follows the tokens in all three, so form controls and scrollbars
> match. **Every rule elsewhere that keys off `prefers-color-scheme` must gain the
> matching `[data-theme]` variant** — at the time of writing that is the Shiki
> code-block swap at `src/styles/global.css:491`, and missing it means code blocks
> render in the light palette inside a toggled-dark page, which is a contrast
> failure, not a cosmetic one.
>
> State lives in `localStorage` under the key `klatech-theme`, values `light` or
> `dark`; absent means follow the OS. It is applied by a small inline script in
> `BaseLayout`'s `<head>`, before first paint — a deferred script would flash the
> wrong theme. That script is the one place presentation may write to the DOM before
> the body renders.
>
> The control is progressive enhancement: with JavaScript off it does nothing, so it
> must not be visible then. Ship it hidden and let the script reveal it, the same way
> the table-scroll enhancement in `BaseLayout` already works. A visible control that
> cannot act is worse than no control.

Additional tokens may be added (there are already derived roles such as
`--color-accent-strong`). If the two blogs are distinguished by colour, that colour
is a token — e.g. `--color-accent-alt` — defined in **both** palettes, and it must
never be the only thing distinguishing them: the blog badge carries text.

## 6. Commands

```
npm run dev      # astro dev
npm run build    # astro build
npm run preview  # astro preview
npm run check    # astro check  (type + content schema validation)
npm run test     # vitest run   (qa)
npm run test:e2e # playwright test  (qa)
```

Dev server, per Astro 7: `npx astro dev --background`, managed with
`astro dev stop` / `astro dev status` / `astro dev logs`.

## 7. Site identity

Single source of truth: `src/lib/site.ts` (backend-dev). Frontend imports it rather
than declaring its own copy.

```
SITE_TITLE       = 'klatech'
SITE_TAGLINE     = 'Cloud security, AI security, and whatever else I am thinking about.'
SITE_URL         = 'http://localhost:4321'
```

> **Amendment 2026-09-09b (@lead):** `SITE_TAGLINE` is new. It lived in
> `src/components/site.ts` as `SITE.tagline` because §7 did not define one, with a
> comment saying it should move here if it ever became canonical. The klatech remodel
> made it canonical: it is now rendered in the footer, in the RSS `<link rel="alternate">`
> title, and as the landing-page hero tagline — three places across two ownership
> boundaries. QA found the resulting duplicate (report 2026-09-09 §3) and it is the same
> shape as the F2 divergence of 2026-08-20, so it is promoted rather than pinned by a test.
> `src/components/site.ts` re-exports it from `src/lib/site.ts` and declares no copy.

> **Amendment 2026-08-20 (@lead):** `SITE_DESCRIPTION` originally froze a placeholder
> string I wrote in Phase 0. backend-dev shipped a better one, QA caught the divergence
> (report 2026-08-20, F2). The contract is corrected to the shipped string rather than
> the code being reverted to the weaker placeholder — the contract was wrong, not the code.
>
> **Amendment 2026-09-09 (@lead):** the site is now klatech, a personal site containing
> two blogs. `SITE_TITLE` and `SITE_DESCRIPTION` describe the *site*; the string that
> used to be `SITE_DESCRIPTION` is now the agent blog's own description in `BLOGS` below,
> where it is still true. `SITE_URL` stays on localhost until deploy — see §4.

```
SITE_DESCRIPTION = 'The personal site of Niklas Klasen — an agent-written blog on Azure, cloud and AI security, plus a personal blog of my own.'
```

### The blog registry

Also exported from `src/lib/site.ts`. This is what makes "two blogs" data rather than
a pile of conditionals, and it is the only place a blog's path prefix is written down:

```ts
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
```

`href` in §3 is `BLOGS[blog].base + slug + '/'`. Nothing else may compute it.

### Contact links

Also exported from `src/lib/site.ts`.

```ts
/**
 * A `null` href renders as plain text rather than a link, so the site can carry a
 * contact entry it has no address for without ever shipping a dead link. All three
 * are live; setting one back to `null` returns it to plain-text rendering.
 */
export const CONTACT_LINKS = [
  { label: 'Email',    href: 'mailto:klasen.niklas@gmail.com' },
  { label: 'GitHub',   href: 'https://github.com/niklasklasen' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/niklasklasen/' },
] as const satisfies readonly { label: string; href: string | null }[];
```

> **Amendment 2026-09-09c (@lead):** the owner supplied the real addresses. All three
> entries were `href: null` placeholders from this morning until now. The `string | null`
> type stays — the null branch is the mechanism that lets an unset entry render as text,
> not a leftover of the placeholder state, and QA's `href="#"` sweep over `dist/` depends
> on it never being substituted with a dead link.

Rendering a `null` href as a live `<a>` — to `#`, to a guessed address, or to
anything else — is a contract violation. QA asserts that `dist/` contains no
`href="#"`.

### Navigation

`NAV_LINKS` lives with the presentation strings (`src/components/site.ts`) but its
shape is fixed here, in this order:

```
Home /   ·   Agent Blog /agent-blog/   ·   Blog /blog/   ·   Tags /tags/   ·   About /about/
```
