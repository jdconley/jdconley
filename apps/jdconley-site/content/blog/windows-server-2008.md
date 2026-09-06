---
title: Windows Server 2008
date: 2008-05-24T10:26:00.000-07:00
slug: windows-server-2008
description: For anybody who's been watching you will have noticed that I have had some fun trying to get x64 Windows Vista stable on my workstation. Well, because of all that fun I've been…
tags:
  - random
  - windows
draft: false
updated: 2011-07-23T05:04:35.929-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-6930063535698047898
originalUrl: http://blog.jdconley.com/2008/05/windows-server-2008.html
---

For anybody who's been watching you will have noticed that I have had [some](/blog/fun-installing-vista-beta-2-on-amd-x64) [fun](/blog/vista-rant) trying to get x64 Windows Vista stable on my workstation. Well, because of all that fun I've been running good ole trusty XP Pro 32 bit (and Ubuntu) for the last 8 months or so. I noticed both Server 2008 and Vista SP1 came out and I thought, "hey, it's time for an upgrade!"

After my last [episode](/blog/vista-rant) installing Vista x64 on my workstation, I decided I should instead go for Windows Server 2008 x64 – I know, it shouldn't really make a difference, but it made me feel better! So I login to MSDN, download it, burn it to disc, and away I go. Before I know it, everything is installed and working. It's been over a week now and it's still working. Not a single crash! Amazing... It's almost like, dare I say it, I got a Mac crossed with Open BSD and a touch of Linux! ;)

I have to say, they did something right with Windows Server 2008 for us hardcore workstation users. It is the perfect blend of security, cutomizability, and sexiness. You gotta love a server operating system with all the IIS 7 goodness that lets you turn on Aero. :) Both of my printers even have drivers now!

However, I must confess, I did cheat a little bit. I disabled my on-board sound card that was the culprit for many of my BSOD's with the prior attempts at Vista x64 and bought a PCI sound card. Ah well, Server 2008 rules, Vista sucks! There. I said It.

Oh yeah, I did have one issue. For some stupid reason it didn't want to activate, giving me the stupid error:

> Windows Activation Error: A problem occurred when Windows tried to activate. Error Code 0x8007232B. For a possible resolution, click More Information. Contact your system administrator or technical support department for assistance. DNS name does not exist.  
>   
>   

Luckily there are about a million hits on Google on the subject. Here's the [most concise one.](http://www.chapterzero.co.uk/articles/fix-vista-activation-dns-error-0x8007232b.aspx) Yeah, you read that right, enter the same exact product key and click activate again. You would think that's an error that would have been fixed in over a year...
