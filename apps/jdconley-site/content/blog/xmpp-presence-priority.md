---
title: XMPP Presence Priority
date: 2007-05-08T19:02:00.000-07:00
slug: xmpp-presence-priority
description: In XMPP (the messaging and presence protocol SoapBox uses) you can log in simultaneously on multiple systems. How your contat list is displayed and how messages are routed are…
tags:
  - xmpp
draft: false
updated: 2011-07-29T23:01:07.512-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-2106830143411505646
originalUrl: http://blog.jdconley.com/2007/05/xmpp-presence-priority.html
ogImage: /blog-assets/og/xmpp-presence-priority-v1.jpg
ogImageAlt: "Colored presence figures stand at different priority levels. — JD Conley."
---

In XMPP (the messaging and presence protocol SoapBox uses) you can log in simultaneously on multiple systems. How your contat list is displayed and how messages are routed are based on hints the client software provides to the server. One of these is presence priority. Priority is just an integer value between -128 and 127 defined in [RFC 3921 Section 2.2.2.3](http://www.xmpp.org/rfcs/rfc3921.html#rfc.section.2.2.2.3).

Managing priority is fairly straightforward when you control all client implementations used by a bare JID, but in a heterogeneous client environment it is more difficult as each developer chooses his/her own path and only learns by spying on what others do. I think presence priority is something that should be covered in the implementation guide so the actual values become more uniform on the network. We currently do pretty basic priority management, but I have some thoughts on a better implementation I hope others implementations might help refine.

Priority is typically used by both clients and servers to determine which resource is most likely to be the one you want to interact with. This could be for routing messages sent to bare JID’s, or deciding which presence status to display in a contact list. So, after much deep thought and implementation trial/error, here is my proposal.

Unless a user explicitly specifies she does not want to receive any messages, never set the priority below 0.

In desktop software, presence priority is based first on user input activity. It is more likely that if a user is active, she will be there to respond to a message, regardless of the presence status that is set in the client software. The actual times may vary based on implementation, but the general idea is to have four base values:

-   User input idle less than 1 minute: 100
-   User input idle more than 1 minute: 80
-   User input idle less than 5 minutes: 60
-   User input idle less than 30 minutes: 40

When these idle thresholds are met, presence should be broadcast. The current [show value](http://www.xmpp.org/rfcs/rfc3921.html#rfc.section.2.2.2.1) is then applied.

-   chat: -4
-   none (normal/available): -4
-   dnd: -4
-   away: -8
-   xa: -12

Thus, if a user has been idle for more than 30 minutes and has a show of xa, her priority is 28 (40-12). If a user has been idle for more than 30 minutes and has a show of away her priority is 32 (40-8). By starting at a high number and leaving padding between each show value, we leave room for implementations to add additional rules to adjust priority. Dnd has a higher priority than away and xa because, although the user does not want to be disturbed they are more likely to be at the dnd resource than the away or xa resource. It is up to the client implementation to insure they are not disturbed per the user’s configuration. A show of dnd uses the same priority as none and chat since you are likely equally available, you just don’t want to be disturbed.

Priority and, optionally, show values are adjusted automatically based on common “away from the computer” events: system input idleness (how long since the user interacted with the system), when a session is locked, or a session screen saver is active. When these events occur, the priority rules must be processed again. For Example, my client is configured to go to a show of away after 5 minutes with a status of “AFK”. After 30 minutes it is set to a show value of xa and a status of “AFK for a long time”. When my system is locked or the screen saver comes on, my client automatically adjusts my show value to away and a status of “Not here”. Important: even if an implementation does not change status messages or show values after these “away from the computer” events it must still adjust its priority as defined above.

After the “away from the computer” rules are processed, the relative availability of your peer resources is taken into account. If any peer was more recently more available (had a more available show value than your current value – chat, none/dnd, away, then xa) and has a non-negative priority, subtract 20 from your current priority. For example: I’m logged in at home and work. At home I last announced available presence 4 hours ago. My software at home never puts me into “xa” and instead decides I am “away” after 30 minutes. Home priority is now 32 (40-8). At work I last announced available presence 3 hours ago with a “none” show value. I go to lunch at work but it is configured to reach a show value of xa after 30 minutes. Its priority is now 28 (40-12). However, since work was my last active resource, when my home resource receives the broadcast from work it adjusts itself to a presence priority of 12 (32-20). The purpose of this is to insure that only the most recently available resource above more available than away/xa is the one that takes the higher priority.

It is important to never adjust your priority relative to the priority of a peer resource without taking much care. Doing so can cause a “race” for the highest or lowest priority (depending on the relative direction your adjusting).

That's about it. I also posted this on the XMPP standards mailing list. Reaching a concensus on how to adjust presence priority sure will help user perception of XMPP software.
