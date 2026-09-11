import { expect, test } from '@playwright/test';
import { AGENT_POST } from './pages';

/**
 * Runtime half of the F1 regression pin (see tests/unit/code-contrast.test.ts
 * for the static half, and .agents/qa-reports/2026-08-20.md F1 for the defect).
 *
 * The static test proves the *emitted* palettes are AA-conformant. This one
 * proves the browser actually paints them:
 *
 *  - Astro writes the light palette as inline `color` / `background-color` and
 *    the dark palette as `--shiki-dark` / `--shiki-dark-bg` custom properties.
 *    Without the `prefers-color-scheme` rule in src/styles/global.css the dark
 *    scheme silently renders the *light* palette — conformant, but wrong, and
 *    invisible to a test that only reads the HTML.
 *  - axe's colour-contrast check is the reason F1 was caught at all, but axe
 *    only reports failures; it will not tell you the two schemes are painting
 *    identical pixels. The disjointness assertion below does.
 *
 * Measured with getComputedStyle, so it is the resolved cascade — inline styles,
 * `!important` overrides and custom-property inheritance all included.
 */

const POST = AGENT_POST;
const AA_NORMAL_TEXT = 4.5;

type Measurement = {
  blocks: number;
  preBackgrounds: string[];
  preBackgroundLuminance: number[];
  tokens: { color: string; background: string; ratio: number; sample: string }[];
};

/** Runs in the page: resolve every painted token colour against its real background. */
const MEASURE = `(() => {
  const parse = (c) => {
    const n = (c.match(/[\\d.]+/g) || []).map(Number);
    return n.length >= 3 ? n.slice(0, 3) : null;
  };
  const alpha = (c) => {
    const n = (c.match(/[\\d.]+/g) || []).map(Number);
    return n.length >= 4 ? n[3] : 1;
  };
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  /** Nearest ancestor that actually paints a background. */
  const effectiveBg = (el) => {
    for (let node = el; node; node = node.parentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      if (parse(bg) && alpha(bg) > 0) return bg;
    }
    return 'rgb(255, 255, 255)';
  };

  const pres = [...document.querySelectorAll('.prose pre.astro-code')];
  const tokens = [];
  const preBackgrounds = [];
  for (const pre of pres) {
    preBackgrounds.push(getComputedStyle(pre).backgroundColor);
    const painted = [pre, ...pre.querySelectorAll('*')];
    for (const el of painted) {
      // Only elements with their own text, so a colour is attributed to the
      // element that actually renders it rather than to a wrapper.
      const own = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join('')
        .trim();
      if (!own) continue;
      const style = getComputedStyle(el);
      const bg = effectiveBg(el);
      const fg = parse(style.color);
      const back = parse(bg);
      if (!fg || !back) continue;
      tokens.push({
        color: style.color,
        background: bg,
        ratio: contrast(fg, back),
        sample: own.slice(0, 48),
      });
    }
  }
  return {
    blocks: pres.length,
    preBackgrounds,
    preBackgroundLuminance: preBackgrounds.map((b) => lum(parse(b) || [255, 255, 255])),
    tokens,
  };
})()`;

async function measure(page: import('@playwright/test').Page, scheme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: scheme });
  await page.goto(POST);
  await page.waitForLoadState('networkidle');
  return (await page.evaluate(MEASURE)) as Measurement;
}

for (const scheme of ['light', 'dark'] as const) {
  test(`code tokens clear WCAG AA at runtime (${scheme})`, async ({ page }) => {
    const m = await measure(page, scheme);

    expect(
      m.blocks,
      'no highlighted code block on the post page — this assertion would pass vacuously',
    ).toBeGreaterThan(0);
    expect(m.tokens.length, 'no coloured text measured inside the code blocks').toBeGreaterThan(0);

    const failing = m.tokens.filter((t) => t.ratio < AA_NORMAL_TEXT);
    const worst = [...m.tokens].sort((a, b) => a.ratio - b.ratio)[0];
    console.log(
      `\n[contrast ${scheme}] ${m.blocks} block(s), ${m.tokens.length} text nodes, ` +
        `pre background ${m.preBackgrounds[0]}, worst ${worst.ratio.toFixed(2)}:1 ` +
        `(${worst.color} on ${worst.background}) "${worst.sample}"`,
    );

    expect(
      failing.map((t) => `${t.ratio.toFixed(2)}:1  ${t.color} on ${t.background}  "${t.sample}"`),
      `syntax tokens below WCAG 2 AA 1.4.3 in ${scheme} mode`,
    ).toEqual([]);
  });
}

test('each colour scheme paints its own Shiki palette (no palette leak)', async ({ page }) => {
  const light = await measure(page, 'light');
  const dark = await measure(page, 'dark');

  // 1. The block background follows the scheme.
  expect(
    light.preBackgroundLuminance.every((l) => l > 0.5),
    `light mode: code block backgrounds ${light.preBackgrounds.join(', ')} are not light`,
  ).toBe(true);
  expect(
    dark.preBackgroundLuminance.every((l) => l < 0.5),
    `dark mode: code block backgrounds ${dark.preBackgrounds.join(', ')} are not dark — ` +
      'the --shiki-dark-bg swap in src/styles/global.css is not taking effect',
  ).toBe(true);

  // 2. The foreground palette follows it too. If the dark rule were missing the
  //    background could still be fixed while every token stayed the light colour,
  //    which would be a contrast failure the per-scheme tests above would catch —
  //    but a *partial* leak might not be, so compare the palettes directly.
  const palette = (m: Measurement) => new Set(m.tokens.map((t) => t.color));
  const lightPalette = palette(light);
  const darkPalette = palette(dark);
  const shared = [...darkPalette].filter((c) => lightPalette.has(c));

  console.log(
    `\n[palette] light: ${[...lightPalette].join(' | ')}\n[palette] dark:  ${[...darkPalette].join(' | ')}`,
  );

  expect(
    shared,
    'these token colours are identical in both colour schemes, so the light palette ' +
      'is leaking into dark mode',
  ).toEqual([]);
});
