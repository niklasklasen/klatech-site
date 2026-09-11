// Required: `getViteConfig` returns vite's `UserConfig`, which has no `test` key
// of its own. Vitest 4 no longer augments vite's types globally, so without this
// reference `npm run check` fails with ts(2353) on the `test` block below.
/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

/**
 * QA-owned vitest configuration. Two kinds of test run under it:
 *
 * `tests/unit/**` — static conformance. These never import application code:
 * they read source and build output from disk and assert it against
 * docs/CONTRACTS.md directly. Asserting against a re-statement of the contract
 * rather than against the implementation is the point — a test that imports the
 * app's own schema cannot catch the app's schema drifting from the contract.
 *
 * `tests/component/**` — component rendering. These DO import application code,
 * deliberately, and render it through Astro's container API. They exist for
 * behaviour that only appears in rendered output and that no build currently
 * exercises: today that is `ContactLinks`' `href: null` branch, which lost its
 * live example when the owner supplied real addresses (CONTRACTS §7 amendment
 * 2026-09-09c) but is still live contract.
 *
 * `getViteConfig` is Astro's own vite config, which is what makes `.astro` files
 * importable and `astro:content` resolvable here. It replaced a hand-written
 * config plus stub modules for `astro:content` / `astro/loaders` on 2026-09-09:
 * with the real virtual modules available, tests/unit/schema-behaviour.test.ts
 * now exercises the schemas through the same module resolution the build uses,
 * and there are no QA-authored stubs left to drift from Astro's behaviour.
 */
export default getViteConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/component/**/*.test.ts'],
    environment: 'node',
    globals: false,
    reporters: ['default'],
  },
});
