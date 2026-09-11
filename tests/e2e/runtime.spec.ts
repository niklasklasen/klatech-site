import { expect, test } from '@playwright/test';
import { PAGES, VIEWPORTS } from './pages';

/**
 * Runtime conformance over the built site.
 * Console noise, failed subresources, landmark structure, and layout overflow.
 */

for (const page_ of PAGES) {
  test.describe(`${page_.name} (${page_.path})`, () => {
    test('loads with no console errors and no failed requests', async ({ page }) => {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      const failedRequests: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        // Navigating to a 404 makes the browser log the *document's own* status
        // as a console error. Every real static host behaves the same way, so
        // that one line is expected noise on the 404 route, not a defect.
        if (page_.status === 404 && /status of 404/.test(msg.text())) return;
        consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => pageErrors.push(err.message));
      page.on('requestfailed', (req) => {
        failedRequests.push(`${req.url()} — ${req.failure()?.errorText ?? 'failed'}`);
      });
      page.on('response', (res) => {
        // The 404 route is expected to answer 404 for its own document.
        const isOwnDocument = res.url().endsWith(page_.path);
        if (res.status() >= 400 && !(page_.status === 404 && isOwnDocument)) {
          failedRequests.push(`${res.status()} ${res.url()}`);
        }
      });

      const response = await page.goto(page_.path, { waitUntil: 'load' });
      expect(response?.status()).toBe(page_.status);
      await page.waitForLoadState('networkidle');

      expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
      expect(pageErrors, `uncaught page errors:\n${pageErrors.join('\n')}`).toEqual([]);
      expect(failedRequests, `failed requests:\n${failedRequests.join('\n')}`).toEqual([]);
    });

    test('has exactly one h1 and the expected landmarks', async ({ page }) => {
      await page.goto(page_.path);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.locator('header').first()).toBeVisible();
      await expect(page.locator('footer').first()).toBeVisible();
      await expect(page.locator('nav[aria-label="Main"]')).toHaveCount(1);
    });

    test('has a non-empty title and meta description', async ({ page }) => {
      await page.goto(page_.path);
      expect((await page.title()).trim().length).toBeGreaterThan(0);
      const description = await page
        .locator('meta[name="description"]')
        .getAttribute('content');
      expect(description?.trim().length ?? 0).toBeGreaterThan(0);
    });

    for (const viewport of VIEWPORTS) {
      test(`no horizontal page scroll at ${viewport.name}px`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(page_.path);
        await page.waitForLoadState('networkidle');

        const overflow = await page.evaluate(() => {
          const el = document.documentElement;
          return {
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
            // Name the widest offender so the ticket can point at it.
            widest: [...document.querySelectorAll<HTMLElement>('body *')]
              .map((n) => ({
                selector: `${n.tagName.toLowerCase()}${n.className && typeof n.className === 'string' ? `.${n.className.trim().split(/\s+/).join('.')}` : ''}`,
                right: Math.round(n.getBoundingClientRect().right),
              }))
              .filter((n) => n.right > el.clientWidth + 1)
              .sort((a, b) => b.right - a.right)
              .slice(0, 3),
          };
        });

        expect(
          overflow.scrollWidth,
          `page scrolls horizontally at ${viewport.width}px ` +
            `(scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth}). ` +
            `Widest overflowing elements: ${JSON.stringify(overflow.widest)}`,
        ).toBeLessThanOrEqual(overflow.clientWidth + 1);
      });
    }
  });
}

test.describe('skip link', () => {
  test('is the first tab stop and targets <main>', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toHaveAttribute('href', '#main');
    await expect(page.locator('#main')).toHaveCount(1);
  });
});

/** All three §4 feeds, parsed by a real XML parser rather than a library. */
for (const feed of ['/rss.xml', '/agent-blog/rss.xml', '/blog/rss.xml']) {
  test.describe(feed, () => {
    test('is served and parses as XML in the browser', async ({ page, request }) => {
      const response = await request.get(feed);
      expect(response.status(), `${feed} was not served`).toBe(200);
      const body = await response.text();
      const parsed = await page.evaluate(
        (xml) => {
          const doc = new DOMParser().parseFromString(xml, 'application/xml');
          return {
            error: doc.querySelector('parsererror')?.textContent ?? null,
            items: doc.querySelectorAll('item').length,
            links: [...doc.querySelectorAll('item > link')].map((n) => n.textContent ?? ''),
          };
        },
        body,
      );
      expect(parsed.error, `${feed} parse error: ${parsed.error}`).toBeNull();
      expect(parsed.items, `${feed} has no items`).toBeGreaterThan(0);
      expect(
        parsed.links.filter((l) => !/^https?:\/\//.test(l)),
        `${feed} has non-absolute item links`,
      ).toEqual([]);
    });
  });
}

test.describe('/rss.xml spans both blogs', () => {
  test('the combined feed carries items from the agent blog and the personal blog', async ({
    request,
  }) => {
    const body = await (await request.get('/rss.xml')).text();
    const links = [...body.matchAll(/<link>([^<]+)<\/link>/g)].map((m) => m[1]).slice(1);
    expect(
      links.filter((l) => l.includes('/agent-blog/')).length,
      'no agent-blog item in the combined feed',
    ).toBeGreaterThan(0);
    expect(
      links.filter((l) => /\/blog\//.test(l) && !l.includes('/agent-blog/')).length,
      'no personal-blog item in the combined feed',
    ).toBeGreaterThan(0);
  });
});
