---
title: 'Concept: Shared platform services for Online archetype applications'
description: 'Two concepts for giving Online archetype applications shared WAF services without breaking their network isolation.'
pubDate: 2025-05-02
tags:
  - azure
draft: false
---
![](/images/blog/shared-services-online.png)
Many environments in Azure follows the Enterprise Scale Landing Zones design where you have Platform Landing Zones that are shared through the Azure environment, and dividing the Application Landing Zones into Corp and Online. Corp applications are bound to utilizing private networks in Azure takes advantage of a hub to communicate between each other and to external services (i.e. on-premises or Internet). Online on the other hand are treated more like bubbles where application owners has a bigger responsibility to secure external traffic, and we minimize the blast radius if they are exposed by not letting them be connected to each other with virtual network peering. 

There are many reasons for why an applications needs to be in the Online archetype. One reason is cost, some PaaS services requires a higher SKU to be able to integrate them in a private network. Another reason I hear is that "private networking in Azure is hard". The last reason can be mitigate by elevating the team or bring in external competence in designing the solution, but the cost aspect might not be possible to mitigate and therefore the Online archetype is the right one for that solution. 

But being in the Online section of the Azure environment means that you can't take advantage of centrally managed shared services that are reached via the hub. One of them could be a centrally managed Web Application Firewall (WAF), and that will be the example in this post. The WAF can be complex to manage and needs configuration to make sure that its protecting the published applications. The WAF also comes with a cost. If we let the teams in the Online archetype managed this completely by them self we might end up with WAFs that are misconfigured and doesn't provide the protection that we want, or that teams publish the service directly to internet, relying only on the services level firewall on the PaaS service itself. 

# Concept 1: Shared Platform Landing Zones for Online
![](/images/blog/solution1-online-shared.drawio.svg)

In this concept we have deployed a WAF that will only serve applications that are in the Online archetype. This WAF will still be managed by the same team or individuals that are responsible for the WAF that is attached to the central connectivity hub. This means that we will have control over the configurations in the WAF that are used by applications in in the Online archetype. So we can ensure that they follow the desired rules and have control how the applications are exposed to the internet and how the communication between WAF and applications is configured. 

Having a shared WAF for the Online archetype also means that we don't need to point our external DNS to various services that are deployed by the application teams, but instead only to our shared WAFs public endpoint. We will also be able to centralize the management of certificates.

We still want to make sure that each Online application remains in its "bubble", so that in the case of a breach there are no direct communication between the applications over the private network. This is still achieved in this concept since traffic won't traverse over vnet peerings to other applications virtual networks. 

But if we are to use shared services in this way for our Online archetype we need to implement some sort of IPAM solution to avoid IP conflicts. For example, if the Online Application 1 vnet and the Online Application 2 vnet overlaps, the WAF won't know in which network the desired backend resource is. I would recommend the native Azure IPAM solution that is built in to Azure Virtual Network Manager (AVNM), but it's still in Public Preview so be cautious when deploying it for a production environment.

Note that you might need to deploy multiple WAFs for your online applications since you want them to be close to the resource in Azure and your applications user.

#  Concept 2: Connect Online Applications the Corp Shared Platform Landing Zones
![](/images/blog/solution2-online-to-corp-shared.drawio.svg)

For the second concept we utilize a WAF that is connected to the connectivity hub to publish our Online applications. Usually this WAF is dedicated to Corp applications but I want to challenge that in this concept. You will still get separation between Online and Corp applications in this scenario since the traffic can't traverse from an Online applications virtual network, through the WAF virtual network and on to the Corp applications. You get the same upsides as you do with the first concept with the addition that you will also save som mony since only one WAF is needed to serve both archetypes and your network team only needs to manage one WAF.

But what are the downsides? Even if the traffic from the Online applications can't reach the connectivity hub, the WAFs virtual network is peered with it, so there can be no overlapping IP addresses in Corp and Online. So your Online applications needs to be handled in the same IP plan as your Corp applications. Usually there is a connection between Azure and you on-premises environment, meaning that those too needs to be in the same IP plan. That can lead to IP exhaustion. 

Since the Online applications and the Corp applications share the same WAF they will have to abide to the same security standard. That sure sounds like a good thing, but if you have different requirements to the different archetypes that will cause an issue. 

# Conclusions
For bigger companies where IP exhaustion is a real risk, the first concept the best for running shared Platform Landing Zones for Online applications. It will increase the cost and management.
And for the second concept it is the other way around. I will be better suited for smaller companies where IP exhaustion is not an issue but cost and management capacity is. 
Keep in mind that in neither of these concepts the online applications traffic is filtered through a firewall. 

# Reflection
For security reasons I personally prefer that you try to run as much as possible through private networks in Azure. That might limit the need for solutions like this. But reality is that not all applications can be restricted to the rules that applies to Corp applications and there for needs to be classified as an Online applications. The goal with these to concepts are to make the Online applications as secure as possible.