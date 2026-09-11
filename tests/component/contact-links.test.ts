import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import ContactLinks from '../../src/components/ContactLinks.astro';
import type { ContactLink } from '../../src/components/types';

/**
 * CONTRACTS §3 / §7 — `ContactLinks` renders a `null` href as plain muted text,
 * never as a link.
 *
 * **Why this file exists.** Until 2026-09-09c every `CONTACT_LINKS` entry shipped
 * with `href: null`, so the null branch was covered incidentally: the sweep over
 * `dist/` for `href="#"` and the check that the labels rendered as text on
 * `/about/` were exercising it on every build. The owner then supplied all three
 * real addresses, and that incidental coverage vanished — nothing in the built
 * site takes the null branch any more.
 *
 * The branch is still live contract (§7 amendment 2026-09-09c: "the null branch
 * is the mechanism that lets an unset entry render as text, not a leftover of the
 * placeholder state"). So it is tested here against **fixtures** instead of
 * against the live constant — the same shape as the detector-plus-fixtures
 * pattern in tests/unit/no-slug-urls.test.ts. Deleting the placeholders must not
 * silently delete the guarantee that a future placeholder is safe.
 *
 * The component is rendered for real through Astro's container API, so this is
 * the actual template output, not a re-reading of its source.
 */

const render = async (props: { links: ContactLink[]; heading?: string }) => {
  const container = await AstroContainer.create();
  return container.renderToString(ContactLinks, { props });
};

/** Every `<a>` in the output, as [href, text]. */
const anchors = (html: string): [string, string][] =>
  [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [
    m[1],
    m[2].replace(/<[^>]*>/g, '').trim(),
  ]);

/** Text of every `.contact-links__pending` span — the not-configured branch. */
const pending = (html: string): string[] =>
  [...html.matchAll(/<span[^>]*class="[^"]*contact-links__pending[^"]*"[^>]*>([\s\S]*?)<\/span>/g)]
    .map((m) => m[1].replace(/<[^>]*>/g, '').trim());

const LIVE: ContactLink[] = [
  { label: 'Email', href: 'mailto:klasen.niklas@gmail.com' },
  { label: 'GitHub', href: 'https://github.com/niklasklasen' },
];

describe('a null href renders as text, never as a link', () => {
  it('renders the label, in a pending span, with no anchor at all', async () => {
    const html = await render({ links: [{ label: 'Email', href: null }] });
    expect(pending(html), 'the null entry did not render as pending text').toEqual(['Email']);
    expect(anchors(html), 'a null href produced an anchor').toEqual([]);
    expect(html, 'the label must still be visible to the reader').toContain('Email');
  });

  it('emits no placeholder href of any kind for a null entry', async () => {
    const html = await render({ links: [{ label: 'Email', href: null }] });
    // The exact strings the dist/ sweep forbids, asserted at the component level
    // so the failure names the component rather than a page.
    for (const forbidden of ['href="#"', 'href=""', 'href="null"', 'href="undefined"']) {
      expect(html, `ContactLinks emitted ${forbidden} for a null href`).not.toContain(forbidden);
    }
    expect(html, 'no href attribute at all should be emitted').not.toMatch(/href=/);
  });

  it('does not invent or guess an address', async () => {
    const html = await render({ links: [{ label: 'Email', href: null }] });
    expect(html).not.toMatch(/mailto:/);
    expect(html).not.toMatch(/https?:\/\//);
  });

  it('keeps the label identical whether or not the entry is configured', async () => {
    // §3: "the label carries no meaning about its state" — the same string is
    // rendered either way, so filling in an address is a data change only.
    const off = await render({ links: [{ label: 'GitHub', href: null }] });
    const on = await render({ links: [{ label: 'GitHub', href: 'https://github.com/x' }] });
    expect(pending(off)).toEqual(['GitHub']);
    expect(anchors(on).map(([, text]) => text)).toEqual(['GitHub']);
  });

  it('treats an empty-string href as not-configured rather than as a link to nowhere', async () => {
    // `''` is outside the §7 type (`string | null`), but it is the value a
    // half-finished edit produces, and `<a href="">` links to the current page.
    // The component branches on truthiness, so this is text — pinned, because a
    // change to `link.href !== null` would silently start shipping a dead link.
    const html = await render({ links: [{ label: 'Email', href: '' }] });
    expect(anchors(html), 'an empty href produced an anchor').toEqual([]);
    expect(pending(html)).toEqual(['Email']);
  });
});

describe('a live href renders as a real link', () => {
  it('uses the address verbatim, with the label as the link text', async () => {
    const html = await render({ links: LIVE });
    expect(anchors(html)).toEqual([
      ['mailto:klasen.niklas@gmail.com', 'Email'],
      ['https://github.com/niklasklasen', 'GitHub'],
    ]);
    expect(pending(html), 'a configured entry must not render as pending text').toEqual([]);
  });

  it('renders each entry exactly once', async () => {
    const html = await render({ links: LIVE });
    expect((html.match(/<li\b/g) ?? []).length).toBe(LIVE.length);
  });
});

describe('a mixed list renders each entry on its own branch', () => {
  const MIXED: ContactLink[] = [
    { label: 'Email', href: 'mailto:klasen.niklas@gmail.com' },
    { label: 'GitHub', href: null },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/niklasklasen/' },
  ];

  it('links the configured entries and renders the unconfigured one as text', async () => {
    const html = await render({ links: MIXED });
    expect(anchors(html)).toEqual([
      ['mailto:klasen.niklas@gmail.com', 'Email'],
      ['https://www.linkedin.com/in/niklasklasen/', 'LinkedIn'],
    ]);
    expect(pending(html)).toEqual(['GitHub']);
    expect((html.match(/<li\b/g) ?? []).length, 'every entry must appear').toBe(3);
  });

  it('order is preserved: the branch taken does not reorder the list', async () => {
    const html = await render({ links: MIXED });
    const order = [...html.matchAll(/>(Email|GitHub|LinkedIn)</g)].map((m) => m[1]);
    expect(order).toEqual(['Email', 'GitHub', 'LinkedIn']);
  });
});

describe('the rest of the §3 props contract', () => {
  it('renders the heading as an <h2> when given one', async () => {
    const html = await render({ links: LIVE, heading: 'Contact' });
    expect(html).toMatch(/<h2[^>]*>\s*Contact\s*<\/h2>/);
  });

  it('renders no heading element when none is given (the footer usage)', async () => {
    const html = await render({ links: LIVE });
    expect(html, 'an empty heading element was emitted').not.toMatch(/<h2/);
  });

  it('renders nothing at all for an empty list', async () => {
    const html = await render({ links: [] });
    expect(html.trim(), 'an empty list should not emit an empty <ul>').not.toMatch(/<ul/);
  });
});
