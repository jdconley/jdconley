---
title: Small Gotcha in .NET Framework 3.5 Beta 2 to RTM Upgrade
date: 2007-11-19T16:07:00.000-08:00
slug: small-gotcha-in-net-framework-35-beta-2
description: Visual Studio 2008 was officially released today to MSDN subscribers so I took the leap and did the upgrade. I ran into an issue with a simple fix that I thought everyone…
tags:
  - .net
  - asp.net
draft: false
updated: 2011-07-22T02:26:00.069-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-4154510686697844042
originalUrl: http://blog.jdconley.com/2007/11/small-gotcha-in-net-framework-35-beta-2.html
---

Visual Studio 2008 was officially released today to MSDN subscribers so I took the leap and did the upgrade. I ran into an issue with a simple fix that I thought everyone should be aware of. You'll get an error message stating: "Could not load file or assembly 'System.Data.DataSetExtensions, Version=2.0.0.0...". This is somewhat cryptic, but easy to fix.

If you have a web project that was running under .NET 3.5 beta 2 you will have an assembly reference as follows:

```
<compilation><assemblies>  ...  <add assembly="System.Data.DataSetExtensions, Version=2.0.0.0, Culture=neutral, PublicKeyToken=B77A5C561934E089"/></assemblies></compilation>
```

Notice the version number is 2.0.0.0. This was apparently changed at the RTM and the version number should be 3.5.0.0 like:

```
<compilation><assemblies>  ...  <add assembly="System.Data.DataSetExtensions, Version=3.5.0.0, Culture=neutral, PublicKeyToken=B77A5C561934E089"/></assemblies></compilation>
```
