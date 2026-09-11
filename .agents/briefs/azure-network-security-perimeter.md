# Research Brief: Azure Network Security Perimeter (NSP)

- **Slug:** `azure-network-security-perimeter`
- **Category:** `azure-network-security`
- **Researched / all sources accessed:** 2026-08-19
- **Suggested `verifiedDate`:** 2026-08-19
- **Researcher note:** Every URL in the Sources section was fetched directly. Anything I
  could not fetch or could not confirm verbatim is marked **UNVERIFIED** and must not be
  stated as fact in the post.

---

## 1. STATUS VERDICT (the load-bearing fact)

**Azure Network Security Perimeter is GENERALLY AVAILABLE. It is not a public preview.**
Verified 2026-08-19.

The exact GA banner text, repeated verbatim and identically across four separate Microsoft
Learn pages I fetched:

> "Network security perimeter is now generally available in all Azure public cloud regions
> and in Azure Government regions (US Gov Virginia, US Gov Texas, US Gov Arizona, US DoD
> East and US DoD Central)."

Pages carrying that banner (all fetched):
- `network-security-perimeter-concepts` — page `ms.date` **2026-07-08**, `updated_at` **2026-07-22**
- `network-security-perimeter-diagnostic-logs` — `ms.date` **2025-08-01**, `updated_at` **2025-08-05**
- `create-network-security-perimeter-cli` — `ms.date` **2025-08-01**, `updated_at` **2025-10-08**

Corroborating signal: every command in the `az network perimeter` CLI reference is listed
with **Status: GA** (page `ms.date` **2026-08-04**), and the ARM/Bicep reference exposes
stable, non-preview API versions up to **2025-07-01** (the `-preview` suffixed versions stop
at `2024-06-01-preview`). A feature does not get a stable API version and a fully GA CLI
surface while in preview.

### The GA *date* — READ THIS
I could **not** verify the GA date from a page I actually fetched.
- The Learn pages state GA but carry no GA date.
- Web search results consistently point to an Azure Updates entry titled
  "[Launched] Generally Available: Network security perimeter" dated **2025-08-06**, but that
  entry survives only on third-party aggregators (azurefeeds.com, azureaggregator). I
  attempted `azurefeeds.com` and got `ENOTFOUND` (domain does not resolve). I tried
  `https://azure.microsoft.com/en-us/updates/generally-available-network-security-perimeter/`
  and it returned an empty Azure Updates filter page ("0 Updates found").
- **WRITER: say "GA as of <verifiedDate>", not "GA since August 2025".** The status is
  certain; the date is **UNVERIFIED**. Do not print 2025-08-06 as a fact.

### Service-level status is NOT the same as feature-level status
NSP the platform feature is GA, but each PaaS service onboards on its own schedule and three
are still in public preview. See §4. This is the distinction most write-ups get wrong.

### Pricing — DO NOT STATE
Search snippets claimed NSP carries no additional cost. **I found no pricing statement on any
page I fetched.** Treat cost as **UNVERIFIED** and omit it entirely. (Note for contrast: the
standard service endpoint page *does* discuss its own pricing, and says Standard Service
Endpoint "is available at no charge in July 2026. Billing is expected to begin after the
preview announcement, currently targeted for August 2026." That is the *service endpoint*
feature, not NSP. Do not conflate them.)

---

## 2. THE PROBLEM IT SOLVES

Azure PaaS resources — a storage account, a key vault, an Event Hubs namespace — are created
*outside* your virtual network with a public endpoint by default. Historically you had three
controls, and all three are per-resource and inbound-only:

- **Per-resource firewall rules** (the "Allowed networks" / IP ACL on each account). Managed
  one resource at a time. Governs inbound only.
- **Service endpoints (basic)**. Extends VNet identity to the PaaS service so the resource
  firewall can allow a subnet. Still per-resource, still inbound only.
- **Private Endpoints / Private Link**. Gives the resource a private IP inside your VNet.
  Solves *VNet-to-PaaS* connectivity privately.

**None of them constrain outbound traffic from the PaaS resource itself.** That is the
exfiltration gap: a compromised or misconfigured resource inside your subscription can still
push data to an attacker-controlled destination, because the resource firewall only ever
looked at who was calling *in*. NSP adds an outbound control plane and a shared boundary.

The concepts page frames the feature set as:

> - Resource to resource access communication within perimeter members, preventing data
>   exfiltration to nonauthorized destinations.
> - External public access management with explicit rules for PaaS resources associated with
>   the perimeter.
> - Access logs for audit and compliance.
> - Unified experience across PaaS resources.

### How NSP differs from each — use this framing, it is the section readers want

| Control | Direction | Scope | What it actually does |
|---|---|---|---|
| Per-resource firewall | Inbound only | One resource | IP/VNet ACL on that account |
| Service endpoint (basic) | Inbound only | Subnet → one resource | Gives VNet identity to the resource firewall |
| Private Endpoint | Inbound only | One resource | Private IP in your VNet; no public path |
| **NSP** | **Inbound and outbound** | **Many resources, many subscriptions** | Explicit-allow boundary + centralized rules + access logs |

Three precise, sourced statements the writer can lean on:

1. **NSP overrides the resource firewall.** Storage doc, verbatim: "Network security perimeter
   rules override the storage account's own firewall settings. Access from within the
   perimeter takes highest precedence over other network restrictions." And: "the account's
   'Allowed networks' settings are bypassed when the storage account is associated in enforced
   mode." Remove the resource from the perimeter and control reverts to the resource firewall.
