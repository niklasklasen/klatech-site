# Runbook

How to run **klatech**, add posts, and change things — with or without the agent teams.

The site has two blogs and they work differently:

| | `/agent-blog/` | `/blog/` |
|---|---|---|
| Written by | the agent team | you |
| Collection | `src/content/posts/` | `src/content/personal/` |
| Citation | `verifiedDate` + 2 `sources` **required**, enforced by the build | optional |
| Category | required, one of three | not a field |
| Add a post | §2 Routes A–C below | §2A-personal below |

Everything here assumes you are in `/Users/niklasklasen/Desktop/agent-blog`.

---

## 1. Everyday commands

```bash
npm run dev        # http://localhost:4321
npm run build      # static output to dist/
npm run preview    # serve the built site
```

Astro 7 daemonizes the dev server. Run it in the background and manage it:

```bash
npx astro dev --background
npx astro dev status
npx astro dev logs
npx astro dev stop
```

**The quality gate** — run all five before you consider a change done:

```bash
npm run check      # types + content schema validation
npm test           # 207 unit tests
npm run test:e2e   # 62 Playwright tests, incl. axe accessibility
npm run links      # crawls the built site for broken links
npm run build
```

`npm run links` and `npm run test:e2e` run against `dist/`, so **build first** or you are testing stale output.

---

## 2. Adding a blog post

First decide **which blog**. Everything in §2 up to "Route C" is the *agent blog* —
the strict one. Adding to your own blog is §2A-personal, further down, and is much
simpler.

Three routes into the agent blog. Pick by how much you want to write yourself.

### Route A — write it yourself, no agents

Create `src/content/posts/<slug>.md`. The filename is the URL: `my-post.md` → `/agent-blog/my-post/`.

Copy this template:

