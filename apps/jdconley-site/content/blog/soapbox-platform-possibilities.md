---
title: SoapBox Platform Possibilities
date: 2006-09-16T09:38:00.000-07:00
slug: soapbox-platform-possibilities
description: "Our customers do some very interesting things with our platform, including: RPC – The asynchronous nature of XMPP along with its addressing and our platform make it ideal for…"
tags:
  - soapbox
  - xmpp
draft: false
updated: 2011-07-21T23:36:45.777-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-7900123433520559771
originalUrl: http://blog.jdconley.com/2006/06/soapbox-platform-possibilities.html
---

Our customers do some very interesting things with our platform, including:  

-   RPC – The asynchronous nature of XMPP along with its addressing and our platform make it ideal for application to application messaging. One of our customers wrote a .NET Remoting transport on SoapBox, and many use it for other custom RPC needs (some are below).
-   Network gaming infrastructure – sending game data, hosting chat rooms, private chat during games, etc
-   In class test taking – Tests are distribute to Tablet PC’s when students log in and results are tallied.
-   Geographical Chat – Whiteboarding combined with maps and group conferencing.
-   Financial Market Data – Real time data from the market flows into applications used by traders.
-   Social Networking – Consumer social networking site using our platform for chat, content, and advertising delivery to the desktop.
-   Emergency Alerting – “The nuclear power plant is melting down. Evacuate!”
-   Remote Surveillance Control – Watch your surveillance cameras at home in any web browser and control them.
-   Automated Manufacturing Alerting – “Line 5 is clogged. Attention required!”.
-   Plain ole’ chat built into an existing application – Give users access to the people they need in the application they are familiar with.
-   Build System Alerts – Our build system sends us messages as our daily builds runs, letting us know the status.
-   Web Based Live Support – Communicate with customers live, through a web site.
-   Voice and Chat on Ruggedized Handhelds - Push to talk through a contact list with presence, send messages, pictures, or go into walkie talkie mode.
-   And the list goes on…

Some have been in the news, some are still in "stealth mode", but unfortunately I can't mention any names of companies. We will have some case studies coming out for a few of them.

Some of these applications are built on our 2005 platform, but many are built on our upcoming 2007 release. We've been working hard with our partners to make sure this upcoming release is something special. Here's a little overview of the new SoapBox platform.

SoapBox Framework (now SoapBox Studio)

The SoapBox Framework was our first product offering. We built and productized a framework knowing we’d want to build a server and an advanced communicator client. It started out as one framework, and has grown into quite a bit more. With the 2007 product release we will be distributing our frameworks in one package called the SoapBox Studio. They are all based on the same code base, which allows us to quickly add features to our entire product line. These frameworks include:  

-   Desktop Edition – Build desktop and web applications in .Net for Windows, Linux, and Solaris.
-   Mobile Edition – Build mobile applications that run on PocketPC, Smart Phone, Windows Mobile, or Windows CE operating systems.
-   Web Service Edition – This is my favorite. J A standard SOAP web service, built using our Desktop Edition on the back end, that allows you to integrate with any language that supports web services. This includes Java, ColdFusion, Flash, C++, Perl, Php, and more (basically every language out there).
-   Server Administration Edition – All of the features that are available in our Management Console are available to you through public API’s. You can quickly perform tasks such as adding users, managing contact lists, and retrieving message archives.
-   Server Edition –This allows you to build plug-ins to the SoapBox Server to manage users from your own custom user store, create custom components to service client requests, filter messages, do custom logging, and manipulate the way the server works in general.

SoapBox Server

The SoapBox Server is our flagship XMPP server product. It is based on our Desktop Edition Framework with additional layers to do everything a server needs to do. You can easily customize the Server to meet your specific needs through the SoapBox Framework Server and Administration SDK’s.

SoapBox Communicator

The SoapBox Communicator is our client software built on our SoapBox Framework Desktop Edition (as well as another layer that we will be productizing soon) and serves as an example of how to best utilize the framework for client side development.

Other Key Platform Features  

-   Open, well normalized database – We use a strict Enterprise nTier model in the SoapBox Server. Our database is well normalized with stored procedures for all interactions. This makes it extremely easy to integrate users, contact lists, message archiving, and presence with any environment that can read or write to a database.
-   Shared code base - Whether you’re writing an application for a Smartphone, or a server plug-in to handle workflow in a CRM application, your code interacting with SoapBox will look strikingly similar. This better utilizes your developer resources by focusing them on their business problem, not re-learning another API.
-   Unprecedented vertical scalability - SoapBox Server will fully utilize any hardware you can throw at it.

We have been hard at work creating the best documentation and samples out there for any XMPP platform. Here are a couple of (draft) samples.  

-   [Building Custom Packets](http://www.coversant.net/downloads/Building%20Custom%20Packets.pdf)
-   [Building a Custom User Manager](http://www.coversant.net/downloads/Building%20a%20Custom%20User%20Manager.pdf)

If you would like advanced access to the SoapBox 2007 Platform, shoot us an email over at [support@coversant.net](mailto:support@coversant.net) and we'll get you on the beta list.
