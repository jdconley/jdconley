---
title: Compact Framework WaitHandle.WaitOne Gotcha
date: 2006-11-08T14:32:00.000-08:00
slug: compact-framework-waithandlewaitone
description: I ran into a behavior in the 2.0 Compact Framework today that was most vexing. It wasn't hard to find like a subtle race condition. It wasn't an issue that only duplicated with…
tags:
  - .net
draft: false
updated: 2011-07-21T23:57:56.545-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-6288449040506861270
originalUrl: http://blog.jdconley.com/2006/11/compact-framework-waithandlewaitone.html
---

I ran into a behavior in the 2.0 Compact Framework today that was most vexing. It wasn't hard to find like a subtle race condition. It wasn't an issue that only duplicated with a certain system configuration, under a full moon, on Wednesday. No, it duplicated every single time the code was ran. But, it wasn't documented anywhere I could find.

One of my favorite new features in the Compact Framework is the availability of the [WaitHandle.WaitOne](http://msdn2.microsoft.com/en-us/library/kzy257t0.aspx)(int, bool) overload. That's something we use quite a bit in our test code and here and there in the actual SoapBox Framework. We used to have our own ManualResetEvent implementation for the Compact Framework that P/Invoked out to Windows CE. But Micrsoft was nice enough to add this into the 2.0 Framework. Yay! (In case you never had the joy of programming to the .NET 1.0 framework, the only WaitOne overload that was there was the indefinitely blocking one. No timeouts allowed.)

I was running our unit test suite against the Compact Framework and tests that used to pass until I ripped out our custom P/Invoking ManualResetEvent implementation were failing. Odd... Well, it turned out to be very easy to track down. [WaitHandle.WaitOne](http://msdn2.microsoft.com/en-us/library/kzy257t0.aspx)(int, true) throws an ArgumentException every single time. That's right. If you pass true to that second parameter, the exception is thrown.

Don't get me wrong, I understand the implications of exiting the synchronization domain for the context or not. It turns out the code that was causing the error should have been passing "false" for the parameter anyway. But, why did the call throw an exception? Why not just ignore the argument when it's not relevant as the documentation alludes? And I quote from MSDN2: "The exitContext parameter has no effect unless the WaitOne method is called from inside a nondefault managed context."

Anyway, if you're doing any Compact Framework development, make sure to pass "false" into the exitContext parameter of your [WaitHandle.WaitOne](http://msdn2.microsoft.com/en-us/library/kzy257t0.aspx) calls.