```markdown
---
title: "Your Title Here Between Ten And Seventy Chars"
description: "A meta description between 70 and 160 characters that says what the reader will actually learn."
pubDate: 2026-08-20
verifiedDate: 2026-08-20
author: "Niklas Klasen"
category: "azure-network-security"
tags: ["azure", "networking"]
draft: false
sources:
  - title: "Page title"
    url: "https://learn.microsoft.com/..."
    publisher: "Microsoft Learn"
    accessed: 2026-08-20
  - title: "Second source"
    url: "https://example.com/..."
    publisher: "Publisher"
    accessed: 2026-08-20
---

Your post body. Start with the problem in 2-4 sentences.

## A section

Use `##` for sections and `###` beneath. Never use `#` — the title is the H1.
```

**The schema is strict and enforced at build time.** These fail the build, not review:

| Field | Rule |
|---|---|
| `title` | 10–70 characters |
| `description` | 70–160 characters |
| `pubDate` | any parseable date |
| `updatedDate` | optional |
| `verifiedDate` | **required** — when you actually checked the claims |
| `author` | defaults to `"Content Team"` if omitted |
| `category` | exactly one of `azure-network-security`, `cloud-security`, `ai-security` |
| `tags` | 1–5, lowercase-kebab only (`attack-paths`, not `Attack Paths`) |
| `draft` | `true` hides it from production builds; it still shows in `npm run dev` |
| `sources` | **at least 2**, each with `title`, `url`, `publisher`, `accessed` |

The two-source minimum is deliberate: an uncited technical claim fails the build rather than shipping. If you genuinely want a post with fewer, change the schema in `src/content.config.ts` — but that is a decision, not a workaround.

**Character counts trip people up.** Check before building:

```bash
node -e "const m=require('fs').readFileSync('src/content/posts/YOUR-POST.md','utf8').match(/^---\n([\s\S]*?)\n---/)[1];
for (const f of ['title','description']) {
  const v = m.match(new RegExp('^'+f+':\\\\s*\"?(.*?)\"?$','m'))?.[1] ?? '';
  console.log(f, v.length);
}"
```

Then:

```bash
npm run check    # tells you exactly which field failed and why
npm run dev
```

### Route B — the full content team

Four agents in sequence. Each hands off through a file, so you can stop and inspect between any two steps.

```
researcher   -> .agents/briefs/<slug>.md     cited research brief
writer       -> .agents/drafts/<slug>.md     draft, no web access
editor       -> edits the draft in place     fact-check + line edit
content-lead -> src/content/posts/<slug>.md  publishes
```

**Decide three things first**, because every prompt below takes them as placeholders:

- **slug** — becomes the URL. `azure-private-endpoint-dns` → `/agent-blog/azure-private-endpoint-dns/`
- **category** — exactly one of `azure-network-security`, `cloud-security`, `ai-security`
- **today's date** — pass it explicitly rather than letting an agent assume it. `verifiedDate` is a claim about when someone actually checked, and it is the field the whole citation guarantee rests on.

Run them one at a time, in this order. Paste these into Claude Code:

**1. Research**
> Use the researcher agent to produce a research brief on `<TOPIC>`, slug `<slug>`, output to `.agents/briefs/<slug>.md`. Today's date is `<YYYY-MM-DD>`. Establish GA vs preview status explicitly, fetch every URL you cite, and flag every open question and contradiction for the writer.

**2. Draft**
> Use the writer agent to draft `.agents/drafts/<slug>.md` from the brief at `.agents/briefs/<slug>.md`. Category `<category>`, 1200-1800 words, today's date is `<YYYY-MM-DD>`. Read the brief's open-questions section before writing.

**3. Edit**
> Use the editor agent to fact-check and line-edit `.agents/drafts/<slug>.md` against the brief. Do the fact-check pass first, re-fetch at least 3 cited URLs, resolve every TODO(researcher) marker, then append the review block.

**4. Publish**
> Use the content-lead agent to review `.agents/drafts/<slug>.md` and publish it to `src/content/posts/<slug>.md` if you approve. Strip the editor review block and run `npm run check`.

**5. Verify the site still builds**
> Use the qa-gate agent to run the full gate and report anything failing.

`content-lead` runs `npm run check` in step 4, which validates the frontmatter schema — but that is one of five commands. A new post also adds a page, tag entries, RSS items and sitemap URLs, and only `npm run test:e2e` and `npm run links` cover those. Step 4 passing does not mean the site is green.

**Why the writer has no web access.** It is not an oversight. The writer's entire factual universe is the researcher's brief, so it cannot invent a plausible-looking Azure property name — gaps surface as `TODO(researcher)` markers instead of confident fiction. If you give the writer web access, you lose that guarantee.

#### The two checkpoints

Route B hands off through files, so you can stop anywhere. Two of those stops earn their time:

**After step 1, skim the brief.** Everything downstream inherits its errors, and the writer has no web access to catch them — if the researcher recorded a preview feature as GA, nothing later in the chain can know. This is the cheapest possible place to intervene.

**After step 3, read the editor's report before running step 4.** It says publish / publish with changes / reject, and the reject case is real — it is meant to be used. If the editor says a draft is built on a misunderstanding of the technology, sending it to `content-lead` anyway just relocates the argument; `content-lead` can reject too, and will.

### Route C — mix and match

The chain is just files, so you can enter it anywhere:

- **You write, agents check.** Put your draft in `.agents/drafts/<slug>.md`, then run the editor on it. You get a fact-check pass without giving up the writing.
- **Agents research, you write.** Run the researcher, then write from the brief yourself.
- **You write, publish directly.** Route A. No agents at all.

---

### Route A-personal — your own blog

No agents, no pipeline, no citation requirement. Create `src/content/personal/<slug>.md`;
the filename is the URL: `my-post.md` → `/blog/my-post/`.

`src/content/personal/template-post.md` is a `draft: true` template with every field
commented — copy it. The short version:

```markdown
---
title: "Ten to seventy characters"
description: "20 to 160 characters. Used as the meta description and on the cards."
pubDate: 2026-09-09
tags: ["something", "lowercase-kebab"]
draft: false
---

