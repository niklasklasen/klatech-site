import { describe, expect, it } from 'vitest';
import { abs, locate, read, rel, walk } from './helpers';

/**
 * CONTRACTS §3 — "no file in src/layouts/ or src/components/ may import
 * astro:content". Presentation receives props; data access lives in src/pages/.
 */

const presentationFiles = [
  ...walk(abs('src/layouts')),
  ...walk(abs('src/components')),
].filter((p) => /\.(astro|ts|tsx|js|mjs)$/.test(p));

describe('CONTRACTS §3 — the astro:content import ban', () => {
  it('there are presentation files to check', () => {
    expect(presentationFiles.length).toBeGreaterThan(0);
  });

  it.each(presentationFiles.map((p) => [rel(p), p] as const))(
    '%s does not reference astro:content',
    (_name, file) => {
      const source = read(file);
      const offends = /astro:content/.test(source);
      expect(
        offends,
        offends ? `${locate(file, 'astro:content')} imports the content API` : '',
      ).toBe(false);
    },
  );

  it.each(presentationFiles.map((p) => [rel(p), p] as const))(
    '%s does not reach into src/lib/posts (the data layer) either',
    (_name, file) => {
      // posts.ts is the module that imports astro:content; importing it from a
      // component would launder the same dependency through one hop.
      expect(/from ['"].*lib\/posts['"]/.test(read(file))).toBe(false);
    },
  );
});
