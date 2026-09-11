import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { abs, read, rel, splitFrontmatter, walk } from './helpers';

/**
 * CONTRACTS §2 — content schema conformance, field by field.
 *
 * Deliberately NOT validated through `src/content.config.ts`: that file is the
 * implementation of the contract, so validating with it would only prove the
 * content agrees with the code, not that either agrees with docs/CONTRACTS.md.
 * The rules below are transcribed from the contract table.
 */

const CATEGORIES = ['azure-network-security', 'cloud-security', 'ai-security'];
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const postFiles = walk(abs('src/content/posts'), (p) => p.endsWith('.md'));
const personalFiles = walk(abs('src/content/personal'), (p) => p.endsWith('.md'));

const slugOf = (file: string) => rel(file).replace(/^.*\//, '').replace(/\.md$/, '');
const frontmatterOf = (file: string) =>
  yaml.load(splitFrontmatter(read(file)).frontmatter) as Record<string, unknown>;

function isDateLike(value: unknown): boolean {
  if (value instanceof Date) return !Number.isNaN(value.valueOf());
  if (typeof value === 'string' || typeof value === 'number') {
    return !Number.isNaN(new Date(value).valueOf());
  }
  return false;
}

function isHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

describe('CONTRACTS §2a — the `posts` collection (agent blog)', () => {
  it('there is at least one post to validate', () => {
    expect(postFiles.length).toBeGreaterThan(0);
  });

  it.each(postFiles.map((p) => [rel(p), p] as const))(
    '%s has a parseable frontmatter block',
    (_name, file) => {
      expect(() => splitFrontmatter(read(file))).not.toThrow();
      const { frontmatter } = splitFrontmatter(read(file));
      expect(yaml.load(frontmatter)).toBeTypeOf('object');
    },
  );

  describe.each(postFiles.map((p) => [rel(p), p] as const))('%s', (name, file) => {
    const data = yaml.load(splitFrontmatter(read(file)).frontmatter) as Record<string, unknown>;

    it('filename is lowercase-kebab (CONTRACTS §2 filename convention)', () => {
      const slug = name.replace(/^.*\//, '').replace(/\.md$/, '');
      expect(slug, `${name}: slug must be lowercase-kebab`).toMatch(KEBAB);
    });

    it('title: string, 10–70 chars', () => {
      expect(typeof data.title).toBe('string');
      const title = String(data.title);
      expect(title.length, `title is ${title.length} chars: ${JSON.stringify(title)}`)
        .toBeGreaterThanOrEqual(10);
      expect(title.length, `title is ${title.length} chars: ${JSON.stringify(title)}`)
        .toBeLessThanOrEqual(70);
    });

    it('description: string, 70–160 chars', () => {
      expect(typeof data.description).toBe('string');
      const description = String(data.description);
      expect(
        description.length,
        `description is ${description.length} chars: ${JSON.stringify(description)}`,
      ).toBeGreaterThanOrEqual(70);
      expect(
        description.length,
        `description is ${description.length} chars: ${JSON.stringify(description)}`,
      ).toBeLessThanOrEqual(160);
    });

    it('pubDate: coercible date', () => {
      expect(isDateLike(data.pubDate), `pubDate=${String(data.pubDate)}`).toBe(true);
    });

    it('verifiedDate: required, coercible date', () => {
      expect(data.verifiedDate, 'verifiedDate is required by CONTRACTS §2').toBeDefined();
      expect(isDateLike(data.verifiedDate), `verifiedDate=${String(data.verifiedDate)}`).toBe(true);
    });

    it('updatedDate: optional, coercible date when present', () => {
      if (data.updatedDate === undefined) return;
      expect(isDateLike(data.updatedDate), `updatedDate=${String(data.updatedDate)}`).toBe(true);
    });

    it('author: string when present (schema default "Content Team")', () => {
      if (data.author === undefined) return;
      expect(typeof data.author).toBe('string');
      expect(String(data.author).length).toBeGreaterThan(0);
    });

    it('category: one of the three enum members', () => {
      expect(CATEGORIES).toContain(data.category);
    });

    it('tags: 1–5 lowercase-kebab strings', () => {
      expect(Array.isArray(data.tags)).toBe(true);
      const tags = data.tags as string[];
      expect(tags.length, `tags=${JSON.stringify(tags)}`).toBeGreaterThanOrEqual(1);
      expect(tags.length, `tags=${JSON.stringify(tags)}`).toBeLessThanOrEqual(5);
      for (const tag of tags) {
        expect(typeof tag).toBe('string');
        expect(tag, `tag ${JSON.stringify(tag)} is not lowercase-kebab`).toMatch(KEBAB);
      }
    });

    it('draft: boolean when present', () => {
      if (data.draft === undefined) return;
      expect(typeof data.draft).toBe('boolean');
    });

    it('sources: at least 2', () => {
      expect(Array.isArray(data.sources)).toBe(true);
      expect(
        (data.sources as unknown[]).length,
        'CONTRACTS §2 requires min 2 sources',
      ).toBeGreaterThanOrEqual(2);
    });

    it('sources[]: each has title, valid http(s) url, publisher, accessed date', () => {
      const sources = (data.sources ?? []) as Record<string, unknown>[];
      sources.forEach((source, i) => {
        expect(typeof source.title, `sources[${i}].title`).toBe('string');
        expect(String(source.title).length, `sources[${i}].title is empty`).toBeGreaterThan(0);
        expect(isHttpUrl(source.url), `sources[${i}].url=${String(source.url)} is not a valid URL`)
          .toBe(true);
        expect(typeof source.publisher, `sources[${i}].publisher`).toBe('string');
        expect(String(source.publisher).length, `sources[${i}].publisher is empty`)
          .toBeGreaterThan(0);
        expect(
          isDateLike(source.accessed),
          `sources[${i}].accessed=${String(source.accessed)} is not a date`,
        ).toBe(true);
      });
    });

    it('no unknown frontmatter keys beyond CONTRACTS §2', () => {
      const allowed = new Set([
        'title', 'description', 'pubDate', 'updatedDate', 'verifiedDate',
        'author', 'category', 'tags', 'draft', 'sources',
      ]);
      const unknown = Object.keys(data).filter((k) => !allowed.has(k));
      expect(unknown, `unknown keys: ${unknown.join(', ')}`).toEqual([]);
    });
  });
});

/**
 * CONTRACTS §2b — the `personal` collection. Same transcription approach, but a
 * different table: description floor is 20 not 70, tags are 0–6, `category` is
 * absent by design, and the citation fields are optional. The point of testing
 * it separately rather than parameterising is that the *differences* are the
 * contract; a shared loop would quietly let one bound stand in for the other.
 */
describe('CONTRACTS §2b — the `personal` collection (owner blog)', () => {
  it('there is at least one personal entry to validate', () => {
    expect(
      personalFiles.length,
      'src/content/personal/ is empty — §2b coverage would pass vacuously',
    ).toBeGreaterThan(0);
  });

  describe.each(personalFiles.map((p) => [rel(p), p] as const))('%s', (name, file) => {
    const data = frontmatterOf(file);

    it('filename is lowercase-kebab', () => {
      expect(slugOf(file)).toMatch(KEBAB);
    });

    it('title: string, 10–70 chars', () => {
      const title = String(data.title);
      expect(typeof data.title).toBe('string');
      expect(title.length, `title is ${title.length} chars`).toBeGreaterThanOrEqual(10);
      expect(title.length, `title is ${title.length} chars`).toBeLessThanOrEqual(70);
    });

    it('description: string, 20–160 chars (§2b floor, not §2a\'s 70)', () => {
      const description = String(data.description);
      expect(typeof data.description).toBe('string');
      expect(description.length, `description is ${description.length} chars`).toBeGreaterThanOrEqual(20);
      expect(description.length, `description is ${description.length} chars`).toBeLessThanOrEqual(160);
    });

    it('pubDate: coercible date', () => {
      expect(isDateLike(data.pubDate), `pubDate=${String(data.pubDate)}`).toBe(true);
    });

    it('updatedDate / verifiedDate: optional, coercible when present', () => {
      for (const field of ['updatedDate', 'verifiedDate'] as const) {
        if (data[field] === undefined) continue;
        expect(isDateLike(data[field]), `${field}=${String(data[field])}`).toBe(true);
      }
    });

    it('author: string when present (schema default "Niklas Klasen")', () => {
      if (data.author === undefined) return;
      expect(typeof data.author).toBe('string');
      expect(String(data.author).length).toBeGreaterThan(0);
    });

    it('tags: 0–6 lowercase-kebab strings', () => {
      if (data.tags === undefined) return;
      expect(Array.isArray(data.tags)).toBe(true);
      const tags = data.tags as string[];
      expect(tags.length, `tags=${JSON.stringify(tags)}`).toBeLessThanOrEqual(6);
      for (const tag of tags) expect(tag, `tag ${JSON.stringify(tag)}`).toMatch(KEBAB);
    });

    it('category: absent — it is an agent-blog taxonomy (§2b)', () => {
      expect(
        data.category,
        `${name} declares a category; CONTRACTS §2b excludes it from this schema`,
      ).toBeUndefined();
    });

    it('sources: optional, but min 1 with valid entries when present', () => {
      if (data.sources === undefined) return;
      expect(Array.isArray(data.sources)).toBe(true);
      const sources = data.sources as Record<string, unknown>[];
      expect(sources.length, 'CONTRACTS §2b: min 1 source when present').toBeGreaterThanOrEqual(1);
      sources.forEach((source, i) => {
        expect(typeof source.title, `sources[${i}].title`).toBe('string');
        expect(isHttpUrl(source.url), `sources[${i}].url=${String(source.url)}`).toBe(true);
        expect(typeof source.publisher, `sources[${i}].publisher`).toBe('string');
        expect(isDateLike(source.accessed), `sources[${i}].accessed`).toBe(true);
      });
    });

    it('originalUrl: a valid URL when present', () => {
      if (data.originalUrl === undefined) return;
      expect(isHttpUrl(data.originalUrl), `originalUrl=${String(data.originalUrl)}`).toBe(true);
    });

    it('draft: boolean when present', () => {
      if (data.draft === undefined) return;
      expect(typeof data.draft).toBe('boolean');
    });

    it('no unknown frontmatter keys beyond CONTRACTS §2b', () => {
      const allowed = new Set([
        'title', 'description', 'pubDate', 'updatedDate', 'author',
        'tags', 'draft', 'verifiedDate', 'sources', 'originalUrl',
      ]);
      const unknown = Object.keys(data).filter((k) => !allowed.has(k));
      expect(unknown, `unknown keys: ${unknown.join(', ')}`).toEqual([]);
    });
  });
});

/**
 * §2b: "Slugs must be unique across both collections — they share the /tags/
 * namespace and the combined feed, and a reader should never meet the same slug
 * twice." Nothing in the build enforces this; the two collections are separate
 * globs, so a collision produces two live pages and two feed items with the same
 * name and no error.
 */
describe('CONTRACTS §2b — slugs are unique across both collections', () => {
  it('no slug appears in both src/content/posts and src/content/personal', () => {
    const agent = new Set(postFiles.map(slugOf));
    const collisions = personalFiles.map(slugOf).filter((slug) => agent.has(slug));
    expect(
      collisions,
      'the same slug exists in both collections; the build will not catch this',
    ).toEqual([]);
  });

  it('no slug is duplicated within a collection', () => {
    for (const [name, files] of [
      ['posts', postFiles],
      ['personal', personalFiles],
    ] as const) {
      const slugs = files.map(slugOf);
      expect(new Set(slugs).size, `duplicate slug within ${name}`).toBe(slugs.length);
    }
  });
});

describe('CONTRACTS §2 — the schema implementation itself', () => {
  const file = abs('src/content.config.ts');
  const source = read(file);

  it('sources[].url uses the amended z.url() form (CONTRACTS §2 amendment 2026-08-19)', () => {
    // The contract was amended to `z.url()`; `z.string().url()` is the deprecated
    // zod-3 overload and is what raises the single `astro check` hint.
    expect(
      source.includes('z.string().url()'),
      'src/content.config.ts still uses the deprecated z.string().url()',
    ).toBe(false);
  });

  it('declares every CONTRACTS §2a field', () => {
    for (const field of [
      'title', 'description', 'pubDate', 'updatedDate', 'verifiedDate',
      'author', 'category', 'tags', 'draft', 'sources',
    ]) {
      expect(source, `${field} missing from the schema`).toContain(`${field}:`);
    }
  });

  it('declares both collections, loaded from their own directories', () => {
    expect(source, 'CONTRACTS §2 defines two collections').toMatch(
      /export const collections\s*=\s*\{[^}]*\bposts\b[^}]*\bpersonal\b[^}]*\}/,
    );
    expect(source).toMatch(/base:\s*['"]\.\/src\/content\/posts['"]/);
    expect(source).toMatch(/base:\s*['"]\.\/src\/content\/personal['"]/);
  });

  it('declares the §2b-only field originalUrl', () => {
    expect(source, 'originalUrl missing from the personal schema').toContain('originalUrl:');
  });
});
