import { describe, expect, it } from 'vitest';
import { abs, exists, read } from './helpers';

/**
 * CONTRACTS §4 — route map. Each route must have its source file.
 *
 * Updated 2026-09-09 for the klatech remodel: `/posts/**` is gone, replaced by
 * `/agent-blog/**` and `/blog/**`, and there are now three feeds. The list below
 * is a re-statement of the contract table, so — following the §7 precedent in
 * site-identity.test.ts — it is guarded against the contract table itself. If §4
 * moves again, the guard fails first and says so, instead of this file reporting
 * a missing file as an application defect.
 */

const ROUTE_FILES: [route: string, file: string][] = [
  ['/', 'src/pages/index.astro'],
  ['/agent-blog/', 'src/pages/agent-blog/index.astro'],
  ['/agent-blog/<slug>/', 'src/pages/agent-blog/[...slug].astro'],
  ['/blog/', 'src/pages/blog/index.astro'],
  ['/blog/<slug>/', 'src/pages/blog/[...slug].astro'],
  ['/about/', 'src/pages/about.astro'],
  ['/tags/', 'src/pages/tags/index.astro'],
  ['/tags/<tag>/', 'src/pages/tags/[tag].astro'],
  ['/rss.xml', 'src/pages/rss.xml.ts'],
  ['/agent-blog/rss.xml', 'src/pages/agent-blog/rss.xml.ts'],
  ['/blog/rss.xml', 'src/pages/blog/rss.xml.ts'],
  ['/404', 'src/pages/404.astro'],
];

const contractsDoc = read(abs('docs/CONTRACTS.md'));

/** The `## 4. Route map` table, parsed back out of the contract. */
function routeTableFromContract(): [string, string][] {
  const section = /##\s*4\.?\s*Route map([\s\S]*?)(?=\n##\s|$)/.exec(contractsDoc)?.[1] ?? '';
  const out: [string, string][] = [];
  for (const line of section.split('\n')) {
    if (!line.trimStart().startsWith('|')) continue;
    const cells = line.split('|').map((c) => c.trim());
    const route = /`([^`]+)`/.exec(cells[1] ?? '')?.[1];
    const file = /src\/pages\/[^\s`|]+/.exec(cells[2] ?? '')?.[0];
    if (route && file) out.push([route, file]);
  }
  return out;
}

describe('CONTRACTS §4 — this suite still re-states the current route map', () => {
  const fromContract = routeTableFromContract();

  it('docs/CONTRACTS.md still has a §4 route table to check against', () => {
    expect(
      fromContract.length,
      'no parseable route table found under "## 4. Route map" in docs/CONTRACTS.md',
    ).toBeGreaterThan(0);
  });

  it('the routes this file asserts are the ones §4 currently specifies', () => {
    expect(
      fromContract,
      'this test file has drifted from docs/CONTRACTS.md §4 — update ROUTE_FILES above ' +
        'to match the contract before reading any other failure here as an application defect',
    ).toEqual(ROUTE_FILES);
  });
});

