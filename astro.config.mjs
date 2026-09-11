// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Required by both @astrojs/rss and @astrojs/sitemap to build absolute URLs.
  site: 'http://localhost:4321',
  integrations: [sitemap()],
  markdown: {
    // Dual Shiki themes, both high-contrast variants (QA F1 / WCAG 2 AA 1.4.3).
    //
    // The default single `github-dark` theme colours comment tokens #6a737d on
    // #24292e = 3.05:1, below the 4.5:1 AA minimum — and the comments in the CLI
    // samples are instructional text, not decoration. The obvious dual-theme pair
    // does not fix it either: `github-dark` keeps that same 3.05:1 in dark mode,
    // and `github-light`'s comment token only reaches 4.82:1.
    //
    // Measured over the post's own bash sample, worst token vs. the theme's own
    // background (all tokens, not just comments):
    //   github-light-high-contrast  bg #ffffff  comments #66707b  5.04:1  (worst token 5.04:1)
    //   github-dark-high-contrast   bg #0a0c10  comments #bdc4cc 11.12:1  (worst token 9.23:1)
    // Every token in both themes clears 4.5:1.
    //
    // `defaultColor` stays Astro's default ('light'): the light palette is written
    // as real inline colours and the dark palette as `--shiki-dark*` custom
    // properties, so dark mode needs a small `prefers-color-scheme` rule in
    // src/styles/global.css to swap them (ticketed to @frontend-dev). Until that
    // lands, dark mode renders the light high-contrast palette — visually light,
    // but still AA-conformant at 5.04:1.
    shikiConfig: {
      themes: {
        light: 'github-light-high-contrast',
        dark: 'github-dark-high-contrast',
      },
    },
  },
});
