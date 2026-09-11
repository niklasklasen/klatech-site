import { expect, test, chromium } from '@playwright/test';
import { AGENT_POST, BASE_URL } from './pages';

/**
 * The two already-ticketed defects, pinned with executable evidence so the
 * report can rate their real severity rather than guess it.
 *
 *  1. Code blocks used a single dark Shiki theme -> ticketed to backend-dev.
 *     **CLOSED 2026-08-20.** `markdown.shikiConfig.themes` now sets dual
 *     high-contrast themes and src/styles/global.css swaps the dark palette in.
 *     The tests below were written as failing evidence and now pass — they are
 *     kept as the regression guard for the appearance half of the fix. (The
 *     contrast half is pinned separately in code-contrast.spec.ts and
 *     tests/unit/code-contrast.test.ts.) A failure here IS a regression.
 *
 *  2. Markdown tables are keyboard-scrollable only with JS -> parked by @lead as
 *     a known low-severity defect; no fix is planned for this milestone.
 *     **STILL OPEN BY DECISION.** Its test is marked `test.fail()`, so Playwright
 *     reports it as an *expected* failure and the run stays green. This is
 *     deliberate: the assertion remains executable evidence that the defect is
 *     real, and if someone ever fixes it the run turns red with "expected to
 *     fail, but passed" — which is the signal to delete the annotation and the
 *     ticket together. Do not soften the assertion to make it pass.
 */

const POST = AGENT_POST;

/** Relative luminance + WCAG contrast, evaluated in the page. */
const CONTRAST_HELPERS = `
  const parse = (c) => c.match(/[\\d.]+/g).slice(0, 3).map(Number);
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const [x, y] = [lum(parse(a)), lum(parse(b))].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
`;

test.describe('known issue 1 — Shiki single dark theme (CLOSED — now a regression guard)', () => {
  test('code block background follows the light colour scheme in light mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(POST);

    const measured = await page.evaluate(`(() => {
      ${CONTRAST_HELPERS}
      const pre = document.querySelector('.prose pre');
      if (!pre) return null;
      const code = pre.querySelector('code') || pre;
      const preBg = getComputedStyle(pre).backgroundColor;
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      const codeFg = getComputedStyle(code).color;
      return {
        preBg,
        bodyBg,
        codeFg,
        preBgLuminance: lum(parse(preBg)),
        bodyBgLuminance: lum(parse(bodyBg)),
        codeContrast: contrast(codeFg, preBg),
      };
    })()`) as {
      preBg: string;
      bodyBg: string;
      codeFg: string;
      preBgLuminance: number;
      bodyBgLuminance: number;
      codeContrast: number;
    } | null;

    expect(measured, 'no <pre> found in the post body').not.toBeNull();
    const m = measured!;

    // Evidence for the severity rating: is the code text itself readable?
    console.log(
      `\n[known issue 1] light mode: page bg ${m.bodyBg} (L=${m.bodyBgLuminance.toFixed(3)}), ` +
        `code bg ${m.preBg} (L=${m.preBgLuminance.toFixed(3)}), code fg ${m.codeFg}, ` +
        `code text contrast ${m.codeContrast.toFixed(2)}:1`,
    );

    // The block is internally readable — that is the point of the severity call.
    expect(
      m.codeContrast,
      'code text is unreadable against its own background — this would be an a11y failure, not cosmetic',
    ).toBeGreaterThanOrEqual(4.5);

    // The actual defect: a dark slab on a light page.
    expect(
      m.preBgLuminance,
      `code block renders dark in light mode: pre background ${m.preBg} vs page background ${m.bodyBg}`,
    ).toBeGreaterThan(0.5);
  });

  test('code block background follows the dark colour scheme in dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(POST);

    const luminance = await page.evaluate(`(() => {
      ${CONTRAST_HELPERS}
      const pre = document.querySelector('.prose pre');
      return pre ? lum(parse(getComputedStyle(pre).backgroundColor)) : null;
    })()`) as number | null;

    expect(luminance, 'no <pre> found').not.toBeNull();
    expect(luminance!, 'code block should be dark in dark mode').toBeLessThan(0.5);
  });
});

test.describe('known issue 2 — table scrolling without JS (OPEN by decision)', () => {
  test('an overflowing table is keyboard-reachable with JavaScript disabled', async () => {
    // Expected-failing by design: see the file header. `test.fail()` keeps the
    // suite green while the assertion below keeps failing, so the defect stays
    // documented in executable form without masquerading as a regression.
    // Scoped to this test only — the code-block test below genuinely passes.
    test.fail(
      true,
      'known open defect, parked by @lead: markdown emits a bare <table> with no ' +
        'wrapper, so without JS an overflowing table has no tabindex and its clipped ' +
        'columns are unreachable by keyboard. Fixing it needs a rehype plugin in ' +
        'astro.config.mjs. If this test starts PASSING, the defect was fixed — ' +
        'remove this annotation and close the ticket.',
    );
    const browser = await chromium.launch();
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 360, height: 800 },
      baseURL: BASE_URL,
    });
    const page = await context.newPage();

    try {
      await page.goto(POST);

      const tables = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('.prose table')].map((t) => ({
          overflows: t.scrollWidth > t.clientWidth + 1,
          tabindex: t.getAttribute('tabindex'),
          wrapped: t.parentElement?.classList.contains('table-scroll') ?? false,
          scrollWidth: t.scrollWidth,
          clientWidth: t.clientWidth,
        })),
      );

      test.skip(tables.length === 0, 'the published post contains no markdown table');
      const overflowing = tables.filter((t) => t.overflows);
      test.skip(overflowing.length === 0, 'no table overflows at 360px');

      console.log(`\n[known issue 2] no-JS, 360px: ${JSON.stringify(tables)}`);

      for (const table of overflowing) {
        expect(
          table.tabindex,
          `an overflowing table (${table.scrollWidth}px content in ${table.clientWidth}px box) ` +
            'has no tabindex without JS, so its content is unreachable by keyboard ' +
            '(axe scrollable-region-focusable)',
        ).toBe('0');
      }
    } finally {
      await context.close();
      await browser.close();
    }
  });

  test('code blocks have the same no-JS problem or do not', async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 360, height: 800 },
      baseURL: BASE_URL,
    });
    const page = await context.newPage();

    try {
      await page.goto(POST);
      const pres = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('.prose pre')].map((p) => ({
          overflows: p.scrollWidth > p.clientWidth + 1,
          tabindex: p.getAttribute('tabindex'),
        })),
      );
      const overflowing = pres.filter((p) => p.overflows);
      console.log(
        `\n[known issue 2, code blocks] no-JS, 360px: ${overflowing.length}/${pres.length} overflow, ` +
          `focusable: ${overflowing.filter((p) => p.tabindex === '0').length}`,
      );
      for (const pre of overflowing) {
        expect(
          pre.tabindex,
          'an overflowing code block is not keyboard-scrollable without JS',
        ).toBe('0');
      }
    } finally {
      await context.close();
      await browser.close();
    }
  });
});
