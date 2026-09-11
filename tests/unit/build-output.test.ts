import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
// NOTE: `XMLValidator` is marked @deprecated in fast-xml-parser 5.11 in favour of
// the separate `fast-xml-validator` package, which is not installed and which QA
// cannot install. It is retained deliberately — it is the only well-formedness
// check available here, and a deprecated-but-working assertion is worth more than
// no assertion. This is the source of the remaining `astro check` hints; they are
// hints, not errors, and they are confined to this line's usages.
// See also the ticket to @lead: neither `fast-xml-parser` nor `js-yaml` is a
// declared dependency; both resolve only by hoisting from astro / @astrojs/rss.
import { XMLValidator, XMLParser } from 'fast-xml-parser';
import { abs, exists, read, splitFrontmatter, walk, rel } from './helpers';

/**
 * CONTRACTS §4 — what the build must actually emit.
 *
 * Rewritten 2026-09-09 for the klatech remodel: two collections, two blog roots,
 * three feeds. The expected file list is derived from the markdown on disk plus
 * the §7 blog registry's `base`, so adding a post does not require editing this
 * file — but moving a route does, and should.
 */

const SITE = 'http://localhost:4321';

type Entry = {
  blog: 'agent' | 'personal';
  base: string;
  slug: string;
  tags: string[];
  draft: boolean;
  title: string;
  description: string;
  sources: { url: string }[];
  data: Record<string, unknown>;
};

function load(dir: string, blog: 'agent' | 'personal', base: string): Entry[] {
  return walk(abs(dir), (p) => p.endsWith('.md')).map((file) => {
    const data = yaml.load(splitFrontmatter(read(file)).frontmatter) as Record<string, unknown>;
    return {
      blog,
      base,
      slug: rel(file).replace(/^.*\//, '').replace(/\.md$/, ''),
      tags: (data.tags ?? []) as string[],
      draft: data.draft === true,
      title: String(data.title),
      description: String(data.description),
      sources: (data.sources ?? []) as { url: string }[],
      data,
    };
  });
}

const entries = [
  ...load('src/content/posts', 'agent', '/agent-blog/'),
  ...load('src/content/personal', 'personal', '/blog/'),
];

const published = entries.filter((e) => !e.draft);
const publishedAgent = published.filter((e) => e.blog === 'agent');
const publishedPersonal = published.filter((e) => e.blog === 'personal');
const allTags = [...new Set(published.flatMap((p) => p.tags))].sort();

const pagePath = (e: Entry) => `${e.base}${e.slug}/`;
const distPath = (e: Entry) => `dist${pagePath(e)}index.html`;

const expectedHtml = [
  'dist/index.html',
  'dist/about/index.html',
  'dist/404.html',
  'dist/tags/index.html',
  'dist/agent-blog/index.html',
  'dist/blog/index.html',
  ...published.map(distPath),
  ...allTags.map((tag) => `dist/tags/${tag}/index.html`),
];

const FEEDS = [
  { name: 'combined', file: 'dist/rss.xml', entries: published },
  { name: 'agent blog', file: 'dist/agent-blog/rss.xml', entries: publishedAgent },
  { name: 'personal blog', file: 'dist/blog/rss.xml', entries: publishedPersonal },
] as const;

const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * §7's CONTACT_LINKS, read out of docs/CONTRACTS.md rather than out of the app,
 * so this file checks the build against the contract and not against itself.
 * `href` is `null` for a not-yet-configured entry.
 */
function contactLinksFromContract(): [string, string | null][] {
  const doc = read(abs('docs/CONTRACTS.md'));
  const section = /##\s*7\.?\s*Site identity([\s\S]*?)(?=\n##\s|$)/.exec(doc)?.[1] ?? '';
  const block = /CONTACT_LINKS\s*=\s*\[([\s\S]*?)\]\s*as const/.exec(section)?.[1] ?? '';
  return [...block.matchAll(/label:\s*'([^']+)'\s*,\s*href:\s*(?:'([^']*)'|(null))/g)].map(
    (m) => [m[1], m[3] === 'null' ? null : m[2]] as [string, string | null],
  );
}

const parse = (xml: string) => new XMLParser({ ignoreAttributes: false }).parse(xml);
const itemsOf = (xml: string) => {
  const raw = parse(xml).rss?.channel?.item;
  return (Array.isArray(raw) ? raw : raw ? [raw] : []) as { link: string; title: string; pubDate: string }[];
};

