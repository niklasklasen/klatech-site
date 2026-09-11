import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPersonalMetas } from '../../lib/posts';
import { BLOGS, SITE_TITLE, SITE_URL } from '../../lib/site';

/** Personal-blog-only feed (CONTRACTS §4). */
export async function GET(context: APIContext) {
  const posts = await getPersonalMetas();
  const blog = BLOGS.personal;

  return rss({
    title: `${SITE_TITLE} — ${blog.title}`,
    description: blog.description,
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
