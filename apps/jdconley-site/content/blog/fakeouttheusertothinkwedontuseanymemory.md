---
title: FakeOutTheUserToThinkWeDontUseAnyMemory
date: 2006-05-08T15:28:00.001-07:00
slug: fakeouttheusertothinkwedontuseanymemory
description: There comes a time in every project where the developers realize we are building software for the users, rather than for ourselves. A user's perception can be the difference…
tags:
  - .net
  - tuning
  - winforms
draft: false
updated: 2011-07-27T04:35:55.215-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-6390406425317569855
originalUrl: http://blog.jdconley.com/2006/05/fakeouttheusertothinkwedontuseanymemory.html
---

There comes a time in every project where the developers realize we are building software for the users, rather than for ourselves. A user's perception can be the difference between a good and a bad reference, and we all know how detrimental bad word of mouth can be. This unfortunate reality hit me square in the face recently when I was told by a customer that "your application is bloatware".

Any desktop application with a user interface, written in .NET, that does anything interesting, can easily be mistaken for bloatware. It's quite easy to create a super elegant application with no memory leaks that appears to use 50MB or more of memory. I say appears, because the figure everyone sees in Task Manager is the "Working Set" size. Users (myself included, up until recently) see large working set sizes as a sign of bloatware and poor programming.

This is simply not the case. The working set is more along the lines of the amount of physical memory the OS thinks your application might need or needed at one point, including shared memory and all sorts of other complicated things that .NET developers aren't supposed to have to think about. If your system was in need of physical memory for other processes much of this perceived bloat would either be reclaimed and put to better use, or paged out to disk.

At the end of the day, the reality of the situation doesn't matter. Your users think your application is bloated. What do you do? Well, you FakeOutTheUserToThinkWeDontUseAnyMemory.

  

```
using System.Diagnostics;namespace Coversant.Utility {  public static class MemoryUtility  {      private static volatile bool _enabled = true;      public static void FakeOutTheUserToThinkWeDontUseAnyMemory()      {          if (!_enabled)              return;          try          {              Process curProc = Process.GetCurrentProcess();              curProc.MaxWorkingSet = curProc.MaxWorkingSet;          }          catch          {              //Some users won't have permission to adjust their working set.              _enabled = false;          }      }  }}
```

  

Yep, that's it. Call that method (.NET 2.0 only -- [in 1.x you had to P/Invoke](http://www.ddj.com/dept/windows/184416804)) and watch the magic happen. In our applications we set it up on a timer that runs every 30 seconds and after any events we know will raise the working set, usually after loading new assemblies or after a window is closed . Running this code causes Windows to free up as much of the working set as possible. Usually this sends most of your bloat to the page file where it will remain forever. In our case, the application had a 50MB working set and really only needed about 10MB of physical memory after it was running. There is, however, one big gotcha. An application can only attempt to adjust its working set if it is running with appropriate permissions (typically a local Administrator).

Yes, your users perceptions are reality. Using this trick/hack helps keep reality in line.
