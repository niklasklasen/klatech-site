---
title: 'Azure Update Manager goes GA, Dynamic Scopes in preview'
description: 'Azure Update Manager reaches general availability, its new pricing, and the preview of Dynamic Scopes for Maintenance Configurations.'
pubDate: 2023-09-20
tags:
  - azure
draft: false
---
![](/images/blog/aumIcon.png)
# Azure Update Manager is generally available
It's been half a year since I wrote my first post for this blog about the product Update Management Center which was in preview back then. A couple of days ago Microsoft released the product as Generally Available under the name "Azure Update Manager", read more in the release post on Microsoft Techcommunity [Microsoft Techcommunity](https://techcommunity.microsoft.com/t5/azure-governance-and-management/generally-available-azure-update-manager/ba-p/3928878?WT.mc_id=DT-MVP-5001664). The release post mentions the new price for Azure Update Manager now when it moves into Generally Availability without going in to any more details than Azure or Azure Stack HCI hosted Virtual Machines will remain free, and Azure Arc-enabled servers will cost up to $5/month per server. So let’s shed some light on that. 

The cost is based on the amount of days that the Arc-enabled server is considered as managed by Azure Update Manager, and a server is considered as managed if the following two conditions are met:
1. The Arc-enabled machine has the status connected when an operations takes place, see condition 2. 
2. An assess operation is triggered no matter if it's manual or automatic, or a patch operation is triggered either manual or by a schedule. 

The cost for each day that these two conditions are met are $0.167 per day. So, if you have enabled Periodic assessment, this will perform a check for new updates every 24h and if your machine is connected this will count your Arc-enabled server as managed by Azure Update Manager and trigger a cost of $0.167. If this happens every day in the month it will land at around $5. But there are two scenarios where the cost for running Azure Update Manager operations on your Arc-enabled VMs are included. 

If you buy Extended Security Updates (ESUs) for your Arc-enabled servers, manage the patching with Azure Update Manager there will be no charge for Azure Update Manager. Also, if you have your Arc-enabled servers onboarded to Defender for Servers Plan 2 (Plan 1 won't cut it) there will be no extra charge for utilizing Azure Update Manager. 

![](/images/blog/azureUpdateManagerOverview.png)

# Dynamic Scopes
A key resource to get the patches installed on your servers using Azure Update Manager is the Maintenance Configuration. I have explained more on how to create Maintenance Configurations on a previous blog post, so I won’t go into details on that. If you would like to read more on creating Maintenance Configurations read this post instead [Configuring Update Management Center (Preview) with policies](https://klasen.cloud/azure/update-management-center/).

For automatic onboarding of servers to Maintenance Configurations I used Azure policies and defined what parameters I needed for specific schedules. If an organization had multiple windows and a global presence, there could be a lot of policies to deploy. In my opinion that leads to a very cluttered compliance view when looking at your policies. Luckily there is a feature in preview called Dynamic Scopes. This replaces the need for policies to dynamically onboard servers to a Maintenance Configuration. 

The first thing you configure when setting up a new Dynamic Scope is the subscription that is the target scope. You can select one or many subscriptions as targeted scope, but you are not able to change it once the dynamic scope is created. When the scope is set you will add your filters, and the filters that you can chose from are: 
- Resource Groups
- Resource Types (VirtualMachine or Azure Arc-enabled server)
- Locations
- OS types (Windows or Linux)
- Tags (with an All or Any operator)

Here is what that looks like in the portal.
![](/images/blog/dynamicScopeFilterPortal.png)

You can also use Bicep to deploy Dynamic Scopes to your Maintenance Configurations. Here is what a Bicep template for a Dynamice Scope can look:
```bicep
param parDynamicScopeName string
param parLocation string
param parFilterLocations array
param parFilterOsTypes array
param parFilterResourceGroups array
param parFilterResourceTypes array
param parMaintenanceConfigurationId string
param parFilterTagOperator string
param parFilterTags object

resource resDynamicScope 'Microsoft.Maintenance/configurationAssignments@2023-04-01' = {
  name: parDynamicScopeName
  location: parLocation
  properties: {
    filter: {
      locations: parFilterLocations
      osTypes: parFilterOsTypes
      resourceGroups: parFilterResourceGroups
      resourceTypes: parFilterResourceTypes
      tagSettings: {
        filterOperator: parFilterTagOperator
        tags: parFilterTags
      }
    }
    maintenanceConfigurationId: parMaintenanceConfigurationId
  }
}
```
