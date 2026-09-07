---
title: "Abstracting Away Azure: How to Run Outside of the Cloud"
date: 2009-02-02T16:27:00.002-08:00
slug: abstracting-away-azure-how-to-run
description: I had a lot of fun over our holiday break this December working on prototype projects for up and coming technologies. One of those projects dealt with Windows Azure, or, the…
tags:
  - architecture
  - azure
draft: false
updated: 2011-07-27T01:14:31.571-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-6581387070107928666
originalUrl: http://blog.jdconley.com/2009/02/abstracting-away-azure-how-to-run.html
ogImage: /blog-assets/og/abstracting-away-azure-how-to-run-v1.jpg
ogImageAlt: "A cloud breaks free from its chains above an open padlock. — JD Conley."
---

I had a lot of fun over our holiday break this December working on prototype projects for up and coming technologies. One of those projects dealt with Windows Azure, or, the Azure Services Platform. Azure is basically a cloud application hosting environment put together by Microsoft. The idea is, you build your web apps in .NET and publish them to the nebulous cloud. Once in the cloud they scale and perform well and you don't have to deal with any of the headaches of managing things at the OS/System level.

But with the recent [economic news](http://www.microsoft.com/presspass/press/2009/jan09/01-22fy09Q2earnings.mspx) out of Redmond I've been wondering about the future of its more experimental CTP/Alpha/Omega/Whatever-They-Call-It projects such as Azure. If you're not familiar with the project, I suggest you [venture on over](http://www.microsoft.com/azure/default.mspx) and check it out now.

Unlike other cloud hosting platforms out there, with Azure you don't have to maintain the operating system. Not only do you get the benefits of cloud computing, but you don't even need a system administrator to run the thing. Of course, the fact that you don't have control of the operating system has its drawbacks.

With Azure you can't run unmanaged code, you're stuck in Medium trust, and you can only build a port 80/443 HTTP application. If you want to run memcached or Velocity or streaming media codecs, well, you can't. If you want to host a game server that communicates with UDP or some non-http protocol, you can't do that either. But, for most custom web applications, everything you need is there. They host a "database" for you, a queue service, you can run background services, and you even get a shared logging service.

All of the services they provide seem to work as advertised and are promised to be extremely scalable. But, one thing they don't talk about (and I can't say I blame them) is how you might run your applications if they're not hosted in the cloud. In our company this just isn't acceptable. If we put out a game and our hosting provider ceases to exist, or no longer meets our needs, we had better be able to move to a new hosting provider! So, I'll give you some tips based on my experiences building prototype Azure applications on how you can easily easily design your applications to run outside of the cloud.

**The Main Azure Features**  

-   Table storage
-   Queue services
-   Blob storage
-   Logging
-   Background services (Worker Role)

**Table/Queue/Blob**  

Abstracting away tables, queues, and blobs is fairly simple but takes a bit of up front planning. You do basically the same thing you'd do if you were building an application on a large team that is designed to work with any data storage back end. At a high level:

<a id="BLOGGER_PHOTO_ID_5632587561430323474"></a>

[![](/blog-assets/imported/545427e849e19249bb213df0.png)](/blog-assets/imported/545427e849e19249bb213df0.png)  

