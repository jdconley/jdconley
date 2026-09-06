---
title: Angry Players Make Sunday More Interesting
date: 2009-11-22T15:48:00.001-08:00
slug: angry-players-make-sunday-more
description: Youtopia has been growing quickly the last couple of weeks. It's fun to watch and the team is really excited about it. Of course, with the growth comes a lot of performance…
tags:
  - asp.net
  - tuning
draft: false
updated: 2011-07-27T04:20:09.327-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-3298497982786863353
originalUrl: http://blog.jdconley.com/2009/11/angry-players-make-sunday-more.html
---

Youtopia has been growing quickly the last couple of weeks. It's fun to watch and the team is really excited about it. Of course, with the growth comes a lot of performance tuning with our code. Today we hit an issue I wasn't expecting at all. . .

We've been running Windows 2008, IIS7, and ASP.NET 3.5 in production for a while now, but haven't had to do much of any performance tuning. It *just works* , and is fast. Which is awesome!

But today, Youtopia was running slowly and requests were hanging so I investigated. The databases were performing normally and not having any locking issues. The network looked good. The memcached cluster was healthy. The queueing service looked great. The ASP.NET performance counters even looked good at first glance.

None of the diagnostic performance monitors I'd used in the past (such as Requests in Application Queue) showed the issue, but requests were absolutely being queued -- or otherwise not processed immediately. There were also plenty of free worker and IOCP threads. The only thing that clued me in was the Pipeline Instance Count and Requests Executing counters were exactly the same (96) on all the servers. So I started investigating from there.

It turns out that [due to the way IIS7 ASP.NET integrated mode threading model](http://blogs.msdn.com/tmarq/archive/2007/07/21/asp-net-thread-usage-on-iis-7-0-and-6-0.aspx) functions there is a (configurable) request limit of 12 per CPU. We hit this limit in Youtopia today because we hold open requests for asynchronous Comet-like communications and there were over 288 people online simultaneously. Our three eight core web servers each had 96 (8\*12) people connected to them and weren't really serving any other requests. We aren't running into any thread configuration limits as the long running requests are asynchronous and not using ASP.NET worker threads.

Here are a few great links that came out of my research.  

-   [http://blogs.msdn.com/tmarq/archive/2007/07/21/asp-net-thread-usage-on-iis-7-0-and-6-0.aspx](http://blogs.msdn.com/tmarq/archive/2007/07/21/asp-net-thread-usage-on-iis-7-0-and-6-0.aspx)
-   [http://support.microsoft.com/kb/816995](http://support.microsoft.com/kb/816995)
-   [http://msdn.microsoft.com/en-us/library/ee377050(BTS.10).aspx](http://msdn.microsoft.com/en-us/library/ee377050%28BTS.10%29.aspx)
-   [http://blogs.msdn.com/webtopics/archive/2009/02/13/asp-net-hang-in-iis-7-0.aspx](http://blogs.msdn.com/webtopics/archive/2009/02/13/asp-net-hang-in-iis-7-0.aspx)

With ASP.NET 3.5 SP1 it boils down to a simple configuration file change. Use something like this in the aspnet.config file (in x64 it's at C:\\Windows\\Microsoft.NET\\Framework64\\v2.0.50727\\aspnet.config). This is the default. Adjust maxConcurrentRequestsPerCPU to suit your needs.  

```
<system.web>   <applicationPool maxConcurrentRequestsPerCPU="12" maxConcurrentThreadsPerCPU="0" requestQueueLimit="5000"/></system.web>
```

In addition, the application pool needs to be configured to allow more requests. By default it only allows 1000 concurrent requests. This is done under the Advanced Settings for the application pool in the IIS 7 manager. Set Queue Length to 5000 to match this system level configuration.
