# Research brief: Azure Front Door Edge Actions

Slug: `azure-front-door-edge-actions`
Researcher: researcher agent
All facts verified by fetching the listed URLs on **2026-09-08**. Use `verifiedDate: 2026-09-08`.

Target: **650–780 words** in the markdown body (short-form exception ticket,
`.agents/backlog.md` §"Short-form exception, 2026-09-08"). Pick from §2 and §3 only.
Everything in §7 is explicitly out of scope for this post.

---

## 1. STATUS — READ THIS BEFORE YOU WRITE A SINGLE SENTENCE

> **Azure Front Door edge actions is in PUBLIC PREVIEW. It is NOT generally available.**
> Verified 2026-09-08 against Microsoft Learn.

The Learn page title is literally `Edge Actions (Preview) - Azure Front Door` and the page
carries an Important box:

> "Azure Front Door edge actions is currently in preview. See the Supplemental Terms of Use
> for Microsoft Azure Previews for legal terms that apply to Azure features that are in beta,
> preview, or otherwise not yet released into general availability."

Learn page `ms.date`: **2026-07-27**; `updated_at`: **2026-07-27T22:17:00Z**. So the page is
~6 weeks old as of writing — recent, but preview limits change without notice. Say so.

**Tiers.** The Learn page's "Applies to" banner reads:
`✔️ Front Door Standard  ✔️ Front Door Premium`.
So: **Standard and Premium both.** Not Front Door (classic) — classic retires **March 31, 2027**
and no longer supports profile creation or new domain onboarding.

**Every ARM/REST/CLI API version for this feature is a preview API version**:
`2024-07-22-preview`, `2025-09-01-preview`, `2025-12-01-preview`. There is no stable one.

**Trap for the writer:** the `az edge-action` CLI reference table lists every subcommand with
Status **"GA"**. That is the CLI extension's own maturity label emitted by the doc generator.
It does **not** mean the service feature is GA. Do not repeat "GA" anywhere.

**Regions:** no region restriction is documented anywhere I fetched. The resource is created
with `--location global` in Microsoft's own CLI example and the REST sample response shows
`"location": "global"`. Do not claim a region list. See open question O5.

---

## 2. THE THREE PAIN POINTS TO LEAD WITH

Ranked. Take the first two; take the third only if the word count allows.

### PP1 — Logic that needed computation had to round-trip to the origin

**Before.** The Front Door rule set is purely declarative. Verified from the rule set and rule
set actions docs:

- A rule is "composed of up to **10 match conditions** and **5 actions**".
- Match conditions are combined with **AND** only. Regex is supported in conditions.
- Rules are local to a rule set and "**can't be exported to use across other rule sets**" —
  you re-create the same rule in every rule set that needs it.
- The complete action set in the current schema is exactly eleven names:
  `AfdUrlSigning`, `CacheExpiration`, `CacheKeyQueryString`, `EdgeAction`, `ModifyRequestHeader`,
  `ModifyResponseHeader`, `OriginGroupOverride`, `RouteConfigurationOverride`, `UrlRedirect`,
  `UrlRewrite`, `UrlSigning`.

There is no arithmetic, no hashing, no loop, no signature verification. So anything that
required computing a value — bucketing a user into an experiment cohort, verifying a JWT
signature, choosing an origin from computed state — could not be expressed. Per the routing
architecture doc the request then goes: WAF → match route → **evaluate rule sets** → return
cached response → select origin → **forward the request to the origin**. The decision happened
at the origin, one full round-trip away from the PoP.

**After.** Learn lists the scenarios Edge Actions supports in preview, verbatim:

- A/B experimentation
- Request and response header manipulation
- Request rejection
- Dynamic origin selection
- URL rewrite
- URL redirect
- **JWT token validation**

The code gets an "immutable context variable that contains all the data of the server
variables, list of **healthy origins** in the matched route, user's request **originating
country code**, user's **device type** from user-agent header of the request, and current
**date-time stamp**." That is the origin-round-trip saving, stated concretely.

### PP2 — The 10 ms budget FAILS OPEN. This is the security story.

Straight from Learn, quote it:

> "The service supports code execution for up to 10 ms. If the execution goes beyond this
> limit, the service terminates the code execution and sends the request **without Edge Action
> processing**."

