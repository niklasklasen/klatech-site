import { expect, test } from '@playwright/test';
import { VIEWPORTS } from './pages';

/**
 * The landing page — new in the klatech remodel (CONTRACTS §4: "landing: hero,
 * then the latest 3 agent posts and latest 3 personal posts").
 *
 * `/` is the one page whose structure is not a repeat of a blog index, and it is
 * the page the two-blog remodel is *for*, so it gets its own coverage rather
 * than being folded into the generic per-page loop in runtime.spec.ts.
 */

const HEADINGS = ['Agent Blog', 'Blog'];

test.describe('/', () => {
  test('has exactly one h1, and it is the site name', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveCount(1);
    // Compared against og:site_name on the same page rather than against a
    // literal: this file has no guard tying it to CONTRACTS §7, and an
    // unguarded copy of the site name is how the last identity drift happened.
    // tests/unit/site-identity.test.ts holds the literal, guarded.
    const siteName = await page.locator('meta[property="og:site_name"]').getAttribute('content');
    expect(siteName?.trim()).toBeTruthy();
    await expect(page.locator('h1')).toHaveText(siteName!.trim());
  });

  test('renders both feed sections, each with its own h2 and a link to its blog', async ({
    page,
  }) => {
    await page.goto('/');

    const sections = page.locator('section.feed-section');
    await expect(sections, 'CONTRACTS §4: the landing page carries both blogs').toHaveCount(2);

    // Scoped to the section's own heading: post cards use <h2> for their titles
    // too, so an unscoped h2 query returns the cards as well.
    const headings = await sections.locator('h2.feed-section__heading').allTextContents();
    expect(headings.map((h) => h.trim()), 'the two §7 blog titles, in order').toEqual(HEADINGS);

    // Each section links onward to its blog index (FeedSection's moreHref).
    await expect(page.locator('section.feed-section a[href="/agent-blog/"]')).toHaveCount(1);
    await expect(page.locator('section.feed-section a[href="/blog/"]')).toHaveCount(1);
  });

  test('each feed shows at most the latest 3 posts', async ({ page }) => {
    await page.goto('/');
    const sections = page.locator('section.feed-section');
    for (let i = 0; i < (await sections.count()); i++) {
      const cards = sections.nth(i).locator('article.post-card');
      const count = await cards.count();
      expect(count, `feed section ${i} shows ${count} cards; §4 says the latest 3`).toBeLessThanOrEqual(3);
      expect(count, `feed section ${i} is empty`).toBeGreaterThan(0);
    }
  });

  test('every card links to a page that exists, in the right blog', async ({ page, request }) => {
    await page.goto('/');
    const hrefs = await page.locator('article.post-card h2 a').evaluateAll((links) =>
      links.map((l) => (l as HTMLAnchorElement).getAttribute('href') ?? ''),
    );
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href, `card links to ${href}, which is in neither blog`).toMatch(
        /^\/(agent-blog|blog)\/[^/]+\/$/,
      );
      expect((await request.get(href)).status(), `${href} does not resolve`).toBe(200);
    }
  });

  test('the two feeds sit side by side at 768px and stack below it', async ({ page }) => {
    const boxOf = async (index: number) => {
      const box = await page.locator('section.feed-section').nth(index).boundingBox();
      if (!box) throw new Error(`feed section ${index} has no box`);
      return box;
    };

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    const [wideA, wideB] = [await boxOf(0), await boxOf(1)];
    expect(
      wideB.x,
      `at 768px the two feeds are not side by side (${JSON.stringify({ a: wideA, b: wideB })})`,
    ).toBeGreaterThan(wideA.x);

    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');
    const [narrowA, narrowB] = [await boxOf(0), await boxOf(1)];
    expect(narrowB.y, 'at 360px the two feeds are not stacked').toBeGreaterThan(narrowA.y);
    expect(narrowB.x, 'at 360px the two feeds are not in the same column').toBe(narrowA.x);
  });

  for (const viewport of VIEWPORTS) {
    test(`no horizontal page scroll at ${viewport.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const overflow = await page.evaluate(() => {
        const el = document.documentElement;
        return {
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          widest: [...document.querySelectorAll<HTMLElement>('body *')]
            .map((n) => ({
              selector: `${n.tagName.toLowerCase()}${
                n.className && typeof n.className === 'string'
                  ? `.${n.className.trim().split(/\s+/).join('.')}`
                  : ''
              }`,
              right: Math.round(n.getBoundingClientRect().right),
            }))
            .filter((n) => n.right > el.clientWidth + 1)
            .sort((a, b) => b.right - a.right)
            .slice(0, 3),
        };
      });

      expect(
        overflow.scrollWidth,
        `landing page scrolls horizontally at ${viewport.width}px ` +
          `(scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth}). ` +
          `Widest: ${JSON.stringify(overflow.widest)}`,
      ).toBeLessThanOrEqual(overflow.clientWidth + 1);
    });
  }
});

/**
 * `/tags/<tag>/` is a mixed list: §4 says "posts from both blogs, badged".
 *
 * No tag currently spans both blogs, so this cannot assert that a single page
 * shows two badge values. What it asserts instead holds either way: every card
 * on every tag page is badged, the badge carries *text* (§5: "it must never be
 * the only thing distinguishing them: the blog badge carries text"), and the
 * badge agrees with the blog the card actually links into. That last check is
 * the one that would catch a mis-mapped `blog` field, which is the real risk.
 */
test.describe('tag pages badge which blog each post came from', () => {
  const LABEL: Record<string, string> = { '/agent-blog/': 'Agent Blog', '/blog/': 'Blog' };

  test('every card on every tag page carries a correct, non-empty badge', async ({ page }) => {
    await page.goto('/tags/');
    const tagHrefs = await page
      .locator('a[href^="/tags/"]')
      .evaluateAll((links) =>
        [
          ...new Set(
            links
              .map((l) => (l as HTMLAnchorElement).getAttribute('href') ?? '')
              .filter((h) => /^\/tags\/[^/]+\/$/.test(h)),
          ),
        ],
      );
    expect(tagHrefs.length, 'no tag pages linked from /tags/').toBeGreaterThan(0);

    const seen = new Set<string>();
    for (const href of tagHrefs) {
      await page.goto(href);
      const cards = await page.locator('article.post-card').evaluateAll((nodes) =>
        nodes.map((n) => ({
          href: n.querySelector('h2 a')?.getAttribute('href') ?? '',
          badge: n.querySelector('.post-card__blog-badge')?.textContent?.trim() ?? '',
        })),
      );
      expect(cards.length, `${href} lists no posts`).toBeGreaterThan(0);
      for (const card of cards) {
        const base = card.href.startsWith('/agent-blog/') ? '/agent-blog/' : '/blog/';
        expect(card.badge, `${href}: card for ${card.href} has no blog badge text`).toBe(
          LABEL[base],
        );
        seen.add(card.badge);
      }
    }
    // Across all tag pages, both blogs must appear — otherwise /tags/ is not
    // spanning both collections at all.
    expect([...seen].sort(), 'tag pages do not span both blogs').toEqual(['Agent Blog', 'Blog']);
  });
});
