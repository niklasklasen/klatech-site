---
title: 'Structure your Azure Firewall Policy rules'
description: 'A practical structure for rule collection groups and rule collections in an Azure Firewall Policy.'
pubDate: 2025-04-11
tags:
  - azure
  - azure-firewall
draft: false
---
![](/images/blog/structure-afwp.png)
As with most things in life you need structure in your Azure Firewall Policy rules. Having a plan for creating your rules in Azure Firewall Policy can (and will) help you when it comes to creating new rules, cleaning up old ones, or in general connectivity troubleshooting. If you are about to create you first rule for your Azure Firewall take a minute and design a structure, because redesigning the rule structure later will probably be more time consuming that getting it right the first time. There are of course multiple ways how you can structure the rules within your Azure Firewall Policy, the concept that I will show you is one that I have implemented and find easy to use when maintaining an Azure Firewall.

This blog post will focus on how to structure your rules within an Azure Firewall Police, not how to plan when using multiple Azure Firewall Policeis where you have a parent policy and multiple child policies.

## Scenario
A common network design in Azure is the hub-and-spoke. You have a central connectivity hub that contains shared services for the platform, like your Azure Firewall, and then the application teams deploy their solutions in different spokes. This means that your central firewall will manage both east-west and north-south traffic. This will most likely mean that your central firewall needs a lot of rules. The central firewall will be one of the key pieces that segments your network, and you only want to let traffic through the firewall that you actually need in your environment. 

![](/images/blog/hub-and-spoke.svg)

## Rule Collection Groups
The structural hierarchy in an Azure Firewall Policy consists of three levels, where the top level is rule collection groups. Out of the box there are 3 included rule collection groups, they are not visible in the portal but will be as soon as you add rule collections (second level) to them. These are:
- DefaultDnatRuleCollectionGroup
- DefaultNetworkRuleCollectionGroup
- DefaultApplicationRuleCollectionGroup

I use these for global rules, rules that aren't bound to a specific team's needs but a general need for the platform. As examples, allowing DNS requests to or from on-premises DNS servers, or if you have a shared service deployed that you want the whole platform to be able to reach.

In addition to these default rule collection groups I create one for each department or application team that is running or building workloads on the platform. This gives you a nice and clean structure to work with when you are looking through the rules in your Azure Firewall Policy. 

![](/images/blog/rule-collection-group-structure.png)

## Rule Collection
This is the second level in the structural hierarchy within Azure Firewall Policies, and these are grouped into Rule Collection Groups. Rule Collections are defined to be either for Network Rules or Application Rules, and you specify if the rules in the Rule Collection is Allow or Deny rules. I tend to avoid using Deny rules since Azure Firewall is explicit deny, meaning if no particular rule is created to allow the traffic through it is denied by default. 

>**NOTE:** If you want to make sure that specific IP addresses or ranges aren't allowed you could add specific deny rules for these, just make sure that they are in a Rule Collection Group with a low priority number. This will make them the first rules that your firewall evaluates and if they trigger the traffic won't be evaluated by any other rules in the Azure Firewall Policy. The purpose of this is to make sure that these IP addresses will be blocked even if they are included in an allowed range by another rule with a higher priority number.

So, how do I structure Rule Collections? First off I create global Rule Collection under the corresponding Rule Collection Group, as an example:

*Global-NetworkRules  -->  DefaultNetworkRuleCollectionGroup*

Then for each of the team or department I create Rule Collections multiple Rule Collections for the different environments (production, development, etc.) and for each I create Rule Collections for network rules and application rules. The result can look something like this: 

![](/images/blog/rule-collection-structure.png)

## Rules
Last level is the rules that you add to rule collections. These will be structured based on priority, where highest priority (lowest number) will be on top and the lowest priority (highest number) will be on the bottom. You add these rules in the rule collection that fits the purpose of the rule. As an example, if Team Y needs to open communications from their production network to an on-premises server you will add that rule under Team Y rule collection group, Team Y Network Rule Collection and then the rule that allows their network to communicate to the destination servers IP address over the desired protocol and port. I can look something like this: 

![](/images/blog/rule-structure.png)

## Priority Matters
The priority you set on all the levels in this structure will matter for the order that the rules are processed. Azure Firewall will process the the type of rules in the following order: 
1. All DNAT rules
2. All Network rules
3. All Application rules

Within those types it will process them based on priority.
1. Rule collection group priority
2. Rule collection priority within the rule collection group

The Azure Firewall denies all traffic that it can't find a rule that allows it. Azure Firewall is explicit deny.