import { describe, expect, it } from 'vitest';
import { collections } from '../../src/content.config';

/**
 * CONTRACTS §2 — what the schemas ACCEPT and, more importantly, what they REJECT.
 *
 * The rest of the schema coverage (content-schema.test.ts) transcribes the
 * contract table and measures the markdown that exists. That can only ever prove
 * the published content is conformant; it cannot prove the schema would stop a
 * non-conformant post, because a non-conformant post never gets committed. So
 * the guarantee the contract actually sells — "a post without two real sources
 * fails the build" (§2) — is untested by construction there.
 *
 * This file closes that hole by running the real zod schemas from
 * src/content.config.ts over fixtures. Every acceptance case is paired with the
 * matching rejection case: a schema test with no red-turning fixture proves
 * nothing, because `z.any()` would pass it.
 *
 * The zod objects are the unmodified ones the build validates with, resolved
 * through Astro's own vite config (see vitest.config.ts) rather than through a
 * QA-written stub of `astro:content`.
 */

/**
 * `collections[k].schema` is typed as a union that includes a context-taking
 * function form and `undefined`, because Astro allows either. Ours are plain
 * zod objects (read src/content.config.ts), so it is narrowed once here rather
 * than at twenty call sites.
 */
type ZodLike = {
  parse: (v: unknown) => Record<string, unknown>;
  safeParse: (v: unknown) => { success: boolean; error?: { issues: { path: unknown[] }[] } };
};

const schemaOf = (key: 'posts' | 'personal'): ZodLike =>
  collections[key].schema as unknown as ZodLike;

const postsSchema = schemaOf('posts');
const personalSchema = schemaOf('personal');

const why = (result: ReturnType<typeof postsSchema.safeParse>) =>
  (result.error?.issues ?? []).map((i) => i.path.join('.')).join(', ') || '(no issues)';

/** A minimal agent post that satisfies every §2a rule. Spread and override to break one rule at a time. */
const validAgentPost = () => ({
  title: 'A perfectly adequate ten-plus character title',
  description:
    'A description that is comfortably inside the seventy to one hundred and sixty character window the contract requires here.',
  pubDate: '2026-09-09',
  verifiedDate: '2026-09-09',
  category: 'cloud-security',
  tags: ['azure'],
  sources: [
    {
      title: 'First source',
      url: 'https://learn.microsoft.com/en-us/azure/',
      publisher: 'Microsoft Learn',
      accessed: '2026-09-01',
    },
    {
      title: 'Second source',
      url: 'https://nvd.nist.gov/',
      publisher: 'NIST',
      accessed: '2026-09-01',
    },
  ],
});

/** A minimal personal post: §2b's required fields and nothing else. */
const validPersonalPost = () => ({
  title: 'A personal post with a short title',
  description: 'Twenty characters or more, comfortably.',
  pubDate: '2026-09-09',
});

describe('CONTRACTS §2a — `posts` accepts a conformant agent post', () => {
  it('the baseline fixture parses (otherwise every rejection below is meaningless)', () => {
    const result = postsSchema.safeParse(validAgentPost());
    expect(result.success, `baseline agent fixture rejected on: ${why(result)}`).toBe(true);
  });

  it('applies the documented defaults for author and draft', () => {
    const parsed = postsSchema.parse(validAgentPost()) as unknown as {
      author: string;
      draft: boolean;
    };
    expect(parsed.author, 'CONTRACTS §2a: author defaults to "Content Team"').toBe('Content Team');
    expect(parsed.draft, 'CONTRACTS §2a: draft defaults to false').toBe(false);
  });
});

describe('CONTRACTS §2a — `posts` still rejects what it must reject', () => {
  /**
   * The headline rule of the whole repo: "a post without two real sources fails
   * the build". Asserted three ways, because the interesting failure mode is a
   * `.min(2)` quietly becoming `.min(1)` or `.optional()`.
   */
  it('rejects a post with one source', () => {
    const post = validAgentPost();
    post.sources = [post.sources[0]];
    expect(
      postsSchema.safeParse(post).success,
      'CONTRACTS §2a requires min 2 sources — the schema accepted a post with 1',
    ).toBe(false);
  });

  it('rejects a post with zero sources', () => {
    expect(postsSchema.safeParse({ ...validAgentPost(), sources: [] }).success).toBe(false);
  });

  it('rejects a post with no sources key at all', () => {
    const { sources: _omitted, ...post } = validAgentPost();
    expect(
      postsSchema.safeParse(post).success,
      'CONTRACTS §2a: sources is required, not optional',
    ).toBe(false);
  });

  it('rejects a source whose url is not a URL', () => {
    const post = validAgentPost();
    post.sources[1].url = 'learn.microsoft.com/no-scheme';
    expect(postsSchema.safeParse(post).success).toBe(false);
  });

  it('rejects a missing verifiedDate', () => {
    const { verifiedDate: _omitted, ...post } = validAgentPost();
    expect(
      postsSchema.safeParse(post).success,
      'CONTRACTS §2a: verifiedDate is required',
    ).toBe(false);
  });

  it('rejects a title outside 10–70 chars', () => {
    expect(postsSchema.safeParse({ ...validAgentPost(), title: 'Too short' }).success).toBe(false);
    expect(postsSchema.safeParse({ ...validAgentPost(), title: 'x'.repeat(71) }).success).toBe(
      false,
    );
  });

  it('rejects a description outside 70–160 chars', () => {
    expect(postsSchema.safeParse({ ...validAgentPost(), description: 'x'.repeat(69) }).success).toBe(
      false,
    );
    expect(
      postsSchema.safeParse({ ...validAgentPost(), description: 'x'.repeat(161) }).success,
    ).toBe(false);
  });

  it('rejects a category outside the three-member enum', () => {
    expect(postsSchema.safeParse({ ...validAgentPost(), category: 'personal' }).success).toBe(false);
  });

  it('rejects 0 tags and 6 tags (the §2a bounds are 1–5)', () => {
    expect(postsSchema.safeParse({ ...validAgentPost(), tags: [] }).success).toBe(false);
    expect(
      postsSchema.safeParse({ ...validAgentPost(), tags: ['a', 'b', 'c', 'd', 'e', 'f'] }).success,
    ).toBe(false);
  });

  it('rejects a tag that is not lowercase-kebab', () => {
    expect(postsSchema.safeParse({ ...validAgentPost(), tags: ['Azure Networking'] }).success).toBe(
      false,
    );
  });
});

