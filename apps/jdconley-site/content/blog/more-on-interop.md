---
title: More on Interop
date: 2006-07-26T21:00:00.000-07:00
slug: more-on-interop
description: I'm sitting on a plane on my way back to Sacramento (a whopping 1 hour flight) and I thought I'd try to give a little more information about the interop event. After two days…
tags:
  - soapbox
  - xmpp
draft: false
updated: 2011-07-21T23:08:37.379-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-1161897624541060473
originalUrl: http://blog.jdconley.com/2006/07/more-on-interop.html
---

I'm sitting on a plane on my way back to Sacramento (a whopping 1 hour flight) and I thought I'd try to give a little more information about the interop event. After two days of testing it appears as though we're actually very close to having quite a few fully interoperable XMPP implementations. As I mentioned last time, Monday was a cake walk. Unfortunately Tuesday wasn't quite so easy.

Consensus was reached on Monday to start later on Tuesday. We wanted to do 10am, but had reservations at Jive's office to sample beers of the northwest at 5 (yeah they have some good beers) and play some XBox, so we decided to start at 9 instead. The morning session consisted mostly of protocol discussions that were very productive. We decided on the general protocol flow of PEP (Personal Eventing via Pubsub). This protocol addition allow us to create some very innovative and interesting extended presence features (more on this later) in future versions of SoapBox Communicator, and they'll be compatible with features in other clients such as Google Talk, GAIM, etc.

I had some really good Thai food from a street vendor, and I'm still not sick, so that's good. In fact it was some of the best Thai food I've had in a long time, and I eat Thai about once a week.

After lunch we got down to business with more interoperability testing. The goal: mutually authenticated TLS streams between servers per RFC 3920. A certificate authority was created, X.509 Certificates were generated, servers were configured, and then... it didn't work. Unlike the overwhelming success of Monday, Tuesday brought the skeletons out of the closet. We soon realized there were numerous breaking differences between OpenSSL, Java, and .NET based implementations of TLS. When we started, absolutely none of the servers were able to talk to each other over a fully trusted TLS connection. The interesting thing was we could all talk to another instance of our own servers. Hmmm.

After a few hours of hacking and debugging we realized there was significant work that needed to be performed and we didn't have enough time to do it. We were able to get connected with a few of the servers, and vice versa, but there definitely wasn't a Happy Path for all. As a result the server to server TLS specifications in RFC3920 will be clarified, as we eventually reached consensus on what it all really means and how it should be implemented.

In the very near future the [JSF](http://www.jabber.org/) will be facilitating ad-hoc interoperability testing over the internet. It will be managing domains (such as soapbox.xmpp.org, google.xmpp.org, etc) where all participating vendors and open source projects will host servers. These will be semi-private domains without open registration, but open to anyone developing XMPP applications that need to test interoperability.

All in all, this was a very successful couple of days. We probably saved a good two months worth of bickering over e-mail lists to figure out protocol issues, verified that XMPP is in fact interoperable, and set the stage for future interoperability testing. We'll also be exploring fully automated tests, which Coversant will likely contribute to the JSF, to make sure everyone continues to play nice in the future. :)
