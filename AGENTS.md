# Project instructions

**klatech** — the personal site of Niklas Klasen, published in future at `klatech.se`.
A landing page, two blogs and an about page, built as one static Astro site:

- `/agent-blog/` — a security blog written by a team of AI agents (collection: `posts`)
- `/blog/` — the owner's personal blog, written by him (collection: `personal`)

See `README.md` for the team structure and `docs/` for the contracts that govern it.

Humans: see [`docs/RUNBOOK.md`](docs/RUNBOOK.md) for how to add posts and invoke the teams.

## Before doing anything

Read `docs/CONTRACTS.md` and `docs/OWNERSHIP.md`. This repo is built by multiple
agents working in parallel, and both documents exist to stop them overwriting each
other. **Write only to the paths your role owns.** If you are the lead orchestrator,
you own `docs/`, `package.json`, `.claude/`, and git.

The four documents in `docs/` are frozen. Do not edit them to make a task easier —
if a contract is genuinely wrong, raise it with the user.

## Development

Dev server in background mode:

```
npx astro dev --background
```

Manage with `astro dev stop`, `astro dev status`, `astro dev logs`.

```
npm run build    # static build
npm run check    # astro check — types + content schema validation
npm run test     # vitest
npm run test:e2e # playwright
npm run links    # linkinator over dist/
```

## Astro 7 specifics

Verified against the installed package — trust these over recalled Astro 4/5 patterns:

- `import { defineCollection, getCollection, render } from 'astro:content'`
- `import { z } from 'astro/zod'` — `z` from `astro:content` is deprecated in v7
- `import { glob } from 'astro/loaders'`
- `render(entry)`, not `entry.render()`
- A collection entry's `id` is the slug; there is no `entry.slug`

When unsure about an API, read the `.d.ts` files under `node_modules/astro/` —
they are ground truth — or https://docs.astro.build.

## Dependencies

Never run `npm install` as a sub-agent. `package.json` is lead-owned; concurrent
installs corrupt the lockfile. Request dependencies via `.agents/backlog.md`.

## Content

Two collections, two different standards — see `docs/CONTRACTS.md` §2.

- **`src/content/posts/*.md`** — the agent blog. Strict: `verifiedDate` and at least
  two `sources` are required fields, so citation is enforced by the build rather than
  by convention. An uncited post is a failing build, not a bad post.
- **`src/content/personal/*.md`** — the owner's blog. Looser by design: no category,
  citation fields optional, `originalUrl` for posts imported from his older blog.
  **No agent writes a personal post.** That content is the owner's own writing;
  agents may scaffold and fix frontmatter, nothing more.

## Documentation

- [Routing and dynamic routes](https://docs.astro.build/en/guides/routing/)
- [Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Content collections](https://docs.astro.build/en/guides/content-collections/)
- [Styling](https://docs.astro.build/en/guides/styling/)