2. **NSP does not touch Private Endpoint traffic.** Transition doc: "Private access: Access via
   Private Links isn't impacted by network security perimeter." Storage doc: "Private endpoint
   traffic is considered highly secure and therefore isn't subject to network security
   perimeter rules." So NSP and Private Link are complementary, not alternatives. There is even
   a dedicated log category, `NspPrivateInboundAllowed`, for private endpoint traffic.
3. **NSP and basic service endpoints do not mix.** See the flagged contradiction in §7.

Also worth saying plainly: **NSP only supports allow rules.** Verbatim from the standard
service endpoint page: "Network security perimeter only supports allow rules, not deny rules.
All access must be explicitly permitted through configured rules." There is no deny rule and
no rule priority to explain.

---

## 3. HOW IT WORKS — THE OBJECT MODEL

Component table, quoted verbatim from the concepts page:

| Component | Description |
|---|---|
| **Network security perimeter** | Top level resource defining logical network boundary to secure PaaS resources. |
| **Profile** | Collection of access rules that apply on resources associated with the profile. |
| **Access rule** | Inbound and outbound rules for resources in a perimeter to allow access outside the perimeter. |
| **Resource association** | Perimeter membership for a PaaS resource. |
| **Network identifier** | A public IP address or prefix associated with a service endpoint subnet, enabling network security perimeter to identify and authorize inbound traffic from IaaS resources. Used with standard service endpoint. |
| **Diagnostics settings** | Extension resource hosted by Microsoft Insights to collect logs & metrics for all resources in the perimeter. |

Perimeter properties on create: **Name** (unique within the resource group), **Location**
(a supported Azure region), **Resource group name**.

### Access rule types (verbatim)

| Direction | Access rule type |
|---|---|
| Inbound | Subscription-based rules |
| Inbound | IP-based rules (check respective onboarded private link resources for v6 support) |
| Outbound | FQDN-based rules |

Inbound is network attributes (source IP/prefix) or identity attributes (subscription).
Outbound is FQDN of the external destination. Note that `emailAddresses`, `phoneNumbers` and
`serviceTags` exist in the schema but every one is annotated "This access rule type is
currently unavailable for use" — do not present them as usable.

### Access modes (the mechanism the whole rollout hinges on)

Concepts page, verbatim:

| Mode | Description |
|---|---|
| **Transition mode (formerly Learning mode)** | Default access mode. Helps network administrators to understand the existing access patterns of their PaaS resources. Advised mode of use before transitioning to enforced mode. |
| **Enforced mode** | Must be set by the administrator. By default, all traffic except intra-perimeter traffic is denied in this mode unless an *Allow* access rule exists. |

Transition doc adds the precise evaluation semantics:

- **Transition** — "Evaluation in this mode uses the network security perimeter configuration
  as a baseline. When it doesn't find a matching rule, evaluation falls back to the resource
  firewall configuration which can then approve access with existing settings."
- **Enforced** — "When explicitly set, the resource obeys **only** network security perimeter
  access rules."

**Terminology warning for the writer:** the docs renamed Learning → Transition, and the
diagnostic logs page says so explicitly: "The available access modes for a network security
perimeter are **Transition** and **Enforced**. The **Transition** mode was previously named
**Learning** mode. You may continue to see references to **Learning** mode in some instances."
The CLI is one of those instances — see §7, contradiction #1. Introduce the term as
"Transition mode (formerly Learning mode)" and never write `--access-mode Transition`.

### `publicNetworkAccess` and the secure-by-default third state

NSP introduces a value on the existing `publicNetworkAccess` property: **`SecuredByPerimeter`**.
Transition doc: "On resource creation, if `publicNetworkAccess` is set to `SecuredByPerimeter`,
the resource is created in the lockdown mode even when not associated with a perimeter. Only
private link traffic will be allowed if configured."

The full interaction matrix (verbatim from the transition doc) — this is a strong table for the
post, and it is the thing that surprises people:

| | Profile not associated | Access mode: Transition | Access mode: Enforced |
|---|---|---|---|
| **Public Network Access: Enabled** | Inbound: Resource rules / Outbound: Allowed | Inbound: NSP + Resource rules / Outbound: NSP rules + Allowed | Inbound: NSP rules / Outbound: NSP rules |
| **Public Network Access: Disabled** | Inbound: Denied / Outbound: Allowed | Inbound: NSP rules / Outbound: NSP rules + Allowed | Inbound: NSP rules / Outbound: NSP rules |
| **Public Network Access: SecuredByPerimeter** | Inbound: Denied / Outbound: Denied | Inbound: NSP rules / Outbound: NSP rules | Inbound: NSP rules / Outbound: NSP rules |

Read the top-left-to-right row carefully: with public access merely "Disabled", **outbound is
still Allowed** when the resource is not in a perimeter. That is exactly the exfiltration gap
from §2, in table form.

### Intra-perimeter traffic requires managed identity

Azure Monitor doc, verbatim: "Any service associated with a network security perimeter
implicitly allows inbound and outbound access to any other service associated with the same
network security perimeter when that access is authenticated using managed identities and role
assignments. Access rules only need to be created when allowing access outside of the network
security perimeter, or for access authenticated using API keys."

The CLI quickstart reinforces it: "Enabling a Managed Identity (MI) is required to support
intra-perimeter communication between resources."

And a hard consequence, from the transition doc: "Managed identity needs to be assigned on
resources for perimeter access." If a resource has no MI, "it's in the same perimeter" does not
buy it access.

### SAS tokens break intra-perimeter and subscription-based access

Concepts page, verbatim: "Intra-perimeter traffic and inbound access rules that are
subscription-based don't support authentication via shared access signature (SAS) token. In
these scenarios, requests that use an SAS token are rejected and display an authentication
error. Use an alternative supported authentication method per your specific resource."

