---
title: Fire and Forget Email, Webservices and More in ASP.NET
date: 2009-01-14T22:19:00.000-08:00
slug: fire-and-forget-email-webservices-and
description: Often times when you're working on a web site you want to fire and forget an email, a web method or, most common in our case, a Facebook call. There's a good chance there's a…
tags:
  - .net
  - async
draft: false
updated: 2011-07-27T01:18:09.847-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-6717842052803519212
originalUrl: http://blog.jdconley.com/2009/01/fire-and-forget-email-webservices-and.html
---

Often times when you're working on a web site you want to fire and forget an email, a web method or, most common in our case, a Facebook call. There's a good chance there's a Framework method available to do that for you quite simply. They're suffixed with the word Async. For email there's the [System.Net.Mail.SmtpClient](http://msdn.microsoft.com/en-us/library/system.net.mail.smtpclient.aspx) class. The following dirt simple code will send an email for you asynchronously:

[Download](https://docs.google.com/viewer?a=v&pid=explorer&chrome=true&srcid=0B7Ew2HKAAmajN2MzNDEwMTEtZTU5Ny00NjBiLWIyODQtYTdjZjc3M2UzMTEy&hl=en_US) the sample code  

```csharp
var s = new SmtpClient();
s.SendCompleted +=
  (sender2, e2) =>
  {
      //do something when the send is done.
      //retry if error, etc.
  };

s.SendAsync(from.Text, to.Text, "", message.Text, null);
```

Well, that's pretty darn simple! Create a new SmtpClient. Call SendAsync and pass in your message data. Cool. There's even a whole set of classes to help you with attachments, multiple formats (like html and text), etc. From your console app or Windows Service this will work beautifully! The problem is, in an ASP.NET page this won't work. If you do this in a Page\_Load or button click event, for example, you'll get the following helpful error message.

> Asynchronous operations are not allowed in this context. Page starting an asynchronous operation has to have the Async attribute set to true and an asynchronous operation can only be started on a page prior to PreRenderComplete event.  
>   

Basically what ASP.NET is saying is that it's not prepared for you to make an Async call. No problem! ASP.NET has a nifty page directive. Just set Async="True". The MSDN documentation says: "Makes the page an asynchronous handler (that is, it causes the page to use an implementation of IHttpAsyncHandler to process requests)." What does that mean? Well, there are a whole bunch of posts on this, so if you're not familiar, search around for [asp.net async page](http://www.google.com/search?q=asp.net+async+page) and come back here. Also do a search for "async" in my blog. I've posted about it a lot. It's one of my favorite features in ASP.NET.

So, now you've got the Async page directive down and you think all is good. But then, suddenly, you notice page load times start to increase. Your phone is ringing. Users are complaining. After mere minutes of debugging (after all you're a kung fu debugger right?) you realize your ASP.NET page is *waiting for the email to send* . "What the heck is going on here? This was an Async call," you mumble under your breathe. You curse Microsoft, and write an angry blog post about it. What happened?

When you set that Async="True" directive on your page you told ASP.NET that you want to do page rendering asynchronously. However, what you didn't realize is that you're doing things asynchronously with regards to the use of threads, and not the serving of the page. Let me clarify. With Async="True" ASP.NET *waits for all Async calls to complete before finishing page rendering* . It's designed so you can kick off long running IO operations like calling a database, web service, writing files, and sending email, without tying up a valuable worker thread in your ASP.NET threadpool. Instead, the IO operation gets queued up down in unmanaged Windows land and IOCP magic and the shared IO threads kick in. If you truly want to fire-and-forget, and not have your Async calls affect your page load time, here's your answer.

```csharp
using (new SynchronizationContextSwitcher())
{
  var s = new SmtpClient();
  s.SendCompleted +=
      (sender2, e2) =>
      {
          //do something when the send is done.
          //retry if error, etc.
      };

  s.SendAsync(from.Text, to.Text, "", message.Text, null);
}
```

It should be noted that in this sample code when the SendCompleted anonymous method is called, you are *no longer in the ASP.NET context* . The SynchronizationContextSwitcher removed this context and put you in no context, so you're just free ballin'. This is important. You can't mess with the Request, Page, Response, etc. We're talking serious multi-threading now. In fact it's even likely that delegate will be executing at the same time as some other method in your page's lifecycle, on a whole other thread. So, pass anything you want to use from the page via the last parameter on the SendAsync call, pull it out of the EventArgs in your SendCompleted handler, and don't touch that page object or anything in it.

I must confess. I didn't write this SynchronizationContextSwitcher class. It was another developer on our team (Boris) and then was improved by a random good Samaritan named [Richard](http://haacked.com/archive/2009/01/09/asynchronous-fire-and-forget-with-lambdas.aspx#70428). It's also based on [this one](http://www.codeproject.com/KB/threads/SynchronizationContext.aspx) that's quite a bit more featureful/complicated.

Anyway, Simply wrap your send (or any Async) call in a using block like this and, for the scope of that block, any Async operations will happen as if you were not even in ASP.NET and didn't have a Request context to worry about. Your page will be served immediately without waiting for your Async call to complete. Of course, this does have caveats. By doing a true fire and forget there is now the potential your email won't get sent and you won't even know about it. ASP.NET could shut down your app domain 1/2 way through the send and you and the user would be none the wiser. So, care must be taken to either store these things in some other reliable place before the Async call, or (as in our case) usually whatever you're firing off isn't critical, so a few missed ones here and there won't matter.  

```csharp
public class SynchronizationContextSwitcher
  : IDisposable
{
  private ExecutionContext _executionContext;
  private readonly SynchronizationContext _oldContext;
  private readonly SynchronizationContext _newContext;

  public SynchronizationContextSwitcher()
      : this(new SynchronizationContext())
  {
  }

  public SynchronizationContextSwitcher(SynchronizationContext context)
  {
      _newContext = context;
      _executionContext = Thread.CurrentThread.ExecutionContext;
      _oldContext = SynchronizationContext.Current;
      SynchronizationContext.SetSynchronizationContext(context);
  }

  public void Dispose()
  {
      if (null != _executionContext)
      {
          if (_executionContext != Thread.CurrentThread.ExecutionContext)
              throw new InvalidOperationException("Dispose called on wrong thread.");

          if (_newContext != SynchronizationContext.Current)
              throw new InvalidOperationException("The SynchronizationContext has changed.");

          SynchronizationContext.SetSynchronizationContext(_oldContext);
          _executionContext = null;
      }
  }
}
```

I whipped up a [small sample project](https://docs.google.com/viewer?a=v&pid=explorer&chrome=true&srcid=0B7Ew2HKAAmajN2MzNDEwMTEtZTU5Ny00NjBiLWIyODQtYTdjZjc3M2UzMTEy&hl=en_US) to demo the effects I talk about here. There are two pages. One that is async, and one that isn't. It demos the error you get if you try to use an Async method on a non-async page, and simulates a slow email server on the async page. Then you can see the fire and forget in action.

Async methods are extremely useful, even if you're not using fire and forget. Most of the samples you see for doing asynchronous ASP.NET pages use the IAsyncResult and Begin\*/End\* methods. Those are pretty complicated, and if the Async method is available why not use it? I've written about the benefits of async programming quite a lot. Search for "async" up at the top right of the page.