Read that against the supported-scenario list, which includes **JWT token validation** and
**request rejection**. If you build an auth gate or a reject rule as an edge action and it
blows the 10 ms budget, Front Door does not fail the request — it forwards it, unvalidated,
un-rejected. That is a fail-open control. Any edge action doing a security decision needs an
origin-side or WAF-side backstop.

Supporting facts for this section:

- **Edge Actions runs after the WAF, not instead of it.** Learn's step list for a route with
  an edge action attached: (1) request lands at a PoP, (2) matches a profile, (3) "If the
  domain is enabled with WAF rules, Azure Front Door evaluates them", (4) rules engine
  processes matching rules, (5) "If the request matches a rule configured to invoke Edge
  Action, the rules engine invokes Edge Action", (6) Hyperlight sandbox is created, (7) code
  executes. The routing architecture doc independently confirms WAF is first and that on a WAF
  violation "Front Door returns an error to the client and the request processing stops".
  So an edge action can never pre-filter for the WAF, and cannot replace it.
- **You can observe the failure.** Front Door access logs carry `edgeActionsStatusCode`:
  `200` = "Successful", `503` = "Error during execution". Alert on non-200 here.
- Your own `console.log` output lands in the `EdgeActionConsoleLog` Log Analytics table:
  columns `TimeGenerated`, `TrackingReference`, `LogMessage`, `EdgeActionVersion`, `Type`,
  `ResourceId`. `TrackingReference` is the `X-Azure-Ref` value, so it joins to the access and
  WAF logs.

### PP3 — Safe rollout of edge logic (use only if words allow)

A rule set change is an in-place edit; there is no version object and no canary primitive in
the rule set schema. Edge Actions adds one:

- Up to **3 versions** per Edge Action resource; one is marked default.
- **Execution filters** gate a non-default version on a request header. The ARM properties are
  `executionFilterIdentifierHeaderName`, `executionFilterIdentifierHeaderValue`, and
  `versionId`. Learn: "Only the *default version* and versions that execution filters
  explicitly reference can run. Execution filters can **override the default version**."
- "**Version protection:** Any version that an execution filter references is active. You
  can't delete or upgrade it while it's in use."
- Promotion is `az edge-action version swap-default`, described as zero-downtime:
  "You can upload a new version and set it as the default without experiencing downtime during
  the switch. If an issue arises with the latest code, you can easily roll back."

---

## 3. CONCRETE ARTIFACTS — copy these, do not reconstruct them

### 3.1 Azure CLI (this is the runnable artifact — prefer it over the portal walkthrough)

The `edge-action` command group is a **CLI extension**, "part of the **edge-action** extension
for the Azure CLI (version **2.75.0** or higher). The extension will automatically install the
first time you run an `az edge-action` command."

Microsoft's own examples, verbatim:

```bash
az edge-action create --resource-group testrg --edge-action-name edgeAction1 \
  --location global --sku "{name:Standard,tier:Standard}"

az edge-action version create --resource-group testrg --edge-action-name edgeAction1 \
  --version version2 --location global --deployment-type zip --is-default-version True

az edge-action version deploy-from-file --resource-group myResourceGroup \
  --edge-action-name myEdgeAction --version v1 --file-path ./mycode.js

az edge-action version swap-default --resource-group myResourceGroup \
  --edge-action-name myEdgeAction --version v2

az edge-action execution-filter list --resource-group testrg --edge-action-name edgeAction1
```

Notes verified from the CLI reference:
- `az edge-action create` required params: `--edge-action-name/--name/-n`, `--resource-group/-g`,
  `--sku`. `--location/-l` is optional and defaults to the resource group's location.
- `az edge-action version create --deployment-type` accepted values: `file`, `others`, `zip`.
- `deploy-from-file --file-path` takes ".js or .zip", type "Auto-detected if not specified".
- `az edge-action list` shows `--resource-group -g` as a **required** parameter, while the
  command description says "List EdgeAction resources by **subscription ID**" and the example
  is a bare `az edge-action list`. The reference contradicts itself. Do not show `az edge-action
  list` without a resource group unless you want to be wrong one way or the other. (Open Q O4.)

### 3.2 ARM / Bicep

```bicep
resource symbolicname 'Microsoft.Cdn/edgeActions@2025-12-01-preview' = {
  location: 'string'
  name: 'string'
  properties: {}
  sku: {
    name: 'string'
    tier: 'string'
  }
  tags: {
    {customized property}: 'string'
  }
}
```

