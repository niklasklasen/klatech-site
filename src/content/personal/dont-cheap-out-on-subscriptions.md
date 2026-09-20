---
title: 'Don''t cheap out on Subscriptions'
description: 'Why splitting workloads across more Azure subscriptions, governed by management groups, beats cramming everything into two.'
pubDate: 2023-09-09
tags:
  - azure
draft: false
---
I have seen environments in Azure that are built around one or two subscriptions, usually one for Production and one for Development/Testing. In these cases, Resource Groups was used to provide some structure in these Subscriptions. This is limiting the flexibility in how we can structure our environment and enforce a scalable governance framework. I am aware that this was the standard a couple of years back and that Microsoft preached this as the best practice when building your Azure environment. But as a lot of other things in Azure the view on this has changed as well. 

![](/images/blog/ESL.png)

In the Cloud Adoption Framework (CAF) we are introduced to Enterprise Scale Landing Zone architecture, see the image above. There are two things that clearly differentiates from the old model of gathering all resources in to two subscriptions. 
  1. We are introducing the management group layer on top of the subscriptions
  2. We see multiple single purpose subscriptions.
This allows you to enforce a governance framework on a more granular level. In this post we will look at how we can work with management groups and subscriptions to help us with enforcing a flexible and scalable governance framework.

Frist of there are a few limits to know when we are working with management groups and subscriptions. In one tenant you can deploy 10.000 management groups and they can be 6 levels deep, not including the Tennant Root or subscriptions. The limit for subscriptions is not in the numbers that you can deploy, since the documented limit there is "unlimited", it's in how much of certain resources within a subscription. For example, you are limited to 980 Resource Groups per Subscription.

![](/images/blog/ESL-limits.png)

## Management Groups
Management groups are used to hierarchy and areas in the way we apply our governance framework. Everything you assign to a management group, whether it's policies or RBAC role assignments they will be inherited vertically down in the structure. They do not inherit horizontal in the structure. As an example, a RBAC role assignment added to the management group "Platform" will be inherited to the management groups "Identity", "Management" and "Connectivity" and all the subscriptions that resides within them. How ever it will not be applied to the management group "Landing Zones". 

The structure presented in the Enterprise Scale Landing Zone architecture is designed to scale with you throughout your cloud journey. Think both one and two times before changing or adding two much to the design. I have seen cases where management groups are created to mimic the company’s organizational structure or their country-based footprint, that solution tends to run in to a scaling problem at some point. The guardrails that we set up with Azure Policies will in most cases span over multiple teams and countries since they are focused on what resource you are allowed to deploy or how the must be configured. If you take an application that is intended to be connected to your central connectivity HUB, it doesn’t matter what country the users are in. We must enforce our policies that applies for applications that want to access our internal network. 

## Subscriptions
Don't hold back when the organization ask for new subscriptions to build their applications in. If you have your management groups in order and the Azure Polices in place, adding extra subscriptions won't be a burden for you. Rather see them as container where your developers or other users can develop and try out new things. If the thing that they tried out works you already have it in a separate container that is organized with the correct governance rules, and it's a product that doesn’t work you can just decommission the whole subscription.

Be very cautious when handing out the RBAC role "Owner", even on subscriptions. As an Owner you can migrate the Subscription to another Tenant. The effect would for your organization will be that you are still carrying the cost for this Subscription, but you won't be able to see it. Even wors, all the guardrails you implemented with RBAC and Azure Policies will not affect the Subscription once it's moved out

The recommendation I give to the companies that I work with are to use one subscription (or two, production and development) for each of the applications or workloads that are built or moved into Azure. Give the application owners the freedom they need to build and test their application without worrying that they will break something else in the environment. That sense of security goes both ways, for both the application team and the IT department responsible for the Azure environment. 

As of today, you can give an application team the RBAC role Contributor without them being able to alter or remove any policies that the subscription needs to be compliant to, and they can't move the subscription out from your tenant. When you have this structure in place along with a good RBAC strategy and policy framework, your IT department can breathe a little easier while still allow agility for the developers. 

![](/images/blog/ESL-MS.svg)

## Platform Landing Zones vs. Application Landing Zones
In the Platform Landing Zone subscriptions, we deploy workloads or applications that provides a shared service for the applications in the Application Landing Zones. In the Enterprise Scale Landing Zone concept, we start with 3 Platform Landing Zone subscriptions, Connectivity, Identity and Management. Here are some examples for what each of them can host:
- **Connectivity** - This will be your central connectivity hub. This is where all the Corp Application Landing Zones are peered together and where your Azure environment is connected to your on-premises datacenters. 
- **Management** - Here deploy Platform Landing Zones for patch management and/or central logging. 
- **Identity** - If there is a need for bringing Domain Controllers to Azure they will live in a Platform Landing Zone here.

Usually these Landing Zones are managed by a central team, but the design also allows for more granular access control to these subscriptions if needed.

An Application Landing Zone Subscription is intended to host a single application. There are two flavors for Application Landing Zones, Corp and Online. A Corp Application Landing Zone is meant to be published internally through the central connectivity hub. To reduce the attack vectors, we don't allow Corp Application Landing Zones to have their own public access point, i.e. a Public IP address. The Online Application Landing Zone is something that is meant to be accessed externally, wo here we do allow the landing zone to contain its own public access point. However, we don't allow this landing zone to be connected to the central connectivity hub. These Online Application Landing Zones will almost be their own isolated islands. 

To get some more inspiration and test this concept in your own environment, have a look at these implementation  options that Microsoft has documented.

**[Landing Zone Implementation Options](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/landing-zone/implementation-options#implementation-options)**