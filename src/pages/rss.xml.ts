import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getAllMetas } from '../lib/posts';
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from '../lib/site';

/** Combined feed: both blogs, newest first (CONTRACTS §4). */
export async function GET(context: APIContext) {
  const posts = await getAllMetas();

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    // `context.site` comes from `site:` in astro.config.mjs.
    site: context.site ?? SITE_URL,
    items: posts.map((post) => ({
      title: post.title,
      description: post.description,
      pubDate: post.pubDate,
      link: post.href,
      categories: post.tags,
    })),
  });
}
