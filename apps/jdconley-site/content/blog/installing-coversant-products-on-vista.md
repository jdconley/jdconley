---
title: Installing Coversant Products on Vista
date: 2006-12-14T18:32:00.000-08:00
slug: installing-coversant-products-on-vista
description: Due to the enhanced security in Windows Vista, not all Coversant products are able to be installed out of the box. Luckily, this is really easy to work around and rest assured,…
tags:
  - soapbox
  - windows
draft: false
updated: 2011-07-22T00:22:00.219-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-1317392116403861647
originalUrl: http://blog.jdconley.com/2006/12/installing-coversant-products-on-vista.html
---

Due to the enhanced security in Windows Vista, not all Coversant products are able to be installed out of the box. Luckily, this is really easy to work around and rest assured, future version of our installation packages will not suffer from these issues.

The symptoms show up as an error message dialog with code 2869:

<a id="BLOGGER_PHOTO_ID_5632072683334427730"></a>

[![](/blog-assets/imported/3baf51f18330d4a8c00233bd.png)](/blog-assets/imported/a9c4c1a675feb6b0ee6a9a0a.png)

And then a series of empty dialog boxes:  
  

<a id="BLOGGER_PHOTO_ID_5632072928238738546"></a>

[![](/blog-assets/imported/5eae5111d928a1cc9d1f5544.png)](/blog-assets/imported/50a9d48773c9808962558f5d.png)  

This is apparently some sort of permissions issue. To solve it, the MSI needs to be run as an administrator. The easiest way to do this is to create a bat file to run the msi manually. It would be something like this:  

```
msiexec.exe /i "c:\SoapBoxServer2007\files\SoapBox.Server.Enterprise.x64.3.0.213.69.msi"
```

Then you right click on the bat file and choose "Run As Administrator". Presto, a working installation in Vista.
