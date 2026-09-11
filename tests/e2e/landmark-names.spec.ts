import { expect, test } from '@playwright/test';
import { AGENT_POST } from './pages';

/**
 * Regression pin for QA finding F5/F3 (2026-08-20): every scrollable region in
 * the post body must have a *distinct* accessible name (axe `landmark-unique`).
 *
 * Why this is a separate test and not left to axe. A region only becomes a
 * landmark when it actually overflows, and at desktop width usually only one
 * does — so axe sees one region, finds nothing duplicated, and stays silent
 * while a collision sits there waiting for a narrower viewport or a longer
 * table. That is exactly how the `<pre>` collision (every code block labelled
 * "Code block") survived the first gate: the tables collided visibly, the code
 * blocks did not, and only one defect got filed.
 *
 * This forces the narrowest supported viewport so the maximum number of regions
 * activate at once, and additionally checks the *latent* names — the
 * `data-label` BaseLayout assigns to every candidate whether or not it currently
 * overflows — so a collision is caught before a viewport reveals it.
 */

const POST = AGENT_POST;

type Region = {
  tag: string;
  overflows: boolean;
  role: string | null;
  tabindex: string | null;
  label: string | null;
  dataLabel: string | undefined;
};

const PROBE = `[...document.querySelectorAll('.prose pre, .prose .table-scroll')].map((el) => ({
  tag: el.tagName.toLowerCase() + (el.classList.contains('table-scroll') ? '.table-scroll' : ''),
  overflows: el.scrollWidth > el.clientWidth + 1,
  role: el.getAttribute('role'),
  tabindex: el.getAttribute('tabindex'),
  label: el.getAttribute('aria-label'),
  dataLabel: el.dataset.label,
}))`;

function duplicates(names: (string | null | undefined)[]): string[] {
  const seen = new Map<string, number>();
  for (const n of names) {
    const key = n ?? '(none)';
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return [...seen].filter(([, n]) => n > 1).map(([name, n]) => `${name} x${n}`);
}

for (const width of [360, 768, 1440]) {
  test(`scroll regions have unique accessible names at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(POST);
    await page.waitForLoadState('networkidle');

    const regions = (await page.evaluate(PROBE)) as Region[];
    expect(regions.length, 'no code blocks or tables in the post body to check').toBeGreaterThan(0);

    const active = regions.filter((r) => r.role === 'region');
    console.log(
      `\n[landmarks ${width}px] ${active.length}/${regions.length} active: ` +
        active.map((r) => `${r.tag} "${r.label}"`).join(' | '),
    );

    // Every activated region is named, focusable, and named uniquely.
    for (const r of active) {
      expect(r.label?.trim(), `${r.tag} became a region with no accessible name`).toBeTruthy();
      expect(r.tabindex, `${r.tag} is a region but not a tab stop`).toBe('0');
    }
    expect(
      duplicates(active.map((r) => r.label)),
      `two scroll regions share an accessible name at ${width}px — a screen-reader ` +
        'user listing regions cannot tell them apart (axe landmark-unique)',
    ).toEqual([]);

    // And nothing that is merely *not overflowing right now* is sitting on a
    // collision that a narrower viewport or a longer table would expose.
    expect(
      duplicates(regions.map((r) => r.dataLabel)),
      'two scroll-region candidates carry the same latent data-label. They do not ' +
        'collide at this viewport only because not all of them overflow at once — ' +
        'this is a latent axe landmark-unique failure, not a passing state',
    ).toEqual([]);
  });
}
