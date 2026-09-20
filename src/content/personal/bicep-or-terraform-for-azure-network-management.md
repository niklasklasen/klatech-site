---
title: 'Bicep or Terraform for Azure network management'
description: 'Testing whether Bicep or Terraform is better for deploying and managing Azure Virtual Network Manager configurations.'
pubDate: 2026-02-07
tags:
  - azure
  - network
  - terraform
  - bicep
draft: false
---
![](/images/blog/avnm-with-code-header.png)
Infrastructure as code (IaC) is not a new concept in the world of IT, but the usage differs between companies. In the last few years I have helped a customers to deploy new infrastructure with the help of IaC templates and my preferred flavour has been Bicep in these project. Both due to personal preferences and customer requirements. 
Deploying new environments with IaC templates is always good for multiple reasons, i.e. you get a baseline for your environment that is re-deployable and you can say that it's somewhat documented as well since all the information you need is there in the templates. But what happens after the deployment, when the new infrastructure meets the reality? 
When the configuration of the infrastructure needs to change in order to meet new requirements from the business. Then it is easy to open up the Azure portal and kick on a few buttons or write a quick PowerShell script to meet these requirements, but then the reality starts to drift from the template. This means that we no longer can use the template to redeploy the environment in a disaster recovery case or lean on it as documentation any more. To avoid this we can instead do all the configurations that the environment needs in the template instead and just keep deploying the template with the new changes. Sounds simple, right? 

The reality is that to reach the point where you can manage your infrastructure completely with code, your organization needs to reach a certain level of maturity and you need the right skills in your infrastructure teams. To end this rant, I have now found a project where the end goal is that there's no human access in the critical areas of the infrastructure, and all deployments and configurations are made using pipeline and IaC templates. Yay! 

But this raised a question for me. When it comes to both deploy a new network infrastructure and manage it, can I still rely Bicep to do the trick or is Terraform better in this scenario? This is what I will try to figure out in this blog post. 

## The test
In reality the entire core network in Azure will be effected by this, but to test the IaC language I'll keep it simple. I'll be using Azure Virtual Network Manager (AVNM) as the base resource here, and within that I'll create 2 network groups. Outside of the template I'll create 2 virtual networks and the the test will then be to:
- Add one virtual network in each of the network groups
- Move one virtual network form one network group to the other
- Remove one virtual network completely from the network groups

> The template for the first test can be found on the bottom of this post, if you want to try this yourself.

> DISCLAIMER: These template doesn't follow any good template structure. They only serve the purpose to conduct these tests.

### Test 1 - creating AVNM and adding virtual networks to network groups
For this first step I created the AVNM using an IaC template and created the two network groups. The template will then add the two existing virtual networks to the network groups, one for each network group. 
#### Terraform
Running this test in Terraform was no problem. AVNM and the network groups was created and one virtual network was added to each of the groups. As expected.

![](/images/blog/tf-2vnet-2networkgroup.png)

#### Bicep
Same as for Terraform there were no issues to create an AVNM with two network groups and add existing virtual networks to them. 

![](/images/blog/bicep-2vnet-2networkgroup.png)

### Test 2 - Move one virtual network from one network group to the other.
By changing the parent for the virtual network "vnet-2" to reference the network group 1, this should move the virtual network from network group 2 to network group 1.
#### Terraform
By changing the parent id for the static member, terraform destroys the existing static member resource and recreates it under the new parent. The result is that the vnet is moved to the other network group. 

![](/images/blog/tf-2vnet-1networkgroup.png)

#### Bicep
By just changing the parent for the static member resource that is referencing "vnet-2", Bicep doesn't move that member. It creates a new static member in the new network group, resulting in network group 1 now has two members and one is still left in network group 2. This now means that the template is drifting from reality.

![](/images/blog/bicep-2vnet-1networkgroup.png)

### Test 3 - Remove the virtual network from a network group
In this test I will simply remove the static member resource from the template and the expectation is that the network group loses the member.
#### Terraform
With Terraform just removing the reference to the static member removes the member virtual network from the network group.

![](/images/blog/tf-1vnet-1networkgroup.png)

#### Bicep 
By removing the reference to the static member 2 in the template, the goal was to remove it from the network groups all together and just keep the static member 1 in network group 1. But since there is no state kept in bicep, just removing the reference from the template results in Bicep ignoring that resource. The environment stays the same as after test 2.

![](/images/blog/bicep-2vnet-1networkgroup.png)

## Conclusion 
The purpose for this test was to figure out what IaC language would be best suited not for just building a core network in Azure, but to also manage the operations for that core network purely with the IaC template. The goal is that the core network only can be manipulated through these templates and not by human interactions through the Azure portal, AzureCLI or PowerShell. 

Bicep is in my opinion a simpler language to use, and if your goal is just to deploy new infrastructure through templates, it's easy. You write a template and what you have in that template is what will be added to the environment. 

With Terraform you get the benefit (and hassle) of a state file, but you need to need to manage that with care. The state file is the source of truth from your Terraform template of what your environment looks like. The state updates with your template, and if there's any difference between the state and the actual environment the environment will adapt to the state in the state file.

