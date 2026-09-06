---
title: Asyncify Your Code
date: 2007-09-28T23:01:00.000-07:00
slug: asyncify-your-code
description: Asyncify your code. Everybody's doing it. (Chicks|Dudes)'ll dig it. It'll make you cool. Pretty much everything I build these days is asynchronous in nature. In SoapBox…
tags:
  - .net
  - async
  - tuning
draft: false
updated: 2011-07-27T01:58:03.994-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-188156924369495615
originalUrl: http://blog.jdconley.com/2007/09/asyncify-your-code.html
---

Asyncify your code. Everybody's doing it. (Chicks|Dudes)'ll dig it. It'll make you cool.

Pretty much everything I build these days is asynchronous in nature. In [SoapBox](http://soapbox.im/) products we are often waiting on some sort of IO to complete. We wait for XMPP data to be sent and received, database queries to complete, log files to be written, DNS servers to respond, .NET to negotiate Tls through a [SslStream](http://www.leastprivilege.com/SslStreamSample.aspx), and much more. Today I'll be talking about a recent walk down Asynchronous Lane: the [AsynchronousProcessGate](https://docs.google.com/viewer?a=v&pid=explorer&chrome=true&srcid=0B7Ew2HKAAmajYjIzNmE4MDYtYWFiMy00Nzk1LTg3MjUtODAzNGY5ZmRmN2I2&hl=en_US) (if you don't like reading just download [the package](https://docs.google.com/viewer?a=v&pid=explorer&chrome=true&srcid=0B7Ew2HKAAmajYjIzNmE4MDYtYWFiMy00Nzk1LTg3MjUtODAzNGY5ZmRmN2I2&hl=en_US) for source code goodness).

I ran into a problem while working on a new web application for Coversant. I needed to execute an extremely CPU and IO intesive process: creating and digitally signing a self extracting compressed file -- AKA The Package Service. This had to happen in an external process, and it had to scale (this application is publicly available on our consumer facing [web site](http://soapbox.im/signup.aspx)). Here's a basic sequence of the design I came up with:  

<a id="BLOGGER_PHOTO_ID_5632098975080183362"></a>

[![](/blog-assets/imported/b0e463757dee3f268b91e3d1.jpg)](/blog-assets/imported/f354242a4442521fede8c951.jpg)  

Do you notice the large holes in the activation times? That's because we're asynchronous! The BeginCreatePackage web service method the page calls exits as soon as the BeginExecute method exits, which is as right when the process starts. That means we're not tying up any threads in our .NET threadpools at any layer of our application during the time a task is executing. That's a Good Thing™.

At this point I'm used to writing highly asynchronous/threaded code. However, I still wouldn't call it easy. Why do it? I'd say there are three main reasons.  

1.  To provide a smooth user experience. The last thing a developer wants is for his/her software to appear sluggish. There's nothing worse than opening Windows Explorer and watching your screen turn white (that application is NOT very asynchronous).
2.  To fully and most appropriately utilize the resources of the platform (Runtime/OS/Hardware). To scale vertically, you might call it.
3.  Because it makes you cool. AKA: To bill a lot more on consulting engagements.

Microsoft [recommends two asynchronous design patterns](http://msdn2.microsoft.com/en-us/library/ms228969.aspx) for .NET developers exposing Asynchronous interfaces. These can be found on various classes throughout the framework. The [Event Based](http://msdn2.microsoft.com/en-us/library/hkasytyf.aspx) pattern comes highly recommended from Microsoft and can be found all over new components they build (like the [BackgroundWorker](http://msdn2.microsoft.com/en-us/library/system.componentmodel.backgroundworker.aspx)). Personally I think the event based pattern is overrated. The hassle of managing events and not knowing if the [completed event will even fire](/blog/simpler-isnt-always-better) typically steers me away from this one. However, it is certainly easier for those who are new to the asynchronous world. This pattern is also quite useful in many situations in Windows Forms and ASP.NET applications, leaving the responsibility of the thread switching to the asynchronous implementation (the events are supposed to be called in the thread/context that made the Async request -- determined by the [AsyncOperationsManager](/blog/simpler-isnt-always-better)). If you've ever used the [ISynchronizeInvoke](http://msdn2.microsoft.com/en-us/library/system.componentmodel.isynchronizeinvoke.aspx) interface on a Winforms Control or manually done [Async ASP.NET Pages](http://odetocode.com/Blogs/scott/archive/2005/06/16/1656.aspx) you can really appreciate the ease of use of this new pattern...

The second recommended pattern, and usually my preference, is called the [IAsyncResult pattern](http://msdn2.microsoft.com/en-us/library/ms228975.aspx). IAsyncResult and I have a very serious love/hate relationship. I've spent many days with my IM status reading "Busy - Asyncifying" due to this one. But, in the end, it produces a simple interface for performing asynchronous operations and a callback when the operation is complete (or maybe timed out or canceled). Typically you'll find IAsyncResult interfaces on the more "hard core" areas of the framework exposing operations such as Sockets, File IO, and streams in general. This is the pattern I used for the Asynchronous Process Gate in the Package Service.

The Package Service has a user interface (an AJAXified asynchronous ASP.NET 2.0 page) which calls an [asynchronous web service](http://msdn2.microsoft.com/en-us/library/98t3s469.aspx). The web service calls another asynchronous class which wraps a few asynchronous operations through the AsynchronousProcessGate and other async methods (i.e. to register a new user account) and exposes a single IAsyncResult interface to the web service.

Confused yet? Read that last paragraph again and [re-look at the sequence](/blog-assets/imported/f354242a4442521fede8c951.jpg). In order to make this whole thing scale it had to be asynchronous or we'd be buying a whole rack of servers to support even a modest load. Also because of the nature of the asynchronous operation (high cpu/disk IO) it had to be configurably queued/throttled. I went through a few possible designs on paper. But in the end I chose to push it down as far as possible. The AsynchronousProcessGate, quite simply, only allows a set number of processes to execute simultaneously, the number of CPU's reported by System.Environment.ProcessorCount by default. It does this by exposing the IAsyncResult pattern for familiar consumption. The piece of magic used internally is something we came up with after writing a lot of asynchronous code: LazyAsyncResult&lt;T&gt;.

LazyAsyncResult&lt;T&gt; provides a generic implementation of IAsyncResult. It manages your state, your caller's state, and the completion events. It also uses [Joe Duffy's LazyInit stuff](http://www.bluebytesoftware.com/blog/PermaLink,guid,df20d0c7-4bf7-443e-8601-b6aa4355a9b1.aspx) for better performance (initializing the WaitHandle is relatively expensive and usually not needed).

Using the asynchronous process gate is straight forward if you're used to the Begin/End IAsyncResult pattern. You create an instance of the class, and call BeginExecuteProcess with your ProcessStartInfo. When the process is complete you will get your AsyncCallback, or you can also wait on the IAsyncResult.WaitHandle that is returned from BeginExecuteProcess. You then call EndExecuteProcess and the instance of Process that was used is returned. If an exception occurred asynchronously, it will be thrown when you call EndExecuteProcess.

**The Begin Code:**  

```
static void StartProcesses(){   AsynchronousProcessGate g = new AsynchronousProcessGate();   while (!_shutdown)   {       //keep twice as many queued as we have cpu's.       //for a real, CPU or IO intensive, operation       //you shouldn't do any throttling before the gate.       //that's what the gate is for!       if (g.PendingCount < g.AllowedInstances * 2)           g.BeginExecuteProcess(               new ProcessStartInfo("notepad.exe"),               10000,               ProcessCompleted,               g);       else           System.Threading.Thread.Sleep(100);   }}
```

**The End Code:**  

```
static void ProcessCompleted(IAsyncResult ar){   try   {       AsynchronousProcessGate g =           (AsynchronousProcessGate)ar.AsyncState;       using (Process p = g.EndExecuteProcess(ar))           Console.WriteLine("Exited with code: " +               p.ExitCode + ". " +               g.PendingCount + " notepads pending.");   }   catch (Exception ex)   {       Console.WriteLine("("            + ex.GetType().ToString()            + ") - "   ex.Message);   }}
```

Phew! After all that, the end result for SoapBox: a single self extracting digitally signed file someone can download. Oh, and a simple library you can use as an Asynchronous Process Gate! Enjoy. Look, another [download link](https://docs.google.com/viewer?a=v&pid=explorer&chrome=true&srcid=0B7Ew2HKAAmajYjIzNmE4MDYtYWFiMy00Nzk1LTg3MjUtODAzNGY5ZmRmN2I2&hl=en_US) so you don't even have to scroll back up. How nice am I?