In order to maintain the abstraction it's very important that your UI and background services don't interact directly with the Azure services. First off, use [DTO](http://en.wikipedia.org/wiki/Data_Transfer_Object) entities. If all else fails and your new back end storage isn't compatible with Azure, you can always fall back to re-writing the layer that talks to it and you don't have to change any of your UI code. **Do not** expose the PartitionKey and RowKey values on your DTO entities. Leave the partitioning scheme as an implementation detail of your Service/Model layer. It will change if you have to move your data into Amazon's [SimpleDB](http://aws.amazon.com/simpledb/), for example. Since Azure Table Storage uses the [ADO.NET Entity Framework](http://msdn.microsoft.com/en-us/library/aa697427%28VS.80%29.aspx) at the core, there actually isn't much you need to do to the entities in order to make them portable to other Table-like storage systems. Also, the Blob and Queue storage services are quite simple and abstracting their interface is a matter of tens of lines of code.

Create interfaces for the layer that the UI communicates with and use a [dependency injection](http://en.wikipedia.org/wiki/Dependency_injection) (DI) framework such as [StructureMap](http://structuremap.sourceforge.net/) or [Castle](http://www.castleproject.org/) to inject your implementations that communicate with Azure.

I use StructureMap on a day to day basis, and I was dissapointed that it didn't work out of the box. I had to make a couple modifications to the source to get it to run under medium trust. First, you need to add an AllowPartiallyTrustedCallersAttribute to the assembly and then remove the security assertion that's asserting the right to read the machine name (you don't have access to the machine name in medium trust). You can download my updated version here (patch and binary): [StructureMap-2.5-PartialTrust.zip](https://docs.google.com/viewer?a=v&pid=explorer&chrome=true&srcid=0B7Ew2HKAAmajNzVkNjlmNGMtYTAxNS00MGU0LTk0MjctN2U4Yzg3NTMxYmRh&hl=en_US)

That's it. With your UI not talking directly to the Azure services you'll have an extra layer of code to maintain, but you'll be thankful if you ever need to pull it out of the cloud.

**Logging**  

For all my non-Azure projects I use [log4net](http://logging.apache.org/log4net/) for logging. It's a simple, flexible, open-source logging engine. You might want to use Enterprise Framework. Whatever. Just like with the storage engines the key to being able to move off of the Azure logging service some day is to not use it in your applications directly. I wrote a little Appender plugin for log4net that writes logs to the Azure RoleManager if the app is loaded into the Azure context. Most of the code is mapping the multitude of log4net log levels to the Azure event log names. Here's the code:

```csharp
public class AzureRoleManagerAppender
: AppenderSkeleton
{
public AzureRoleManagerAppender()
{
}

public AzureRoleManagerAppender(ILayout layout)
{
   Layout = layout;
}

protected override void Append(log4net.Core.LoggingEvent loggingEvent)
{
   if (null == Layout)
       Layout = new log4net.Layout.SimpleLayout();

   var sb = new StringBuilder();
   using (var sr = new StringWriter(sb))
   {
       Layout.Format(sr, loggingEvent);
       sr.Flush();

       if (RoleManager.IsRoleManagerRunning)
           RoleManager.WriteToLog(GetEventLogName(loggingEvent), sb.ToString());
       else
           System.Diagnostics.Trace.Write(sb.ToString(), GetEventLogName(loggingEvent));
   }
}

protected virtual string GetEventLogName(LoggingEvent loggingEvent)
{
   if (loggingEvent.Level == Level.Alert)
       return "Critical";
   else if (loggingEvent.Level == Level.Critical)
       return "Critical";
   else if (loggingEvent.Level == Level.Debug)
       return "Verbose";
   else if (loggingEvent.Level == Level.Emergency)
       return "Critical";
   else if (loggingEvent.Level == Level.Error)
       return "Error";
   else if (loggingEvent.Level == Level.Fatal)
       return "Critical";
   else if (loggingEvent.Level == Level.Fine)
       return "Information";
   else if (loggingEvent.Level == Level.Finer)
       return "Information";
   else if (loggingEvent.Level == Level.Finest)
       return "Information";
   else if (loggingEvent.Level == Level.Info)
       return "Information";
   else if (loggingEvent.Level == Level.Notice)
       return "Information";
   else if (loggingEvent.Level == Level.Severe)
       return "Critical";
   else if (loggingEvent.Level == Level.Trace)
       return "Verbose";
   else if (loggingEvent.Level == Level.Verbose)
       return "Verbose";
   else if (loggingEvent.Level == Level.Warn)
       return "Warning";
   else
       return "Information";
}
}
```

Then you just configure log4net as usual, and go on your merry way. Write your logs to log4net rather than to the Azure log manager.

```csharp
<log4net>
<appender name="azure" type="AzureRoleManagerAppender,MyAssembly">
<layout type="log4net.Layout.PatternLayout">
 <conversionPattern value="%logger - %message" />
</layout>
</appender>

<root>
<level value="ALL" />
<appender-ref ref="azure" />
</root>
</log4net>
```

```csharp
private ILog _log = LogManager.GetLogger(typeof(WorkerRole));

...

_log.Info("Starting worker process");
```

  
**Background Services**  

Background services (Worker Roles) are basically Windows Services. The key difference, though, is in the behavior of the Start method. In Windows Service land you're expected to exit the Start method when the service has started. In Azure, the Start method is more like a Main and when it exits Azure assumes your service has completed its task and is restarted. I'd just write all your code in your RoleEntryPoint and not worry about any abstraction for the Worker Role. It's simple enough to just refactor and move to a Windows Service model if need be. But, just like in your UI, don't communicate directly with Azure back end services like Table, Queue, and Blob storage.

So there you have it. The basics of abstracting away Azure. I don't think Microsoft plans on canceling this project any time soon, but if they do (or you want to host elsewhere) you'll be ready! I, for one, am really excited about the future potential of Azure and we may even use it here, but we will be designing our applications so they can easily be ported to a different platform just in case.