This is a genuinely high-value gotcha — SAS-based storage access is everywhere.

---

## 4. ONBOARDED SERVICES — as of 2026-08-19

Verbatim from the concepts page. **This list changes; the writer must date it in the post.**

| Private link resource | Resource type | Public cloud | Gov cloud |
|---|---|---|---|
| Azure Monitor | `Microsoft.Insights/dataCollectionEndpoints`, `Microsoft.Insights/ScheduledQueryRules`, `Microsoft.Insights/actionGroups`, `Microsoft.OperationalInsights/workspaces` | Generally available | Not Available |
| Azure AI Search | `Microsoft.Search/searchServices` | Generally Available | Not Available |
| Cosmos DB | `Microsoft.DocumentDB/databaseAccounts` | **Public Preview** | Not Available |
| Event Hubs | `Microsoft.EventHub/namespaces` | Generally Available | Not Available |
| Key Vault | `Microsoft.KeyVault/vaults` | Generally Available | Generally Available |
| SQL DB | `Microsoft.Sql/servers` | **Public Preview** | Not Available |
| Storage | `Microsoft.Storage/storageAccounts` | Generally Available | Generally Available |
| Azure OpenAI service | `Microsoft.CognitiveServices` (kind="OpenAI") | **Public Preview** | Not Available |
| Microsoft Foundry | `Microsoft.CognitiveServices/accounts`, `Microsoft.CognitiveServices` (kind="AIServices") | Generally Available | Generally Available |
| Azure Service Bus | `Microsoft.ServiceBus/namespaces` | Generally Available | Not Available |

Explicit preview callout on the same page: "The following onboarded services are in public
preview with Network Security Perimeter: Cosmos DB, SQL DB, Azure OpenAI Service."

**Ten services. That is the adoption gate, and it is the honest headline of the post:** NSP is
GA, but a real Azure estate contains App Service, Functions, AKS, Container Registry, Service
Fabric, Azure Backup, and dozens more that simply cannot join a perimeter yet. Only Key Vault,
Storage and Microsoft Foundry are GA in Gov cloud.

Storage doc gives the documented workaround for non-onboarded callers, verbatim: "If a service
isn't listed, it is not onboarded yet. To allow access to a specific resource from a
non-onboarded service, you can create a subscription-based rule for the network security
perimeter. A subscription-based rule grants access to all resources within that subscription."

Flag the bluntness of that last sentence in the post — a subscription-based rule is a wide
grant, and reaching for it to unblock a non-onboarded service erodes the boundary you just
built.

The CLI can enumerate the current list at runtime, which is the right advice to give a reader
whose estate will differ from this table:

```bash
az network perimeter associable-resource-type list --location <region>
```

(Command name and description — "List all network security perimeter associable resource
types" — confirmed verbatim in the CLI reference. The `--location` flag specifically is
**UNVERIFIED**; I did not fetch the subcommand page. Present the command name, or verify the
flag before printing it.)

---

## 5. CONFIGURATION ARTIFACTS (copied verbatim from docs)

### Azure CLI — extension and version

CLI reference note, verbatim: "This reference is part of the **nsp** extension for the Azure
CLI (version 2.75.0 or higher). The extension will automatically install the first time you run
an **az network perimeter** command."

Quickstart install line: `az extension add --name nsp`

Quickstart also does: `az provider register --namespace Microsoft.Network`

> **CONTRADICTION** — the CLI reference says the nsp extension needs **Azure CLI 2.75.0 or
> higher**; the quickstart says "This article **requires version 2.38.0 or later** of the Azure
> CLI." Quote the higher number (2.75.0) from the extension reference, or state a version range
> and cite both. Do not print 2.38.0 alone.

### Full working sequence — verbatim from the CLI quickstart (Key Vault example)

```bash
# 1. Create the perimeter
az network perimeter create \
    --name network-security-perimeter \
    --resource-group resource-group \
    -l westcentralus

# 2. Create a profile
az network perimeter profile create \
    --name network-perimeter-profile \
    --resource-group resource-group \
    --perimeter-name network-security-perimeter

# 3. Associate the PaaS resource, starting in Learning mode
az network perimeter association create \
    --name network-perimeter-association \
    --perimeter-name network-security-perimeter \
    --resource-group resource-group \
    --access-mode Learning \
    --private-link-resource "{id:<PaaSArmId>}" \
    --profile "{id:<networkSecurityPerimeterProfileId>}"

# 4. Flip to Enforced (same command, re-run with the new mode)
az network perimeter association create \
    --name network-perimeter-association \
    --perimeter-name network-security-perimeter \
    --resource-group resource-group \
    --access-mode Enforced \
    --private-link-resource "{id:<PaaSArmId>}" \
    --profile "{id:<networkSecurityPerimeterProfileId>}"

# 5. Inbound access rule with an IP prefix
az network perimeter profile access-rule create \
    --name access-rule \
    --profile-name network-perimeter-profile \
    --perimeter-name network-security-perimeter \
    --resource-group resource-group \
    --address-prefixes "[192.0.2.0/24]"
```

All five blocks are copied from the quickstart. Note it flips mode by re-running
`association create`, not `association update` — though `az network perimeter association
update` exists and its own reference example uses `--access-mode Enforced`.

### `az network perimeter association create` — exact signature (verbatim)

```
az network perimeter association create --association-name --name
                                        --perimeter-name
                                        --resource-group
                                        [--access-mode {Audit, Enforced, Learning}]
                                        [--acquire-policy-token]
                                        [--change-reference]
                                        [--no-wait {0, 1, f, false, n, no, t, true, y, yes}]
                                        [--private-link-resource]
                                        [--profile]
```