- Resource type: **`Microsoft.Cdn/edgeActions`**. It is a **top-level resource in a resource
  group**, *not* a child of the Front Door profile. Deployment scope: "Resource groups".
- Child types seen in the REST API: `Microsoft.Cdn/edgeActions/versions` and
  `Microsoft.Cdn/edgeActions/executionFilters`.
- API versions listed: `2025-12-01-preview`, `2025-09-01-preview`, `2024-07-22-preview`.
- `name` constraints, verbatim: "Max length = 50, Pattern = `[a-zA-Z0-9]+`". **Alphanumeric
  only — no hyphens, no underscores.** Good, cheap gotcha.
- `location` is marked **(required)**; `sku` is marked **(required)**.
- The `EdgeActionProperties` table on the ARM reference page is **empty** — zero documented
  properties. That is a real documentation gap, not an omission on my part (Open Q O3).

### 3.3 The rule set action that wires it up

From the `Microsoft.Cdn/profiles/ruleSets/rules` template reference (latest =
`2026-04-01-preview`):

```bicep
{
  name: 'EdgeAction'
  parameters: {
    edgeActionReference: {
      id: 'string'
    }
    invocationPoint: 'string'
    typeName: 'string'
  }
}
```

- Action discriminator name: **`EdgeAction`**.
- `typeName`: **`DeliveryRuleEdgeActionParameters`**.
- `invocationPoint` allowed values: **`'ClientRequest'`** and **`'OriginRequest'`**.
  **Only `ClientRequest` is supported in preview** — see contradiction C2 below. Write
  `ClientRequest`.

### 3.4 Portal path (if you use it instead)

Portal search box → **Edge Actions** → **+ Create**. Then, on the resource:
**Settings > Versions > + Add** (upload the `.js`, optionally **Set default**);
**Settings > Execution filters > + Add**; **Settings > Attachments > + Associate route**.
To attach from the Front Door side: **Front Door profile > Settings > Front Door manager >**
endpoint **> Routes >** route **> Update route > Attach Edge Actions >** select **> Associate
> Update**. Verify with **Update route > Manage Edge Actions**. Detach via **Attachments >
Dissociate**. Diagnostic logs: **Monitoring > Diagnostic settings > + Add diagnostic setting
> allLogs > Send to Log Analytics workspace**.

---

## 4. HARD NUMBERS — quote exactly, invent nothing

Preview limits, identical wording on the Edge Actions page and in the Front Door limits table
(the limits table gives them per tier; all four values are the same for Standard and Premium):

| Limit | Value |
| --- | --- |
| Edge action code size | **16 KB** |
| Edge action version counts | **3** |
| Edge action execution time | **10 ms** |
| Maximum number of Edge Actions resources per subscription | **100** |

Adjacent rule set limits from the same table, useful for the "before" contrast:
Maximum rule set per profile **100** (Standard) / **200** (Premium); Maximum rules per rule set
**100**; Maximum rules per route **100**; WAF match conditions per custom rule **10**.

Language: "Currently, **JavaScript** is the only supported language."

Other preview behaviors worth a line:
- "During the preview period, the **Upload code** operation can take up to **10 minutes**."
- "Currently, you can invoke Edge Actions **only through Azure Front Door route
  configurations**." An edge action does nothing until it is attached to a route.
- Downloading code from the portal yields "a ZIP folder named `EdgeActionCode`".
- Isolation: "Edge Action creates a **Hyperlight sandbox**" per invocation, loading a "Custom
  and secure JavaScript runtime". (One clause maximum — see §7.)

### Pricing / billing

From the Azure Front Door pricing page, edge actions rows, both Standard and Premium:

- **Invocations — `$0.1 per 1M invocations`**
- **Overage execution time — `$0.00005 per second`**, footnoted as "Cumulative additional
  execution time for all invocations which took more than 1ms."

The billing doc (Example 7, `ms.date` 2026-08-31) confirms the model and the meter names —
`Invocations` and `Overage execution time`, both with billing region **`Global`**:

- 1 M invocations at 1 ms each → Invocations 1 M, Overage execution time **0**.
- 50 M invocations split 10 M @ 1 ms / 20 M @ 3 ms / 20 M @ 8 ms → Invocations 50 M, Overage
  `20 M x (3-1) + 20 M x (8-1) = 180 M milliseconds or 180 K seconds`.

