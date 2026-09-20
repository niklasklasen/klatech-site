---
title: 'Configuring Update Management Center (Preview) with policies'
description: 'A look at Azure''s Update Management Center (Preview) and how to manage VM patching for it using Azure Policies.'
pubDate: 2023-03-23
tags:
  - azure
draft: false
---
As long as we use virtual machines patch management will always be something that we need to be on top of. I recently came a cross a case where a customer wanted to update the way they managed patching for their virtual machines, both in Azure and on-prem. This led me to try out the service Update Management Center (Preview). One thing that caught my attention right of the bat was the possibility to manage patching through the use of Azure Policies. That is a big upside since utilizing a policy driven framework to govern Azure resources eases the administrative burden of IT departments and makes sure that you are compliant towards your own governance framework.
So what is Update Management Center (Preview) and how do you get started with it? 

# Update Management Center (Preview)
One key difference from Automation Update Management, the current update management service in Azure, is that you no longer need Azure Automation or Azure Monitor Logs. Update Management Center (Preview) instead relies on an extension that interacts with the operating system to provide the functionality it need to assess and preform updates to your virtual machines. This extension is automatically installed on the virtual machine when an operation is initiated from Update Management Center (Preview), for example check for updates, install one-time update or periodic assessment on the virtual machine. The extension is install by using one of the following agents: 
- Azure virtual machine Windows agent
- Azure virtual machine Linux agent
- Azure Arc-enabled server agent
This means that Update Management Center (Preview) can be used to manage updates on our Azure deployed virtual machines and on-prem or other cloud providers that you have extended your Azure environment to using Azure Arc. 

To perform its tasks the Update Management Center (Preview) extension runs code locally on the virtual machine to interact with the operating system. That allows it to perform the following tasks: 
- Retrieve the assessment information about the status of the system updates specified by Windows Update client or Linux package manager.
- Initiate the download and installation of updates approved by Windows Update client or Linux package manager. 

Since the Update Management Center (Preview) extension is looking at the servers configuration to pull the data for what is the latest updates, you need to make sure that the server can communicate to the source. Are you using a WSUS server to manage what updates you allow, each server needs to have a way to communicate with that WSUS server. Otherwise the assessment won't be able to fetch any data for the assessments. The same concept applies to public sources as well. If you are fetching updates from Microsoft Update the server needs to be able to connect to these endpoints:
- *.download.windowsupdate.com
- *.dl.delivery.mp.microsoft.com
- *.delivery.mp.microsoft.com

# Limitations
There are some limitations for Update Management Center (Preview). The service doesn't support driver updates and for Azure virtual machines Update Management Center (Preview) is available in all regions that supports Compute Virtual Machines. But for Azure Arc-enabled servers it's only supported in the following regions:
- South East Asia
- Australia East
- Canada Central
- North Europe
- West Europe
- France Central
- Japan East
- Korea Central
- UK South
- UK West
- East US
- East US 2
- North Central US
- South Central US
- West Central US
- West US
- West US 2
- West US 3

# Deploying with Azure Policies
You can find four built-in policies in the category Update Management Center that can be used to manage your patching aligned with a policy driven governance framework. One of these policies is used to enable periodic checks for updates on your Azure virtual machines and Azure Arc-enabled servers. When activated the assessment that Update Management Center (Preview) runs to find missing updates is performed with a 24-hour interval. Another policy is used to schedule recurring updates. These updates are based on the assessment that finds missing updates on your server and the categories that you chose to include in the schedule. 

![](/images/blog/umc-policies.png)

First assign the policy to enable periodic checks for updates, it's called [Preview]: Configure periodic checking for missing system updates on azure virtual machines. If you are using Azure Arc to manage servers from other hyperscalers or that is located on-prem and want to include them in this update management solution as well, then you need to assign the policy [Preview]: Configure periodic checking for missing system updates on azure Arc-enabled servers. When naming the policy assignment I recommend that you include the name of the OS (Windows or Linux) that the assignment refers to. You can only select one per assignment when deploying through the Azure Portal. In my demo environment I have two azure virtual machines running (one Windows and one Linux) that doesn’t have checking for periodic assessments enabled. To allow the policy to make the needed changes on my virtual machines I need to check the box for creating a remediation task and assign a managed identity that will perform the action. This managed identity needs to have the Virtual Machine Contributor roll for the virtual machines that are in scope. In my case I used a system assigned managed identity.

![](/images/blog/umc-policies-assignment.png)

The next step is to assign a policy to trigger the automatic updates for the servers that is in scope. This policy uses a maintenance configuration to determine when, how and what updates that are being applied to the server. So first lets create a maintenance configuration. 

![](/images/blog/umc-maintenance-configuration.png)

In this step I'm not adding any servers to the maintenance configuration, that will be handled later by a policy assigned to the desired scope. 

In the Updates step you select what type of updates to include in this maintenance configuration. You can also specify if any specific KBs or packages should be included or excluded. In this demo I'm including all classifications of updates.

![](/images/blog/umc-maintenance-configuration-updates.png)

A maintenance configuration is an ARM resource, so it will appear in your list of resources. 

Now we can assign the policy [Preview]: Schedule recuring updates using Update Management Center, and under parameters we reference the resource ID of the newly created maintenance configuration. 

When the policies have taken effect you can see in the Update Management Center that Periodic assessments has been set to 'yes' and associated schedules you can see the applied maintenance configuration.

![](/images/blog/umc-machines.png)

Back at the overview blade you can see the status for all servers, and filter so that you see the scope that you are interested in. The overview blade is a workbook, that means that you are able to create your own workbook so you can configure it to display the information that is important for you. 

![](/images/blog/umc-overview.png)

