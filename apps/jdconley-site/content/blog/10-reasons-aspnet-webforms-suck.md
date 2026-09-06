---
title: 10 Reasons ASP.NET Webforms Suck
date: 2009-01-12T19:24:00.000-08:00
slug: 10-reasons-aspnet-webforms-suck
description: I've always been a .NET Fanboy. I've been on the bandwagon since its inception. I've developed quite a few shipping .NET products for the web, Windows, and Linux. I've given…
tags:
  - .net
  - asp.net
draft: false
updated: 2011-07-23T05:14:41.201-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-8150011986971385423
originalUrl: http://blog.jdconley.com/2009/01/10-reasons-aspnet-webforms-suck.html
---

I've always been a .NET Fanboy. I've been on the bandwagon since its inception. I've developed quite a few shipping .NET products for the web, Windows, and Linux. I've given talks at user groups, created a consulting company, and mentored developers new to .NET. I always experiment with the latest toys and try to stay ahead of the technolgoy curve. In my most recent role at Hive7, I've been focused on web technology. We have some pretty large scale games (millions of players) built on ASP.NET webforms and ASP.NET AJAX. It's been about 8 years since I've written a full blown web app that wasn't in ASP.NET webforms. Sure, there's the occasional small PHP or static html site, but no "real" applications have been built on anything but ASP.NET. I think I've been missing out.

I'm going to preface this by saying one thing. Ever try to train someone new to ASP.NET? Especially someone with any other web programming experience. It's not easy. That to me is a sign of suck, or maybe fail.

**The Reasons (in order of frustration)**  

1.  Other web developers assume you're inferior  
    
    Let's face it, if you're coding in ASP.NET you are NOT initially considered one of the cool kids. It's automatically assumed you're a corporate lackey with no programming fu. You have to prove yourself. It sucks. Yes, this is #1. Afterall, don't you want other people to think you're cool? Or am I the only one still living in high school...?
    
  
3.  One form to rule us all, one form to bind us  
    
    I don't think I have much to say on this, other than. Why? What was the design decision behind overloading the html form and only lettings us have one? Why? Why? Why?
    
  
5.  Viewstate  
    
    Ever accidentally generated a 1MB (simple) page by just using standard controls?
    
  
7.  ID insanity  
    
    Mapping id's in html elements to id's in code starts out innocent enough. But, throw in nested controls (a recommended design practice) and hold on for your life. Once you get used to it everything makes sense. But try showing your dhtml/javascript guy how to use codebehind to grab a ClientID and pass that to his javascript code...
    
      
    
8.  Html abstraction  
    
    I truly hate that in webforms that you don't really write html code. Browser independent rending is just a bad, horrible idea. The abstraction sounds nice on the surface, but some day it will bite you. Web developers should know how to write html code, understand the web programming model, and the cross platform implications of their code.
    
  
10.  Postbacks everywhere  
     
     Linkbuttons, and any of the controls with 'autopostback' should be taken out on the street and shot. Posting back to the initial page as the default to perform an action is just counter intuitive. And then, how do you consume this action? An event handler? Weird.
     
  
12.  Request lifecycle  
     
     Init, Load, PreRender. WTF? Try explaining that one to your javascript guy. The fact that we need a 10 step lifecycle for things to work sends off warning bells in my head.
     
  
14.  Getting data to the client  
     
     Ok, I've got this cool data driven web site. And now I want to do some AJAX. How do you interface your server code with your Javascript? You can pick one of 20 methods, none of which are simple, and all leave the developer scratching his head. Sometimes things magically work. Usually they don't.
     
  
16.  Ugly URL's  
     
     Ok, so this one is low on the list becuase the latest service pack added a routing engine. But hey, it's bugged me for the last 8 years. Customers want pretty url's. Webforms did not deliver without much hackery.
     
  
18.  Codebehind  
     
     I love c#. But, the concept of codebehind just seems weird. Why is there a separate file that's coupled to the html code? This nifty abstraction has been the cause of so many developer questions and Visual Studio environment issues I don't even want to go there.
     
  
20.  The odd feeling that you have to beat the framework into submission to get it to do what you want  
     
     Ok, this is #11, I know. But hey, something just *feels* wrong in webforms. Like you're trying to stick a square peg through a round hole.
     

  

As I look over this list I realized that most things I hate about ASP.NET Webforms related to the choices that were made about abstractions. I don't understand what was so scary about the web programming model that these decisions were made. In fact, now that I think about it, I'd have been happier sticking with the classic ASP programming model than using webforms. Oh well. The last 8 years will now be known as "the time in my life when I had to code on that ASP.NET webforms junk". Ok I'm done complaining for now. Posts in the forseeable future will be about happy things like ASP.NET MVC, Azure, and jQuery.

Most recently I've been working with the ASP.NET MVC framework and I have to say, wow. What a relief. It reminds me of doing web programming when I actually wrote simple Html code for my first web site. It's not really the MVC pattern per-se that attracts me. The joy comes from not being coupled to the desires of the ASP.NET framework developers whims. I can write javascript, html, and css. I can write server side code. And guess what, it's not necessarily coupled! Maybe in 8 years I'll be singing a different tune. But for now, I'm happy again.

Edit: I posted a [follow up](/blog/aspnet-mvc-sucks-and-so-does-jquery-and).