**`--access-mode` accepted values are literally `Audit`, `Enforced`, `Learning`.** Not
`Transition`. See §7 contradiction #1.

### `az network perimeter profile access-rule create` — exact signature (verbatim)

```
az network perimeter profile access-rule create --access-rule-name --name
                                                --perimeter-name
                                                --profile-name
                                                --resource-group
                                                [--acquire-policy-token]
                                                [--address-prefixes]
                                                [--change-reference]
                                                [--direction {Inbound, Outbound}]
                                                [--email-addresses]
                                                [--fqdn]
                                                [--phone-numbers]
                                                [--service-tags]
                                                [--subscriptions]
```

Verbatim examples from that page:

```bash
# IP based (inbound)
az network perimeter profile access-rule create -n MyAccessRule \
  --profile-name MyProfile --perimeter-name MyPerimeter -g MyResourceGroup \
  --address-prefixes "[10.10.0.0/16]"

# FQDN based (outbound)
az network perimeter profile access-rule create -n MyAccessRule \
  --profile-name MyProfile --perimeter-name MyPerimeter -g MyResourceGroup \
  --fqdn "['www.abc.com', 'www.google.com']" --direction "Outbound"

# Subscription based (inbound)
az network perimeter profile access-rule create -n MyAccessRule \
  --profile-name MyProfile --perimeter-name MyPerimeter -g MyResourceGroup \
  --subscriptions [0].id="<SubscriptionID1>" [1].id="<SubscriptionID2>"
```

> One of the examples on that page uses an `--nsp` flag ("Create NSP based access rule") that
> does **not** appear in the command's own parameter list. Treat `--nsp` as **UNVERIFIED /
> likely stale doc** and do not use it in the post.

### Other CLI command groups (all confirmed present, all Status GA)

`az network perimeter` · `associable-resource-type` · `association` · `link` ·
`link-reference` · `logging-configuration` · `profile` · `profile access-rule` ·
`service-tag` — plus `create`/`delete`/`list`/`show`/`wait` at the top level.

`link` and `link-reference` are how perimeters connect to each other. I did **not** fetch those
subcommand pages — perimeter linking is **UNVERIFIED** beyond the command names. Either omit
it or describe it only as "perimeters can be linked" without mechanism.

### Bicep / ARM — verbatim resource formats

Perimeter (latest API version **2025-07-01**):

```bicep
resource symbolicname 'Microsoft.Network/networkSecurityPerimeters@2025-07-01' = {
  location: 'string'
  name: 'string'
  properties: {}
  tags: {
    {customized property}: 'string'
  }
}
```

Access rule (latest API version **2025-07-01**):

```bicep
resource symbolicname 'Microsoft.Network/networkSecurityPerimeters/profiles/accessRules@2025-07-01' = {
  parent: resourceSymbolicName
  name: 'string'
  properties: {
    addressPrefixes: [ 'string' ]
    direction: 'string'
    emailAddresses: [ 'string' ]
    fullyQualifiedDomainNames: [ 'string' ]
    phoneNumbers: [ 'string' ]
    serviceTags: [ 'string' ]
    subscriptions: [ { id: 'string' } ]
  }
}
```

