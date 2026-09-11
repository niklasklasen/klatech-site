import { describe, expect, it } from 'vitest';
import { abs, exists, read, walk } from './helpers';

/**
 * Regression pin for QA finding F1 (2026-08-20): the syntax-highlighting palette
 * must clear WCAG 2 AA 1.4.3 (4.5:1) for **every** token, in **both** colour
 * schemes, on **real published posts**.
 *
 * Why this file exists. F1 shipped because the palette was only ever looked at
 * against stub content: the default `github-dark` theme's comment token measured
 * 3.05:1 and nothing in the suite would have said so. axe caught it at runtime
 * only once a real post with real comments existed, and only on the one page that
 * had them. This test needs no browser and no axe — it reads the colours Shiki
 * actually wrote into `dist/` and does the arithmetic — so the floor is enforced
 * for whatever posts exist at build time, not for a sample someone remembered to
 * check.
 *
 * It also covers the half axe cannot see: Astro emits the light palette as real
 * inline colours and the dark palette as `--shiki-dark*` custom properties, so a
 * browser in one colour scheme only ever exercises one of the two palettes.
 * Both are checked here from the same source of truth.
 *
 * Requires `npm run build` first.
 */

const AA_NORMAL_TEXT = 4.5;

type Rgb = [number, number, number];

function parseHex(value: string): Rgb | null {
  const hex = value.trim().replace(/^#/, '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
}

/** WCAG 2.x relative luminance. */
function luminance([r, g, b]: Rgb): number {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** WCAG 2.x contrast ratio, order-independent. */
export function contrastRatio(fg: string, bg: string): number {
  const a = parseHex(fg);
  const b = parseHex(bg);
  if (!a || !b) throw new Error(`un-parseable colour pair: ${fg} / ${bg}`);
  const [hi, lo] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (hi + 0.05) / (lo + 0.05);
}

function declarations(styleAttribute: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of styleAttribute.split(';')) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}

type Token = {
  file: string;
  block: number;
  /** The token's own colour in this palette. */
  color: string;
  /** The block background in this palette. */
  background: string;
  sample: string;
  count: number;
};

/**
 * Every distinct (colour, background) pair Shiki emitted, per palette.
 * `light` reads the inline `color`; `dark` reads the `--shiki-dark` custom
 * property that the `prefers-color-scheme` rule in global.css swaps in.
 */
function collectTokens(): { light: Token[]; dark: Token[]; blocks: number; files: string[] } {
  const dist = abs('dist');
  const files = walk(dist, (p) => p.endsWith('.html'));
  const light: Token[] = [];
  const dark: Token[] = [];
  let blocks = 0;
  const seen = { light: new Set<string>(), dark: new Set<string>() };

  for (const file of files) {
    const html = read(file);
    const preRe = /<pre class="([^"]*\bastro-code\b[^"]*)"[^>]*style="([^"]*)"([\s\S]*?)<\/pre>/g;
    let pre: RegExpExecArray | null;
    let blockIndex = 0;
    while ((pre = preRe.exec(html))) {
      blockIndex += 1;
      blocks += 1;
      const preStyle = declarations(pre[2]);
      const lightBg = preStyle['background-color'];
      const darkBg = preStyle['--shiki-dark-bg'];
      const lightBase = preStyle['color'];
      const darkBase = preStyle['--shiki-dark'];

      // The block's own base foreground counts as a token: unwrapped text
      // inside <pre> inherits it.
      const push = (
        bucket: Token[],
        key: 'light' | 'dark',
        color: string | undefined,
        background: string | undefined,
        sample: string,
      ) => {
        if (!color || !background) return;
        const id = `${color}|${background}`;
        if (seen[key].has(id)) {
          const existing = bucket.find((t) => `${t.color}|${t.background}` === id);
          if (existing) existing.count += 1;
          return;
        }
        seen[key].add(id);
        bucket.push({
          file: file.slice(dist.length + 1),
          block: blockIndex,
          color,
          background,
          sample,
          count: 1,
        });
      };

      push(light, 'light', lightBase, lightBg, '(block base colour)');
      push(dark, 'dark', darkBase, darkBg, '(block base colour)');

      const spanRe = /<span style="([^"]*)">([\s\S]*?)<\/span>/g;
      let span: RegExpExecArray | null;
      while ((span = spanRe.exec(pre[3]))) {
        const style = declarations(span[1]);
        const text = span[2].replace(/<[^>]*>/g, '').trim().slice(0, 48);
        if (!text) continue;
        push(light, 'light', style['color'], lightBg, text);
        push(dark, 'dark', style['--shiki-dark'], darkBg, text);
      }
    }
  }
  return { light, dark, blocks, files: files.map((f) => f.slice(dist.length + 1)) };
}

const built = exists(abs('dist/index.html'));
const tokens = built ? collectTokens() : { light: [], dark: [], blocks: 0, files: [] };

function report(t: Token): string {
  return `${t.file} block ${t.block}: ${t.color} on ${t.background} = ${contrastRatio(
    t.color,
    t.background,
  ).toFixed(2)}:1  "${t.sample}"`;
}

describe('WCAG AA contrast floor for syntax highlighting (regression pin for F1)', () => {
  it('dist/ was built before this suite ran', () => {
    expect(built, 'run `npm run build` first').toBe(true);
  });

  it('the build contains at least one real highlighted code block to measure', () => {
    expect(
      tokens.blocks,
      'no <pre class="astro-code"> in dist/ — this suite would pass vacuously. ' +
        'F1 shipped precisely because the palette was judged against content that ' +
        'did not exist in the build.',
    ).toBeGreaterThan(0);
  });

  it('Astro emitted both palettes, so dark mode has something to swap in', () => {
    expect(
      tokens.dark.length,
      'no --shiki-dark values found on any code block: markdown.shikiConfig is not ' +
        'configured with dual themes, so one colour scheme is rendering the other ' +
        "scheme's palette",
    ).toBeGreaterThan(0);
  });

  for (const scheme of ['light', 'dark'] as const) {
    it(`every ${scheme}-palette token clears ${AA_NORMAL_TEXT}:1 against its block background`, () => {
      const failing = tokens[scheme].filter(
        (t) => contrastRatio(t.color, t.background) < AA_NORMAL_TEXT,
      );
      expect(
        failing.map(report),
        `syntax tokens below WCAG 2 AA 1.4.3 (${AA_NORMAL_TEXT}:1) in the ${scheme} palette. ` +
          'Fix `markdown.shikiConfig.themes` in astro.config.mjs and re-measure BOTH themes.',
      ).toEqual([]);
    });
  }

  it('records the measured worst case in both palettes', () => {
    const worst = (scheme: 'light' | 'dark') =>
      tokens[scheme]
        .map((t) => ({ t, ratio: contrastRatio(t.color, t.background) }))
        .sort((a, b) => a.ratio - b.ratio)[0];
    const l = worst('light');
    const d = worst('dark');
    // Not an assertion about a specific number — a printed measurement, so the
    // report never has to take a theme's advertised contrast on trust.
    console.log(
      `\n[contrast] ${tokens.blocks} code block(s), ` +
        `${tokens.light.length} distinct light tokens / ${tokens.dark.length} dark.\n` +
        `[contrast] worst light: ${report(l.t)}\n` +
        `[contrast] worst dark:  ${report(d.t)}`,
    );
    expect(l.ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    expect(d.ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});
