# klatech

The personal site of Niklas Klasen — one static Astro site, four things in it:

| | |
|---|---|
| `/` | landing page |
| `/agent-blog/` | a security blog covering **Azure network security, cloud security and AI security**, written by a team of AI agents |
| `/blog/` | a personal blog, written by a human |
| `/about/` | about me |

Deploys as a single Azure Static Web App. Domain `klatech.se`, not yet live —
`site` is still `http://localhost:4321`.

The two blogs are held to deliberately different standards. The agent blog cannot
publish an uncited claim: `verifiedDate` and two `sources` are required schema
fields, so it fails the build. The personal blog has no such requirement, because a
human writing in his own name is a different kind of accountability.

## Quick start

```bash
npm run dev      # http://localhost:4321
npm run build    # static output to dist/
npm run preview  # serve the built site
```

**→ [`docs/RUNBOOK.md`](docs/RUNBOOK.md)** is the practical guide: how to add a post
(with the content team, or entirely by hand), how to ask an agent to change the site,
and what to run before calling a change done.

## The teams

Eight agents, defined in `.claude/agents/`, coordinated by a lead orchestrator.

**App team** — builds the site
| Agent | Model | Owns |
|---|---|---|
| `backend-dev` | sonnet | content schema, routing, RSS/sitemap, data helpers |
| `frontend-dev` | sonnet | layouts, components, design tokens, CSS |
| `qa` | opus | test authoring, accessibility audits, defect investigation |
| `qa-gate` | haiku | re-runs the five-command gate, reports green/red — cannot write |

**Content team** — writes the posts
| Agent | Model | Owns |
|---|---|---|
| `content-lead` | opus | editorial calendar, final publication decision |
| `researcher` | opus | cited research briefs, every URL verified by fetching it |
| `writer` | opus | drafts, working only from the brief — no web access, by design |
| `editor` | opus | fact-check against the brief, source re-verification, line edit |

The content team stays on Opus throughout: every one of those four roles is an accuracy
gate, and a technical security blog that publishes a plausible-sounding wrong fact has
failed at the only thing it exists to do. The app team builds against frozen contracts,
which is a much better fit for a cheaper model. The model in the frontmatter is a
default, not a ceiling — name a model when you invoke an agent to override it for a
round of genuinely architectural work.

## How they avoid destroying each other's work

Parallel agents writing the same file is the failure mode that kills multi-agent
builds. Four documents in `docs/` prevent it, and they are frozen — no agent may
edit them:

- **`CONTRACTS.md`** — the interfaces. Content frontmatter schema, the `PostMeta`
  view-model, exact component props, route map, design token names. Because these
  are fixed up front, backend and frontend can build simultaneously without ever
  reading each other's code.
- **`OWNERSHIP.md`** — a path-to-agent write map. Need a change in a file you do
  not own? File a ticket in `.agents/backlog.md`; do not edit it.
- **`STYLEGUIDE.md`** — editorial voice plus the accuracy rules that matter for
  security writing: every technical claim traceable to a primary source, GA vs
  preview status always explicit, nothing invented.
- **`ACCEPTANCE.md`** — per-role definition of done, verified by running something.

Two structural choices do most of the quality work:

1. **The writer has no web access.** Its entire factual universe is the researcher's
   brief, so it cannot quietly invent a plausible-looking Azure property name. Gaps
   surface as `TODO(researcher)` markers instead of confident fiction.
2. **Citation is enforced by the build.** `sources` (minimum two) and `verifiedDate`
   are required schema fields. An uncited post is not a bad post — it is a failing
   build.

## Content pipeline

```
researcher  -> .agents/briefs/<slug>.md
writer      -> .agents/drafts/<slug>.md
editor      -> reviews in place, appends <!-- EDITOR REVIEW -->
content-lead-> publishes to src/content/posts/<slug>.md
```

`src/content/posts/` is the publication gate, and `content-lead` is the only agent
that may write there. **This pipeline serves the agent blog only.** The personal
blog at `src/content/personal/` is the owner's own writing; no agent researches,
drafts or invents a post there.

## Stack

Astro 7.2.4, content collections with Zod v4 schema validation, `@astrojs/rss`,
`@astrojs/sitemap`. QA runs vitest, Playwright + axe-core, and linkinator.