So: the first 1 ms of every invocation is included; you pay per second only on the excess.
Rules engine remains free — the billing doc states you "don't pay extra fees to use features
like ... the rules engine ... and custom web application firewall (WAF) rules." That is the
honest cost framing: moving logic off the rule set and into an edge action is the thing that
starts costing money.

---

## 5. CONTRADICTIONS — flag these, do not smooth them over

- **C1 — Docs say portal/VS Code only; the CLI and ARM say otherwise.** The Edge Actions
  concept page (2026-07-27) states: "You can create and attach Edge Actions by using the portal
  UI or the Visual Studio Code extension." But `az edge-action` is fully documented with create/
  update/delete/version/execution-filter commands, and `Microsoft.Cdn/edgeActions` has Bicep,
  ARM and Terraform (AzAPI) reference pages. The conceptual page is behind the tooling. Writer:
  use the CLI, and say plainly that the concept doc has not caught up. Do not assert that
  attaching to a route is possible from the CLI — I found no CLI command for the route
  attachment, only for the Edge Action resource itself (Open Q O1).
- **C2 — `OriginRequest` exists in the schema but is not supported.** The rule action schema
  allows `invocationPoint: 'ClientRequest' | 'OriginRequest'`. Learn says: "During the preview,
  Edge Actions support only **client request invocations**." Do not tell readers they can run
  logic on the origin request or on the response. Response-side manipulation appears in the
  scenario list ("Request and response header manipulation") while the invocation point is
  client-request only — those two statements sit uneasily together (Open Q O2).
- **C3 — "GA" in the CLI reference.** Every `az edge-action` row is Status "GA". The feature is
  preview. Do not let this leak into the post.
- **C4 — The rule set actions doc never mentions Edge Actions.** `front-door-rules-engine-actions`
  (`ms.date` 2024-07-16, `updated_at` 2025-06-04) documents only route configuration override,
  modify request header, modify response header, URL redirect and URL rewrite. No "Invoke Edge
  Action", even though the Edge Actions page tells you to "Select the action as **Invoke Edge
  Action**" and the ARM schema has `name: 'EdgeAction'`. The action's docs page is stale.
  Note also the naming drift: portal label "Invoke Edge Action", ARM value `EdgeAction`.
- **C5 — The samples repo is a preview stage behind.** `Azure/EdgeActionsSamples` README says
  Edge Actions is at "**select customer preview stage**" and that support will expand "by
  public preview and General Availability stages". Learn says public preview. Treat the README
  as stale; do not cite it for status. It is MIT-licensed and points at `src/edgeactions-js`.
- **C6 — Marketing vs docs on what this replaces.** The two Microsoft Community Hub posts
  (`.../4531928` and `.../4542177`) are the marketing framing for this launch and are widely
  quoted second-hand. **I could not fetch either — both render client-side and returned only
  the page title.** So I have no verified Microsoft claim that Edge Actions replaces a
  third-party CDN worker platform, App Gateway, or anything else. **Do not make a
  "replaces X" claim in the post.** The docs claim only that it "reduce[s] origin load" and
  enables "ultra-low latency execution of business logic". Stay inside that.

---

## 6. SOURCES

All fetched 2026-09-08. Primary sources only; the one GitHub item is Microsoft-owned and used
solely to evidence a contradiction.