For my purpose of managing the core network only from the template, Terraform is the preferred choice. I also get the benefit of Terraform reverting any changes done in the portal if I redeploy my template. From a security perspective that means that I in theory can run a pipeline every night that deploys the Terraform template. If there's no changes in either the template or the environment, nothing will happen. But if someone has made unexpected changes in the environment, Terraform will roll it back to my expected state that is referenced in the state file. 


### Appendix - Test 1 templates
#### Terraform
```json
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0.2"
    }
    azapi = {
      source  = "azure/azapi"
      version = "~> 1.5.0"
    }
  }

  required_version = ">= 1.1.0"
}

provider "azurerm" {
  features {}
}

data "azurerm_client_config" "current" {
}

variable "vnet-1-id" {
  type        = string
  default     = "Add your own vnet resource ID"
}

variable "vnet-2-id" {
  type        = string
  default     = "Add your own vnet resource ID"
}

resource "azurerm_resource_group" "rg" {
  name     = "rg-avnm-demo"
  location = "swedencentral"
}

data "azapi_resource" "subscription" {
  type                   = "Microsoft.Resources/subscriptions@2021-01-01"
  resource_id            = "/subscriptions/${data.azurerm_client_config.current.subscription_id}"
  response_export_values = ["*"]
}

resource "azapi_resource" "networkManager" {
  type      = "Microsoft.Network/networkManagers@2024-10-01"
  parent_id = azurerm_resource_group.rg.id
  name      = "avnm-tf-demo"
  location  = "swedencentral"
  body = jsonencode({
    properties = {
      description = ""
      networkManagerScopeAccesses = [
        "Connectivity",
      ]
      networkManagerScopes = {
        managementGroups = [
        ]
        subscriptions = [
          data.azapi_resource.subscription.id,
        ]
      }
    }
  })
  schema_validation_enabled = false
  response_export_values    = ["*"]
}

resource "azapi_resource" "networkGroup-1" {
  type      = "Microsoft.Network/networkManagers/networkGroups@2024-10-01"
  parent_id = azapi_resource.networkManager.id
  name      = "TF-NetworkGroup-1"
  body = jsonencode({
    properties = {
    }
  })
  schema_validation_enabled = false
  response_export_values    = ["*"]
}

resource "azapi_resource" "networkGroup-2" {
  type      = "Microsoft.Network/networkManagers/networkGroups@2024-10-01"
  parent_id = azapi_resource.networkManager.id
  name      = "TF-NetworkGroup-2"
  body = jsonencode({
    properties = {
    }
  })
  schema_validation_enabled = false
  response_export_values    = ["*"]
}

resource "azapi_resource" "staticMember-1" {
  type      = "Microsoft.Network/networkManagers/networkGroups/staticMembers@2024-10-01"
  parent_id = azapi_resource.networkGroup-1.id
  name      = "static-member-vnet-1"
  body = jsonencode({
    properties = {
      resourceId = var.vnet-1-id
    }
  })
  schema_validation_enabled = false
  response_export_values    = ["*"]
}

resource "azapi_resource" "staticMember-2" {
  type      = "Microsoft.Network/networkManagers/networkGroups/staticMembers@2024-10-01"
  parent_id = azapi_resource.networkGroup-2.id
  name      = "static-member-vnet-2"
  body = jsonencode({
    properties = {
      resourceId = var.vnet-2-id
    }
  })
  schema_validation_enabled = false
  response_export_values    = ["*"]
}
```
#### Bicep
```powershell
targetScope = 'resourceGroup'

param subid string = '/subscriptions/2e63d2be-c58f-4c17-b08d-967891a03825'
param vnet1id string = '/subscriptions/2e63d2be-c58f-4c17-b08d-967891a03825/resourceGroups/rg-vnets/providers/Microsoft.Network/virtualNetworks/vnet-1'
param vnet2id string = '/subscriptions/2e63d2be-c58f-4c17-b08d-967891a03825/resourceGroups/rg-vnets/providers/Microsoft.Network/virtualNetworks/vnet-2'

resource resavnm 'Microsoft.Network/networkManagers@2025-05-01' = {
  location: resourceGroup().location
  name: 'avnm-demo'
  properties: {
    description: 'Bicep created Azure Virtual Network Manager'
    networkManagerScopeAccesses: [
      'Connectivity'
    ]
    networkManagerScopes: {
      subscriptions: [
        subid
      ]
    }
  }
}

resource networkgroup1 'Microsoft.Network/networkManagers/networkGroups@2025-05-01' = {
  parent: resavnm
  name: 'network-group-1'
  properties: {
    description: 'Network Group 1'
    memberType: 'VirtualNetwork'
  }
}

resource networkgroup2 'Microsoft.Network/networkManagers/networkGroups@2025-05-01' = {
  parent: resavnm
  name: 'network-group-2'
  properties: {
    description: 'Network Group 2'
    memberType: 'VirtualNetwork'
  }
}

resource staticMember1 'Microsoft.Network/networkManagers/networkGroups/staticMembers@2025-05-01' = {
  parent: networkgroup1
  name: 'static-member-vnet-1'
  properties: {
    resourceId: vnet1id
  }
}

resource staticMember2 'Microsoft.Network/networkManagers/networkGroups/staticMembers@2025-05-01' = {
  parent: networkgroup2
  name: 'static-member-vnet-2'
  properties: {
    resourceId: vnet2id
  }
}
```