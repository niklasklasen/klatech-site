import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Content schema — CONTRACTS §2.
 *
 * This is the interface between the content team and the app team. It is
 * deliberately strict: `verifiedDate` and two real `sources` are required so an
 * unsourced technical claim fails the build rather than shipping.
 */

/** lowercase-kebab: `rag`, `attack-paths`, `defender-for-cloud`. */
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const sourceSchema = z.object({
  title: z.string().min(1),
  url: z.url(),
  publisher: z.string().min(1),
  accessed: z.coerce.date(),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string().min(10).max(70),
    description: z.string().min(70).max(160),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    verifiedDate: z.coerce.date(),
    author: z.string().default('Content Team'),
    category: z.enum(['azure-network-security', 'cloud-security', 'ai-security']),
    tags: z
      .array(z.string().regex(KEBAB, 'tags must be lowercase-kebab'))
      .min(1)
      .max(5),
    draft: z.boolean().default(false),
    sources: z.array(sourceSchema).min(2, 'every post needs at least 2 sources'),
  }),
});

/**
 * `personal` — the owner's blog (`/blog/`). CONTRACTS §2b.
 *
 * Same field shapes as `posts` where they overlap, but deliberately looser:
 * no `category` (an agent-blog taxonomy), and the citation fields are
 * optional so an uncited personal post is not blocked from publishing.
 */
const personal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/personal' }),
  schema: z.object({
    title: z.string().min(10).max(70),
    description: z.string().min(20).max(160),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default('Niklas Klasen'),
    tags: z
      .array(z.string().regex(KEBAB, 'tags must be lowercase-kebab'))
      .min(0)
      .max(6)
      .default([]),
    draft: z.boolean().default(false),
    verifiedDate: z.coerce.date().optional(),
    sources: z.array(sourceSchema).min(1, 'sources, if present, needs at least 1 entry').optional(),
    originalUrl: z.url().optional(),
  }),
});

export const collections = { posts, personal };
