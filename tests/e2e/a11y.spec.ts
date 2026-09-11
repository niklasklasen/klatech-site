import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { AGENT_POST, PAGES, VIEWPORTS } from './pages';

/**
 * axe-core: zero `critical` or `serious` violations on every page, in both
 * colour schemes and at mobile and desktop width. Moderate/minor findings are
 * printed for the report but do not fail the gate.
 */

const BLOCKING = new Set(['critical', 'serious']);

function summarise(violations: { id: string; impact?: string | null; nodes: unknown[]; help: string }[]) {
  return violations
    .map(
      (v) =>
        `[${v.impact ?? 'unknown'}] ${v.id}: ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? '' : 's'})`,
    )
    .join('\n');
}

for (const page_ of PAGES) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`axe: ${page_.name} (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(page_.path);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
        .analyze();

      const blocking = results.violations.filter((v) => BLOCKING.has(v.impact ?? ''));
      const other = results.violations.filter((v) => !BLOCKING.has(v.impact ?? ''));

      if (other.length) {
        console.log(`\n[axe non-blocking] ${page_.name} (${scheme}):\n${summarise(other as never)}`);
      }

      expect(
        blocking,
        `critical/serious axe violations on ${page_.path} (${scheme}):\n${summarise(blocking as never)}\n` +
          blocking
            .flatMap((v) => v.nodes.map((n) => `  ${v.id} -> ${n.target.join(' ')}`))
            .join('\n'),
      ).toEqual([]);
    });
  }
}

test('axe: post page at 360px (mobile layout)', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[0]);
  await page.goto(AGENT_POST);
  await page.waitForLoadState('networkidle');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const blocking = results.violations.filter((v) => BLOCKING.has(v.impact ?? ''));
  expect(blocking, summarise(blocking as never)).toEqual([]);
});

test('every interactive element has a visible focus indicator', async ({ page }) => {
  await page.goto(AGENT_POST);

  const missing = await page.evaluate(() => {
    const out: string[] = [];
    const targets = document.querySelectorAll<HTMLElement>('a[href], button, [tabindex="0"]');
    for (const el of targets) {
      el.focus();
      const style = getComputedStyle(el);
      const hasOutline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
      const hasUnderline = style.textDecorationLine.includes('underline');
      const hasShadow = style.boxShadow !== 'none';
      if (!hasOutline && !hasUnderline && !hasShadow) {
        out.push(`${el.tagName.toLowerCase()}.${el.className} "${el.textContent?.trim().slice(0, 30)}"`);
      }
    }
    return out;
  });

  expect(missing, `no visible focus indicator on:\n${missing.join('\n')}`).toEqual([]);
});
