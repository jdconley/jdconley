---
title: Fun Installing Vista Beta 2 on AMD x64
date: 2006-06-02T12:50:00.001-07:00
slug: fun-installing-vista-beta-2-on-amd-x64
description: As a self proclaimed geek and MSDN subscriber I feel as though it's my duty to explore all the new software that Microsoft comes out with. This last week I have been embarking…
tags:
  - windows
draft: false
updated: 2011-07-26T05:41:03.300-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-5719775486610590806
originalUrl: http://blog.jdconley.com/2006/06/fun-installing-vista-beta-2-on-amd-x64.html
---

As a self proclaimed geek and MSDN subscriber I feel as though it's my duty to explore all the new software that Microsoft comes out with. This last week I have been embarking on one such journey. Working with beta software is always a bit trying, but tack on a beta driver model and a "new" hardware platform (x64) and things get really interesting.

Vista Beta 2 was released to MSDN about a week ago. The next day I fired up my DVD burner and started messing around. About four hours later I had a working installation. Why so long? Well, because my workstation is an AMD NForce 4 x64 system and boots from the onboard SATA RAID. Apparently this is not one of Microsoft's test platforms. I had an experience similar to [this guy](http://www.nforcershq.com/forum/finally-got-nforce-raid-to-work-with-vista-vt65055.html).

I had to run the Vista install from an existing Windows installation. It simply would not work when I attempted to boot from the dvd. I never got an option to load drivers. Nvidia recently released beta [Forceware drivers](http://www.nzone.com/object/nzone_downloads_nforce_vista_x64_beta2.html) for Vista x64. I assumed these would have the RAID drivers I needed to install Vista, afterall they did have the appropirate txtsetup.oem file and seemed to be correct. After a few attempted installations, blue screens, automatic reboots, and hangs, I decided that my assumption was bad. Lesson learned: to install Vista x64 on an Nforce 4 RAID use the XP x64 Nforce4 RAID and SATA drivers. Yup, that's right. Well, almost.

If you're like me and want to use the latest Nvidia XP x64 drivers you'll be greeted with a black screen telling you that your drivers are corrupt after the first setup reboot. Say wha? Lucky for you, they aren't. This is a [feature](http://blog.eweek.com/blogs/eweek_labs/archive/2006/01/23/4899.aspx) of Vista x64. Hit F8 at the boot screen and choose to disable driver signature verification. Of course, hitting F8 EVERY time you boot your computer is not going to be very fun. Luckily (for now) there is an application called bcdedit (just run "Bcdedit.exe –set nointegritychecks ON") that you can use to disable signature verification after you get into your desktop. Oh, don't forget to right click on the Command Prompt link in your start menu and choose "Run as Administrator" before trying to run this command, or it will tell you "Access is Denied". Yay security! I should definitely mention that *Vista prompted me to allow this action* (VPMTATA), at least once.

Oh yeah, I almost forgot, after you finally get to your desktop Vista will keep telling you that it has found an unknown device. This is your RAID controller; the one with XP drivers. Point the device wizard thingy to the inf file (VPMTATA) of the Forceware Vista x64 Beta drivers and this annoyance will go away. You'll also need to install drivers (VPMTATA) for the Nforce4 audio chipset.

On the plus side, Vista had drivers for my Geforce 7800GT and Nforce4 gigabit network card. It even figured out I had dual monitors (VPMTATA), picked the max resolution for both (VPMTATA), and presented a neat little dialog that let me choose the desktop layout (VPMTATA). Of course, I wanted to upgrade to the latest ones from Nvidia. This is usually straightforward.

I ran the setup exe (VPMTATA) for the Nvidia Vista Beta 2 Geforce drivers. It extracted stuff (VPMTATA), ran the second installer exe (VPMTATA), and then failed with some cryptic error messages I probably should have written down and submitted as bug reports. Subsequent attempts to run the installation package (VPMTATA) resulted in an error about running 32 bit uninstaller code on a 64 bit platform. I was very confused, didn't want to spend much time on it, and gave up.

A few days later I had an epiphany - "I should just try to update the Microsoft Geforce driver with the inf". Duh. Well, I opened up the Device Manager (VPMTATA) and clicked update drivers (VPMTATA). Viola! The drivers were upgraded. Though, I have no idea if there are any control panels with these drivers (as there are in XP) since I couldn't run the full setup. Ah well, at least I have better video acceleration.

I'll be back later for my accounts of fun with Vista. After a week of use, I think I could write a book. However, it definitely hasn't all been bad (though VPMTATA) and I will continue to use Vista as my primary OS until it does something very mean or simply won't allow me to get things done.
