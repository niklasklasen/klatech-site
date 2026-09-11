---
title: "Azure Front Door Edge Actions and the 10 ms fail-open"
description: "Edge Actions runs JavaScript at the Front Door PoP. What it removes from your origin, and why its 10 ms execution budget fails open. Public preview."
pubDate: 2026-09-08
verifiedDate: 2026-09-08
author: "Content Team"
category: azure-network-security
tags:
  - azure-front-door
  - edge-actions
  - waf
  - preview
draft: false
sources:
  - title: "Edge Actions (Preview) - Azure Front Door"
    url: "https://learn.microsoft.com/en-us/azure/frontdoor/edge-actions"
    publisher: "Microsoft Learn"
    accessed: 2026-09-08
  - title: "What is a rule set? - Azure Front Door"
    url: "https://learn.microsoft.com/en-us/azure/frontdoor/front-door-rules-engine"
    publisher: "Microsoft Learn"
    accessed: 2026-09-08
  - title: "Routing Architecture - Azure Front Door"
    url: "https://learn.microsoft.com/en-us/azure/frontdoor/front-door-routing-architecture"
    publisher: "Microsoft Learn"
    accessed: 2026-09-08
  - title: "Microsoft.Cdn/profiles/ruleSets/rules (2026-04-01-preview)"
    url: "https://learn.microsoft.com/en-us/azure/templates/microsoft.cdn/2026-04-01-preview/profiles/rulesets/rules"
    publisher: "Microsoft Learn"
    accessed: 2026-09-08
  - title: "Microsoft.Cdn/edgeActions - Bicep, ARM template & Terraform AzAPI reference"
    url: "https://learn.microsoft.com/en-us/azure/templates/microsoft.cdn/edgeactions"
    publisher: "Microsoft Learn"
    accessed: 2026-09-08
  - title: "az edge-action"
    url: "https://learn.microsoft.com/en-us/cli/azure/edge-action?view=azure-cli-latest"
    publisher: "Microsoft Learn"
    accessed: 2026-09-08
  - title: "az edge-action version"
    url: "https://learn.microsoft.com/en-us/cli/azure/edge-action/version?view=azure-cli-latest"
    publisher: "Microsoft Learn"
    accessed: 2026-09-08
  - title: "includes/front-door-limits.md"
    url: "https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/includes/front-door-limits.md"
    publisher: "MicrosoftDocs/azure-docs"
    accessed: 2026-09-08
  - title: "Pricing - Front Door"
    url: "https://azure.microsoft.com/en-us/pricing/details/frontdoor/"
    publisher: "Microsoft Azure"
    accessed: 2026-09-08
  - title: "Azure Front Door billing"
    url: "https://learn.microsoft.com/en-us/azure/frontdoor/billing"
    publisher: "Microsoft Learn"
    accessed: 2026-09-08
---

The Azure Front Door rule set is declarative: up to 10 match conditions combined
with AND, 5 actions per rule, drawn from a fixed list of eleven action names.
No arithmetic, no hashing, no signature verification. So anything that required
computing a value — bucketing a user into an experiment cohort, verifying a JWT,
choosing an origin from state — had to be decided at the origin, a full round
trip from the point of presence (PoP) that already held the request.

**Edge Actions** runs your JavaScript at the PoP instead. It is in **public
preview** on Front Door Standard and Premium, checked against Microsoft Learn on
**2026-09-08**. Every ARM and REST API version for it is a preview version, so
treat the limits below as movable.

## What you can stop sending to the origin

Learn lists the scenarios supported in preview: A/B experimentation, request and
response header manipulation, request rejection, dynamic origin selection, URL
rewrite, URL redirect, and JWT token validation.

The code is handed an immutable context variable: the server variables, the
list of **healthy origins** in the matched route, the
request's **originating country code**, the **device type** from the User-Agent
header, and the current date-time stamp.

JavaScript is the only supported language and code size caps at **16 KB**. The
rule action schema accepts `invocationPoint` values `ClientRequest` and
`OriginRequest`, but Learn scopes the preview to client request invocations and
lists every supported scenario, response header manipulation included, under
that single invocation point. Write `ClientRequest`.

## The 10 ms budget fails open

The sentence to design around, from Learn:

> The service supports code execution for up to 10 ms. If the execution goes
> beyond this limit, the service terminates the code execution and sends the
> request without Edge Action processing.

