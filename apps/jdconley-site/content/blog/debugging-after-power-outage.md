---
title: Debugging after a power outage
date: 2008-09-24T18:18:00.000-07:00
slug: debugging-after-power-outage
description: Here at Hive7 we host all our servers with a hybrid co-location/hosting provider. When you host your servers in a colo facility there are a few key things you look for. Stuff…
tags:
  - asp.net
  - windows
draft: false
updated: 2011-07-23T05:10:06.923-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-4184339582627726952
originalUrl: http://blog.jdconley.com/2008/09/debugging-after-power-outage.html
ogImage: /blog-assets/og/debugging-after-power-outage-v1.jpg
ogImageAlt: "WHEN POWER FAILS. A lantern illuminates dark server racks and a disconnected power cable. — JD Conley."
---

Here at [Hive7](http://www.hive7.com/) we host all our servers with a hybrid co-location/hosting provider. When you host your servers in a colo facility there are a few key things you look for. Stuff like multiple redundant internet routes, clean power, zero interruption backup power systems, adequate cooling, and decent security. While our host has all of these, after all they come standard in any decent co-location, they also provide us with a few services above and beyond a bare bones colo like good prices on rented servers of any configuration and hardware load balancers. We've had our share of small mishaps, but things have been pretty smooth sailing. That is, until, about 36 hours ago.

Sometime around 5am PDT PG&E had a major power outage. Normally when this (rarely) happens in a colo, the backup batteries and generator carry you through without even a hiccup. Well, not this time. Backup power systems faltered and servers went down. Things quickly came back up, but, there was a catch. The Air Conditioner in our data center did not! Servers rapidly began overheating. Quick to react, the colo's on site engineers hard powered off a bunch of our servers (I'm still not quite sure why we didn't get a phone call to do this on our own the safe way).

Text messages flew ([Zenoss](http://www.zenoss.com/) is your friend) and our chief sys admin dude rushed down to the data center to assess the damages as soon as he was alerted. On the surface there were a few major issues. Many of our larger RAID Arrays were running degraded and needed some love. Some servers had not powered back on and were stuck. He spent all day trying to right the wrongs made by our colo's (lack of) backup power.

While he was doing that, guess what I was doing? Yeah, trying to make [Knighthood](http://apps.facebook.com/knighthood) run. Knighthood is a pretty big web app. We have millions of users, and roughly 10,000 actively playing at any given point in time. With a few database servers running with degraded arrays, virtual machine hosts not running, and some other systems still not powered on I set forth scouring logs and troubleshooting. One by one we got the necessary systems back up and running. First it was the email service, then the email invitation service, then the Active Directory domain controllers. With all of these up and running properly, the game was still performing poorly. It was exhibiting performance traits I'd seen before. It'd go fast for a bit, then completely hang, then go fast again.

In the past, a performance pattern like this has been caused by some reader/writer lock contention where an upgrade to a write lock causes everything to stop. It's also been caused by transactions hanging in Distributed Transaction Coordinator, or SQL Blocking, or contention on a big cache item in Memcached, or some code that is infinitely recursing. So, I did my normal troubleshooting in this scenario.

I popped open perfmon to look at request rates, bandwidth, cpu, threads, memory, etc across the farm. Every single front end IIS server (7 of them for this game) was processing absolutely nothing for a 20 second period. And by nothing, I mean nothing. IIS wouldn't even serve up an image! And CPU was 0% utilized. But, once that 20 seconds was over we'd get a good 5 seconds of processing done. Everything was queued and no requests were dropped. I thought for sure the power outage had severely damaged one of our databases, DNS servers, or a big chunk of cache (we run about 60GB of memcached), or something else obvious like that. It really *felt* like something was timing out and then letting the flood gates open.

At this point the logs weren't showing any errors to lead me down a debugging path. Since the behavior was happening consistently I decided to grab a [hang dump](http://blogs.msdn.com/tess/archive/2006/10/16/net-hang-debugging-walkthrough.aspx) of the w3wp process. The dump was, well, completely surprising! Guess what was happening?

No really. Guess.

Give Up? **Nothing!** Yeah, nothing. During that 20 seconds all the managed and unmanaged threads were completely idle doing absolutely nothing. No locks were held. No pages were processing. I know that because of Tess's neat blog post about which [threads you can ignore](http://blogs.msdn.com/tess/archive/2005/12/20/505862.aspx). It's as if IIS just decided we didn't really want to process any more requests. This had me scratching my head. I repeated the process another 4 or 5 times with the same result. It seemed the problem must be somewhere in kernel space. None of my user mode dumps found anything at all. That scared me.

I have no experience doing kernel debugging. So, well, this is where I partially threw in the towel. I called Microsoft support and opened a premier support case. It had been about 8 hours and we had a LOT of pissed off paying users. After a few hours on the phone we captured some more user mode dumps (they didn't believe me that there wasn't anything interesting there) and uploaded them. I wish saying "I am experienced doing production crash dump debugging" meant something to these guys... I'm not sure how many times I had to say "No, you see, when it hangs it uses 0% CPU!".

The Microsoft crash dump engineers went about their business and said they'd call me back when they found something (though I knew they wouldn't find anything and no amount of whining could make them skip this step). To their credit, since it was production and affecting our main line of business, they offered to do the debugging immediately rather than withing 2 business days which is the normal turnaround.

A couple hours later everything magically started working perfectly. I changed nothing. I called our sysadmin and he said he changed nothing that should have affected Knighthood. It had already been a long day and we decided to wait for the next day to find what had fixed it. Sysadmin dude sends me an IM this morning to let me know he figured out the problem. Guess what it was?

No really. Guess.

Well of course, it was IIS logging! We have all our IIS logs pointed at a NAS. I never thought this would be an issue since, well, logging happens in a background thread right? It can't possibly interfere with actual request processing. Turns out that is incorrect! The NAS was one of the last things that Sysadmin dude had brought up at the end of the day because it was only used for archiving and log files, a very low priority in a crisis scenario. Well, apparently not!

Microsoft called me back about an hour later to let me know that the hang dumps did not uncover anything and it appeared that requests were simply being delayed before they could be processed. "Well, no $@\*! I told you that 12 hours ago", I thought. So, I let them know we had fixed the problem and closed the case. I'm sure we could have seen it in a kernel hang dump in the IIS kernel mode stuff, but the problem was not reproducing anymore and I didn't want to bother...

Now you know. IIS logging can clog up all your requests. So, if you're logging to a remote system over a windows share, make sure it never goes down! Or, well, don't do that and log locally and ship them out on occasion.