- [Edge Actions (Preview) - Azure Front Door](https://learn.microsoft.com/en-us/azure/frontdoor/edge-actions) — Microsoft Learn, accessed 2026-09-08 — supports: preview status, Standard+Premium tiers, JavaScript-only, 16 KB / 3 versions / 10 ms / 100 per subscription, the fail-open-on-timeout quote, request flow and WAF ordering, execution filters, `EdgeActionConsoleLog` and `edgeActionsStatusCode` schemas, portal paths, the 10-minute upload note. Page `ms.date` 2026-07-27.
- [Azure Front Door billing](https://learn.microsoft.com/en-us/azure/frontdoor/billing) — Microsoft Learn, accessed 2026-09-08 — supports: Example 7 edge actions billing meters (`Invocations`, `Overage execution time`, region `Global`), the two worked examples, and the statement that the rules engine and custom WAF rules carry no extra fee. `ms.date` 2026-08-31.
- [Pricing — Front Door](https://azure.microsoft.com/en-us/pricing/details/frontdoor/) — Microsoft Azure, accessed 2026-09-08 — supports: `$0.1 per 1M invocations`, `$0.00005 per second` overage, the ">1ms" footnote, availability on both Standard and Premium.
- [What is a rule set? - Azure Front Door](https://learn.microsoft.com/en-us/azure/frontdoor/front-door-rules-engine) — Microsoft Learn, accessed 2026-09-08 — supports: rule sets are declarative, 10 AND-ed match conditions and 5 actions per rule, rules not exportable across rule sets, classic retirement date 2027-03-31. `ms.date` 2025-04-09.
- [Rule set actions - Azure Front Door](https://learn.microsoft.com/en-us/azure/frontdoor/front-door-rules-engine-actions) — Microsoft Learn, accessed 2026-09-08 — supports: the documented action inventory, and contradiction C4 (no Edge Actions entry). `ms.date` 2024-07-16, `updated_at` 2025-06-04.
- [Routing Architecture - Azure Front Door](https://learn.microsoft.com/en-us/azure/frontdoor/front-door-routing-architecture) — Microsoft Learn, accessed 2026-09-08 — supports: WAF evaluated before rule sets, request processing stops on WAF violation, rule sets → cache → select origin → forward to origin ordering. `ms.date` 2026-02-24.
- [Microsoft.Cdn/edgeActions — Bicep, ARM template & Terraform AzAPI reference](https://learn.microsoft.com/en-us/azure/templates/microsoft.cdn/edgeactions) — Microsoft Learn, accessed 2026-09-08 — supports: resource type name, resource-group scope, preview-only API versions, required `location` and `sku`, name pattern `[a-zA-Z0-9]+` max 50, and the empty `EdgeActionProperties` table.
- [Microsoft.Cdn/profiles/ruleSets/rules (2026-04-01-preview)](https://learn.microsoft.com/en-us/azure/templates/microsoft.cdn/2026-04-01-preview/profiles/rulesets/rules) — Microsoft Learn, accessed 2026-09-08 — supports: the eleven allowed action `name` values, the `EdgeAction` action shape, `edgeActionReference.id`, `typeName: 'DeliveryRuleEdgeActionParameters'`, and `invocationPoint` allowing `ClientRequest`/`OriginRequest`.
- [Edge Action Execution Filters - Get - REST API (Azure Front Door Service)](https://learn.microsoft.com/en-us/rest/api/edge-actions/edge-action-execution-filters/get?view=rest-edge-actions-2025-12-01-preview) — Microsoft Learn, accessed 2026-09-08 — supports: API version `2025-12-01-preview`, ARM path `/providers/Microsoft.Cdn/edgeActions/{edgeActionName}/executionFilters/{executionFilter}`, filter properties `executionFilterIdentifierHeaderName` / `executionFilterIdentifierHeaderValue` / `versionId`, and `"location": "global"` in the sample response.
- [az edge-action](https://learn.microsoft.com/en-us/cli/azure/edge-action?view=azure-cli-latest) — Microsoft Learn, accessed 2026-09-08 — supports: the extension requirement (CLI 2.75.0+), the full command inventory, `az edge-action create` example with `--location global --sku "{name:Standard,tier:Standard}"`, the misleading "GA" status column, and contradiction C1.
- [az edge-action version](https://learn.microsoft.com/en-us/cli/azure/edge-action/version?view=azure-cli-latest) — Microsoft Learn, accessed 2026-09-08 — supports: `version create` params and `--deployment-type {file, others, zip}`, `deploy-from-file --file-path`, `swap-default` example, `get-version-code`.
- [includes/front-door-limits.md](https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/includes/front-door-limits.md) — MicrosoftDocs/azure-docs (GitHub, Microsoft-owned), accessed 2026-09-08 — supports: the per-tier limits table (edge action code size / version counts / execution time / resources per subscription; rule sets per profile 100 vs 200; rules per rule set 100; WAF match conditions per custom rule 10). Used because the rendered `azure-subscription-service-limits` page is too large to fetch the Front Door section reliably.
- [Azure/EdgeActionsSamples](https://github.com/Azure/EdgeActionsSamples) and [its README](https://raw.githubusercontent.com/Azure/EdgeActionsSamples/main/README.md) — GitHub (Microsoft-owned), MIT, accessed 2026-09-08 — supports: contradiction C5 ("select customer preview stage"), the sample scenario list, and the absence of a documented JS API surface.

**Fetched and FAILED — do not cite, do not treat as confirmed:**
`https://techcommunity.microsoft.com/blog/azurenetworkingblog/introducing-azure-front-door-edge-actions---bringing-secure-programmable-logic-t/4531928`
and `https://techcommunity.microsoft.com/blog/azurenetworkingblog/azure-front-door-edge-actions-programmable-compute-for-a-secure-resilient-ai-rea/4542177`
— both returned title only (client-side rendered). No Azure Updates entry for edge actions was
locatable by search either. Every pain-point claim in §2 therefore rests on documentation, not
on the launch blogs. That is a feature, not a bug, but it means the post must not attribute
positioning claims to Microsoft.

---

## 7. OUT OF SCOPE FOR THIS 650–780 WORD POST

Verified, but cut them — they will not fit and they dilute §2:

- Hyperlight micro-VM isolation internals, the per-invocation sandbox, hardware-backed tenancy.
  One subordinate clause at most, if any.
- The full portal click-path (three separate attach flows: "easy attach", new rule set,
  Attachments view). Use the CLI instead.
- Full `EdgeActionConsoleLog` / diagnostic settings walkthrough. One sentence in PP2 is enough.
- Worked pricing arithmetic. State the two meters and the 1 ms inclusion, move on.
- Front Door classic, tier migration, and the 2027-03-31 retirement.
- Any comparison to Cloudflare Workers, Lambda@Edge, Application Gateway or a "separate CDN
  worker platform". I have **no fetched source** for any of it. See C6.

---

## 8. OPEN QUESTIONS — hand these to the editor, do not guess past them

- **O1.** Is there any CLI/ARM path to *attach* an Edge Action to a route, or only to manage the
  Edge Action resource? The `az edge-action` group has no attach/associate command. Attachment
  is presumably the `EdgeAction` action inside a `Microsoft.Cdn/profiles/ruleSets/rules`
  resource, which is consistent, but **I did not find a documented end-to-end example** wiring
  `edgeActionReference.id` to a rule. Do not present an unverified Bicep rule snippet as
  working. If the post shows attachment, show the portal path (§3.4) and label the Bicep shape
  as the schema, not a tested deployment.
- **O2.** Does "response header manipulation" actually work when the only supported invocation
  point is `ClientRequest`? Learn lists it as a supported scenario and simultaneously says
  client-request-only. Unresolved. Avoid claiming response-side behavior.
- **O3.** What are the actual `EdgeActionProperties`? The ARM reference table is empty and the
  CLI exposes no properties on `edge-action create` beyond `--sku`, `--location`, `--tags`.
  Unknown.
- **O4.** Is `az edge-action list` subscription-scoped or resource-group-scoped? The reference
  says both. Unresolved.
- **O5.** Region/PoP availability. No documented restriction found, and no statement that edge
  actions run at *all* Front Door PoPs. `location: global` is what the API takes; that is a
  control-plane fact, not a data-plane one. Do not claim "every PoP".
- **O6.** SKU semantics. `sku` is required and Microsoft's example uses
  `{name:Standard,tier:Standard}`. Whether a Premium edge action SKU exists, and whether the
  edge action SKU must match the Front Door profile tier, is **undocumented on every page I
  fetched**.
- **O7.** Preview pricing. The pricing page shows prices with no preview-discount or free-grant
  note, and no note saying billing is suspended during preview. Whether invocations are
  actually charged today is unconfirmed. Phrase as "list price" rather than "you will be billed".
- **O8.** On timeout, Learn says the request is forwarded without edge action processing, while
  the log schema defines `edgeActionsStatusCode` `503` as "Error during execution". Whether a
  `503` is ever returned to the client, or is purely a log value on a request that still
  succeeded, is not stated. PP2's fail-open claim is safe as written — it quotes Learn directly
  — but do not additionally claim "the client sees a 503" or "the client never sees an error".
- **O9.** No Azure Updates / release-notes entry for edge actions was findable, so I have no
  primary-sourced **announcement date**. Do not put a launch date in the post. The earliest
  hard date I can defend is the Learn page's `ms.date` of 2026-07-27, and an API version
  stamped `2024-07-22-preview`.
