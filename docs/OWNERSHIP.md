# OWNERSHIP

Parallel agents that write the same file destroy each other's work. This map is
the rule that prevents it. **Write only to paths you own.** Read anything.

| Path | Owner | Notes |
|---|---|---|
| `src/content.config.ts` | backend-dev | schema per CONTRACTS §2 |
| `src/pages/**` | backend-dev | routing + all data access |
| `astro.config.mjs` | backend-dev | integrations, `site` |
| `src/lib/**` | backend-dev | helpers (readingTime, toPostMeta) |
| `src/layouts/**` | frontend-dev | |
| `src/components/**` | frontend-dev | |
| `src/styles/**` | frontend-dev | |
| `public/**` | frontend-dev | favicon, static assets |
| `tests/**` | qa | |
| `playwright.config.ts` `vitest.config.ts` | qa | |
| `.agents/qa-reports/**` | qa | |
| _(nothing)_ | qa-gate | read-only by design — runs the gate, reports, writes nothing |
| `.agents/briefs/**` | researcher | |
| `.agents/drafts/**` | writer, then editor | handoff dir, see below |
| `.agents/backlog.md` | any agent, append-only | open tickets only; ≤5 lines each |
| `.agents/backlog-archive.md` | whoever closes a ticket | closed tickets; nothing reads this |
| `src/content/posts/**` | **content-lead only** | the agent blog; nobody else writes a live post |
| `src/content/personal/**` | **the site owner**, via content-lead | the human blog. Agents write here only when the owner asks; never invent a personal post |
| `docs/**` | lead | read-only for every agent |
| `package.json` `package-lock.json` | lead | **never run `npm install`** — request deps via backlog |
| `.claude/**` | lead | |
| `README.md` `CLAUDE.md` `AGENTS.md` | lead | |

## Content handoff chain

```
researcher  -> .agents/briefs/<slug>.md        (cited research brief)
writer      -> .agents/drafts/<slug>.md        (draft, schema-valid frontmatter)
editor      -> edits .agents/drafts/<slug>.md  (in place; appends a review note)
content-lead-> copies approved draft to src/content/posts/<slug>.md
```

The draft is not live until content-lead moves it. `src/content/posts/` is the
publication gate.

**The personal blog does not use this chain.** `src/content/personal/**` holds the
owner's own writing — he drafts it himself, or hands over an export from the old blog
to import. No agent researches, drafts, edits or invents a personal post. content-lead
may create scaffolding and may fix frontmatter to satisfy CONTRACTS §2b, and that is all.

## Cross-boundary changes

Need something changed in a file you don't own? Append a ticket to
`.agents/backlog.md`:

```
- [ ] (from: <your-agent-name>) (to: <owner>) <what and why, with file:line>
```

Do not edit the file yourself. Do not wait — carry on with everything else you can do.

**Keep a ticket to five lines or fewer:** what is wrong, where (`file:line`), and why it
matters. That is the whole ticket. Evidence, measurements, reasoning and repro steps go
in your own report file — `.agents/qa-reports/<date>.md` for @qa, the review block in the
draft for @editor — and the ticket cites that path. A ticket is an address, not an
argument: every agent that reads the backlog pays to read every ticket in it, so an essay
filed here is a cost charged to everyone who comes after you.

**When a ticket is resolved, move it to `.agents/backlog-archive.md`** — do not leave it
in place as `- [x]`. The backlog is a queue of open work; closed tickets are history and
nothing reads them. Whoever closes the ticket moves it, under its original section
heading.

## Never

- `npm install` / `npm uninstall` (lockfile races) — file a ticket to @lead
- `git commit`, `git checkout`, `git reset`, branch operations — the lead handles git
- editing `docs/**`
- deleting another agent's files
