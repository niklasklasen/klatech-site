import { describe, expect, it } from 'vitest';
import { abs, exists, read, walk } from './helpers';

/**
 * Every `<link rel="canonical">` and `og:url` in the build must point at a URL
 * the site actually serves.
 *
 * This exists because the link gate structurally cannot check it. `linkinator`
 * crawls outward from the home page, so it only ever sees URLs that something
 * links to. Nothing links to the 404 page — a static host serves it in response
 * to an unknown path — so no crawl reaches it, and any broken URL declared in
 * its head is invisible to the link check for ever. Verified: injecting a broken
 * link into dist/ made linkinator crawl the 404 body and immediately surface a
 * broken canonical that a clean run never sees.
 *
 * Resolution rule matches tests/server.mjs, which mirrors static-host behaviour:
 *   `/foo/` -> dist/foo/index.html
 *   `/foo`  -> dist/foo/index.html or dist/foo.html
 *   `/`     -> dist/index.html
 *
 * Requires `npm run build` first.
 */

const SITE = 'http://localhost:4321';
const built = exists(abs('dist/index.html'));

/** True when a static host serving dist/ would return 200 for this path. */
function resolves(pathname: string): boolean {
  const clean = pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  if (clean === '') return exists(abs('dist/index.html'));
  const endsWithSlash = pathname.endsWith('/');
  // A directory URL (trailing slash) only resolves via an index.html.
  if (endsWithSlash) return exists(abs('dist', clean, 'index.html'));
  return (
    exists(abs('dist', clean, 'index.html')) ||
    exists(abs('dist', clean)) ||
    exists(abs('dist', `${clean}.html`))
  );
}

type Declared = { file: string; kind: string; href: string; pathname: string };

function collect(): Declared[] {
  if (!built) return [];
  const dist = abs('dist');
  const out: Declared[] = [];
  for (const file of walk(dist, (p) => p.endsWith('.html'))) {
    const html = read(file);
    const rel = file.slice(dist.length + 1);
    const push = (kind: string, href: string | undefined) => {
      if (!href || !href.startsWith(SITE)) return;
      out.push({ file: rel, kind, href, pathname: new URL(href).pathname });
    };
    push('canonical', /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1]);
    push('og:url', /<meta property="og:url" content="([^"]+)"/.exec(html)?.[1]);
  }
  return out;
}

const declared = collect();
const broken = declared.filter((d) => !resolves(d.pathname));
const describeBroken = (d: Declared) => `${d.file} ${d.kind}=${d.href} -> no such file in dist/`;

describe('canonical and og:url point at URLs the site serves', () => {
  it('dist/ was built before this suite ran', () => {
    expect(built, 'run `npm run build` first').toBe(true);
  });

  it('every emitted page declares a canonical URL', () => {
    const pages = walk(abs('dist'), (p) => p.endsWith('.html')).length;
    const canonicals = declared.filter((d) => d.kind === 'canonical').length;
    expect(canonicals, `${canonicals} canonical tags across ${pages} emitted pages`).toBe(pages);
  });

  /**
   * REGRESSION PIN — N2, filed in the 2026-08-20 re-verify pass, fixed 2026-08-20.
   *
   * The defect: dist/404.html declared canonical and og:url as
   * `http://localhost:4321/404/`, but the build emits `dist/404.html`, not
   * `dist/404/index.html`. Measured against tests/server.mjs, which mirrors
   * static-host behaviour: `/404` -> 200, `/404.html` -> 200, `/404/` -> 404.
   * The error page's own canonical URL was the only broken URL in the build,
   * wrong by exactly one trailing slash.
   *
   * Cause: src/pages/404.astro passed no `canonicalPath`, so BaseLayout.astro
   * fell back to `Astro.url.pathname` — `/404/` at build time. That fallback is
   * correct for every other route, because every other route really is emitted
   * as `<route>/index.html` and really is served at a directory URL. The 404
   * page is the single page emitted as a bare `.html`, so it is the single page
   * the fallback gets wrong.
   *
   * Fixed by `canonicalPath="/404"` in src/pages/404.astro. Re-verified here
   * independently of that claim: the built tag reads `/404`, and over HTTP
   * against tests/server.mjs `/404` returns 200 while `/404/` still returns 404.
   *
   * This assertion was `it.fails()` while the defect stood; it is now a
   * permanent forward guard. Re-introducing the fallback puts `/404/` back in
   * the head, which does not resolve, and this test goes red naming the tag.
   *
   * Deliberately phrased as "whatever the 404 page declares must resolve"
   * rather than "the 404 page must declare `/404`". Emitting *no* canonical and
   * no og:url on an error page is the more correct answer (see the known
   * limitation in .agents/qa-reports/2026-08-20-reverify.md), and this test must
   * not stand in the way of that change if it is ever made. Presence is
   * guaranteed by the `every emitted page declares a canonical URL` assertion
   * above; correctness is guaranteed here. The pair is what closes the hole.
   */
  it('the 404 page is emitted as a bare .html, not a directory', () => {
    // The structural fact that made the defect possible. If Astro ever changes
    // this, the trailing-slash fallback stops being wrong and this pin needs
    // re-reading rather than silently passing for a new reason.
    expect(exists(abs('dist/404.html')), 'dist/404.html').toBe(true);
    expect(exists(abs('dist/404/index.html')), 'dist/404/index.html').toBe(false);
  });

  it('every URL the 404 page declares for itself resolves', () => {
    const notFoundPage = declared.filter((d) => d.file === '404.html');
    expect(
      notFoundPage.filter((d) => !resolves(d.pathname)).map(describeBroken),
      'the 404 page declares a URL the build does not emit (N2 regression)',
    ).toEqual([]);
  });

  it('the 404 page never declares the trailing-slash form that 404s', () => {
    // The exact defect shape, named. `/404/` resolves only via
    // dist/404/index.html, which the build does not emit.
    const notFoundPage = declared.filter((d) => d.file === '404.html');
    expect(
      notFoundPage.filter((d) => d.pathname === '/404/').map(describeBroken),
      'canonicalPath fell back to Astro.url.pathname again — see src/pages/404.astro',
    ).toEqual([]);
    expect(resolves('/404/'), '/404/ is still not a servable path').toBe(false);
  });

  it('no page has a broken canonical or og:url', () => {
    // Previously exempted 404.html while N2 stood. The exemption is removed:
    // every page in the build is now held to this, the 404 page included.
    expect(
      broken.map(describeBroken),
      'a canonical URL points at a path the build does not emit',
    ).toEqual([]);
  });

  it('records the full canonical inventory, and it is clean', () => {
    console.log(
      `\n[canonical] ${declared.length} declared, ${broken.length} broken:\n` +
        (broken.map((d) => `  ${describeBroken(d)}`).join('\n') || '  (none)'),
    );
    // Was `.toBe(2)` — a pin on the known-broken set while N2 stood, which
    // fired correctly when the fix landed and handed back 0. Now a floor of
    // zero: any newly broken canonical anywhere in the build turns this red.
    expect(broken.length, 'the build declares a canonical URL it does not serve').toBe(0);
    // Guard against a vacuous pass if `collect()` ever stops matching the tags.
    expect(declared.length, 'no canonical/og:url tags were found at all').toBeGreaterThan(0);
  });
});
