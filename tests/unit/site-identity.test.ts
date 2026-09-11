import { describe, expect, it } from 'vitest';
import { abs, exists, read, rel, walk } from './helpers';

/**
 * CONTRACTS §7 — site identity.
 *
 * "Single source of truth: src/lib/site.ts (backend-dev). Frontend imports it
 * rather than declaring its own copy."
 */

const CONTRACT_TITLE = 'klatech';

/**
 * Amended by @lead on 2026-08-20 (see CONTRACTS §7): the frozen placeholder was
 * replaced with the string backend-dev had shipped, because the contract was
 * wrong and the code was right. This suite re-states the contract rather than
 * importing the app's own constant — see vitest.config.ts — so the re-statement
 * is guarded below against docs/CONTRACTS.md itself, which is what stops this
 * literal going stale the next time §7 is amended.
 *
 * Amended again 2026-09-09 (the klatech remodel): the site is now klatech and
 * SITE_DESCRIPTION describes the site rather than the agent blog. The old string
 * lives on as BLOGS.agent.description and is asserted in that form below. The
 * guard worked exactly as designed — on the first run after the remodel the only
 * red in this file was "this test file has drifted from docs/CONTRACTS.md §7".
 */
const CONTRACT_DESCRIPTION =
  'The personal site of Niklas Klasen — an agent-written blog on Azure, cloud and AI security, plus a personal blog of my own.';

/** §7's blog registry, re-stated. Guarded against the contract block below. */
const CONTRACT_BLOGS = {
  agent: {
    collection: 'posts',
    title: 'Agent Blog',
    navLabel: 'Agent Blog',
    base: '/agent-blog/',
    rss: '/agent-blog/rss.xml',
  },
  personal: {
    collection: 'personal',
    title: 'Blog',
    navLabel: 'Blog',
    base: '/blog/',
    rss: '/blog/rss.xml',
  },
} as const;

/**
 * §7's tagline. New in amendment 2026-09-09b: it used to live in
 * `src/components/site.ts` as `SITE.tagline`, which QA reported as a duplicate
 * identity string (report 2026-09-09 §3). @lead promoted it to §7 rather than
 * pinning the duplicate with a test, so it is now guarded like the others.
 */
const CONTRACT_TAGLINE = 'Cloud security, AI security, and whatever else I am thinking about.';

/**
 * §7's contact links, label and href, in order.
 *
 * Amendment 2026-09-09c: all three shipped as `href: null` placeholders until the
 * owner supplied real addresses. The `string | null` type stays, and so does the
 * meaning of `null` — an entry the site has no address for renders as plain text.
 * That branch no longer has a live example, so it is covered by fixture in
 * tests/component/contact-links.test.ts. What is asserted *here* is only the
 * thing §7 actually declares today.
 */
const CONTRACT_CONTACT_LINKS: [label: string, href: string | null][] = [
  ['Email', 'mailto:klasen.niklas@gmail.com'],
  ['GitHub', 'https://github.com/niklasklasen'],
  ['LinkedIn', 'https://www.linkedin.com/in/niklasklasen/'],
];

const libSite = read(abs('src/lib/site.ts'));
const contractsDoc = read(abs('docs/CONTRACTS.md'));
const section = /##\s*7\.?\s*Site identity([\s\S]*?)(?=\n##\s|$)/.exec(contractsDoc)?.[1] ?? '';

function constant(source: string, name: string): string | undefined {
  const match = new RegExp(
    `export const ${name}\\s*(?::[^=]*)?=\\s*\\r?\\n?\\s*(['"\`])([\\s\\S]*?)\\1`,
  ).exec(source);
  return match?.[2];
}

/** Every `key: 'value'` pair inside a named object literal, flattened per blog. */
function blogRegistry(source: string): Record<string, Record<string, string>> {
  const body = /BLOGS\s*=\s*\{([\s\S]*?)\n\}\s*as const/.exec(source)?.[1] ?? '';
  const out: Record<string, Record<string, string>> = {};
  for (const match of body.matchAll(/(\w+):\s*\{([\s\S]*?)\n\s{2}\}/g)) {
    const fields: Record<string, string> = {};
    for (const pair of match[2].matchAll(/(\w+):\s*\r?\n?\s*'([^']*)'/g)) {
      fields[pair[1]] = pair[2];
    }
    out[match[1]] = fields;
  }
  return out;
}

/**
 * Every `{ label, href }` pair in a `CONTACT_LINKS` array literal, in order.
 * `href` comes back as `null` for the not-configured form and as the string
 * otherwise, so the same parser reads the contract and the shipped module.
 */
