# EDITORIAL STYLE GUIDE

Blog scope: **cyber security — Azure network security, cloud security, AI security.**
Audience: working practitioners — cloud/security engineers, architects, blue teamers.
They know what a subnet and an IAM role are. Do not explain the basics to them.

## Voice

- Direct and technical. Short sentences. Active voice.
- Write for someone who has to ship a config change on Monday.
- No hype, no "in today's ever-evolving threat landscape", no LinkedIn cadence.
- No em-dash-heavy rhetorical build-ups. No "it's not just X, it's Y".
- First person plural sparingly. Second person ("you") is fine and preferred for instructions.
- British or American spelling — pick American, be consistent.

## Hard accuracy rules

These are non-negotiable and the editor enforces them.

1. **Every technical claim traces to a source in `sources`.** Specifically: version
   numbers, CVE IDs, service limits, quotas, pricing, GA/preview status, default
   behaviors, and "X does not support Y" statements.
2. **Prefer primary sources**: Microsoft Learn, Azure updates/release notes, NVD/CVE,
   MITRE ATT&CK, CISA, vendor security advisories, RFCs. Blogs are secondary and may
   support but never carry a claim alone.
3. **Preview vs GA must be stated explicitly** for any Azure feature, with the date it
   was checked. Azure preview features change behavior without notice.
4. **Never invent**: portal menu paths, CLI flags, ARM/Bicep property names, resource
   provider strings, limit values, or CVE numbers. If you cannot verify it, write
   around it or omit it.
5. `verifiedDate` in frontmatter is the date the claims were actually checked — not
   the publication date, not a guess.
6. If a source contradicts the draft, the source wins.

## Structure

- Open with the problem in 2–4 sentences. No throat-clearing preamble.
- `## H2` for main sections, `### H3` beneath. Never skip a level. Never use `#` in
  the body — the title is the H1.
- 150–250 words per section. Break up anything longer.
- Include at least one concrete, runnable artifact: Azure CLI, PowerShell, Bicep, or
  a portal walkthrough with exact names.
- Close with a short "What this means in practice" or a limitations section. Not a
  summary of what you just said.
- Target length 1200–1800 words.

## Formatting

- Fenced code blocks with a language tag, always (`bash`, `powershell`, `bicep`, `json`).
- Keep code lines under ~80 chars where possible — long unwrappable lines break layouts.
- Placeholders in `<angle-brackets>`, e.g. `<subscription-id>`.
- Tables for comparisons and rule sets. Keep them under 5 columns.
- Bold for the first mention of a key term. No bold for emphasis mid-sentence.
- Define an acronym on first use: "Network Security Perimeter (NSP)".
- Inline links only for genuinely useful references; the `sources` list carries citations.

## Frontmatter

Must satisfy `docs/CONTRACTS.md` §2 exactly, or the build fails.
`description` is the SEO meta description: 70–160 chars, states what the reader learns.