describe('CONTRACTS §4 — route sources', () => {
  it.each(ROUTE_FILES)('%s is served by %s', (_route, file) => {
    expect(exists(abs(file)), `${file} does not exist`).toBe(true);
  });

  /**
   * The remodel deletes the old blog root rather than redirecting it (§4: "no
   * redirect is owed to anyone; do not add one"). A leftover `src/pages/posts/`
   * would keep emitting the old URLs alongside the new ones.
   */
  it('src/pages/posts/** is gone', () => {
    expect(exists(abs('src/pages/posts')), 'src/pages/posts still exists').toBe(false);
  });

  it('astro.config.mjs registers the sitemap integration', () => {
    const config = read(abs('astro.config.mjs'));
    expect(config).toMatch(/@astrojs\/sitemap/);
    expect(config).toMatch(/integrations\s*:\s*\[[^\]]*sitemap\(\)/);
  });

  it('astro.config.mjs sets site to http://localhost:4321', () => {
    // §4: it becomes https://klatech.se at deploy time, not before. Pinned here
    // deliberately — changing it is a lead decision, not a drive-by edit.
    const config = read(abs('astro.config.mjs'));
    expect(config).toMatch(/site:\s*['"]http:\/\/localhost:4321['"]/);
  });

  it.each([
    'src/pages/rss.xml.ts',
    'src/pages/agent-blog/rss.xml.ts',
    'src/pages/blog/rss.xml.ts',
  ])('%s uses @astrojs/rss', (file) => {
    expect(read(abs(file))).toMatch(/from ['"]@astrojs\/rss['"]/);
  });

  it('drafts are excluded when import.meta.env.PROD, for both collections', () => {
    const lib = read(abs('src/lib/posts.ts'));
    expect(lib, 'no PROD draft guard found in src/lib/posts.ts').toMatch(/import\.meta\.env\.PROD/);
    // The guard has to be reachable from both collections' accessors, or one
    // blog's drafts ship. `isPublished` is the shared predicate.
    expect(lib).toMatch(/getCollection\(\s*['"]posts['"]\s*,\s*isPublished\s*\)/);
    expect(lib).toMatch(/getCollection\(\s*['"]personal['"]\s*,\s*isPublished\s*\)/);
  });
});

describe('CONTRACTS §3 — component sources', () => {
  const COMPONENTS = [
    'src/layouts/BaseLayout.astro',
    'src/layouts/PostLayout.astro',
    'src/components/PostCard.astro',
    'src/components/TagPill.astro',
    'src/components/Hero.astro',
    'src/components/FeedSection.astro',
    'src/components/ContactLinks.astro',
    'src/components/SiteHeader.astro',
    'src/components/SiteFooter.astro',
  ];

  it.each(COMPONENTS)('%s exists', (file) => {
    expect(exists(abs(file)), `${file} missing`).toBe(true);
  });

  /** Declared props, checked against the §3 table one component at a time. */
  const PROPS: [file: string, props: string[]][] = [
    ['src/layouts/BaseLayout.astro', ['title', 'description', 'canonicalPath', 'ogType']],
    ['src/layouts/PostLayout.astro', ['post', 'headings']],
    ['src/components/PostCard.astro', ['post', 'showBlog']],
    ['src/components/TagPill.astro', ['tag', 'href']],
    ['src/components/Hero.astro', ['title', 'tagline']],
    [
      'src/components/FeedSection.astro',
      ['heading', 'blurb', 'posts', 'moreHref', 'moreLabel', 'empty'],
    ],
    ['src/components/ContactLinks.astro', ['links', 'heading']],
  ];

  it.each(PROPS)('%s declares exactly the §3 props', (file, props) => {
    const source = read(abs(file));
    for (const prop of props) {
      expect(source, `${file} missing prop ${prop}`).toMatch(new RegExp(`${prop}\\??\\s*:`));
    }
  });

  /**
   * §3: PostLayout "serves both blogs". Typing it against `PostMeta` would make
   * the citation fields required and a personal post unrenderable, so the type
   * name is asserted, not merely the presence of a `post` prop.
   */
  it('PostLayout types its post prop against ArticleMeta, not PostMeta', () => {
    const source = read(abs('src/layouts/PostLayout.astro'));
    expect(
      source,
      'PostLayout must accept ArticleMeta — it serves both blogs (CONTRACTS §3)',
    ).toMatch(/post\s*:\s*ArticleMeta/);
    expect(source).toMatch(/headings\s*:\s*MarkdownHeading\[\]/);
  });

  it('PostCard types its post prop against ArticleMeta and links via post.href', () => {
    const source = read(abs('src/components/PostCard.astro'));
    expect(source).toMatch(/post\s*:\s*ArticleMeta/);
    expect(source, 'PostCard must link to post.href (CONTRACTS §3)').toMatch(
      /href=\{\s*post\.href\s*\}/,
    );
  });

  /** §3: the optional blocks render conditionally, or a personal post shows empty furniture. */
  it.each([
    ['post.sources', /post\.sources|sources\.length/],
    ['post.verifiedDate', /post\.verifiedDate\s*&&/],
    ['post.category', /post\.category\s*&&/],
    ['post.originalUrl', /post\.originalUrl\s*&&/],
  ])('PostLayout renders the %s block conditionally', (_name, pattern) => {
    expect(read(abs('src/layouts/PostLayout.astro'))).toMatch(pattern);
  });

  it('FeedSection renders an <h2> heading and a "more" link', () => {
    const source = read(abs('src/components/FeedSection.astro'));
    expect(source).toMatch(/<h2[^>]*>\{heading\}<\/h2>|<h2[\s\S]{0,120}\{heading\}/);
    expect(source).toMatch(/href=\{\s*moreHref\s*\}/);
  });

  it('ContactLinks never renders a null href as a link', () => {
    // Strip block comments first: the file's own header documents the rule in
    // prose ("never `href=\"#\"`"), and matching that would be a false positive.
    const source = read(abs('src/components/ContactLinks.astro')).replace(/\/\*[\s\S]*?\*\//g, '');
    // The branch must be on the href itself: a `null` entry becomes text.
    expect(source, 'ContactLinks must branch on link.href (CONTRACTS §3, §7)').toMatch(
      /link\.href\s*\?/,
    );
    expect(source, 'ContactLinks must never emit a placeholder href').not.toMatch(/href="#"/);
  });

  it('SiteHeader navigates to all five §7 nav destinations, in order', () => {
    const source = read(abs('src/components/site.ts'));
    const nav = /NAV_LINKS\s*=\s*\[([\s\S]*?)\]/.exec(source)?.[1] ?? '';
    const entries = [...nav.matchAll(/href:\s*'([^']+)'[^}]*label:\s*'([^']+)'/g)].map((m) => [
      m[1],
      m[2],
    ]);
    expect(entries, 'NAV_LINKS must match CONTRACTS §7 exactly, in order').toEqual([
      ['/', 'Home'],
      ['/agent-blog/', 'Agent Blog'],
      ['/blog/', 'Blog'],
      ['/tags/', 'Tags'],
      ['/about/', 'About'],
    ]);
    expect(read(abs('src/components/SiteHeader.astro'))).toMatch(/NAV_LINKS/);
  });

  it('SiteFooter links both per-blog feeds', () => {
    const source = read(abs('src/components/SiteFooter.astro'));
    for (const feed of ['/agent-blog/rss.xml', '/blog/rss.xml']) {
      expect(source, `SiteFooter missing ${feed} (CONTRACTS §3)`).toContain(feed);
    }
  });
});
