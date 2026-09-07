---
title: "Introduction to fbasync: an Asynchronous Facebook Library (Part 1)"
date: 2007-12-11T22:06:00.000-08:00
slug: introduction-to-fbasync-asynchronous
description: I'd like to start off by saying asynchronous programming is easy. Building asynchronous frameworks is hard, but using them is easy. Everybody doing programming in AJAX and…
tags:
  - .net
  - async
  - facebook
  - fbasync
draft: false
updated: 2011-07-23T04:38:32.946-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-8830681557683240270
originalUrl: http://blog.jdconley.com/2007/12/introduction-to-fbasync-asynchronous.html
---

I'd like to start off by saying asynchronous programming is easy. Building asynchronous frameworks is hard, but using them is easy. Everybody doing programming in AJAX and Flash do it every day without thinking about it. There's no reason us C# .NET programmers can't do the same!

This first article about [fbasync](http://www.codeplex.com/fbasync) is going to show how to use it. Your 12 year old [script kiddie](http://en.wikipedia.org/wiki/Script_kiddie) nephew could do it, I promise. Then later on in the series we'll dive into how the library is implemented and see if we can forever scare him away from a programming career.

Those who know me well (or have read my blog for a while) know I'm a proponent of asynchronous patterns. Why? Well, there are a lot of reasons. I've mentioned why [1](/blog/how-to-build-scalable-net-server) [2](/blog/building-reactive-user-interfaces-in) [3](/blog/simpler-isnt-always-better) [4](/blog/asyncify-your-code) [5](/blog/photo-feeds-facebook-application) [6](/blog/async-facebook-library-teaser) times. To sum it up, the two primary reasons for using asynchronous patterns are to gain better vertical scalability (to do more with one piece of hardware) and provide a better user experience. When it's as easy as writing synchronous code, I say why not? Using asynchronous patterns in your code is especially important when it comes to communicating with a web service outside of your network (like Facebook). When you don't know how long your service calls are going to take, you simply can't expect to scale up an application without going asynchronous!

In a previous article entitled [Simpler Isn't Always Better](/blog/simpler-isnt-always-better) I spent a lot of time bashing the [event based](http://msdn2.microsoft.com/en-us/library/awb8dkht.aspx) asynchronous pattern. Well, I take it back (some of it). It turns out in the context of ASP.NET and Winforms, the event based pattern is very nice indeed. While I implemented both the event based and [IAsyncResult](http://msdn2.microsoft.com/en-us/library/ms228972.aspx) pattern in fbasync, I'd recommend most people use the event based interface. This is what we'll be looking at today.

**What you've been waiting for**  

Ok, enough blabbering! The fbasync library is available on [CodePlex](http://www.codeplex.com/fbasync). You can download the bits right now and follow along at home. The library comes with a simple example that allows you to browse the photo albums uploaded by you and your friends. In this sample we get all the albums and related cover photos of the requested user, and the list of friends for the authenticated user on the server through asynchronous requests. Let's get it setup and take a deeper look!  

1.  Make sure you have Visual Studio 2008 installed. It's required.
2.  Download and extract the zip file somewhere interesting.
3.  Open the fbasync.sln file.
  

Now that you have the web site loaded just make sure your web server is setup to run on port 30912 and the virtual path is "/" (in your project properties). This is the way the sample application is configured in Facebook. If you have your own application (API Key/Secret) you want to test this with, edit the web.config.

<a id="BLOGGER_PHOTO_ID_5632506573214993058"></a>

[![Project Setup](/blog-assets/imported/6e49d1c0913759e63e9c21e6.png)](/blog-assets/imported/6e49d1c0913759e63e9c21e6.png)  
  
With this setup, you'll be able to run the fbasync.web application, add it through Facebook, and experiment with it in the Facebook iframe.  
  
**Setting up your page**  

Getting your Facebook application setup and working is outside the scope of this article. Check out the [Facebook Developer](http://developers.facebook.com/) site for introduction information. Once you decide you want a Facebook canvas page with an iframe application, return here. :)

It's quite easy to get your page connected to Facebook. Simply inherit from the fbasync.webcomponents.FacebookPage. Once we hit the 1.0 release of the library, you'll also be able to drag a component onto an existing page without messing with your inheritance hierarchy. For now, here's how it looks.

<a id="BLOGGER_PHOTO_ID_5632507886074985138"></a>

[![](/blog-assets/imported/00d9eb78e0709a898d8af2f6.png)](/blog-assets/imported/00d9eb78e0709a898d8af2f6.png)  

Once you've got your page setup, using the library is simple. The base page takes care of making sure the request is authenticated and gets a Facebook session based on the authentication token provided to your application. Before we go any further, make sure you set the Async directive on your page so fbasync can do things asynchronously. How async pages work was explained well by Fritz Onion in an [Extreme ASP.NET article](http://msdn.microsoft.com/msdnmag/issues/06/07/ExtremeASPNET/) last year.

<a id="BLOGGER_PHOTO_ID_5632509177057507954"></a>

[![](/blog-assets/imported/a328404ddc563610eb8ba0f8.png)](/blog-assets/imported/a328404ddc563610eb8ba0f8.png)  
  
Now that you have setup the page to process requests asynchronously, fbasync can best do its magic. Override the OnFacebookSessionCreated method in your page, or add a handler for the FacebookSessionCreated event. This will be raised when fbasync has acquired a session from Facebook, using either the authentication token provided in the Facebook iframe or after a redirect through the Facebook login page. The Facebook authentication process is covered in depth in the [Facebook Developer Authentication Overview](http://developers.facebook.com/documentation.php?v=1.0&doc=auth). The good news is, you probably don't need to know! Fbasync will handle the most common situation for you.  

Now that you've got a Facebook session, it's time to do something interesting. Let's take a look at the code in our AlbumBrowse page.

<a id="BLOGGER_PHOTO_ID_5632507642583989906"></a>

[![](/blog-assets/imported/987a8f36a88921c3ccaf6a46.png)](/blog-assets/imported/987a8f36a88921c3ccaf6a46.png)  

There are two interesting bits in this code (they're in giant red boxes – hard to miss). First, we setup event handlers for the \*Completed events we are interested in. Second, we call the \*Async methods. Notice in this example we're doing three *simultaneous* asynchronous requests. That's important. These requests will happen *simultaneously* . That, is the power of asynchronous code in action. Imagine each call takes 250ms to complete. With three calls, that's nearly 750ms of time just waiting around for Facebook. Using the asynchronous pages we end up waiting only as long as it takes for the longest running call to complete!

At this point astute readers will point out that I am in fact lying. In the default configuration of .NET, you will only ever make *two* simultaneous calls to a given remote IP. This is built-in to the WebRequest class. Lucky for us, we can change it in the web.config like so!  

```csharp
<system.net>
   <connectionManagement>
       <add address="*" maxconnection="100" />
   </connectionManagement>
</system.net>
```

With this configuration entry in place we can now make up to 100 simultaneous outgoing requests to the same IP address. Much better. Even if you're not using fbasync, you should make a similar change.

Back to the example. Making asynchronous requests is interesting, but requests don't usually do us much good without dealing with the results. The list of friends on the left side of the application is generated using a ListView control and some simple codebehind. I'm going to leave the HTML markup out of it, as its dirt simple. Have a look at the code if interested. Here's the codebehind that renders the user list.

<a id="BLOGGER_PHOTO_ID_5632507494763246610"></a>

[![](/blog-assets/imported/4a5672f537a1af6858328e99.png)](/blog-assets/imported/4a5672f537a1af6858328e99.png)  

Surprised? There are no red highlights. There's nothing very interesting here. If you haven't seen many lambda functions or LINQ before, the OrderBy and Single methods might look funny, but the code here is pretty darn simple. We remove our event handler (not doing this is prone to memory leaks so I always do it). Then we bind the ListView to the Result on the event argument. And finally we put the friends name who's albums we are viewing in the placeholder. Yup, that's it. No thread locking, no monitor, no mutex, no volatiles, no interlocks, *none* of that scary threading stuff at all.

Let's review what happened. Our page loaded. The fbasync library got a session from Facebook (or pulled one out of the cache/session – more on this in a future post). Our GetUsersAsync method was kicked off (among others). It finished, in a background thread, and raised the GetUsersCompleted event *back in the context of our ASP.NET request* . We took the results and bound them to a list view. No muss, no fuss. No threading required. My grandmother could do it – well, if she knew ASP.NET.

This is getting too long already. I'm starting to feel like I'm writing a [Scott Guthrie](http://weblogs.asp.net/scottgu/) article. Coming soon: we'll wrap up the rest of the example code, and move onto how the \*Async methods are implemented. I'd love to get some more contributors on this project. So, if you're interested, give me a buzz or head on over to [CodePlex](http://www.codeplex.com/fbasync) and get crackin! Feedback is welcome and encouraged.
