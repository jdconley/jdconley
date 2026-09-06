---
title: Linq to Sql Surprise Performance Hit
date: 2007-11-28T21:13:00.000-08:00
slug: linq-to-sql-surprise-performance-hit
description: A couple days ago I built Photo Feeds. I wrote about it here. After using the app a bit I noticed something peculiar. The page took a really long time to load. From my local…
tags:
  - .net
  - asp.net
  - linq
  - tuning
draft: false
updated: 2011-07-22T03:14:11.657-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-1887030120170852789
originalUrl: http://blog.jdconley.com/2007/11/linq-to-sql-surprise-performance-hit.html
---

A couple days ago I built [Photo Feeds](http://apps.facebook.com/photofeeds/). I wrote about it [here](/blog/photo-feeds-facebook-application). After using the app a bit I noticed something peculiar. The page took a really long time to load. From my local web server it was on the order of 2-5 seconds. That's *way* too slow.

Having written the code a few hours prior, I immediately knew what was wrong. I thought "Well, duh, either Facebook sucks, I'm hitting my database too often, or I'm calling the Facebook service too often." I/O is, after all, usually what causes an application this simple to be slow. I glanced over the code and thought to myself "Holy crap, who wrote this junk? It's calling the database waaaaay too much. That has to be the problem."  

Having been down this path many times I decided to analyze a bit more before officially jumping to conclusions. I popped open task manager to see if I was in fact I/O bound (i.e. to see if my CPU was racing or idle) – usually a good rough indicator of what's going on. To my jaw-dropped amazement the CPU was hitting 100% for the majority of the page request time. "Could it be the JIT?" I thought. So I hit refresh 50 times and watched in amazement as the CPU spiked each time. I switched over to the Processes tab and, again to my amazement, noticed it was the web server chewing up the cycles, and NOT SQL server. Did I mention I was amazed?  

Ok, so apparently I was *wrong* \[insert shock and awe\]. The web site was way too CPU hungry! Good thing I didn't put any bets on that one. I then theorized that maybe Cassini just sucked (my code *couldn't* be that bad). I whipped up a virtual directory in IIS and ran my tests again.

Nope, it wasn't Cassini. Alright, so now let's get scientific. I pop open [ANTS](http://www.red-gate.com/products/ants_profiler/index.htm) and setup a profiling session on my virtual directory. I loaded the page a few times and, lo and behold, the worst offender screen pops up:

  

<a id="BLOGGER_PHOTO_ID_5632113825861421794"></a>

[![](/blog-assets/imported/825aa880d8179194b3f085cc.png)](/blog-assets/imported/0e8af65acaef134307d84b6d.png)

Wow! That's a long time (and a lot of hits). I was definitely right. I'm hitting the database way too often. But, I know I saw the CPU racing... What the heck?

Here's the offending code:  

```
public static Feed GetOrCreateFeed(FeedsDataContext dc,string owner,FeedSourceType sourceType,string facebookId){var q = from f in dc.Feeds       where f.OwnerId == owner &&       f.FeedSourceType == (byte)sourceType &&       f.FacebookId == facebookId       select f;Feed existingItem = q.SingleOrDefault();...}
```

So I dug into the call graph a bit and found out the code causing by far the most damage was the creation of the LINQ query object for every call! The actual round trip to the database paled in comparison. Now that was, again, a *huge* surprise. Check out the hit counts on this call – holy cow!

<a id="BLOGGER_PHOTO_ID_5632116728215770002"></a>

[![](/blog-assets/imported/d586d9bc34215a3e984d9f81.png)](/blog-assets/imported/383f34aad87f62a7f2701d55.png)

  

1,176,879 calls to SqlVisitor.Visit. Over a million calls to anything for loading a page three times can't be good.

I started doing some research. I remembered [reading about](http://blogs.msdn.com/ricom/archive/2007/07/05/dlinq-linq-to-sql-performance-part-4.aspx) using compiled LINQ to SQL queries for optimization a few months ago. I did a little more searching and ran into [this gem](http://devauthority.com/blogs/jwooley/archive/2007/09/05/75645.aspx) for anybody scared of lambda functions. *Warning, scary .NET 3.5 lambda functions ahead* . Here's the magic fix:

```
private static readonly Func<FeedsDataContext, string, FeedSourceType,string, IQueryable<Feed>> _compiledGet =CompiledQuery.Compile((FeedsDataContext dc, string owner,FeedSourceType sourceType, string facebookId) =>   from f in dc.Feeds   where f.OwnerId == owner &&   f.FeedSourceType == (byte)sourceType &&   f.FacebookId == facebookId   select f);public static Feed GetOrCreateFeed(FeedsDataContext dc,string owner,FeedSourceType sourceType,string facebookId){Feed existingItem = _compiledGet(dc, owner, sourceType, facebookId)   .SingleOrDefault();...}
```

If that's your first time seeing lambdas in C#, I feel for you. I'd suggest trying them out and doing a lot of [research](http://www.google.com/search?q=c%23+lambda+functions). That *simple* change yielded the following result:

  

<a id="BLOGGER_PHOTO_ID_5632117288474594642"></a>

[![](/blog-assets/imported/1f05627ab83e945d361e5521.png)](/blog-assets/imported/c4dae5ba17ce8170652ccb40.png)

  

That method is still by far the worst offender in the application, but is **five times faster** than it was and barely registers on the CPU when the page loads. This one change netted sub second page rendering times which is good enough for me. Obviously I still have major issues, hitting the database way too often, but I'm a big believer in not doing any premature optimization. But now, at least I'm back in my comfort zone and am I/O bound.

So, what have we learned? Never, ever, ever, ever, ever, ever, ever, ever, ever blindly edit code to fix performance issues. *Always* run it through a profiler. No matter how much experience you have performance tuning, the worst offenders will still surprise you 99% of the time. Oh, and sometimes LINQ to SQL is slow at creating its query objects. Use compiled queries in these cases!
