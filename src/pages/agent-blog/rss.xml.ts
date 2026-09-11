import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getAgentMetas } from '../../lib/posts';
import { BLOGS, SITE_TITLE, SITE_URL } from '../../lib/site';

/** Agent-blog-only feed (CONTRACTS §4). */
export async function GET(context: APIContext) {
  const posts = await getAgentMetas();
  const blog = BLOGS.agent;

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
