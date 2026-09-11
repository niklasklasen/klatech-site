import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { abs, exists, read, rel, splitFrontmatter, walk } from './helpers';

/**
 * ACCEPTANCE (klatech remodel, frontend-dev): "A personal post with no category,
 * no sources and no tags renders as a deliberate page, not a broken one — no
 * empty Sources heading, no blank kicker."
 *
 * PostLayout serves both blogs (CONTRACTS §3), and every agent-blog block in it
 * is conditional. The failure mode is a heading, a <dt> or a kicker rendered
 * around data that is not there — visible as a stray "Sources" with nothing
 * under it. That is invisible to axe, to linkinator and to the build; only a
 * check of the emitted markup catches it.
 *
 * The assertions are paired with the same checks run against an agent post, so
 * a detector that has stopped finding anything cannot pass silently.
 */

const stripNonMarkup = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

type Page = {
  route: string;
  file: string;
  markup: string;
  data: Record<string, unknown>;
};

function pages(dir: string, base: string): Page[] {
  return walk(abs(dir), (p) => p.endsWith('.md'))
    .map((source) => {
      const data = yaml.load(splitFrontmatter(read(source)).frontmatter) as Record<string, unknown>;
      const slug = rel(source).replace(/^.*\//, '').replace(/\.md$/, '');
      const file = `dist${base}${slug}/index.html`;
      return { route: `${base}${slug}/`, file, data, markup: '' };
    })
    .filter((p) => p.data.draft !== true && exists(abs(p.file)))
    .map((p) => ({ ...p, markup: stripNonMarkup(read(abs(p.file))) }));
}

const personalPages = pages('src/content/personal', '/blog/');
const agentPages = pages('src/content/posts', '/agent-blog/');

/** The agent-blog furniture, as it appears in emitted markup. */
const FURNITURE = {
  sourcesSection: /<section[^>]*class="[^"]*\bsources\b[^"]*"/,
  sourcesHeading: /<h2[^>]*>\s*Sources\s*<\/h2>/,
  verifiedTerm: /<dt[^>]*>\s*Verified\s*<\/dt>/,
  verifiedNote: /Technically accurate as of/,
  kicker: /<p[^>]*class="[^"]*post__kicker[^"]*"/,
} as const;

describe('personal post pages render without the agent-blog furniture', () => {
  it('there is a published personal post to check (/blog/colophon/ is the fixture)', () => {
    expect(personalPages.length, 'no personal post in dist/').toBeGreaterThan(0);
    expect(personalPages.map((p) => p.route)).toContain('/blog/colophon/');
  });

  describe.each(personalPages.map((p) => [p.route, p] as const))('%s', (route, page) => {
    it('has exactly one <h1>', () => {
      expect((page.markup.match(/<h1[\s>]/g) ?? []).length).toBe(1);
    });

    it('renders no category kicker (personal posts have no category)', () => {
      expect(
        FURNITURE.kicker.test(page.markup),
        `${route} renders a post__kicker element, but §2b gives personal posts no category`,
      ).toBe(false);
    });

    it('renders no Sources section when the post cites none', () => {
      if (page.data.sources !== undefined) return;
      expect(
        FURNITURE.sourcesHeading.test(page.markup) || FURNITURE.sourcesSection.test(page.markup),
        `${route} renders a Sources section with nothing in it`,
      ).toBe(false);
    });

    it('renders no Verified meta or verified note when verifiedDate is unset', () => {
      if (page.data.verifiedDate !== undefined) return;
      expect(FURNITURE.verifiedTerm.test(page.markup), `${route} shows an empty Verified term`).toBe(
        false,
      );
      expect(
        FURNITURE.verifiedNote.test(page.markup),
        `${route} shows the "technically accurate as of" note with no date behind it`,
      ).toBe(false);
    });

    it('renders no empty definition terms or values in the meta block', () => {
      const empties = [
        ...page.markup.matchAll(/<(dt|dd|h2|p)[^>]*>\s*<\/\1>/g),
      ].map((m) => m[0]);
      expect(empties, `${route} emits empty elements: ${empties.join(', ')}`).toEqual([]);
    });

    it('still renders the meta that every post has: date, reading time, author', () => {
      for (const term of ['Published', 'Reading time', 'Author']) {
        expect(page.markup, `${route} is missing the ${term} meta`).toMatch(
          new RegExp(`<dt[^>]*>\\s*${term}\\s*</dt>`),
        );
      }
      expect(page.markup, `${route} does not show its byline`).toContain(
        String(page.data.author ?? 'Niklas Klasen'),
      );
    });

    it('declares its own /blog/<slug>/ canonical', () => {
      expect(page.markup).toContain(`<link rel="canonical" href="http://localhost:4321${route}"`);
    });

    it('links its tags into the shared /tags/ namespace', () => {
      const tags = (page.data.tags ?? []) as string[];
      for (const tag of tags) {
        expect(page.markup, `${route} does not link tag ${tag}`).toContain(`href="/tags/${tag}/"`);
      }
    });
  });
});

/**
 * The control group. If these assertions ever start failing, the detectors above
 * are matching nothing and the "no furniture" result is worthless.
 */
describe('the same detectors DO find the furniture on an agent post', () => {
  it('there is a published agent post to check', () => {
    expect(agentPages.length).toBeGreaterThan(0);
  });

  it.each(agentPages.map((p) => [p.route, p] as const))(
    '%s renders the Sources section, the Verified meta and the category kicker',
    (route, page) => {
      expect(FURNITURE.sourcesHeading.test(page.markup), `${route}: no Sources heading`).toBe(true);
      expect(FURNITURE.sourcesSection.test(page.markup), `${route}: no Sources section`).toBe(true);
      expect(FURNITURE.verifiedTerm.test(page.markup), `${route}: no Verified term`).toBe(true);
      expect(FURNITURE.verifiedNote.test(page.markup), `${route}: no verified note`).toBe(true);
      expect(FURNITURE.kicker.test(page.markup), `${route}: no category kicker`).toBe(true);
    },
  );
});

/**
 * Both blogs share one PostLayout by design (§3: "an unsourced personal post and
 * a cited security post should look like they belong to the same site"). This
 * asserts the shared chrome really is shared rather than forked per blog.
 */
describe('both blogs render through the same layout', () => {
  it('personal and agent post pages carry the same layout classes', () => {
    const shared = ['post__header', 'post__title', 'post__meta', 'prose'];
    for (const cls of shared) {
      expect(personalPages[0].markup, `personal post missing .${cls}`).toContain(cls);
      expect(agentPages[0].markup, `agent post missing .${cls}`).toContain(cls);
    }
  });
});