describe('build output — expected files', () => {
  it('there is content in both collections to build from', () => {
    expect(publishedAgent.length, 'no published agent posts').toBeGreaterThan(0);
    expect(publishedPersonal.length, 'no published personal posts').toBeGreaterThan(0);
  });

  it.each(expectedHtml)('%s exists', (file) => {
    expect(exists(abs(file)), `${file} was not emitted; run npm run build`).toBe(true);
  });

  it.each([
    'dist/rss.xml',
    'dist/agent-blog/rss.xml',
    'dist/blog/rss.xml',
    'dist/sitemap-index.xml',
    'dist/sitemap-0.xml',
  ])('%s exists', (file) => {
    expect(exists(abs(file)), `${file} was not emitted`).toBe(true);
  });

  it('drafts are not emitted in the production build (either collection)', () => {
    const leaked = entries.filter((e) => e.draft && exists(abs(distPath(e))));
    expect(leaked.map(pagePath), 'a draft leaked into dist/').toEqual([]);
  });

  /**
   * §4: "src/pages/posts/** is deleted in this remodel. Nothing is deployed yet,
   * so no redirect is owed to anyone; do not add one." A surviving /posts/ page
   * would mean the same post is reachable at two URLs with two canonicals.
   */
  it('no /posts/ directory survives in dist/', () => {
    expect(exists(abs('dist/posts')), 'dist/posts/ still exists').toBe(false);
  });
});

describe('the old /posts/ URL space is gone from the build', () => {
  const htmlFiles = walk(abs('dist'), (p) => p.endsWith('.html'));
  const xmlFiles = walk(abs('dist'), (p) => p.endsWith('.xml'));

  it('the build emitted pages to check', () => {
    expect(htmlFiles.length).toBeGreaterThan(0);
  });

  /**
   * Deliberately scoped to *links*, not to the string `/posts/`. The colophon
   * post discusses `src/content/posts/` in prose inside a <code> element; that is
   * the source directory, not a URL, and flagging it would be a false positive
   * that trains people to ignore this test.
   */
  it.each(htmlFiles.map((f) => [rel(f), f] as const))(
    '%s links to no /posts/ URL',
    (name, file) => {
      const html = read(file);
      const hits = [
        ...html.matchAll(/(?:href|src)="((?:https?:\/\/[^"/]+)?\/posts\/[^"]*)"/g),
      ].map((m) => m[1]);
      expect(hits, `${name} still links into the deleted /posts/ route space`).toEqual([]);
    },
  );

  it.each(xmlFiles.map((f) => [rel(f), f] as const))('%s references no /posts/ URL', (name, file) => {
    const hits = [...read(file).matchAll(/https?:\/\/[^<"\s]*\/posts\/[^<"\s]*/g)].map((m) => m[0]);
    expect(hits, `${name} still advertises the deleted /posts/ route space`).toEqual([]);
  });
});

/**
 * CONTRACTS §7: "Rendering a `null` href as a live <a> — to `#`, to a guessed
 * address, or to anything else — is a contract violation. QA asserts that dist/
 * contains no href="#"."
 *
 * The sweep below is unchanged by amendment 2026-09-09c and must stay exactly as
 * strict: it is the invariant, not a check on the placeholder state. What changed
 * is only which branch the live data takes. The `null` -> plain-text branch is now
 * covered by fixture in tests/component/contact-links.test.ts, because no entry in
 * the build exercises it any more.
 */
describe('CONTRACTS §7 — the build ships no dead links', () => {
  const htmlFiles = walk(abs('dist'), (p) => p.endsWith('.html'));

  it.each(htmlFiles.map((f) => [rel(f), f] as const))(
    '%s contains no href="#", no empty href and no javascript: href',
    (name, file) => {
      const hits = [...read(file).matchAll(/href="(?:#|javascript:[^"]*|)"/g)].map((m) => m[0]);
      expect(hits, `${name} ships a dead placeholder link`).toEqual([]);
    },
  );

  it.each(htmlFiles.map((f) => [rel(f), f] as const))(
    '%s has no anchor without a target',
    (name, file) => {
      // `<a>` with no href at all, or with a literal null/undefined leaked from a
      // template — the other shapes a not-configured entry could wrongly take.
      const hits = [
        ...read(file).matchAll(/<a\b(?![^>]*\bhref=)[^>]*>/g),
        ...read(file).matchAll(/href="(?:null|undefined)"/g),
      ].map((m) => m[0]);
      expect(hits, `${name} has an anchor with no usable target`).toEqual([]);
    },
  );
});