describe('CONTRACTS §2b — `personal` is looser exactly where the contract says', () => {
  it('accepts a post with no sources and no verifiedDate', () => {
    const result = personalSchema.safeParse(validPersonalPost());
    expect(
      result.success,
      `CONTRACTS §2b makes sources and verifiedDate optional; rejected on: ${why(result)}`,
    ).toBe(true);
  });

  it('accepts a post with no tags, and defaults them to []', () => {
    const parsed = personalSchema.parse(validPersonalPost()) as unknown as { tags: string[] };
    expect(parsed.tags, 'CONTRACTS §2b: tags default to []').toEqual([]);
  });

  it('defaults author to "Niklas Klasen"', () => {
    const parsed = personalSchema.parse(validPersonalPost()) as unknown as { author: string };
    expect(parsed.author).toBe('Niklas Klasen');
  });

  it('accepts a 20-char description, which `posts` would reject', () => {
    const shortish = 'Exactly twenty chars';
    expect(shortish.length).toBe(20);
    expect(personalSchema.safeParse({ ...validPersonalPost(), description: shortish }).success).toBe(
      true,
    );
    expect(
      postsSchema.safeParse({ ...validAgentPost(), description: shortish }).success,
      'the two collections must not have collapsed into the same description bound',
    ).toBe(false);
  });

  it('accepts up to 6 tags', () => {
    expect(
      personalSchema.safeParse({
        ...validPersonalPost(),
        tags: ['a', 'b', 'c', 'd', 'e', 'f'],
      }).success,
    ).toBe(true);
  });

  it('accepts originalUrl when it is a real URL', () => {
    expect(
      personalSchema.safeParse({
        ...validPersonalPost(),
        originalUrl: 'https://example.com/old-blog/post/',
      }).success,
    ).toBe(true);
  });

  it('accepts sources when present, rendering identically to an agent post', () => {
    expect(
      personalSchema.safeParse({ ...validPersonalPost(), sources: validAgentPost().sources })
        .success,
    ).toBe(true);
  });
});

describe('CONTRACTS §2b — `personal` is not a free-for-all', () => {
  it('rejects an empty sources array (min 1 when present)', () => {
    expect(
      personalSchema.safeParse({ ...validPersonalPost(), sources: [] }).success,
      'CONTRACTS §2b: sources needs min 1 entry when present — delete the key instead',
    ).toBe(false);
  });

  it('accepts a single source, unlike `posts`', () => {
    const one = [validAgentPost().sources[0]];
    expect(personalSchema.safeParse({ ...validPersonalPost(), sources: one }).success).toBe(true);
    expect(postsSchema.safeParse({ ...validAgentPost(), sources: one }).success).toBe(false);
  });

  it('rejects more than 6 tags', () => {
    expect(
      personalSchema.safeParse({
        ...validPersonalPost(),
        tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      }).success,
    ).toBe(false);
  });

  it('rejects a non-kebab tag, same as `posts`', () => {
    expect(personalSchema.safeParse({ ...validPersonalPost(), tags: ['Not Kebab'] }).success).toBe(
      false,
    );
  });

  it('rejects a missing title, description or pubDate', () => {
    for (const field of ['title', 'description', 'pubDate'] as const) {
      const post: Record<string, unknown> = validPersonalPost();
      delete post[field];
      expect(personalSchema.safeParse(post).success, `${field} must stay required`).toBe(false);
    }
  });

  it('rejects an originalUrl that is not a URL', () => {
    expect(
      personalSchema.safeParse({ ...validPersonalPost(), originalUrl: 'not a url' }).success,
    ).toBe(false);
  });

  /**
   * §2b: "category — not part of this schema. Categories are an agent-blog
   * taxonomy." Zod objects strip unknown keys by default rather than erroring,
   * so the observable contract is that `category` does not survive parsing.
   */
  it('does not carry a category through, even if one is written in the frontmatter', () => {
    const parsed = personalSchema.parse({
      ...validPersonalPost(),
      category: 'cloud-security',
    });
    expect(
      'category' in parsed,
      'CONTRACTS §2b: category is not part of the personal schema',
    ).toBe(false);
  });
});
