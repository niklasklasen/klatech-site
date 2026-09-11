import { describe, expect, it } from 'vitest';
import { abs, read, rel, walk } from './helpers';

/**
 * CONTRACTS §3, second hard rule (new in the klatech remodel):
 *
 *   "no file in src/layouts/ or src/components/ may construct a post URL from a
 *    slug. No `/posts/${slug}/`, no `/blog/${slug}/`. Backend computes href and
 *    passes it."
 *
 * Why it is worth a test rather than a code review: the failure is silent. Two
 * blogs share PostCard and PostLayout, so a component that hard-codes one blog's
 * prefix still renders — it just links every personal post into the agent blog,
 * or vice versa, and every link 404s or, worse, resolves to the wrong post.
 *
 * **The exemption matters as much as the rule.** §3: "/tags/<tag>/ ... is correct
 * rather than merely tolerated — there is no second variant it could be wrong
 * for." So `href={`/tags/${tag}/`}` in PostCard.astro and PostLayout.astro must
 * NOT be flagged. That is asserted explicitly below, twice: once as "these two
 * files are clean", and once as "the detector does flag the shapes it is meant
 * to flag" — because a detector that flags nothing would pass the first
 * assertion perfectly.
 */

const presentationFiles = [...walk(abs('src/layouts')), ...walk(abs('src/components'))].filter((p) =>
  /\.(astro|ts|tsx|js|mjs)$/.test(p),
);

/** Path prefixes that identify a *post* URL. `/tags/` is deliberately absent. */
const POST_PREFIXES = ['/posts/', '/blog/', '/agent-blog/'];

type Offence = { line: number; text: string; why: string };

/**
 * Find post-URL construction in a source string.
 *
 * Three shapes are caught:
 *  1. a template literal whose static prefix is a post-blog path and which then
 *     interpolates — `` `/blog/${post.slug}/` ``;
 *  2. any template literal that interpolates a slug-ish expression into a path;
 *  3. string concatenation onto a post-blog prefix — `'/agent-blog/' + slug`,
 *     and the `BLOGS[...].base + slug` form, which is backend's job (§7).
 *
 * Comments are stripped first: these files document the rule in prose, and
 * matching the prose would be a false positive rather than a finding.
 */
export function findSlugUrls(source: string): Offence[] {
  const lines = source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, '$1'));

  const offences: Offence[] = [];

  lines.forEach((line, i) => {
    const push = (text: string, why: string) =>
      offences.push({ line: i + 1, text: text.trim().slice(0, 120), why });

    // 1 + 2: template literals containing an interpolation and a path.
    for (const match of line.matchAll(/`([^`]*)`/g)) {
      const literal = match[1];
      if (!literal.includes('${')) continue;
      const staticPrefix = literal.slice(0, literal.indexOf('${'));
      if (!staticPrefix.includes('/')) continue;
      // Exempt: the shared tag namespace (CONTRACTS §3, explicitly).
      if (/^\/tags\/$/.test(staticPrefix)) continue;
      if (POST_PREFIXES.some((p) => staticPrefix.startsWith(p))) {
        push(match[0], `builds a post URL from an interpolation: prefix "${staticPrefix}"`);
      } else if (/^\/[a-z0-9-]*\/?$/.test(staticPrefix)) {
        push(match[0], `builds a site path from an interpolation: prefix "${staticPrefix}"`);
      }
    }

    // 3: concatenation onto a post-blog prefix, or onto a BLOGS base.
    for (const prefix of POST_PREFIXES) {
      if (new RegExp(`['"\`]${prefix}['"\`]\\s*\\+`).test(line)) {
        push(line, `concatenates onto the hard-coded prefix "${prefix}"`);
      }
    }
    if (/\.base\s*\+/.test(line) || /BLOGS\[[^\]]*\]\.base/.test(line)) {
      push(line, 'derives a URL from BLOGS[...].base — that is backend-dev\'s hrefFor()');
    }
    if (/hrefFor\s*\(/.test(line)) {
      push(line, 'calls hrefFor() — post URLs are computed in src/lib and passed in as props');
    }
  });

  return offences;
}

describe('CONTRACTS §3 — the no-slug-built-post-URL rule', () => {
  it('there are presentation files to check', () => {
    expect(presentationFiles.length).toBeGreaterThan(0);
  });

  it.each(presentationFiles.map((p) => [rel(p), p] as const))(
    '%s does not construct a post URL from a slug',
    (name, file) => {
      const offences = findSlugUrls(read(file));
      expect(
        offences.map((o) => `${name}:${o.line}  ${o.text}  — ${o.why}`),
        'CONTRACTS §3: presentation renders post.href; it never builds one. ' +
          'Backend computes href via hrefFor()/BLOGS and passes it as a prop.',
      ).toEqual([]);
    },
  );

  it('components use post.href where they link to a post', () => {
    // The positive half: the rule is satisfied by *using* the prop, not by
    // omitting the link altogether.
    expect(read(abs('src/components/PostCard.astro'))).toMatch(/href=\{\s*post\.href\s*\}/);
    expect(read(abs('src/layouts/PostLayout.astro'))).toMatch(/canonicalPath=\{\s*post\.href\s*\}/);
  });
});

describe('CONTRACTS §3 — the /tags/ exemption is honoured', () => {
  /**
   * §3 names these two files specifically: their tag links are correct and must
   * not be flagged. If a future tightening of the detector starts flagging them,
   * this test goes red and names the contract paragraph that forbids it.
   */
  it.each(['src/components/PostCard.astro', 'src/layouts/PostLayout.astro'])(
    '%s still builds its /tags/<tag>/ links, and that is allowed',
    (file) => {
      const source = read(abs(file));
      expect(
        source,
        `${file} no longer contains a /tags/ link — if the tag links moved, this ` +
          'exemption test is now vacuous and needs re-pointing',
      ).toMatch(/`\/tags\/\$\{/);
      expect(
        findSlugUrls(source),
        'the /tags/<tag>/ link was flagged — CONTRACTS §3 exempts it explicitly',
      ).toEqual([]);
    },
  );
});

describe('the detector itself actually detects', () => {
  /**
   * A conformance test whose detector silently matches nothing passes for ever.
   * These fixtures are the shapes the rule exists to stop; each must be caught.
   */
  it.each([
    ['<a href={`/blog/${post.slug}/`}>x</a>', 'the personal-blog prefix'],
    ['<a href={`/agent-blog/${slug}/`}>x</a>', 'the agent-blog prefix'],
    ['<a href={`/posts/${entry.id}/`}>x</a>', 'the deleted /posts/ prefix'],
    ["const href = '/blog/' + post.slug + '/';", 'concatenation'],
    ['const href = BLOGS[post.blog].base + post.slug;', 'the blog registry'],
    ["const href = hrefFor('agent', post.slug);", 'calling the backend href helper'],
  ])('flags %s (%s)', (fixture) => {
    expect(findSlugUrls(fixture).length, `not flagged: ${fixture}`).toBeGreaterThan(0);
  });

  it.each([
    ['<a href={`/tags/${tag}/`}>x</a>', 'the exempt tag link'],
    ['<a href={post.href}>x</a>', 'using the passed-in href'],
    ['<a href={`#${heading.slug}`}>x</a>', 'an in-page fragment'],
    ['// never write `/blog/${slug}/` here', 'the rule quoted in a comment'],
  ])('does not flag %s (%s)', (fixture) => {
    expect(findSlugUrls(fixture), `false positive: ${fixture}`).toEqual([]);
  });
});