Read that against the scenario list: JWT token validation and request
rejection. If your auth gate is an edge action and it blows the budget,
Front Door does not fail the request — it forwards it, unvalidated and
un-rejected. That is a fail-open control, and anything making a security decision
in an edge action needs an origin-side or WAF-side backstop.

Edge Actions also runs **after** the web application firewall (WAF), never
instead of it. WAF rules are evaluated first where the domain has them enabled,
then the rules engine runs, and only a rule configured to invoke an edge action
reaches your code. On a WAF violation Front Door returns an error to the client
and stops. An edge action can neither pre-filter for the WAF nor replace it.

Front Door logs carry `edgeActionsStatusCode` — `200` "Successful", `503` "Error
during execution". Alert on non-200. Your `console.log` output lands in
`EdgeActionConsoleLog`, keyed by `TrackingReference` (the `X-Azure-Ref` value),
which joins it to the WAF logs.

## Creating one

`az edge-action` lives in the `edge-action` extension (Azure CLI 2.75.0 or
higher), installed automatically on first use — though the concept page still
says portal or VS Code extension only.

```bash
az edge-action create --resource-group testrg --edge-action-name edgeAction1 \
  --location global --sku "{name:Standard,tier:Standard}"

az edge-action version create --resource-group testrg \
  --edge-action-name edgeAction1 --version version2 --location global \
  --deployment-type zip --is-default-version True

az edge-action version deploy-from-file --resource-group myResourceGroup \
  --edge-action-name myEdgeAction --version v1 --file-path ./mycode.js
```

`Microsoft.Cdn/edgeActions` is a top-level resource in a resource group, not a
child of the Front Door profile, and its name is alphanumeric only: max 50,
pattern `[a-zA-Z0-9]+`. During preview the upload can take up to 10 minutes.

Attachment is the gap. No `az edge-action` command associates an edge action with
a route. The ARM path is an `EdgeAction` action inside a rule set rule, carrying
`edgeActionReference.id` and `invocationPoint` — published as a schema, with no
end-to-end example. The portal path is **Front Door manager >** endpoint
**> Routes >** route **> Update route > Attach Edge Actions**.

## What this means in practice

The preview ceilings are low: 16 KB of code, 3 versions, 10 ms of execution, 100
Edge Actions resources per subscription. An edge action does nothing until a
route invokes it — route configurations are currently the only way in.

The rules engine and custom WAF rules carry no extra fee; Edge Actions bills on
two meters: `$0.1 per 1M invocations` list price, plus `$0.00005 per second`
beyond the first millisecond of each invocation. The pricing page states no
preview exemption, so budget as if you are billed.

Use it where the logic genuinely needs the edge, and back every edge-side
security decision with something that fails closed.

<!-- EDITOR REVIEW

Claims cut/corrected:
- "That healthy-origin state is what previously forced the round trip." CUT. Writer's
  causal inference, not in the brief and not in any source. Front Door already selects
  a healthy origin at the PoP without edge code; the round trip was forced by the need
  to *compute*, not by origin health data.
- "Response header manipulation is on the scenario list anyway, which sits uneasily
  with that." CORRECTED. This was the writer editorializing on brief O2/C2. The Learn
  page resolves it in its own voice: "During the preview, Edge Actions support only
  client request invocations, which support the following scenarios:" — and the list,
  response header manipulation included, hangs off that sentence. Rewritten to state
  exactly that, with no claim about whether response-side manipulation actually works.
  TODO(researcher) O2 removed; no residual unsupported claim.
- "Every ARM, REST and CLI API version for it is a preview version" -> "Every ARM and
  REST API version". The CLI has no per-feature API version, and the CLI reference is
  precisely where the misleading "GA" label lives. Narrowed to what the brief supports.
- "Access logs carry edgeActionsStatusCode" -> "Front Door logs carry". Learn puts that
  column under "Azure Front Door logs", not under an access-log schema.
- TODO(researcher) O1 RESOLVED by fetching. Confirmed there is no attach/associate
  command anywhere in the az edge-action group, and confirmed the rules template page
  publishes the EdgeAction action shape with no worked example attaching it to a route.
  Rewritten to say both, and to label the ARM route as a schema rather than a tested
  deployment, per brief O1.