/**
 * §7's contact links, as they reach the reader. `ContactLinks` is used on
 * `/about/` and in the footer (§3), so every page carries the footer copy.
 */
describe('CONTRACTS §7 — contact links render as the addresses the contract declares', () => {
  const CONTACTS = contactLinksFromContract();

  it('§7 still declares contact links to check', () => {
    expect(CONTACTS.length, 'no CONTACT_LINKS block parsed out of docs/CONTRACTS.md §7')
      .toBeGreaterThan(0);
  });

  it.each([
    ['/about/', 'dist/about/index.html'],
    ['the footer (sampled on /)', 'dist/index.html'],
  ])('%s renders each entry on the branch its href implies', (_where, file) => {
    const html = read(abs(file));
    for (const [label, href] of CONTACTS) {
      expect(html, `${file} does not mention ${label}`).toContain(label);
      const asLink = new RegExp(`<a[^>]*href="${escapeRe(href ?? '')}"[^>]*>\\s*${label}\\s*</a>`);
      const asText = new RegExp(
        `<span[^>]*contact-links__pending[^>]*>\\s*${label}\\s*</span>`,
      );
      if (href === null) {
        expect(
          asText.test(html),
          `${label} has href: null in §7 but ${file} does not render it as plain text`,
        ).toBe(true);
        expect(
          new RegExp(`<a[^>]*>\\s*${label}\\s*</a>`).test(html),
          `${label} has href: null in §7 but ${file} renders it as a link`,
        ).toBe(false);
      } else {
        expect(
          asLink.test(html),
          `${file} does not render ${label} as a link to ${href}`,
        ).toBe(true);
      }
    }
  });

  it('every mailto: in the build is an address §7 declares', () => {
    const declared = new Set(
      CONTACTS.map(([, href]) => href).filter((h): h is string => !!h && h.startsWith('mailto:')),
    );
    const found = new Set<string>();
    for (const file of walk(abs('dist'), (p) => p.endsWith('.html'))) {
      for (const m of read(file).matchAll(/href="(mailto:[^"]*)"/g)) found.add(m[1]);
    }
    expect(
      [...found].filter((h) => !declared.has(h)),
      'the build contains an email address that CONTRACTS §7 does not declare',
    ).toEqual([]);
  });
});

