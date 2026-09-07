---
title: Gentoo Linux MAC Based Host Name
date: 2006-09-25T18:22:00.000-07:00
slug: gentoo-linux-mac-based-host-name
description: We use Gentoo for all our Linux development (yeah, we do Linux -- coming very very soon). In fact we are currently putting together a test lab with quite a few computers using…
tags:
  - linux
draft: false
updated: 2011-07-21T23:48:55.569-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-7389091125871809749
originalUrl: http://blog.jdconley.com/2006/09/gentoo-linux-mac-based-host-name.html
---

We use [Gentoo](http://www.gentoo.org/) for all our Linux development (yeah, we do Linux -- coming very very soon). In fact we are currently putting together a test lab with quite a few computers using Gentoo, [Mono](http://www.mono-project.com/), and our own StressBot software to drive client load to our server.

The lab currently consists of 25 computers, pointed at whatever server hardware/software configuration we happen to be testing. I'll post some pictures some day, I promise. As any IT guy will tell you, managing 25 computers isn't trivial. You have to make sure images stay in sync with the correct software builds, monitor that everything is working, etc. In a test lab this isn't so horrible, since our hardware is identical and we just use Ghost software and push out new images. However, this does bring up some interesting issues, the main one being the hostname. On Windows there are more issues, but we won't get into that.

On your network the hostname uniquely identifies your system. If you're pushing out images, this gets a little hairy. Most organizations use some sort of boot script that contacts a central repository to take care of this. We didn't need that much control for our lab. Instead, we decided just to base the hostname on the MAC address of the primary NIC, a very simple and guaranteed unique mechanism. Since we're using Gentoo we have the /etc/conf.d/hostname file that is used at boot time to set the hostname. Here's what we used to set the hostname to contain the MAC address:

```bash
lab0002A51B9F16 tmp # cat /etc/conf.d/hostname
  # /etc/conf.d/hostname
  # Set to lab+MAC (without ":"). IE: lab0002A51B9F16
  HOSTNAME=lab`ifconfig eth0 |awk '/HWaddr/ {print $5}'|sed 's/://g'` 
```

I'm sure there are more effecient commands that could be used here (I'm no scripting geek), but this works. :) I spent a couple hours hunting for something like this and couldn't find it, so I hope it's of use to someone.
