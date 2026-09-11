---
title: "Azure Network Security Perimeter: What Breaks at Enforced"
description: "Azure Network Security Perimeter is GA, but only ten PaaS services are onboarded. What it controls, and what breaks when you flip to Enforced mode."
pubDate: 2026-08-19
verifiedDate: 2026-08-19
author: "Content Team"
category: azure-network-security
tags:
  - azure
  - network-security-perimeter
  - paas
  - data-exfiltration
  - private-link
draft: false
sources:
  - title: "What is a network security perimeter?"
    url: "https://learn.microsoft.com/en-us/azure/private-link/network-security-perimeter-concepts"
    publisher: "Microsoft Learn"
    accessed: 2026-08-19
  - title: "Transition to a Network Security Perimeter in Azure"
    url: "https://learn.microsoft.com/en-us/azure/private-link/network-security-perimeter-transition"
    publisher: "Microsoft Learn"
    accessed: 2026-08-19
  - title: "Diagnostic logs for Network Security Perimeter"
    url: "https://learn.microsoft.com/en-us/azure/private-link/network-security-perimeter-diagnostic-logs"
    publisher: "Microsoft Learn"
    accessed: 2026-08-19
  - title: "Quickstart - Create a network security perimeter - Azure CLI"
    url: "https://learn.microsoft.com/en-us/azure/private-link/create-network-security-perimeter-cli"
    publisher: "Microsoft Learn"
    accessed: 2026-08-19
  - title: "az network perimeter association"
    url: "https://learn.microsoft.com/en-us/cli/azure/network/perimeter/association"
    publisher: "Microsoft Learn"
    accessed: 2026-08-19
  - title: "Network Security Perimeter for Azure Storage"
    url: "https://learn.microsoft.com/en-us/azure/storage/common/storage-network-security-perimeter"
    publisher: "Microsoft Learn"
    accessed: 2026-08-19
  - title: "What is an Azure standard service endpoint?"
    url: "https://learn.microsoft.com/en-us/azure/private-link/service-endpoint-standard-overview"
    publisher: "Microsoft Learn"
    accessed: 2026-08-19
  - title: "Azure RBAC permissions required for Azure Network Security Perimeter usage"
    url: "https://learn.microsoft.com/en-us/azure/private-link/network-security-perimeter-role-based-access-control-requirements"
    publisher: "Microsoft Learn"
    accessed: 2026-08-19
  - title: "Configure Azure Monitor with Network Security Perimeter"
    url: "https://learn.microsoft.com/en-us/azure/azure-monitor/essentials/network-security-perimeter"
    publisher: "Microsoft Learn"
    accessed: 2026-08-19
---

A storage account, a key vault, an Event Hubs namespace: each is created outside your
virtual network with a public endpoint. You have had three controls for years:
per-resource firewall, service endpoints, and Private Endpoints. All are scoped to one
resource and look only at inbound traffic. None of them constrain what the PaaS
resource itself sends outbound. That is the exfiltration path that survives every "we
locked down the storage firewall" review.

**Network Security Perimeter (NSP)** closes that gap. It is generally available as of
2026-08-19, in all Azure public cloud regions and in the listed Azure Government regions.
That GA badge is the most misread fact about it: the platform being GA says nothing about
which of your services can join a perimeter.

## What NSP adds that the other three controls don't

| Control | Direction | Scope | What it does |
|---|---|---|---|
| Per-resource firewall | Inbound only | One resource | IP/VNet ACL on that account |
| Service endpoint (basic) | Inbound only | Subnet to one resource | Gives VNet identity to the resource firewall |
| Private Endpoint | Inbound only | One resource | Private IP in your VNet, no public path |
| NSP | Inbound and outbound | Many resources, many subscriptions | Explicit-allow boundary, central rules, access logs |

Three behaviors matter. NSP rules override the resource's own firewall: the Storage docs
say the account's "Allowed networks" settings are bypassed once it is associated in
enforced mode. NSP does not touch Private Link traffic, which is explicitly not subject to
perimeter rules, so the two are complementary layers. And NSP only supports allow rules,
not deny rules, so there is no rule priority and no deny path to debug.

## The object model

A **network security perimeter** is the boundary resource, named uniquely within its
resource group and placed in a supported region. A **profile** is a collection of access
rules; a **resource association** is one PaaS resource's membership, carrying its access
mode. **Access rules** are IP-prefix or subscription based inbound, and fully qualified
domain name (FQDN) based outbound.
The schema's `emailAddresses`, `phoneNumbers` and `serviceTags` rule types are all
annotated "currently unavailable for use".