function contactLinks(source: string): [string, string | null][] {
  const block = /CONTACT_LINKS\s*=\s*\[([\s\S]*?)\]\s*as const/.exec(source)?.[1] ?? '';
  return [...block.matchAll(/label:\s*'([^']+)'\s*,\s*href:\s*(?:'([^']*)'|(null))/g)].map(
    (m) => [m[1], m[3] === 'null' ? null : m[2]] as [string, string | null],
  );
}

const pick = (blog: Record<string, string> | undefined, keys: readonly string[]) =>
  Object.fromEntries(keys.map((k) => [k, blog?.[k]]));

/** Every source file under src/pages, relative to the repo root. */
const pagesFiles = walk(abs('src/pages'), (p) => /\.(astro|ts)$/.test(p)).map(rel);

describe('CONTRACTS §7 — this suite still re-states the current contract', () => {
  /**
   * Guards the QA suite against itself. On 2026-08-20 §7 was amended and this
   * file was not, so the only red test in the unit suite was a stale QA
   * assertion rather than a real defect. These assertions turn that class of
   * staleness into a self-describing failure.
   */
  it('docs/CONTRACTS.md still has a §7 to check against', () => {
    expect(
      section.length,
      'no "## 7. Site identity" section found in docs/CONTRACTS.md',
    ).toBeGreaterThan(0);
  });

  it('the constants this file asserts are the ones §7 currently specifies', () => {
    const declared = (name: string) =>
      new RegExp(`${name}\\s*=\\s*(['"\`])([\\s\\S]*?)\\1`).exec(section)?.[2];
    expect(
      { SITE_TITLE: declared('SITE_TITLE'), SITE_DESCRIPTION: declared('SITE_DESCRIPTION') },
      'this test file has drifted from docs/CONTRACTS.md §7 — update the CONTRACT_* ' +
        'literals above to match the contract before reading any other failure here ' +
        'as an application defect',
    ).toEqual({ SITE_TITLE: CONTRACT_TITLE, SITE_DESCRIPTION: CONTRACT_DESCRIPTION });
  });

  it('the blog registry this file asserts is the one §7 currently specifies', () => {
    const fromContract = blogRegistry(section);
    const keys = Object.keys(CONTRACT_BLOGS.agent);
    expect(
      {
        agent: pick(fromContract.agent, keys),
        personal: pick(fromContract.personal, keys),
      },
      'this test file has drifted from the BLOGS block in docs/CONTRACTS.md §7 — ' +
        'update CONTRACT_BLOGS above before reading any failure below as an application defect',
    ).toEqual(CONTRACT_BLOGS);
  });

  it('the contact links this file asserts are the ones §7 currently specifies', () => {
    // Label AND href, not just the labels: on 2026-09-09c the labels did not
    // move and the hrefs did, and a labels-only guard would have stayed green
    // through it while the assertions below went red for the wrong reason.
    expect(
      contactLinks(section),
      'this test file has drifted from the CONTACT_LINKS block in docs/CONTRACTS.md §7 — ' +
        'update CONTRACT_CONTACT_LINKS above before reading any failure below as an ' +
        'application defect. If an href moved to or from `null`, check that ' +
        'tests/component/contact-links.test.ts still covers the branch that lost its ' +
        'live example.',
    ).toEqual(CONTRACT_CONTACT_LINKS);
  });

  it('the tagline this file asserts is the one §7 currently specifies', () => {
    const declared = /SITE_TAGLINE\s*=\s*'([^']*)'/.exec(section)?.[1];
    expect(
      declared,
      'this test file has drifted from docs/CONTRACTS.md §7 — update CONTRACT_TAGLINE',
    ).toBe(CONTRACT_TAGLINE);
  });
});

