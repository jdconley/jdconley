---
title: Cross Platform Deployment Project Bootstrapper
date: 2006-09-01T10:13:00.000-07:00
slug: cross-platform-deployment-project
description: I think we are one of a very small set of companies out there building consumer grade, shrink wrapped products on .NET. Why? Well, I'm not sure. It might have to do with…
tags:
  - .net
  - install
  - soapbox
draft: false
updated: 2011-07-21T23:30:00.269-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-8439273755609074001
originalUrl: http://blog.jdconley.com/2006/09/cross-platform-deployment-project.html
ogImage: /blog-assets/og/cross-platform-deployment-project-v1.jpg
ogImageAlt: "A deployment toolbox connects different operating systems. — JD Conley."
---

I think we are one of a very small set of companies out there building consumer grade, shrink wrapped products on .NET. Why? Well, I'm not sure. It might have to do with Microsoft's positioning on the matter. All their documentation talks about enterprise deployments. It could also have to do with the runtime size. Some people think 50MB download for prerequisites is too much. In general, though, .NET, and Visual Studio 2005 especially, provide all kinds of great tools for building shrink-wrapped products. One of these is the Deployment Project.

To create a working Deployment Project you simply set a few properties and point it at your main executable project. Whether it is a Windows Service, Winforms, or Web Project, you will get an installer that will run for most people. By default in Visual Studio 2005 the Deployment Project generates a bootstrapper Setup.exe. This will download and install MDAC 2.8 and the .NET 2.0 redistributable, if necessary. However, there is one caveat. It only works on x86 based operating systems! I have to admit, this caught me off guard. I expected to check a couple boxes in the UI and have everything just work on every platform where .NET would run. Unfortunately this is not the case.

Luckily, the bootstrapper is [very customizable](http://blogs.msdn.com/chrsmith/archive/2005/06/03/How_to_do_a_64bit_OS_check.aspx). Using a simple [MSBuild task](http://msdn2.microsoft.com/en-us/library/ms164294.aspx) and some XML files you can dynamically [build bootstrappers](http://msdn.microsoft.com/library/default.asp?url=/library/en-us/dnvs05/html/custom_pkg.asp) for any MSI or executable file. So, I put together some bootstrapper packages for .NET 2.0 on x86, x64, and IA64 platforms, MDAC on x86, Windows Installer 3.1 on x86, and SQL Express 1.0 SP1 on any platform. The result: I can click a few check boxes in a deployment project and not have to worry about changing my bootstrapper packages for each platform.

Here is the bootstrapper set: [CrossPlatformBootstrappers.zip](http://www.coversant.net/downloads/blogdownloads/jconley/CrossPlatformBootstrappers.zip)

The key to these bootstrappers working on all platforms is they do not fail if the platform doesn't match. They simply move on to the next bootstrapper. So you can choose all of our .NET 2.0 boostrappers in your Deployment Project, change the target platform of the deployment, and not have to remember to change your bootstrappers.

In addition to the .NET 2.0 bootstrappers I also created a SQL Express 1.0 SP1 bootstrapper using SQLEXPR.exe, which will run on all platforms. However, instead of doing a default install of SQL Express, it installs a specific instance name. For us, this instance is SOAPBOX. You'll want to modify the bootstrapper package.xml and product.xml files to suit your needs for your SQL instance name (or just use the default). If the instance already exists on the computer, it won't be installed again.

Earlier I mentioned MSBuild. A major key to creating shrink-wrapped products is being able to get builds out quickly and accurately. We use MSBuild for this. We have tons of custom tasks, but one of the MSBuild tasks that ships with the framework is called [GenerateBootstrapper](http://msdn2.microsoft.com/en-us/library/ms164294.aspx). With this task you can point MSBuild at your Bootstrapper directory (the contents of the zip file), an msi, and a list of bootstrappers, and it will create a bootstrapper exe for you.

Deployment Projects and I have a love/hate relationship. There are many things about them I don't like, but the bootstrapper piece is wonderful! So, in the upcoming 2007 builds of SoapBox products, expect to see a seamless installation including download on demand for all the prerequisites your system will need, on any platform.