`NspAccessRuleProperties`, verbatim: `addressPrefixes` (string[], "Inbound address prefixes
(IPv4/IPv6)"), `direction` (`'Inbound'` | `'Outbound'`), `emailAddresses` (string[],
"currently unavailable for use"), `fullyQualifiedDomainNames` (string[]), `phoneNumbers`
(string[], "currently unavailable for use"), `serviceTags` (string[], "currently unavailable
for use"), `subscriptions` (`SubscriptionId[]`, each `{ id: string }`).

Name constraint on both resource types, verbatim: max length **80**, pattern
`(^[a-zA-Z0-9]+[a-zA-Z0-9_.-]*[a-zA-Z0-9_]+$)|(^[a-zA-Z0-9]$)`.

Resource type strings — status of each:
- `Microsoft.Network/networkSecurityPerimeters` — **verified verbatim** (ARM reference)
- `Microsoft.Network/networkSecurityPerimeters/profiles/accessRules` — **verified verbatim**
- `Microsoft.Network/networkSecurityPerimeters/profiles` — verified as the declared Bicep
  `parent` type of accessRules, and as an RBAC action scope
- `Microsoft.Network/networkSecurityPerimeters/resourceAssociations` — confirmed only from RBAC
  action strings, e.g. `Microsoft.Network/networkSecurityPerimeters/resourceAssociations/write`.
  **I did not fetch its ARM template page — the Bicep block for resourceAssociations is
  UNVERIFIED.** Do not invent one.

API versions available on the perimeter type: `2025-07-01`, `2025-05-01`, `2025-03-01`,
`2025-01-01`, `2024-10-01`, `2024-07-01`, then `2024-06-01-preview` and older previews.

There is an Azure Verified Module: `avm/res/network/network-security-perimeter` in
`Azure/bicep-registry-modules`, and a quickstart template
`quickstarts/microsoft.network/network-security-perimeter-create`. Both are linked from the ARM
reference page I fetched; I did **not** fetch the repos themselves, so describe them as
"exists / linked from Microsoft's reference" and do not quote their contents.

### RBAC (all verbatim from the RBAC requirements page, ms.date 2025-08-01)

Built-in roles that work: **Owner, Contributor, or Network Contributor**.

Perimeter: `Microsoft.Network/networkSecurityPerimeters/read` · `/write` · `/delete` ·
`Microsoft.Network/locations/perimeterAssociableResourceTypes/read`

Profile: `.../profiles/read` · `/write` · `/delete`

Access rules: `.../profiles/accessRules/read` · `/write` · `/delete` ·
`Microsoft.Resources/subscriptions/joinPerimeterRule/action`
(plus the note: "User must have *subscription contributor* role to create/update
subscription-based access rule.")

Associations — this is the three-way permission that trips people up, verbatim:
> - `Microsoft.Network/networkSecurityPerimeters/resourceAssociations/write` is required at the
>   network security perimeter resource.
> - `Microsoft.Network/networkSecurityPerimeters/profiles/join/action` is required on the profile.
> - `{providerNamespace}/{resourceType}/joinPerimeter/action` is required on the respective PaaS resource.

Associating a resource needs rights on **both** the perimeter and the target resource. In a
central-networking-team model, the networking team alone cannot onboard an app team's storage
account. Good practical point for the post.

### Portal path (verbatim from the transition doc)

1. Navigate to the network security perimeter resource.
2. **Settings** > **Associated resources**.
3. Select **...** (ellipsis) next to the resource.
4. **Configure public network access** → **Enabled**, **Disabled**, or **SecuredByPerimeter**.
5. **Change access mode** → **Transition** or **Enforced**.

Note the portal offers **Transition/Enforced** while the CLI offers **Audit/Enforced/Learning**.

---

## 6. LIMITATIONS, GOTCHAS, LOGGING

### Scale limits (verbatim from concepts)

| Limit | Value |
|---|---|
| Network security perimeters | Up to **100** as recommended limit **per subscription** |
| Profiles per perimeter | Up to **200** as recommended limit |
| Rule elements per profile | Up to **200** for inbound and outbound **each**, as a **hard limit** |
| PaaS resources across subscriptions per perimeter | Up to **1000** as recommended limit |

Note the wording distinction the docs make: "recommended limit" vs "hard limit". Only the
200 rule elements per profile is called a hard limit.

### Named limitations and known issues (verbatim from concepts)

- **Service endpoint traffic is not supported.** "It's recommended to use private endpoints for
  IaaS to PaaS communication. Currently, service endpoint traffic can be denied even when an
  inbound rule allows 0.0.0.0/0." — a spectacular failure mode; the rule looks maximally open
  and traffic still drops. See §7 contradiction #2 for the nuance.
- **44-character resource name ceiling.** "The network security perimeter resource association
  created from the Azure portal has the format `{resourceName}-{perimeter-guid}`. To align with
  the requirement name field can't have more than 80 characters, resources names would have to
  be limited to 44 characters."
- **SDK association creation 403.** "'Status: 403 (Forbidden); ErrorCode: AuthorizationFailed'
  might be received while performing action
  `Microsoft.Network/locations/networkSecurityPerimeterOperationStatuses/read`... Until the fix,
  use permission `Microsoft.Network/locations/*/read` or use `WaitUntil.Started` in
  `CreateOrUpdateAsync` SDK API for association creations."
- **Aggregated logs missing fields.** "If the fields 'count' and 'timeGeneratedEndTime' are
  missing, consider the aggregation count as 1."
- **Microsoft Sentinel.** "Network security perimeters aren't supported for Log Analytics
  workspaces enabled for Microsoft Sentinel. If a network security perimeter is enabled on the
  workspace, analytic rules are automatically disabled." Also: "Querying workspaces with private
  link from Advanced hunting is not supported." — see §7 contradiction #3.
- **Azure Backup + Storage.** "Azure Backup is not supported for Storage Accounts enabled with
  network security perimeter."
- **Log Analytics region.** The workspace "needs to be located in one of the Azure Monitor
  supported regions."

### Storage-specific limitations (verbatim from the Storage NSP doc)

- **Object replication** — "Not Supported. Object Replication between storage accounts fails if
  either the source or destination account is associated with a network security perimeter."
  Mutually exclusive at config time in both directions.
- **NFS / SMB / SFTP** — "All protocols other than HTTPS-based access are blocked when a storage
  account is associated with a Network Security Perimeter in Enforced mode." With a sharp
  warning: "When testing or migrating to network security perimeter using Transition mode,
  successful access might occur through firewall fallback behavior and doesn't indicate protocol
  support through network security perimeter." **This is the single best gotcha in the brief** —
  Transition mode can make an unsupported protocol look supported, and it dies at enforcement.
- **Azure Backup** — "Not supported. Azure Backup as a service is not onboarded to network
  security perimeter yet."
- **Unmanaged disks** — "don't honor network security perimeter rules."
- **Static website** — "Not supported... Static website, being open in nature cannot be used
  with network security perimeter." Mutually exclusive at config time.
- **CMK warning** — "For storage accounts that are associated with a network security perimeter,
  in order for customer managed keys (CMK) scenarios to work, ensure that the Azure Key Vault is
  accessible from within the perimeter to which the storage account is associated."
- Supported surface: "all standard data-plane operations for blobs, files, tables, and queues"
  over HTTPS.

### Azure Monitor-specific limitations (verbatim)

- Log Analytics export to storage/event hub: both ends "must be part of the same perimeter."
- "When configuring diagnostic settings at the tenant level, the destination resources... must
  be located **outside** the NSP." (Note this is the *inverse* of the general rule — call it out.)
- "Global action groups resources don't support network security perimeters. You must create
  regional action groups." And: "Event Hub is currently the only supported action type."
- "Cross-resource queries are blocked for Log Analytics workspaces associated with a network
  security perimeter. This includes accessing the workspace through an ADX cluster."
- "Network security perimeter access logs are sampled every **30 minutes**."
- Not supported: workspace replication, ingestion of events from Azure Event Hubs, Azure Monitor
  workspaces (Managed Prometheus), Application Insights Profiler for .NET, Snapshot Debugger,
  Log Analytics customer managed key.

### Trusted services die at enforcement

Storage doc, verbatim: "In enforced mode, even Azure's 'trusted service' exceptions aren't
honored." Transition doc: "Since network security perimeter provides more granular control than
trusted access, Trusted access isn't supported in enforced mode."

If a reader relies on the "Allow Azure services on the trusted services list to access this
storage account" checkbox, flipping to Enforced breaks it. This is probably the #1 real-world
breakage.

### Diagnostic logging

Destination table name in Log Analytics: **`NSPAccessLogs`**. Destinations: Log Analytics
workspace, Azure Storage account, Azure Event Hubs.

Log categories, verbatim, with the modes each applies to — this table *is* the
learning-to-enforced workflow:

| Category | Description | Modes |
|---|---|---|
| `NspPublicInboundPerimeterRulesAllowed` | Inbound access is allowed based on NSP access rules. | Transition/Enforced |
| `NspPublicInboundPerimeterRulesDenied` | Public inbound access denied by NSP. | **Enforced** |
| `NspPublicOutboundPerimeterRulesAllowed` | Outbound access is allowed based on NSP access rules. | Transition/Enforced |
| `NspPublicOutboundPerimeterRulesDenied` | Public outbound access denied by NSP. | **Enforced** |
| `NspOutboundAttempt` | Outbound attempt within NSP. | Transition/Enforced |
| `NspIntraPerimeterInboundAllowed` | Inbound access within perimeter is allowed. | Transition/Enforced |
| `NspPublicInboundResourceRulesAllowed` | When NSP rules deny, inbound access is allowed based on PaaS resource rules. | **Transition** |
| `NspPublicInboundResourceRulesDenied` | When NSP rules deny, inbound access denied by PaaS resource rules. | **Transition** |
| `NspPublicOutboundResourceRulesAllowed` | When NSP rules deny, outbound access allowed based on PaaS resource rules. | **Transition** |
| `NspPublicOutboundResourceRulesDenied` | When NSP rules deny, outbound access denied by PaaS resource rules. | **Transition** |
| `NspPrivateInboundAllowed` | Private endpoint traffic is allowed. | Transition/Enforced |

**The operational insight to build the post's advice around:** the four
`...ResourceRulesAllowed/Denied` categories only fire in **Transition** mode, and
`NspPublicInboundResourceRulesAllowed` / `NspPublicOutboundResourceRulesAllowed` are precisely
the traffic that is surviving on resource-firewall fallback. **Every one of those events is a
connection that will break the moment you set Enforced.** Drain those two categories to zero
before flipping. Conversely the `...PerimeterRulesDenied` categories do not exist in Transition
mode, so you cannot see denials until you enforce.

Log schema top-level fields: `time`, `timeGeneratedEndTime`, `count`, `resourceId`, `location`,
`operationName`, `operationVersion`, `category`, `properties`, `resultDescription`.
NSP-specific properties: `serviceResourceId`, `serviceFqdn`, `profile`, `parameters`, `appId`,
`matchedRule` (JSON bag `{"accessRule": "{ruleName}"}`), `source`, `destination`,
`accessRulesVersion`. Source sub-properties include `ipAddress`, `port`, `protocol`
(format `{AppProtocol}:{TptProtocol}`, e.g. `HTTPS:TCP`), `perimeterGuids`, `appId`.
Destination sub-properties include `fullyQualifiedDomainName`, `port`, `protocol`.

Full sample JSON log entries for inbound and outbound are on the diagnostic logs page if the
writer wants one.

> **NO KQL AVAILABLE.** The diagnostic logs page contains **no sample KQL queries**. If the post
> shows a KQL query it will be invented. The table name `NSPAccessLogs` and the `category`
> field are verified, so a minimal query is defensible, but the writer should either keep it
> trivial and flag it as illustrative, or skip KQL entirely. **Do not present invented KQL as
> documented.**

Logging destination warning, verbatim: "The log destinations must be within the same network
security perimeter as the PaaS resource to ensure the proper flow of PaaS resource logs.
Configuring/already configured Diagnostic Settings for resources not included in the list of
Onboarded private link resources, will result in the cessation of log flow for those
resources." — enabling NSP can silently stop logs for non-onboarded resources.

### Documented rollout guidance (verbatim, standard service endpoint page)

> "Traffic pattern validation: Review and verify all traffic patterns on network security
> perimeter before moving resources to enforced mode. Use network security perimeter diagnostic
> logs to confirm all traffic is approved by network security perimeter access rules. **Monitor
> for one to two weeks** to ensure all access patterns are covered."

Storage doc counterweight, verbatim: "Operating Storage accounts in **Transition (formerly
Learning)** mode should serve only as a transitional step. Malicious actors may exploit
unsecured resources to exfiltrate data. Therefore, it's crucial to transition to a fully secure
configuration as soon as possible with the access mode set to **Enforced**."

One-to-two weeks of observation, then enforce. Transition mode is not a resting state — while
you sit in it, the exfiltration gap the feature exists to close is still wide open.

### Deleting an association is not a safe rollback

Quickstart, verbatim: "Removing your resource association from the network security perimeter
results in access control falling back to the existing resource firewall configuration. This may
result in access being allowed/denied as per the resource firewall configuration. **If
PublicNetworkAccess is set to SecuredByPerimeter and the association has been deleted, the
resource will enter a locked down state.**"

So the rollback path depends on `publicNetworkAccess`: normally you fall back to the resource
firewall, but with `SecuredByPerimeter` you brick the resource's public access entirely.

---

## 7. OPEN QUESTIONS AND CONTRADICTIONS — READ BEFORE WRITING

**1. Access mode naming is inconsistent between the docs and the CLI. (Highest risk.)**
Concepts, transition and diagnostic-logs pages all say the modes are **Transition** and
**Enforced**, and state Transition was "previously named Learning". But
`az network perimeter association create|update --access-mode` accepts exactly
`{Audit, Enforced, Learning}` (CLI reference `ms.date` 2026-08-04 — *newer* than the concepts
page). The CLI quickstart, a Learn page, uses `--access-mode Learning`. And **`Audit` appears
in the CLI but is documented nowhere** in any conceptual page I fetched — I have no idea what it
does.
→ Writer: use "Transition mode (formerly Learning mode)" in prose, use `Learning` in CLI
examples (that is what the quickstart does and what the enum accepts), never write
`--access-mode Transition`, and do not mention `Audit` as a usable mode. Consider calling the
mismatch out in the post — it is exactly the kind of detail that proves the author actually ran
this. **Unresolved: what `Audit` does, and whether `Transition` is accepted as an undocumented
alias.**

**2. Service endpoints: the concepts page contradicts itself.**
Its limitations table says "**Service endpoint traffic is not supported.** ... Currently,
service endpoint traffic can be denied even when an inbound rule allows 0.0.0.0/0." Yet the same
page's component table and "How does it work" section describe **network identifiers** that let
NSP "authorize inbound traffic by using network identifiers — public IP addresses or prefixes
associated with service endpoint subnets", used with **standard service endpoint**.
→ My resolution, from the standard service endpoint page: **basic** service endpoints are
unsupported; **standard** service endpoints (network identifiers) are the supported path — and
that page says plainly "**Standard service endpoint is currently in preview.**" So: NSP is GA,
but the only supported way to get service-endpoint-style IaaS-to-PaaS traffic through it is a
**preview** feature covering only **4 services** (Storage, Key Vault, SQL Database, Cosmos DB).
This resolution is mine, not stated as such by Microsoft — present it carefully, cite both
pages, and do not claim Microsoft says it.

**3. Microsoft Sentinel: direct conflict between two Learn pages.**
Concepts page: "Network security perimeters **aren't supported** for Log Analytics workspaces
enabled for Microsoft Sentinel. If a network security perimeter is enabled on the workspace,
analytic rules are automatically disabled." Azure Monitor page: lists a set of limitations and
then says "**These limitations also apply to Sentinel-enabled Log Analytics workspaces**" —
which implies Sentinel workspaces *can* be associated, subject to limits.
→ Flatly contradictory. Concepts page is newer (`ms.date` 2026-07-08 vs 2025-06-04). **Writer:
take the conservative reading — do not put a Sentinel-enabled workspace in a perimeter — cite
the concepts page, and note the docs disagree.** Do not silently pick one.

**4. GA date unverified.** Status is certain, date is not. See §1. Say "GA as of
<verifiedDate>". Do not print 2025-08-06.

**5. Azure CLI minimum version conflict.** 2.75.0 (CLI extension reference) vs 2.38.0
(quickstart). See §5.

**6. Pricing unverified.** No fetched page states NSP's cost. Omit.

**7. Stale doc anchors suggest the onboarding table may lag reality.** The concepts table marks
Key Vault and Storage as **Generally Available**, but links them to anchors literally named
`#network-security-perimeter-preview`. Cosmetic, but it is evidence the page is not fully
groomed — reinforces telling readers to check the live list rather than trust a table in a blog
post.

**8. TechCommunity announcements could not be verified.** Several Microsoft TechCommunity posts
appear in search (Service Bus GA, Azure Monitor GA, Storage GA, Gov regions). Those pages render
client-side and **WebFetch returned only the page title, no body**. I have therefore cited none
of them. **Do not cite any techcommunity.microsoft.com URL in the post** — I could not confirm
what any of them says. The Learn onboarding table already carries the per-service status and is
the better citation.

**9. Not researched — gaps the writer should route around, not guess at:**
   - Perimeter **links** / `link-reference` (perimeter-to-perimeter). Command names confirmed,
     mechanism not.
   - `az network perimeter logging-configuration` semantics vs a plain diagnostic setting.
   - The `resourceAssociations` Bicep/ARM block.
   - Azure Policy integration for enforcing perimeter membership at scale.
   - Whether IPv6 is supported per-service ("check respective onboarded private link resources
     for v6 support" — unresolved per service).
   - What the CLI `Audit` access mode does.

---

## 8. SUGGESTED ANGLE FOR THE WRITER

The honest, non-hype framing this topic deserves: **NSP is GA and it closes a real gap that
Private Endpoints never addressed — outbound control on PaaS resources — but adoption is gated
by a ten-service onboarding list, and the flip from Transition to Enforced is where things
break.** The strongest 300 words in the post are the enforcement-day failure list: trusted
services stop working, SAS-authenticated intra-perimeter calls get rejected, non-HTTPS storage
protocols (NFS/SMB/SFTP) die, resources without a managed identity lose perimeter access, and
anything relying on resource-firewall fallback in Transition mode silently stops. The
`...ResourceRulesAllowed` log categories are the pre-flight check that catches all of it.

Do not describe NSP as a replacement for Private Link. The docs are explicit that private
endpoint traffic bypasses NSP entirely; they are complementary layers.

---

## 9. SOURCES

All fetched and confirmed on 2026-08-19. All are Microsoft Learn (primary). No secondary or
community sources are cited, because none I found could be verified by fetch.

- [What is a network security perimeter?](https://learn.microsoft.com/en-us/azure/private-link/network-security-perimeter-concepts) — Microsoft Learn, accessed 2026-08-19 — supports: GA status statement; component/object model; access modes; onboarded services table; access rule types; scale limits; known issues; SAS limitation; Sentinel and Azure Backup limitations. Page `ms.date` 2026-07-08, `updated_at` 2026-07-22.
- [Transition to a Network Security Perimeter in Azure](https://learn.microsoft.com/en-us/azure/private-link/network-security-perimeter-transition) — Microsoft Learn, accessed 2026-08-19 — supports: `accessMode` values Enforced/Transition; Transition fallback semantics; public/perimeter/trusted/private access behavior in enforced mode; `SecuredByPerimeter`; the publicNetworkAccess × accessMode matrix; portal path. Page `ms.date` 2025-08-15, `updated_at` 2026-05-26.
- [Diagnostic logs for Network Security Perimeter](https://learn.microsoft.com/en-us/azure/private-link/network-security-perimeter-diagnostic-logs) — Microsoft Learn, accessed 2026-08-19 — supports: all 11 log categories and their applicable modes; `NSPAccessLogs` table name; log destinations; full log schema; Transition-formerly-Learning naming note; log-destination-must-be-in-perimeter warning. Page `ms.date` 2025-08-01, `updated_at` 2025-08-05.
- [Quickstart - Create a network security perimeter - Azure CLI](https://learn.microsoft.com/en-us/azure/private-link/create-network-security-perimeter-cli) — Microsoft Learn, accessed 2026-08-19 — supports: the full runnable CLI sequence; `az extension add --name nsp`; provider registration; managed identity requirement; association-deletion fallback behavior; CLI 2.38.0 claim. Page `ms.date` 2025-08-01, `updated_at` 2025-10-08.
- [az network perimeter](https://learn.microsoft.com/en-us/cli/azure/network/perimeter) — Microsoft Learn, accessed 2026-08-19 — supports: full command surface all marked Status GA; nsp extension requires Azure CLI 2.75.0+; `az network perimeter create` signature. Page `ms.date` 2026-08-04.
- [az network perimeter association](https://learn.microsoft.com/en-us/cli/azure/network/perimeter/association) — Microsoft Learn, accessed 2026-08-19 — supports: `--access-mode {Audit, Enforced, Learning}` accepted values; `--private-link-resource` and `--profile` syntax; create/update examples. Page `ms.date` 2026-08-04.
- [az network perimeter profile access-rule](https://learn.microsoft.com/en-us/cli/azure/network/perimeter/profile/access-rule) — Microsoft Learn, accessed 2026-08-19 — supports: exact access-rule create signature and flags; IP/FQDN/subscription examples; "currently unavailable for use" notes on email/phone/service-tag rule types. Page `ms.date` 2026-08-04.
- [Microsoft.Network/networkSecurityPerimeters (ARM/Bicep reference)](https://learn.microsoft.com/en-us/azure/templates/microsoft.network/networksecurityperimeters) — Microsoft Learn, accessed 2026-08-19 — supports: resource type string; latest stable API version 2025-07-01; API version history showing previews ended at 2024-06-01-preview; name length/pattern constraints; AVM module existence. Page `ms.date` 2024-12-09, `updated_at` 2026-07-20.
- [Microsoft.Network/networkSecurityPerimeters/profiles/accessRules (ARM/Bicep reference)](https://learn.microsoft.com/en-us/azure/templates/microsoft.network/networksecurityperimeters/profiles/accessrules) — Microsoft Learn, accessed 2026-08-19 — supports: verbatim Bicep block; `NspAccessRuleProperties` field names and types; `direction` enum. Page `ms.date` 2024-12-09, `updated_at` 2026-07-20.
- [Network Security Perimeter for Azure Storage](https://learn.microsoft.com/en-us/azure/storage/common/storage-network-security-perimeter) — Microsoft Learn, accessed 2026-08-19 — supports: NSP overrides storage firewall; private endpoint bypass; trusted services not honored in enforced mode; object replication / NFS / SMB / SFTP / Azure Backup / unmanaged disks / static website limitations; Transition-mode-masks-unsupported-protocols warning; CMK warning; subscription-rule workaround for non-onboarded services. Page `ms.date` 2025-07-27, `updated_at` 2026-07-07.
- [What is an Azure standard service endpoint?](https://learn.microsoft.com/en-us/azure/private-link/service-endpoint-standard-overview) — Microsoft Learn, accessed 2026-08-19 — supports: standard service endpoint is in preview; network identifier concept; 4 supported services; "NSP only supports allow rules, not deny rules"; one-to-two-week validation guidance; scale-planning best practices; standard service endpoint pricing. Page `ms.date` 2026-07-08, `updated_at` 2026-08-05.
- [Azure RBAC permissions required for Azure Network Security Perimeter usage](https://learn.microsoft.com/en-us/azure/private-link/network-security-perimeter-role-based-access-control-requirements) — Microsoft Learn, accessed 2026-08-19 — supports: built-in roles; every RBAC action string for perimeter/profile/access rule/association; the three-way association permission requirement; subscription contributor note. Page `ms.date` 2025-08-01, `updated_at` 2025-10-15.
- [Configure Azure Monitor with Network Security Perimeter](https://learn.microsoft.com/en-us/azure/azure-monitor/essentials/network-security-perimeter) — Microsoft Learn, accessed 2026-08-19 — supports: Azure Monitor supported components and API versions; managed-identity implicit intra-perimeter access; regional vs global action groups; 30-minute log sampling; cross-resource query block; tenant-level diagnostic settings inversion; unsupported components; the conflicting Sentinel statement. Page `ms.date` 2025-06-04, `updated_at` 2026-07-07. (Canonicalizes to `/azure-monitor/fundamentals/network-security-perimeter`.)

**Source count: 13. All primary (Microsoft Learn). Zero secondary sources cited.**
