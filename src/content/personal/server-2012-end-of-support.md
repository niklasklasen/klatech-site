---
title: 'Windows Server 2012 End of Support: get Extended Security Updates'
description: 'Windows Server 2012 and 2012 R2 reached end of support - how to get three more years of updates via Extended Security Updates.'
pubDate: 2023-10-09
tags:
  - azure
  - azure-arc
draft: false
---
![](/images/blog/esuheaderimg.jpg)
Today the 10th of October 2023 Windows server 2012 and 1012 R2 goes "End of Support". That means that they received their last Security and Critical update today. Are you behind on your upgrade project and still have a few old servers in your data center that hasn't been upgraded yet? Then this blog post will give you some guidance on how to prolong the Security updates for another 3 years for these servers. 

## Extended Security Updates
Extended Security Updates (ESUs) are available to servers hosted in Azure free of charge, but for servers hosted in other places than Azure (i.e. On-Premises) ESUs available for purchase. Then you need to onboard these servers with Azure Arc, but more on that later. 

Wether your Windows Server 2012 or 2012 R2 are hosted in Azure or elsewhere, ESU will extend your Security and Critical updates to the 13th of October 2026. That's three more years for you to complete your upgrade project. But I would still recommend hurrying up, since updates outside of the classifications Security and Critical won't be delivered to your 2012 and 2012 R2 servers.

For Azure hosted servers there's no extra steps to take, ESUs are included and you can move straight to the step of setting up automated patching with Azure Update Manager. 

> **_WARNING:_** After the period for Extended Security Updates ends on the 13th of October 2026 there will be no more updates for Windows server 2012 and 2012 R2. 

### Licensing
You have a few options when it comes to buying your ESU license. You can chose between Datacenter or Standard, and Physical cores or Virtual cores. This means that the license is based on the amount of cores that your servers have that you want to include in the ESU license. 

Standard can be applied to up to two virtual machines and Datacenter has no limit on how many virtual machines that you can include in that license. 

If you chose to license based on Physical cores the least amount that you can buy is 16 cores per license and for Virtual cores the least amount is 8 cores per license. 

ESUs licenses are flexible, meaning that you can scale your license up and down as the the need to include more cores increases or decreases, and you buy them in chunks of 2 or 16 cores. There is no automation that updates the amount of cores in your license so it will be up to you to update as the need changes.

### Licensing Examples 
To help navigate the license jungle for ESUs Microsoft has illustrated a couple of potential scenarios to help you understand how the licensing model works. Below I have listed two of them, but you can find more scenarios here on [Microsoft Learn.](https://learn.microsoft.com/en-us/azure/azure-arc/servers/license-extended-security-updates#scenario-based-examples-compliant-and-cost-effective-licensing).

#### Eight modern 32-core hosts (not Windows Server 2012). While each of these hosts are running four 8-core VMs, only one VM on each host is running Windows Server 2012 R2
In this scenario, you can use virtual core-based licensing to avoid covering the entire host by provisioning eight Windows Server 2012 Standard licenses for eight virtual cores each and link each of those licenses to the VMs running Windows Server 2012 R2. Alternatively, you could consider consolidating your Windows Server 2012 R2 VMs into two of the hosts to take advantage of physical core-based licensing options. 

#### 128-core Windows Server 2012 Datacenter server running between 10 and 15 Windows Server 2012 R2 VMs that get provisioned and deprovisioned regularly
In this scenario, you should provision a Windows Server 2012 Datacenter license associated with 128 physical cores and link this license to the Arc-enabled Windows Server 2012 R2 VMs running on it. The deletion of the underlying VM also deletes the corresponding Arc-enabled server resource, enabling you to link another Arc-enabled server.

## ESU with Azure Arc
In conclusion, there are 2 ways to ways to prepare your on-premises servers for ESUs. Either you migrate them to Azure, but if you go that path I recommend that you upgrade to a current version of Windows Server if possible, or onboard your on-premises servers to Azure Arc. In this post I will not focus on the onboarding process to Azure Arc, but if you are new to that concept you can read more here on [Microsoft Learn.](https://learn.microsoft.com/en-us/azure/azure-arc/servers/).

### Prerequisites
There are some requirements to be able to use ESUs with Azure Arc. First of you need the Azure Arc agent to be on at least version 1.34, which is today the latest version released in September 2023. You are also required to attest to their conformance with SA or SPLA. Software Assurance or an equivalent Server Subscription is required for you to purchase Extended Security Updates on-premises and in hosted environments.

You can examine what Arc-enabled servers you have in your environment that is eligible for ESUs from the Azure Arc blade. Navigate to **Extended Security Updates** and click on **Eligible resources** on the top left. This will list all Arc-enabled servers that are eligible for ESUs.

![](/images/blog/eligibleresources.png)

### Buying through the Azure portal
To buy ESU licenses for your Azure Arc-enabled severs in the portal, you navigate to the Azure Arc blade and click on **Extended Security Updates** just like the previous image, but you stay on the blade **Licenses**. If you have any existing ESU licenses they will be listed here. To create a new ESU license click on the plus icon labeled **Create**, this will open up a new blade for creating ESU licenses. 

Here you need to provide the following information:
- Subscription & Resource Group
- License Name
- Activate License (Now or Later)
- Region
- SKU (Datacenter or Standard)
- Core Type (Physical or Virtual)
- Core Packs (in chunks of 2 or 16)
  - Total cores is listed below
- Check the box assuring that your Windows severs have Software Assurance.

Once all this is filled out, click the create button to create your license. 

![](/images/blog/esulicenseblade.png)

Next you will need to associate your Arc-enabled servers with the created ESU license. This is done at the **Eligible Resources** blade shown in the *Prerequisites* section. 

### Get updates through Azure Update Manager
Once your Arc-enabled servers are set to receive security updates through an ESU license you can automate the patching with Azure Update Manager. If you already have a good patch process set up using Azure Update Manager you can onboard your Arc-enabled Windows Server 2012 and 2012 R2 servers to the Maintenance Configuration that covers Security updates.

If you are setting up Azure Update Manager just to automate security updates for ESU enabled servers, I would recommend creating a Maintenance Configuration that installs Security and Critical updates and configure it to have a +1 day offset to the second Tuesday every month. Second Tuesday is as most of you know known as **Patch Tuesday** in the Microsoft world, and the +1 day offset is to factor in any potential time zone variations. We don't want to risk missing the newly released security patches and fall one month behind on them.

> **_Header image prompt:_** Generate a 3D style image of servers bunched together ready to receive security updates.