describe.each(FEEDS)('$file', (feed) => {
  const xml = exists(abs(feed.file)) ? read(abs(feed.file)) : '';

  it('is well-formed XML', () => {
    expect(xml.length, `${feed.file} missing`).toBeGreaterThan(0);
    const result = XMLValidator.validate(xml);
    expect(result, `${feed.file} is not well-formed: ${JSON.stringify(result)}`).toBe(true);
  });

  it('is an RSS 2.0 document with a channel', () => {
    const parsed = parse(xml);
    expect(parsed.rss, 'no <rss> root').toBeDefined();
    expect(parsed.rss['@_version']).toBe('2.0');
    expect(parsed.rss.channel.title).toBeTruthy();
    expect(parsed.rss.channel.description).toBeTruthy();
    expect(String(parsed.rss.channel.link)).toMatch(/^https?:\/\//);
  });

  it('carries one absolute-linked item per published post in its scope', () => {
    const items = itemsOf(xml);
    expect(
      items.map((i) => i.link).sort(),
      `${feed.name} feed does not match the published set`,
    ).toEqual(feed.entries.map((e) => `${SITE}${pagePath(e)}`).sort());
    for (const item of items) {
      expect(item.title).toBeTruthy();
      expect(item.pubDate).toBeTruthy();
    }
  });

  it('is sorted newest first', () => {
    const dates = itemsOf(xml).map((i) => new Date(i.pubDate).valueOf());
    expect(dates, `${feed.name} feed is not newest-first`).toEqual(
      [...dates].sort((a, b) => b - a),
    );
  });
});

/**
 * The remodel's specific feed risk: three feeds that all quietly carry the same
 * items, or a combined feed that only picked up one collection.
 */
describe('/rss.xml is genuinely combined', () => {
  const combined = itemsOf(read(abs('dist/rss.xml'))).map((i) => i.link);

  it('contains at least one item from each blog', () => {
    expect(
      combined.filter((l) => l.includes('/agent-blog/')).length,
      'no agent-blog item in the combined feed',
    ).toBeGreaterThan(0);
    expect(
      combined.filter((l) => l.includes('/blog/') && !l.includes('/agent-blog/')).length,
      'no personal-blog item in the combined feed',
    ).toBeGreaterThan(0);
  });

  it('is the union of the two per-blog feeds, exactly', () => {
    const agent = itemsOf(read(abs('dist/agent-blog/rss.xml'))).map((i) => i.link);
    const personal = itemsOf(read(abs('dist/blog/rss.xml'))).map((i) => i.link);
    expect(combined.slice().sort()).toEqual([...agent, ...personal].sort());
  });

  it('each per-blog feed is restricted to its own blog', () => {
    const agent = itemsOf(read(abs('dist/agent-blog/rss.xml'))).map((i) => i.link);
    const personal = itemsOf(read(abs('dist/blog/rss.xml'))).map((i) => i.link);
    expect(agent.filter((l) => !l.startsWith(`${SITE}/agent-blog/`))).toEqual([]);
    expect(personal.filter((l) => !l.startsWith(`${SITE}/blog/`))).toEqual([]);
  });
});

describe('sitemap', () => {
  const index = read(abs('dist/sitemap-index.xml'));
  const urlset = read(abs('dist/sitemap-0.xml'));

  it('both sitemap documents are well-formed XML', () => {
    expect(XMLValidator.validate(index)).toBe(true);
    expect(XMLValidator.validate(urlset)).toBe(true);
  });

  it('lists the home page and every published post from both blogs', () => {
    expect(urlset).toContain(`${SITE}/`);
    for (const post of published) {
      expect(urlset, `sitemap missing ${pagePath(post)}`).toContain(`${SITE}${pagePath(post)}`);
    }
  });

  it('lists both blog index pages', () => {
    for (const base of ['/agent-blog/', '/blog/']) {
      expect(urlset, `sitemap missing ${base}`).toContain(`${SITE}${base}`);
    }
  });

  it('does not advertise the 404 page', () => {
    expect(urlset).not.toContain('/404');
  });
});

describe('emitted HTML — head metadata', () => {
  const pages = expectedHtml.filter((f) => exists(abs(f)));

  it.each(pages)('%s has exactly one <h1>', (file) => {
    const html = read(abs(file));
    const count = (html.match(/<h1[\s>]/g) ?? []).length;
    expect(count, `${file} has ${count} h1 elements`).toBe(1);
  });

  it.each(pages)('%s has a non-empty meta description', (file) => {
    const html = read(abs(file));
    const description = /<meta name="description" content="([^"]*)"/.exec(html)?.[1];
    expect(description, `${file} has no meta description`).toBeTruthy();
  });

  it.each(pages)('%s has a canonical link', (file) => {
    expect(read(abs(file)), `${file} has no canonical`).toMatch(/<link rel="canonical" href="/);
  });

  it.each(pages)('%s declares lang on <html>', (file) => {
    expect(read(abs(file))).toMatch(/<html[^>]*\slang="[^"]+"/);
  });

  it('every agent post page renders every source as a real link', () => {
    for (const post of publishedAgent) {
      const html = read(abs(distPath(post)));
      expect(html, `${pagePath(post)} has no Sources section`).toContain('Sources');
      for (const { url } of post.sources) {
        expect(html, `${pagePath(post)} missing source link ${url}`).toContain(`href="${url}"`);
      }
    }
  });
});

describe('internal fragment links', () => {
  // linkinator validates URLs, not `#fragment` targets. A ToC entry pointing at
  // a heading id that the renderer never emitted is a broken internal link that
  // a crawler reports as 200.
  const pages = expectedHtml.filter((f) => exists(abs(f)));

  it.each(pages)('%s — every #fragment href has a matching id', (file) => {
    const html = read(abs(file));
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const fragments = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    const broken = fragments.filter((f) => !ids.has(decodeURIComponent(f)));
    expect(broken, `${file} links to missing ids: ${broken.join(', ')}`).toEqual([]);
  });
});