- TODO(researcher) O7 RESOLVED by fetching the pricing page. No preview note, no free
  grant, no billing-suspension statement. Kept "list price" and added "the pricing page
  states no preview exemption, so budget as if you are billed" — a budgeting
  instruction, not a claim that invocations are charged today. Brief O7 respected.
- All three TODO markers are gone. None was resolved by guessing.

Checked and left standing (verified, not assumed):
- No "GA" anywhere in the body describing the feature. The CLI-reference trap (brief C3)
  did not leak in.
- No comparison to Cloudflare Workers, Lambda@Edge, Application Gateway or any CDN
  worker platform; no "replaces X" claim. Brief §7 and C6 held.
- No claim that the client sees a 503 (brief O8), no region/PoP coverage claim (O5),
  no SKU-matching claim (O6), no launch date (O9), no bare `az edge-action list` (O4).

Sources re-verified (5 fetched independently, 2026-09-08):
1. Edge Actions (Preview) - Azure Front Door — EXISTS, SUPPORTS. Title carries
   "(Preview)"; Important box says "currently in preview ... not yet released into
   general availability"; Applies to banner is "Front Door Standard / Front Door
   Premium". The 10 ms quote is verbatim correct, word for word. Request-flow steps
   confirm the ordering the post asserts: (3) WAF evaluated, (4) rules engine, (5) rules
   engine invokes Edge Action. Limits 16 KB / 3 / 10 ms / 100 confirmed. "Currently, you
   can invoke Edge Actions only through Azure Front Door route configurations" confirmed.
   Portal path "Front Door manager > endpoint > Routes > route > Update route > Attach
   Edge Actions" confirmed verbatim. edgeActionsStatusCode 200/503 confirmed. C1
   confirmed: the page still says portal UI or VS Code extension only.
2. Routing Architecture - Azure Front Door — EXISTS, SUPPORTS. WAF is evaluated before
   route matching and rule sets, and "If a rule gets violated, Front Door returns an
   error to the client and the request processing stops." Independently corroborates
   PP2's ordering claim from a second page.
3. az edge-action — EXISTS, and confirms the trap rather than the claim: every subcommand
   is Status "GA", Type "Extension". Feature status is not on this page. Extension
   requirement (CLI 2.75.0+) and the create example are verbatim correct. No attach or
   associate command exists in the group — O1 half-confirmed here.
4. Microsoft.Cdn/profiles/ruleSets/rules (2026-04-01-preview) — EXISTS, SUPPORTS. Eleven
   action names as listed; EdgeAction discriminator, edgeActionReference.id,
   invocationPoint ClientRequest|OriginRequest, typeName DeliveryRuleEdgeActionParameters.
   No end-to-end example — O1 other half confirmed.
5. Pricing - Front Door — EXISTS, SUPPORTS. $0.1 per 1M invocations, $0.00005 per second,
   ">1ms" footnote, both tiers. No preview qualifier of any kind on the page — O7.
   Zero 404s. Zero sources that failed to support what the draft attributes to them.

Style fixes: cut the two hedging constructions above; tightened the context-variable and
scenario-list sentences. Voice, heading hierarchy (H2 only, no skipped levels), bash fence
tag, PoP and WAF both defined on first use, no table, one runnable CLI artifact: all pass.
No hype and no throat-clearing to remove — the writer kept the opening clean.

Frontmatter: title 53 chars (10-70 OK). description 148 chars (70-160 OK). category
azure-network-security (allowed). tags 4, all lowercase-kebab (1-5 OK). sources 10 entries,
each with title/url/publisher/accessed (min 2 OK). verifiedDate 2026-09-08 is honest — it
is the date the brief was researched and the date I re-fetched. pubDate matches.

For content-lead to decide:
- LENGTH: I count the body at ~746 words by hand, against the 780 ceiling in the
  short-form ticket. I have no shell in this environment and could NOT run the node
  verification command. Please run it before publishing. If it reads over 780, the
  cheapest cut is the "Microsoft.Cdn/edgeActions is a top-level resource" sentence
  (~37 words), which is the least load-bearing paragraph in the post.
- The post carries 10 sources for a 746-word body. Correct but heavy in the rendered
  Sources section. Trimming to the 5 I re-verified plus the limits include would still
  clear the two-source minimum. Your call; I did not cut them.
- Brief O3 (EdgeActionProperties is an empty table on the ARM reference) is a genuine
  documentation gap and a decent hook, but there is no room for it inside 780 words.
-->

