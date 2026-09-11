# ACCEPTANCE CRITERIA (Definition of Done)

You are done when every box for your role is true — verified by running something,
not by believing it. Report honestly: if a check fails and you could not fix it,
say so explicitly and file a ticket.

## backend-dev
- [ ] `src/content.config.ts` implements CONTRACTS §2 exactly (all fields, all constraints)
- [ ] Every route in CONTRACTS §4 exists and builds
- [ ] `toPostMeta()` in `src/lib/` maps an entry to the exact `PostMeta` shape (CONTRACTS §3)
- [ ] `readingTime` computed from the raw body (200 wpm, rounded up, min 1)
- [ ] No file in `src/pages/**` contains inline styling or markup that belongs in a component
- [ ] Drafts excluded when `import.meta.env.PROD`
- [ ] `/rss.xml` valid; sitemap emitted
- [ ] `npm run build` and `npm run check` both exit 0

## frontend-dev
- [ ] Every component in CONTRACTS §3 exists with exactly the specified props
- [ ] **Zero** imports of `astro:content` anywhere in `src/layouts/**` or `src/components/**`
- [ ] All tokens in CONTRACTS §5 defined in `src/styles/tokens.css`; light and dark both explicit
- [ ] No hard-coded hex/rgb outside `tokens.css`
- [ ] Readable at 360px, 768px and 1440px with no horizontal page scroll
- [ ] Code blocks and tables scroll inside their own container, never the page
- [ ] Semantic landmarks: one `<h1>` per page, `<main>`, `<nav>`, `<header>`, `<footer>`
- [ ] Visible focus states on all interactive elements; body text contrast >= 4.5:1 both themes
- [ ] `PostLayout` renders the Sources section from `post.sources` with real links

## qa
- [ ] `tests/` covers: content schema conformance, the `astro:content` import ban,
      token presence, route existence, RSS well-formedness
- [ ] Playwright run over the built site: no console errors, no 404s
- [ ] axe-core pass on `/`, a post page, and `/tags/` — zero critical or serious violations
- [ ] Link check across `dist/` — zero broken internal links
- [ ] Findings written to `.agents/qa-reports/<date>.md` and ticketed to the owning agent
- [ ] QA never fixes app code. QA reports.

## researcher
- [ ] `.agents/briefs/<slug>.md` exists with >= 6 sources, each with title, URL,
      publisher, access date, and a one-line note on what it supports
- [ ] Primary sources (Microsoft Learn, CVE/NVD, MITRE, vendor advisories) dominate
- [ ] Every URL was actually fetched and confirmed to exist and to say what is claimed
- [ ] GA vs preview status of the feature stated explicitly, with the date checked
- [ ] Open questions and contradictions between sources flagged, not smoothed over

## writer
- [ ] Draft at `.agents/drafts/<slug>.md`, 1200–1800 words
- [ ] Frontmatter satisfies CONTRACTS §2 exactly, `sources` >= 2 drawn from the brief
- [ ] Every technical claim traceable to the brief — no facts invented beyond it
- [ ] Style guide followed (voice, structure, formatting)
- [ ] At least one concrete runnable artifact (CLI/Bicep/PowerShell)

## editor
- [ ] Every technical claim checked against the brief's sources; unsupported claims cut or fixed
- [ ] At least 3 source URLs independently re-fetched and confirmed
- [ ] Frontmatter validated field by field against CONTRACTS §2 (count the chars)
- [ ] Style guide conformance pass
- [ ] Review note appended to the draft under `<!-- EDITOR REVIEW -->` listing what changed
      and anything the lead must decide

## content-lead
- [ ] Draft read end to end and judged publishable
- [ ] Copied to `src/content/posts/<slug>.md` with the review comment stripped
- [ ] `npm run check` passes with the real post in place

---

## Added 2026-09-09 — the klatech remodel

These are additional to the per-role lists above, which still stand.

### backend-dev
- [ ] Both collections in CONTRACTS §2 implemented; `posts` unchanged, `personal` looser
- [ ] Every §4 route exists and builds; `src/pages/posts/**` is gone
- [ ] `toArticleMeta()` sets `blog` and `href`; `href` comes from `hrefFor()`/`BLOGS` and
      is computed nowhere else in the codebase
- [ ] `/tags/**`, `/` and `/rss.xml` span both blogs; per-blog feeds exist and validate
- [ ] Drafts excluded in PROD in **both** collections

### frontend-dev
- [ ] `Hero` and `FeedSection` exist with exactly the §3 props
- [ ] `PostCard` and `PostLayout` type against `ArticleMeta` and link via `post.href`
- [ ] **No slug-built URLs** anywhere in `src/layouts/**` or `src/components/**`
- [ ] A personal post with no category, no sources and no tags renders as a deliberate
      page, not a broken one — no empty Sources heading, no blank kicker
- [ ] Landing page: two feeds side by side ≥768px, stacked below, no horizontal scroll
      at 360 / 768 / 1440

### qa
- [ ] Route, identity and component suites updated to the amended contract — a stale
      assertion is a QA defect, not an app defect (see the §7 self-guard precedent)
- [ ] Schema suite covers **both** collections, including that `personal` accepts a post
      with no sources and `posts` still rejects one
- [ ] A test that fails if any file under `src/layouts/**` or `src/components/**`
      constructs a post URL from a slug
- [ ] axe pass on `/`, `/agent-blog/`, `/blog/`, an agent post, a personal post, `/tags/`
- [ ] `dist/` contains no link to a `/posts/...` URL

### content-lead
- [ ] Personal-blog scaffolding is honestly marked as scaffolding — no invented
      biography, no fabricated post presented as the owner's writing

---

## Added 2026-09-11 — the theme toggle (CONTRACTS §5 amendment)

### frontend-dev
- [ ] Every colour token declared in all three states of the §5 amendment; a token
      present in two of them is a defect
- [ ] Every existing `prefers-color-scheme` rule has its `[data-theme]` counterpart —
      grep for it and check each hit, starting with `src/styles/global.css:491`
- [ ] Code blocks use the dark Shiki palette when dark is chosen **by the toggle on a
      light-OS machine**, not only when dark is the OS setting
- [ ] No flash of the wrong theme on load in either scheme, with a warm and a cold cache
- [ ] The control is a `<button>` with an accessible name, a visible focus ring, and a
      contrast-conformant hit area at 360px
- [ ] With JavaScript disabled the control is not visible, and the page still renders in
      the OS scheme
- [ ] `localStorage` unavailable (private mode, blocked site data) degrades to OS scheme
      rather than throwing — the head script must not break the page
