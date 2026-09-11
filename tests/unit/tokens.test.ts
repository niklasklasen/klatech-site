import { describe, expect, it } from 'vitest';
import { abs, read, rel, walk } from './helpers';

/** CONTRACTS §5 — design token contract. */

const REQUIRED_TOKENS = [
  '--color-bg', '--color-surface', '--color-fg', '--color-muted',
  '--color-accent', '--color-border',
  '--font-sans', '--font-mono',
  '--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6',
  '--measure',
  '--radius',
];

/** Tokens whose value is a colour and so must be redefined for dark mode. */
const COLOUR_TOKENS = REQUIRED_TOKENS.filter((t) => t.startsWith('--color-'));

const tokensFile = abs('src/styles/tokens.css');
const tokensCss = read(tokensFile);

/** The `@media (prefers-color-scheme: dark)` block, brace-matched. */
function darkBlock(css: string): string {
  const start = css.search(/@media[^{]*prefers-color-scheme:\s*dark[^{]*\{/);
  if (start === -1) return '';
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  return '';
}

/** A declaration of `name`, not merely a `var(name)` reference. */
function declares(css: string, token: string): boolean {
  return new RegExp(`(^|[;{\\s])${token}\\s*:`, 'm').test(css);
}

describe('CONTRACTS §5 — tokens', () => {
  it('tokens.css exists and declares :root', () => {
    expect(tokensCss).toMatch(/:root\s*\{/);
  });

  it.each(REQUIRED_TOKENS)('%s is declared in the light (:root) block', (token) => {
    const light = tokensCss.slice(0, tokensCss.search(/@media/) === -1 ? undefined : tokensCss.search(/@media/));
    expect(declares(light, token), `${token} missing from :root in ${rel(tokensFile)}`).toBe(true);
  });

  it('a prefers-color-scheme: dark block exists', () => {
    expect(darkBlock(tokensCss).length, 'no dark-mode block in tokens.css').toBeGreaterThan(0);
  });

  it.each(COLOUR_TOKENS)('%s is redefined in the dark block', (token) => {
    expect(
      declares(darkBlock(tokensCss), token),
      `${token} is not redefined under prefers-color-scheme: dark`,
    ).toBe(true);
  });
});

describe('CONTRACTS §5 — no literal colours outside tokens.css', () => {
  const styled = [
    ...walk(abs('src/styles'), (p) => p.endsWith('.css') && !p.endsWith('tokens.css')),
    ...walk(abs('src/layouts'), (p) => p.endsWith('.astro')),
    ...walk(abs('src/components'), (p) => p.endsWith('.astro')),
    ...walk(abs('src/pages'), (p) => p.endsWith('.astro')),
  ];

  const HEX = /#[0-9a-fA-F]{3,8}\b/g;
  const FUNC = /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\s*\(/g;

  it.each(styled.map((p) => [rel(p), p] as const))('%s has no hex colour', (name, file) => {
    const lines = read(file).split('\n');
    const hits: string[] = [];
    lines.forEach((line, i) => {
      // `#anchor` hrefs and `content: "#"` are not colours.
      if (/href=|content:\s*["']/.test(line)) return;
      const found = line.match(HEX);
      if (found) hits.push(`${name}:${i + 1}  ${line.trim()}`);
    });
    expect(hits, `hard-coded hex outside tokens.css:\n${hits.join('\n')}`).toEqual([]);
  });

  it.each(styled.map((p) => [rel(p), p] as const))(
    '%s has no literal rgb()/hsl()/oklch() colour',
    (name, file) => {
      const lines = read(file).split('\n');
      const hits: string[] = [];
      lines.forEach((line, i) => {
        if (FUNC.test(line)) hits.push(`${name}:${i + 1}  ${line.trim()}`);
        FUNC.lastIndex = 0;
      });
      expect(hits, `literal colour function outside tokens.css:\n${hits.join('\n')}`).toEqual([]);
    },
  );
});
