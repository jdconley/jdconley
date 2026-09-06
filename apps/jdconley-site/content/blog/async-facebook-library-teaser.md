---
title: Async Facebook Library Teaser
date: 2007-12-05T09:20:00.000-08:00
slug: async-facebook-library-teaser
description: I've been trolling the Facebook Developer Forums recently and talking with other developers. I've also been reading a lot and trying to get a feel for what people might want…
tags:
  - .net
  - asp.net
  - async
  - facebook
draft: false
updated: 2011-07-23T04:10:31.286-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-2939929600917594074
originalUrl: http://blog.jdconley.com/2007/12/async-facebook-library-teaser.html
---

I've been trolling the Facebook Developer Forums recently and talking with other developers. I've also been reading a lot and trying to get a feel for what people might want out of the asynchronous Facebook library I've been (slowly) building. In particular, I've been participating in [this thread](http://forum.developers.facebook.com/viewtopic.php?pid=19659) about Facebook scalability issues. I thought I would share my [most recent](http://forum.developers.facebook.com/viewtopic.php?pid=19659#p19659) post as a bit of a teaser as what's to come. Here it is, reproduced:

> > **tomten wrote:**  
> >   
> > ...but it was way overkill for what I've done. ...
> 
> This is one myth I want to squash. Async stuff isn't hard. I promise. smile Let's take your page loading example, and make it asynchronous. I put in code comments for a "facebook is hammered" timing. Let's say every call takes you 250ms. That means that page will spend roughly one second waiting for facebook.
> 
> ```
> Page_Load { GetSession(); // Call to Facebook 250ms RenderHtml(); Response.Flush(); Response.Close(); // Make calls to Facebook GetFriends(); // Call to Facebook 250ms UpdateProfile(); // Call to Facebook 250ms SendNotification(); // Call to Facebook 250ms}
> ```
> 
> Now, let's make this Async. It would become (roughly -- there is also a "Completed" event handler you'd setup for the items you cared about):
> 
> ```
> Page_Load {fbasync.GetSessionAsync();fbasync.GetFriendsAsync();fbasync.UpdateProfileAsync();fbasync.SendNotificationAsync();}Page_PreRenderCompelete {RenderHtml();Response.Flush();Response.Close();}
> ```
> 
> This time, with the async calls in the server, we spend 0 time waiting for facebook. Just like in client side AJAX, we get a callback when the calls were complete! And, instead of a full second for our page to finish processing, it only takes 250ms, as all the facebook calls happen simultaneously (yeah I know this is a faulty assumption, but it is usually pretty close).
> 
> In addition to the shorter page lifecycle (250ms instead of 1 second) we are not tying up a processing thread (of which there is a small finite number). During that time we are waiting for facebook to finish our API calls, the asp.net engine happily processes more requests on the thread that originally kicked off processing of our page.
> 
> A shorter lifecycle is important, not only for throughput, but also for memory consumption and garbage collection efficiency. Because the objects do not live for as long, they will be garbage collected more quickly and your application will spend less time doing garbage collection.
> 
> Ok, so that's a bit of a spoiler, but, I hope it helps.

Hopefully some time this week I'll clean up the library enough that I think it's worthy to be posted publicly. I spent last night refactoring a bit and removing a lot of "who wrote this crap" code. :)

As a bit of an aside, I was excited to see the team working on the "almsot official" Microsoft .NET library for Facebook released an asynchronous version of the FacebookService. I thought maybe I wouldn't have to write one myself. However, after looking at the code, I was very disappointed by the fake asynchronous support that's in the [Facebook Developer Toolkit](http://www.codeplex.com/FacebookToolkit). It made me shed a tear. I really wish they'd put a disclaimer up: "This AsyncFacebookService is not really asynchronous I/O. It will only make things worse by tying up an additional threadpool thread waiting for the delegate to the synchronous method to return.".