One rule governs everything inside the boundary: resources in the same perimeter implicitly
allow each other, but only when access is authenticated using managed identities and
role assignments. A resource with no managed identity gets nothing from membership, and
API-key access still needs an explicit rule. Shared access signature (SAS) tokens are
worse: intra-perimeter traffic and subscription-based inbound rules do not support SAS at
all, and requests using one are rejected with an authentication error.

## Standing one up

The `nsp` extension installs itself on first use. The version floor is contradictory: the
CLI extension reference says Azure CLI 2.75.0 or higher, the quickstart says 2.38.0.
Use 2.75.0.

```bash
az extension add --name nsp
az provider register --namespace Microsoft.Network

# 1. The perimeter
az network perimeter create \
    --name network-security-perimeter \
    --resource-group resource-group \
    -l westcentralus

# 2. A profile to hang rules on
az network perimeter profile create \
    --name network-perimeter-profile \
    --resource-group resource-group \
    --perimeter-name network-security-perimeter

# 3. Associate the PaaS resource, observation mode first
az network perimeter association create \
    --name network-perimeter-association \
    --perimeter-name network-security-perimeter \
    --resource-group resource-group \
    --access-mode Learning \
    --private-link-resource "{id:<PaaSArmId>}" \
    --profile "{id:<networkSecurityPerimeterProfileId>}"

# 4. Inbound rule for a known caller prefix
az network perimeter profile access-rule create \
    --name access-rule \
    --profile-name network-perimeter-profile \
    --perimeter-name network-security-perimeter \
    --resource-group resource-group \
    --address-prefixes "[192.0.2.0/24]"

# 5. Outbound rule: the part no other control gives you
az network perimeter profile access-rule create \
    --name outbound-fqdn-rule \
    --profile-name network-perimeter-profile \
    --perimeter-name network-security-perimeter \
    --resource-group resource-group \
    --fqdn "['<allowed-destination-fqdn>']" \
    --direction "Outbound"

# 6. Flip to Enforced once the logs are clean: same command, new mode
az network perimeter association create \
    --name network-perimeter-association \
    --perimeter-name network-security-perimeter \
    --resource-group resource-group \
    --access-mode Enforced \
    --private-link-resource "{id:<PaaSArmId>}" \
    --profile "{id:<networkSecurityPerimeterProfileId>}"
```

### The access mode naming trap

The conceptual docs say the modes are **Transition mode (formerly Learning mode)** and
**Enforced**, and the portal offers those two labels. The CLI does not. Both
`az network perimeter association create` and `association update` accept exactly three
values for `--access-mode`: `Audit`, `Enforced`, `Learning`. `Transition` is not among
them, and `Audit` has no description in the CLI reference and no mention in any
conceptual page: treat it as undocumented and leave it alone. Write `Learning` in
scripts, say "Transition" in the runbook, and expect the two to keep disagreeing.

The behavioral difference matters more. In Transition mode the NSP configuration is the
baseline; when no perimeter rule matches, evaluation falls back to the resource firewall,
which may then allow the request. In Enforced mode the resource obeys only NSP rules.

NSP also adds a third `publicNetworkAccess` value, `SecuredByPerimeter`, which locks a
resource down on creation even before it joins a perimeter:

| `publicNetworkAccess` | No profile associated | Transition | Enforced |
|---|---|---|---|
| Enabled | In: resource rules / Out: allowed | In: NSP + resource rules / Out: NSP rules + allowed | In: NSP / Out: NSP |
| Disabled | In: denied / Out: allowed | In: NSP / Out: NSP rules + allowed | In: NSP / Out: NSP |
| SecuredByPerimeter | In: denied / Out: denied | In: NSP / Out: NSP | In: NSP / Out: NSP |

Read the second row: with public access merely "Disabled" and no perimeter, outbound is
still allowed. The exfiltration gap, in table form.

## Ten services is the real adoption gate

As of 2026-08-19 the onboarding table lists ten private link resources: Azure Monitor,
Azure AI Search, Cosmos DB, Event Hubs, Key Vault, SQL DB, Storage, Azure OpenAI Service,
Microsoft Foundry, and Azure Service Bus. Cosmos DB, SQL DB and Azure OpenAI Service are
in **public preview**. In Gov cloud only Key Vault, Storage and Microsoft Foundry are GA.

A real estate also contains App Service, Functions, AKS, Container Registry and Azure
Backup, none of which can join a perimeter today. The documented workaround is a
subscription-based inbound rule, and the docs are blunt: "A subscription-based rule
grants access to all resources within that subscription."

