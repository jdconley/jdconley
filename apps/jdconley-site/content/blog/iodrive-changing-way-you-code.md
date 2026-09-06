---
title: ioDrive, Changing the Way You Code
date: 2009-03-12T12:30:00.000-07:00
slug: iodrive-changing-way-you-code
description: Introduction In my lifetime there have been very few technologies that have created a paradigm shift in the software industry – I was born just after the spinning magnetic hard…
tags:
  - architecture
  - tuning
draft: false
updated: 2011-07-27T00:32:46.120-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-3039767605246329505
originalUrl: http://blog.jdconley.com/2009/03/iodrive-changing-way-you-code.html
---

<a id="intro"></a>

**Introduction**  

In my lifetime there have been very few technologies that have created a paradigm shift in the software industry – I was born just after the spinning magnetic hard drive was created. Off the top of my head I can think of: the Internet (thanks Al!), optical disks, Windows, and parallel computing. From each of these technologies entirely new software industries were born and development methodology drastically changed. We're at the beginning of another such change, this time in data storage.

**Contents**  

-   [Introduction](/blog/iodrive-changing-way-you-code#intro)
-   [Random Story for Context](/blog/iodrive-changing-way-you-code#random)
-   [System Configuration](/blog/iodrive-changing-way-you-code#system)
-   [Test Configuration](/blog/iodrive-changing-way-you-code#test)
-   [Test Results](/blog/iodrive-changing-way-you-code#results)
-   [Conclusion](/blog/iodrive-changing-way-you-code#conclusion)

<a id="random"></a>

 **Random Story for Context**  

At [Hive7](http://www.hive7.com/) we make web based social games for platforms like Facebook and Myspace. We're a tiny startup, but producing a successful game on these platforms means we're writing code to deal with millions of monthly users, and thousands of simultaneous users pounding away at our games. Because our games are web based they're basically written like you'd write any other web application. They're stateless, with multiple RDBMS back end servers for most of the data storage. Game state is pretty small so we don't really store that much data per user. We don't have Google sized problems to solve or anything. Our main problem is with speed.

When you're surfing the web you want it to be fast but can live with a page taking a few second to load here and there. When you're playing a game, on the other hand, you want instant gratification. A full second is just way too long to wait to see the results of your action. Your character's life might be on the line!

To accomplish this speed in our games we currently buy high end commodity hardware for our database servers, and have a huge cluster of memcached that we tap into. It works. But, properly implementing caching is complex. And those DB servers are big 3U power hungry monsters! Here's a typical disk configuration of one of our DB servers:

  

<a id="BLOGGER_PHOTO_ID_5632593832082979442"></a>

[![](/blog-assets/imported/52cfc90a61e4ca22231a591c.png)](/blog-assets/imported/52cfc90a61e4ca22231a591c.png)  

Each of those drives are 15k RPM 72 GB SAS (or whatever the fastest is at the time of build). And the RAID controllers are very high end with loads of cache. And here's the kicker! We can only use about 25% of the capacity of these arrays before the database write load gets too high and performance starts to suffer. They cost us about $10k a piece. Sure, there are much more complex architectures we could use to gain performance. Or we could spend a few hundred grand and pick up a good SAN of some sort. Or we could drop some coin for [Samsung SSD's](http://www.youtube.com/watch?v=96dWOEa4Djs&fmt=22). But, those options are a bit out of the price we want to spend for our hardware, not to mention the necessary rack space and power requirements.

Enter the [ioDrive](http://www.fusionio.com/Products.aspx). With read/write speeds that are very close to the 24 SSD monster that Samsung recently touted, at a way lower price, I have a hard time imagining choosing the 24 drive option. Maybe if you had massive storage requirements, but for pure performance you can't beat the ioDrive price/performance ratio right now. I don't remember if I'm allowed to comment on pricing, but you can contact a sales rep at Fusion-io for more info.

Last month we picked up one of these bad boys for testing. In summary, "WOW!" I spent a few hours this week putting the ioDrive through the ringer and comparing it to a couple different disk configurations in our datacenter. My main goal was to see if this is a viable option to help us consolidate databases and/or speed up existing servers.

<a id="system"></a>

 **The Configuration**  

*ioDrive System (my workstation)*  

-   Windows Server 2008 x64 Standard Edition
-   4 CPU Cores
-   6 GB Ram
-   80 GB ioDrive
-   Log and Data files on same drive

*Fast Disk System*  

-   Windows Server 2008 x64 Standard Edition
-   8 CPU Cores
-   8 GB Ram
-   16 15k RPM 72 GB SAS Drives (visualization above)
-   Log and Data files on different arrays

*Big and Slow Disk System*  

-   Windows Server 2008 x64 Standard Edition
-   4 CPU Cores
-   8 GB Ram
-   12 7200 RPM 500 GB SATA Drives
-   Log and Data files on different arrays

<a id="test"></a>

 **Test Configuration**  

For this test I used [SQLIOSim](http://support.microsoft.com/kb/231619) with two five minute test runs. We were really only interested in simulating database workloads. If you want a more comprehensive set of tests check out [Tom's Hardware](http://www.tomshardware.com/search.php?s=iodrive&x=0&y=0). I should also mention that this was obviously not a test of equals. Both disk based systems have a clear RAM advantage and the fast disk system has a clear CPU advantage. The hardware chipsets and CPU's are also slightly different, but they're the same generation of Intel chips. In any case, when you see the results you'll see how this had a negligible effect. We're talking orders of magnitude differences in performance here...

I ran two different configurations through SQLIOSim. One was the "Default" configuration that ships with the tool. It represents a pretty typical load on a SQL Server disk system for a general use SQL server. The other was one I created called "Write Heavy Memory Constrained". The write heavy one was designed to simulate the usage in a typical game, where, due to caching, we have way more writes than reads to a database. Also, the write heavy one is much more parallel. It uses 100 simulated simultaneous random access users where the default one has only 8. And, with the write heavy one there is no chance the entire data set can be cached in memory. It puts a serious strain on the disk subsystem.

I took the output from SQLIOSim and imported it into Excel to do some analysis. I was primarily concerned with two metrics: IO Duration and IO Operation count. These two things tell me all I need to know. First, how long does it take the device to perform IO on average, and how many can it get done in the given time period.

<a id="results"></a>

 **Test Results**  
  
*Write Heavy Memory Constrained Workload*  

| Metric | ioDrive | Slow Disks | Fast Disks |
| --- | --- | --- | --- |
| Total IO Operations | 10,625,381 | 1,309,673 | 3,260,725 |
| Total IO Time (ms) | 17,625,337 | 1,730,147,612 | 356,839,912 |
| Cumulative Avg IO Duration (ms) | 1.66 | 1,321.05 | 109.44 |

  

<a id="BLOGGER_PHOTO_ID_5632593827268035602"></a>

[![](/blog-assets/imported/42cc10d05f0d863f21b62370.png)](/blog-assets/imported/42cc10d05f0d863f21b62370.png)  

Wow, 100x faster IO's on average!

<a id="BLOGGER_PHOTO_ID_5632593828024019538"></a>

[![](/blog-assets/imported/e0338291f4f4b1d0f1597a4e.png)](/blog-assets/imported/e0338291f4f4b1d0f1597a4e.png)  

Over 20x less time spent doing IO operations!

<a id="BLOGGER_PHOTO_ID_5632593826144091986"></a>

[![](/blog-assets/imported/cdaa40da4f577e445a0bce77.png)](/blog-assets/imported/cdaa40da4f577e445a0bce77.png)  

And over 3x more operations performed. This would have been way higher, but the ioDrive system was CPU constrained, taking 100% CPU. Looks like we'll be loading up at least 8 cores in any database servers we build with these cards!

*Default Workload*  

| Metric | ioDrive | Slow Disks | Fast Disks |
| --- | --- | --- | --- |
| Total IO Operations | 690,753 | 287,180 | 456,300 |
| Total IO Time (ms) | 3,616,903 | 231,859,576 | 93,991,055 |
| Cumulative Avg IO Duration (ms) | 5.24 | 807.37 | 205.99 |

  

<a id="BLOGGER_PHOTO_ID_5632593825485629506"></a>

[![](/blog-assets/imported/84e3aa062bc274fff952e0bf.png)](/blog-assets/imported/84e3aa062bc274fff952e0bf.png)  

40x faster on average in this workload! Looks like the bulk operations and larger IO's present in this workload narrowed the gap a bit.

<a id="BLOGGER_PHOTO_ID_5632593444295861314"></a>

[![](/blog-assets/imported/42fc3efdfb886aa95c321d1c.png)](/blog-assets/imported/42fc3efdfb886aa95c321d1c.png)  

This time, a little under 30x less time spent doing IO operations!

<a id="BLOGGER_PHOTO_ID_5632593240851024802"></a>

[![](/blog-assets/imported/6c16f17d34de3564e0fe8a4b.png)](/blog-assets/imported/6c16f17d34de3564e0fe8a4b.png)  

Only 1.5x more total operations this round. This time we weren't CPU constrained, and I didn't take the time to dig in to the "why" on this one. Based on the raw data I would guess this is caused by IO blocking a lot more often for ioDrive than the fast RAID system. This probably has to do with the caching system in the RAID cards under this mixed write workload. You'll notice if you look at the raw report, that the ioDrive has no read or write cache at the device level. It doesn't really need it.

In case you want to see the raw data or the SQLIOSim configuration files, you can download the package here: [ioDrive Test Results](https://docs.google.com/viewer?a=v&pid=explorer&chrome=true&srcid=0B7Ew2HKAAmajZjJkNjNkZjItYmRhMS00ZWFlLTlhM2ItMGVkNzZjOGM2NzNk&hl=en_US)

<a id="conclusion"></a>

 **Conclusion**  

Wow! ioDrive is going to be scary fast in a database server, especially when it comes to tiny random write IO's, parallelism, and memory constraints. I think we'll be seeing a lot of new interesting software development and system architectures due to this type of technology. The industry is changing. You no longer need either tons of cache (or cash) or tons of RAM to get great performance out of your data store. We're talking 100x better performance than our fast commodity arrays. I think it's safe to say we'll be using these devices in production in the near future. Since this device is currently plugged into my workstation, maybe I'll post another review about how it's improving my development productivity so you can convince your boss to buy you one. :)
