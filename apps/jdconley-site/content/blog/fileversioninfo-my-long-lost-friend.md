---
title: FileVersionInfo - My Long Lost Friend
date: 2007-11-26T13:31:00.000-08:00
slug: fileversioninfo-my-long-lost-friend
description: I've been doing .NET development professionally since the first public beta release of the 1.0 framework. That's... well, a long time. It constantly amazes me how big the…
tags:
  - .net
  - utility
draft: false
updated: 2011-07-22T02:35:16.081-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-6128067537066896627
originalUrl: http://blog.jdconley.com/2007/11/fileversioninfo-my-long-lost-friend.html
---

I've been doing .NET development professionally since the first public beta release of the 1.0 framework. That's... well, a long time. It constantly amazes me how big the framework really is. There are a number of times I've written tens or hundreds of lines of code for a task that I later realized – or was smacked over the head with by a colleague with – that were in the framework. Heck, even after writing my [Extension Methods](/blog/aspnet-centric-extensions) post a couple months ago some friendly readers [pointed out](/blog/aspnet-centric-extensions#2) how I was writing too much code.

Today, I was updating a client's web application to show the version number at the bottom of the screen based on the actual version that was running (it used to just be hard coded). The version number on the site was supposed to show the full revision of the assembly – which is stored in the assembly **file version** . The process to build the web site follows Microsoft version standards so the assembly version number does not necessarily change with each revision, but the file version does. Therefore, the normal *System.Reflection.Assembly.GetExecutingAssembly().GetName().Version.ToString()* isn't really the version number we want to display.

But how do you get the file version? Well, with *System.Diagnostics.FileVersionInfo.GetVersionInfo* of course! I swear I have looked for how to do this numerous times with only win32 responses to my query. Anyway, apparently it's dirt simple. This time I ran into [this thread](http://www.thescripts.com/forum/thread492012.html) with the answer. Check out the [System.Diagnostics.FileVersionInfo](http://msdn2.microsoft.com/en-us/library/system.diagnostics.fileversioninfo%28vs.90%29.aspx) class for more info. Duh!

I leave you with this to ponder: WHY, WHY, WHY is this feature not exposed through System.IO.FileInfo or some other class that makes sense (and I did check in Reflector to be sure I wasn't mad)?!
