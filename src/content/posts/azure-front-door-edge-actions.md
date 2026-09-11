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
computing a value — bucketing a user into an experiment cohort, verifying a JSON Web Token (JWT),
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
higher), installed automatically on first use — though the Edge Actions concept page still
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