The list changes, so enumerate it at deploy time rather than trusting any table, this one
included. `--location` is required, not an optional filter, so you query one region at
a time:

```bash
az network perimeter associable-resource-type list --location <region>
```

## What breaks the day you set Enforced

- **Trusted services stop working.** In enforced mode, Azure's "trusted service"
  exceptions are not honored. Anything depending on the "Allow Azure services on the
  trusted services list" checkbox dies here.
- **SAS-authenticated calls are rejected** for intra-perimeter traffic and
  subscription-based inbound rules.
- **Non-HTTPS storage protocols stop.** Everything other than HTTPS is blocked for a
  storage account in enforced mode, taking out NFS, SMB and SFTP. The Storage doc warns
  that success in Transition mode proves nothing, because the traffic may be surviving
  on firewall fallback.
- **Resources without a managed identity lose perimeter access.**
- **Anything relying on resource-firewall fallback stops**, by definition.

Storage adds exclusions: object replication fails if either account is in a perimeter,
static website is unsupported, unmanaged disks do not honor perimeter rules, and Azure
Backup is unsupported on NSP-enabled accounts. With customer-managed keys, the Key Vault
must be reachable from inside the same perimeter.

Deleting the association is not a clean rollback: control normally reverts to the resource
firewall, but under `SecuredByPerimeter` the resource enters a locked-down state.

## The pre-flight check that catches all of it

NSP writes access logs to the `NSPAccessLogs` table, with Log Analytics, Storage and Event
Hubs as destinations. Eleven categories exist; what matters is which mode each fires in.
The `...ResourceRulesAllowed` and `...ResourceRulesDenied` pairs only exist in Transition
mode. They record traffic that no perimeter rule matched and the resource
firewall then adjudicated.

So every event in `NspPublicInboundResourceRulesAllowed` and
`NspPublicOutboundResourceRulesAllowed` is a connection that will break the moment you set
Enforced. Drive both to zero, then flip. The inverse also holds: the
`...PerimeterRulesDenied` categories do not exist in Transition mode, so you cannot see
denials until you enforce.

Microsoft's guidance is to monitor for one to two weeks before enforcing, while the
Storage doc insists Transition mode "should serve only as a transitional step", because
while you sit there the exfiltration gap is still open. Two logging caveats: destinations
must sit in the same perimeter as the resource, and diagnostic settings aimed at a
non-onboarded destination stop log flow for those resources. Azure Monitor
documents 30-minute sampling on access logs, so the feedback loop is not immediate.

## Where the docs contradict each other

**Service endpoints.** The concepts page lists "service endpoint traffic is not supported"
as a limitation, and notes such traffic can be denied even when an inbound rule allows
`0.0.0.0/0`. The same page describes network identifiers that authorize inbound traffic
from service endpoint subnets. The reading that fits both, though Microsoft does not say it
in these words, is that basic service endpoints are unsupported and **standard** ones are
the supported path. Standard service endpoint is itself in preview across four services.

**Microsoft Sentinel.** The concepts page says perimeters are not supported for Log
Analytics workspaces enabled for Sentinel, and that enabling one automatically disables
analytic rules. The Azure Monitor page lists limitations and then says they "also apply to
Sentinel-enabled Log Analytics workspaces", implying such workspaces can be associated.
Both cannot be right. The concepts page is newer: keep Sentinel workspaces out.

**The GA date.** The status is unambiguous across multiple Learn pages, but none of them
carries a GA date, and the Azure Updates entry that search results point to no longer
resolves. That is why this post says "GA as of 2026-08-19" and names no launch date.

## What this means in practice

Plan the boundary before the rules. 100 perimeters per subscription and 1,000 PaaS
resources per perimeter are *recommended* limits; 200 rule elements per profile, inbound
and outbound each, is a **hard** limit. Rule sprawl is the constraint that bites.

Sort out permissions early. Association requires
`Microsoft.Network/networkSecurityPerimeters/resourceAssociations/write` on the perimeter,
`.../profiles/join/action` on the profile, and
`{providerNamespace}/{resourceType}/joinPerimeter/action` on the target PaaS resource. A
central networking team holding Network Contributor cannot onboard an app team's storage
account alone. Model that ticket queue before you promise a date.

Then be honest about coverage. With ten services onboarded and three in preview, NSP
secures a slice of a typical estate, not the estate. It is the right control for that
slice, particularly for outbound FQDN restriction, which none of the three older controls
offers. Extend it service by service as onboarding lands, keep Private Endpoints, and
budget two weeks of log review before every enforcement flip.
