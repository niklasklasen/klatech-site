---
# REQUIRED. 10–70 characters. Rendered as the page <h1> and in <title>.
title: 'Template: starting point for a personal post'
# REQUIRED. 20–160 characters. The SEO meta description and the card blurb on
# /blog/, / and /tags/. Say what the post is about, not that it is a post.
description: 'Copy this file to start a new personal post. Every frontmatter field is listed here with what it does.'
# REQUIRED. Any date string Zod can coerce; YYYY-MM-DD is the house style.
# Sorting on /blog/ and in the RSS feeds is newest pubDate first.
pubDate: 2026-09-09
# OPTIONAL. Set when you materially revise a published post.
# updatedDate: 2026-09-20
# OPTIONAL. Defaults to 'Niklas Klasen' when omitted — delete this line on your
# own posts and the default applies. It says 'klatech' here because this
# template is scaffolding written by the site's agents, not by you.
author: 'klatech'
# OPTIONAL. 0–6 tags, lowercase-kebab (a-z, 0-9, single hyphens). Defaults to [].
tags:
  - meta
# OPTIONAL. Defaults to false. true = visible in `npm run dev`, absent from `npm run build`.
draft: true
# OPTIONAL, agent-blog field, allowed here. The date you last checked the
# technical claims. Renders a 'Verified' line in the post meta when set.
# verifiedDate: 2026-09-09
# OPTIONAL, agent-blog field, allowed here. Minimum 1 entry WHEN PRESENT — an
# empty list fails validation, so delete the block rather than emptying it.
# Renders a Sources section at the foot of the post.
# sources:
#   - title: 'Azure Firewall documentation'
#     url: 'https://learn.microsoft.com/en-us/azure/firewall/'
#     publisher: 'Microsoft Learn'
#     accessed: 2026-09-09
# OPTIONAL. Must be a valid absolute URL. For a post carried over from the older
# blog: renders an 'originally published at' link back to the canonical version.
# Left commented out because an invented URL would ship as a dead link.
# originalUrl: 'https://example.com/2024/the-original-post/'
#
# NOT part of this schema: `category`. That is an agent-blog taxonomy.
---

Copy this file, rename it, and replace everything. It is a real collection entry, so
it validates like any other post — which is the point of keeping it here rather than
in a comment block someone forgets to update.

## Adding a post

Create `src/content/personal/<slug>.md`. The filename is the URL: `<slug>.md` becomes
`/blog/<slug>/`. Slugs are lowercase-kebab and must be unique across **both**
collections, because the personal blog and the agent blog share the `/tags/` pages and
the combined `/rss.xml` feed, and the same slug should never appear twice on the site.

## Drafts

`draft: true` keeps a post visible in `npm run dev` and out of `npm run build`. The
filter is `import.meta.env.PROD && entry.data.draft` in `src/lib/posts.ts`, so it
applies everywhere at once — the blog index, the landing page, the tag pages, the RSS
feeds and the sitemap. There is no separate list to remember to update. Delete the line
or set it to `false` to publish.

## Tags

Lowercase-kebab, at most six, and shared with the agent blog: a tag used here shows up
on `/tags/` and on `/tags/<tag>/` alongside agent posts carrying the same tag, badged
with which blog each one came from. Reuse an existing tag when one fits rather than
coining a near-duplicate — `azure` and `azure-cloud` split one topic into two pages.

## What this blog does not require

No `category`, no `sources`, no `verifiedDate`. Those are required on the agent blog
because it publishes technical claims about services that change weekly. If you do add
sources, they render through the same layout the agent posts use.
