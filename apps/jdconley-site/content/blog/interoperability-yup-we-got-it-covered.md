---
title: Interoperability - Yup, we got it covered
date: 2006-07-24T23:54:00.000-07:00
slug: interoperability-yup-we-got-it-covered
description: Today was the first day of the first ever official XMPP Interop Event. In fact, it was probably the first day of any open instant messaging and presence interop event, ever. We…
tags:
  - soapbox
  - xmpp
draft: false
updated: 2011-07-21T23:05:04.808-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-3475430821530758052
originalUrl: http://blog.jdconley.com/2006/07/interoperability-yup-we-got-it-covered.html
---

Today was the first day of the first ever official [XMPP Interop Event](http://wiki.jabber.org/index.php/Interop_Event). In fact, it was probably the first day of any open instant messaging and presence interop event, ever.

We had showings from Coversant (yeah, that's us), Sun, SixApart (LiveJournal), Google, Jive Software, Jabber Inc, Sun Microsystems, and Process-one. Some of those names might sound familiar, and others not, but in the end what we ended up with was seven completely different XMPP server code bases/implementations both open and closed source, setup on a LAN and federating with each other. We spent more time configuring DNS, IP addresses, and other networking junk than we did fixing bugs that were hampering interoperability.

As far as I know (who knows what everyone was hiding on their laptop screens) there were only a few major bugs that were found and they were on two of the very freshest of server implementations, one of which the vendor considers in "pre-alpha" release status. No, I won't tell you who, but I bet they release patches soon. :)

So what the heck did we do all day? Well, we tested interoperability, obviously! But more specifically:

  
-   Inter-domain roster manipulation - Add and remove contacts on other servers.
-   Inter-domain messaging - Can we actually hold conversations with each other?
-   Inter-domain presence - Avatars, status messages, show states, etc
-   pizza
-   UTF8 support - Strange unicode characters in other languages in addresses, messages, and presence.
-   Discussed quite a few of the enhancement protocols pending for the XMPP specification and came to concensus on some issues.
-   Mingled with everyone and shared some anecdotes on implementing XMPP that pretty much only the people in that room would understand.
-   beer
  

What does that mean to you, a loving Coversant customer -- you are a customer, right? Well, it means that you can securely talk through IM in a federated manner to your trading partners, friends, family, and arch enemies even if they aren't one of our customers. Yeah, we support that, and apparently it works. ;)  

#1 on the list for tomorrow, trusted TLS based inter-server connections. So we have the joy of setting up a trusted certificate authority and distributing certs. I bet setup will take longer than the interoperability testing itself, again.