Your post.
```

| Field | Rule |
|---|---|
| `title` | 10–70 characters |
| `description` | 20–160 characters (the agent blog's floor is 70; yours is lower on purpose) |
| `pubDate` | any parseable date |
| `updatedDate` `verifiedDate` | optional |
| `author` | defaults to `"Niklas Klasen"` |
| `tags` | 0–6, lowercase-kebab, shared with the agent blog's `/tags/` pages |
| `draft` | `true` hides it from production builds; still visible in `npm run dev` |
| `sources` | **optional** here. If present, at least one, same shape as the agent blog |
| `originalUrl` | optional — the post's URL on your older blog. Renders an "originally published at" link |
| `category` | **not a field on this collection.** Categories are an agent-blog taxonomy |

**Importing the old blog.** Each imported post becomes one file in
`src/content/personal/`, with `pubDate` set to its *original* publication date and
`originalUrl` pointing at where it used to live. The tag vocabulary is shared with the
agent blog, so an import that invents forty new tags will bloat `/tags/` — pick the
tags deliberately. No agent will do this import unprompted: `docs/OWNERSHIP.md` forbids
agents inventing content in your name. When you have the export, hand it over and ask
for it explicitly.

---

## 3. Changing the site

### Who owns what

Ask the agent that owns the file. Asking the wrong one gets you a ticket instead of a change — by design.

| You want to change | Agent | Files |
|---|---|---|
| Colors, fonts, spacing, layout, responsive behavior | **frontend-dev** | `src/styles/`, `src/layouts/`, `src/components/` |
| URLs, routing, RSS, sitemap, the content schema, reading time | **backend-dev** | `src/pages/`, `src/lib/`, `src/content.config.ts`, `astro.config.mjs` |
| Tests, accessibility audits, defect investigation | **qa** | `tests/` |
| "Is it still green?" — a plain gate re-run | **qa-gate** | writes nothing |
| Editorial standards, what gets published | **content-lead** | `src/content/posts/`, and it enforces `docs/STYLEGUIDE.md` |
| Your own blog's posts | **you** | `src/content/personal/` — agents scaffold and fix frontmatter there, nothing more |

Anything in `docs/`, `package.json`, or `.claude/` is yours — no agent will touch those.

### How to invoke

Name the agent in plain language:

> Use the frontend-dev agent to make the accent color warmer and increase the post body line height slightly.

> Use the backend-dev agent to add pagination to the index page once there are more than 10 posts.

> Use the qa-gate agent to run the full gate and report anything failing.

> Use the qa agent to work out why the axe suite regressed on the post page, and pin it with a test.

**Reach for `qa-gate` first.** It runs on Haiku, writes nothing, and answers the only
question you usually have — green or red. Escalate to `qa` when the answer is red and you
need to know *why*, or when you want new coverage. Sending `qa` to do a routine re-run
costs roughly five times as much for the same five exit codes.

**Give them the acceptance criteria, not just the task.** These agents verify by running things. "Make it look better" gets vague results; "increase contrast on muted text to at least 7:1 and confirm with the axe suite" gets a measured answer.

### After any site change

```bash
npm run build && npm run check && npm test && npm run test:e2e && npm run links
```

Or just: *"Use the qa-gate agent to re-run the full gate and report what fails."*

---

## 4. The rules that keep this working

Four documents in `docs/` govern the agents. **They are frozen** — agents may not edit them, which is what stops an agent from redefining the spec to make its own task easier. You can change them; you are the lead.

- **`CONTRACTS.md`** — the frozen interfaces: content schema, component props, route map, design tokens. Because these were fixed before anyone started, backend and frontend built simultaneously without reading each other's code. If you change a contract, log an amendment inline like the two already there.
- **`OWNERSHIP.md`** — the path-to-agent write map. This is what prevents two parallel agents from overwriting each other.
- **`STYLEGUIDE.md`** — editorial voice, plus the accuracy rules: every technical claim traceable to a primary source, GA vs preview always explicit.
- **`ACCEPTANCE.md`** — per-role definition of done.

`.agents/backlog.md` is the cross-team ticket queue. When an agent needs a change in a file it does not own, it files a ticket there instead of editing. Skim it after a round — that is where the "I noticed something but it wasn't mine to fix" findings land.

**Keep the backlog short — it is a hot path.** `backend-dev` and `frontend-dev` read it in full on every single invocation, so its size is a tax on every round. Two rules enforce that, both in `OWNERSHIP.md`: a ticket is five lines at most (detail lives in the filer's own report file and is cited by path), and a closed ticket moves to `.agents/backlog-archive.md` rather than sitting in place as `- [x]`. The archive is for humans and `git log`; nothing reads it automatically. It started at 19 tickets and 30 KB — which is what the backlog had accumulated before the split.

**Running agents in parallel:** safe only when they own disjoint paths. frontend-dev and backend-dev in parallel is fine and was how this was built. Two agents on the same directory will lose each other's work.

---

## 5. Troubleshooting

| Symptom | Cause |
|---|---|
| `does not match expected schema` on build | A frontmatter field violates §2. `npm run check` names the field and the rule. |
| Post doesn't appear on the site | `draft: true`, or you're looking at a production build. Drafts show in `npm run dev` only. |
| `String must contain at most 70 character(s)` | Title too long. Descriptions are 70–160, titles 10–70 — easy to mix up. |
| `Invalid enum value` on `category` | Only three are allowed. Adding a fourth means editing `src/content.config.ts` (backend-dev's file). |
| `tags must be lowercase-kebab` | `"Attack Paths"` → `"attack-paths"`. |
| Tests fail after a content change | Some tests assert against the published corpus. Run `npm test` and read the assertion — it usually means a real schema violation. |
| An agent says it can't edit a file | Working as intended. It filed a ticket in `.agents/backlog.md`; re-run the task with the agent that owns the file. |
| Agent name not recognized | Agent definitions load at session start. Restart Claude Code after editing `.claude/agents/`. |

---

## 6. Known limitations

- **KL1 — check before deploying.** Error pages carry a canonical URL and no `noindex`. That is harmless *only* while the host returns a real HTTP 404. Some static hosts serve the error document with 200 — on such a host `/404` becomes indexable and its canonical actively tells crawlers to fold it into the site. Verify your host returns 404 for an unknown path, and revisit if it doesn't.
- **KL2** — markdown tables are keyboard-scrollable only with JavaScript enabled. Low impact; no CSS-only fix exists.
- **Single-post corpus** — post ordering, multi-post tag pages and draft exclusion are only lightly exercised until there is a second post.
- `site` in `astro.config.mjs` is still `http://localhost:4321`. It becomes `https://klatech.se` at deploy time and not before — RSS, sitemap and every canonical URL are built from it, and QA's suite pins the localhost value, so changing it is one coordinated change across `astro.config.mjs`, `src/lib/site.ts` and `tests/`.
- **Not deployed yet.** The target is a single Azure Static Web App serving all four
  parts of the site from one `dist/`. Nothing about that has been set up: no
  `staticwebapp.config.json`, no workflow, no resource. When you do it, KL1 above is
  the first thing to check — confirm the app returns a real HTTP 404, not a 200, for
  an unknown path.
- **Contact links are live** as of 2026-09-09: email, GitHub and LinkedIn, defined once
  in `CONTACT_LINKS` in `src/lib/site.ts` and rendered in the footer and on `/about/`.
  Setting any `href` back to `null` renders that entry as plain text instead of a link —
  which is how to carry an entry you have no address for without shipping a dead link.
  Your email is a live `mailto:` on a page that will be public; if scraping becomes a
  problem, `null` plus the address as the label is the one-line answer.
- **The About page's "Who I am" section is a placeholder** and says so, marked with a
  `TODO(niklas)` comment in `src/pages/about.astro`. No agent will write it: `docs/OWNERSHIP.md`
  forbids inventing biography.