describe('CONTRACTS §7 — the declared source of truth', () => {
  it('src/lib/site.ts exports SITE_TITLE exactly as the contract states', () => {
    expect(constant(libSite, 'SITE_TITLE')).toBe(CONTRACT_TITLE);
  });

  it('src/lib/site.ts exports SITE_DESCRIPTION exactly as the contract states', () => {
    expect(constant(libSite, 'SITE_DESCRIPTION')).toBe(CONTRACT_DESCRIPTION);
  });

  it('src/lib/site.ts exports SITE_URL as the localhost value §4 pins', () => {
    expect(constant(libSite, 'SITE_URL')).toBe('http://localhost:4321');
  });

  it('src/lib/site.ts exports BLOGS exactly as the contract states', () => {
    const shipped = blogRegistry(libSite);
    const keys = Object.keys(CONTRACT_BLOGS.agent);
    expect({
      agent: pick(shipped.agent, keys),
      personal: pick(shipped.personal, keys),
    }).toEqual(CONTRACT_BLOGS);
  });

  it('the agent blog keeps the old site description as its own', () => {
    // §7 amendment 2026-09-09: "the string that used to be SITE_DESCRIPTION is
    // now the agent blog's own description in BLOGS, where it is still true."
    expect(blogRegistry(libSite).agent?.description).toBe(
      'Field notes on Azure network security, cloud security posture, and the security of AI systems — sourced, dated, and checked.',
    );
  });

  it('src/lib/site.ts exports SITE_TAGLINE exactly as the contract states', () => {
    expect(constant(libSite, 'SITE_TAGLINE')).toBe(CONTRACT_TAGLINE);
  });

  it('CONTACT_LINKS ships exactly the §7 entries, label and address, in order', () => {
    expect(contactLinks(libSite)).toEqual(CONTRACT_CONTACT_LINKS);
  });

  /**
   * The invariant that survives every state of this list, and the reason the two
   * tests it replaced existed in the first place: an entry is either a real
   * address or it is `null`. There is no third option — no `#`, no empty string,
   * no invented or guessed address standing in for one the owner has not given.
   *
   * This is what made the placeholder state safe, and it is what makes the
   * configured state trustworthy. It reads whatever §7 declares, so it keeps
   * working whichever way an entry moves next.
   */
  it('every CONTACT_LINKS href is either a real address or null — never a placeholder', () => {
    const bad = contactLinks(libSite).filter(([label, href]) => {
      if (href === null) return false;
      if (!/^(?:mailto:[^@\s]+@[^@\s]+\.[^@\s]+|https:\/\/[^\s]+)$/.test(href)) return true;
      return ['#', '', 'null', 'undefined', 'TODO', 'about:blank'].includes(href) || !label;
    });
    expect(
      bad,
      'a CONTACT_LINKS entry is neither a real mailto:/https: address nor null. ' +
        'CONTRACTS §7: rendering anything else is a contract violation.',
    ).toEqual([]);
  });

  it('a null entry is still expressible — the type has not been narrowed away', () => {
    // §7 amendment 2026-09-09c keeps `string | null` deliberately. If the type is
    // narrowed to `string`, the plain-text branch becomes dead code and the next
    // unset contact has nowhere safe to go. The rendering half of this guarantee
    // is tests/component/contact-links.test.ts.
    expect(
      read(abs('src/lib/types.ts')),
      'ContactLink.href must stay `string | null` (CONTRACTS §7)',
    ).toMatch(/href:\s*string\s*\|\s*null/);
    expect(libSite).toMatch(/href:\s*string\s*\|\s*null|satisfies readonly ContactLink\[\]/);
  });

  /**
   * §7: "`href` in §3 is `BLOGS[blog].base + slug + '/'`. Nothing else may
   * compute it." Asserted as: exactly one function body in src/lib does the
   * concatenation, and everything else calls it.
   */
  it('hrefFor() is the only place a post URL is computed', () => {
    expect(libSite, 'src/lib/site.ts must export hrefFor()').toMatch(/export function hrefFor\(/);
    expect(libSite).toMatch(/BLOGS\[blog\]\.base\s*\+\s*slug\s*\+\s*['"]\/['"]/);

    const others = ['src/lib/posts.ts', 'src/lib/types.ts', ...pagesFiles].filter((file) => {
      const source = read(abs(file));
      return /BLOGS\[[^\]]*\]\.base\s*\+|['"]\/(?:agent-)?blog\/['"]\s*\+/.test(source);
    });
    expect(
      others,
      'a second place computes a post URL; CONTRACTS §7 says hrefFor() is the only one',
    ).toEqual([]);
  });
});

describe('CONTRACTS §7 — no second copy of site identity', () => {
  const componentsSite = abs('src/components/site.ts');

  it('the presentation layer does not declare its own site name', () => {
    if (!exists(componentsSite)) return;
    const source = read(componentsSite);
    const declaresOwnName = /\bname\s*:\s*['"`]/.test(source);
    expect(
      declaresOwnName,
      'src/components/site.ts declares its own site name; CONTRACTS §7 makes ' +
        'src/lib/site.ts the single source of truth and says frontend imports it',
    ).toBe(false);
  });

  it('if src/components/site.ts exists it imports identity from src/lib/site', () => {
    if (!exists(componentsSite)) return;
    expect(read(componentsSite)).toMatch(/from ['"][^'"]*lib\/site['"]/);
  });

  it('the presentation layer no longer declares its own tagline', () => {
    // Amendment 2026-09-09b promoted SITE.tagline to §7 SITE_TAGLINE. The copy in
    // src/components/site.ts is the defect QA reported on 2026-09-09; this is the
    // forward guard that stops it coming back.
    if (!exists(componentsSite)) return;
    const source = read(componentsSite);
    expect(
      /tagline\s*:\s*['"`]/.test(source),
      'src/components/site.ts declares its own tagline again; CONTRACTS §7 owns it as ' +
        'SITE_TAGLINE and this module must re-export it',
    ).toBe(false);
    expect(source, 'src/components/site.ts should re-export SITE_TAGLINE').toMatch(/SITE_TAGLINE/);
  });

  it('the presentation layer does not re-declare the blog registry either', () => {
    if (!exists(componentsSite)) return;
    const source = read(componentsSite);
    const declaresOwnBlogs = /(?:const|let)\s+BLOGS\s*=/.test(source);
    expect(
      declaresOwnBlogs,
      'src/components/site.ts declares its own BLOGS; §7 makes src/lib/site.ts the ' +
        'only place a blog path prefix is written down',
    ).toBe(false);
    expect(source, 'src/components/site.ts should re-export BLOGS from src/lib/site').toMatch(
      /BLOGS/,
    );
  });
});

/**
 * The consequence test. Duplicated constants only matter if the rendered
 * strings disagree — this asserts on dist/ so the report can state whether the
 * divergence is real today or latent.
 */
describe('CONTRACTS §7 — rendered output agrees with itself', () => {
  const index = exists(abs('dist/index.html')) ? read(abs('dist/index.html')) : '';
  const rss = exists(abs('dist/rss.xml')) ? read(abs('dist/rss.xml')) : '';

  const ogSiteName = /<meta property="og:site_name" content="([^"]*)"/.exec(index)?.[1];
  const brand = /class="brand__name"[^>]*>([^<]*)</.exec(index)?.[1];
  const rssTitle = /<channel><title>([^<]*)<\/title>/.exec(rss)?.[1];
  const metaDescription = /<meta name="description" content="([^"]*)"/.exec(index)?.[1];
  const rssDescription = /<description>([^<]*)<\/description>/.exec(rss)?.[1];

  it('dist/ was built before this suite ran', () => {
    expect(index.length, 'run `npm run build` first').toBeGreaterThan(0);
    expect(rss.length, 'run `npm run build` first').toBeGreaterThan(0);
  });

  it('the header wordmark, og:site_name and the RSS channel title are the same string', () => {
    expect({ brand, ogSiteName, rssTitle }).toEqual({
      brand: CONTRACT_TITLE,
      ogSiteName: CONTRACT_TITLE,
      rssTitle: CONTRACT_TITLE,
    });
  });

  /**
   * Forward guard for QA-2026-09-09-01 (report §Defects): src/pages/index.astro
   * passes the site name to <Hero> as a string literal instead of SITE_TITLE,
   * even though it imports SITE_TITLE on the line above for BaseLayout. The two
   * agree today, so this passes; it goes red the moment they stop agreeing,
   * which is the only symptom the duplication can ever produce.
   */
  it('the landing-page <h1> is the same string as the wordmark', () => {
    const h1 = /<h1[^>]*>([^<]*)</.exec(index)?.[1]?.trim();
    expect(h1, 'no <h1> found on dist/index.html').toBeTruthy();
    expect(
      h1,
      'the hero heading and the site wordmark have diverged — src/pages/index.astro ' +
        'hard-codes the site name rather than passing SITE_TITLE (CONTRACTS §7)',
    ).toBe(CONTRACT_TITLE);
  });

  it('the footer tagline is the §7 string, rendered from the single source', () => {
    expect(index, 'the landing page does not render SITE_TAGLINE').toContain(CONTRACT_TAGLINE);
  });

  it('the home meta description and the RSS channel description are the same string', () => {
    expect(metaDescription).toBe(rssDescription);
  });

  it('the combined feed describes the site, not one of its blogs', () => {
    // The remodel's exact regression risk: leaving the old blog description on
    // the site-wide feed, so /rss.xml claims to be the agent blog.
    expect(rssDescription).toBe(CONTRACT_DESCRIPTION);
  });

  it('each per-blog feed carries its own §7 description and title', () => {
    for (const [key, feed] of [
      ['agent', 'dist/agent-blog/rss.xml'],
      ['personal', 'dist/blog/rss.xml'],
    ] as const) {
      const xml = exists(abs(feed)) ? read(abs(feed)) : '';
      expect(xml.length, `${feed} was not emitted`).toBeGreaterThan(0);
      const shipped = blogRegistry(libSite)[key];
      expect(xml, `${feed} does not carry BLOGS.${key}.description`).toContain(
        shipped.description,
      );
    }
  });
});
