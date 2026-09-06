---
title: ASP.NET MVC sucks and so does jQuery and PHP
date: 2009-01-16T22:46:00.000-08:00
slug: aspnet-mvc-sucks-and-so-does-jquery-and
description: Apparently, saying something sucks gets you a lot of hits. I think I'll use this tactic more often. My post on 10 Reasons ASP.NET Webforms Suck has been quite the talk in our…
tags:
  - asp.net
draft: false
updated: 2011-07-23T09:15:59.616-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-7640307391466323137
originalUrl: http://blog.jdconley.com/2009/01/aspnet-mvc-sucks-and-so-does-jquery-and.html
---

Apparently, saying something sucks gets you a lot of hits. I think I'll use this tactic more often. My post on [10 Reasons ASP.NET Webforms Suck](/blog/10-reasons-aspnet-webforms-suck) has been quite the talk in our tiny little .NET blog world this week. Who knew you all had such strong opinions on the matter!

**ASP.NET doesn't *completely* suck**  

Saying something sucks doesn't mean it isn't good enough, or isn't the best option. In my mind everything sucks. My cell phone sucks, my laptop sucks, my operating system sucks, my car sucks. They all need improvements. They are all far from perfect. It is this mindset that drives me to build better software. If you can't see the flaws around you how can you improve on them? ASP.NET 4.0 didn't come around for fun. It came around because 3.5 sucks and needs improvement, and so on, and so forth.

Quite a few of you wrote some great rebuttals. Some were utter nonsense, but hey, this is the internet. That's to be expected. I'd like to talk about my favorite comments:

> "It's obviously not a perfect design, but, it did it's job." – Robert Sweeney  
>   
>   

Indeed, my thoughts exactly. It did its job. The internet has moved along really fast. Webforms are lagging behind a bit. Sure, it's still perfect for RAD business type applications. But build a web game on it, or a "Web 2.0" web site, or other consumer facing web product. The level of customization you end up doing to work within the bounds of the framework's abstraction starts to become silly.

> "I agree that is does suck now." ... "over time, better ways to do things are created and naturally, the old ways get laid to rest" – shaun  
>   
>   

Yeah, this is the nature of things. The technology will be around forever, but the development world will pass it by. We like shiny new things.

> "Anyway, this 'hidding how HTTP works' philosophie that ASP.NET follows in every single corner of the framework is the real problem. Django, Ruby on Rails, and PHP doesn't try to hide the fact that you are building a website/page/app and help you in the process of coding with helpers, decorators or simple functions." – Angel  
>   
>   

YES! HTTP, HTML, CSS, Javascript. These are the technologies we work with on the web. They're simple. Learn them, love them, embrace them. It'll also make your skills a lot more transferable should you ever be looking for work.

> "Newb" – rabbit  
>   

pwned!

> "loooks like newly migrated from php/java." – web spider  
>   
>   

Did you read my post? I have been using ASP.NET since it was in beta. I live and breathe this stuff and use it every day. I'm simply pointing out the flaws I see.

> "I've used PHP, Drupal, Rails and even FastCGI in the bad old early days and find I'm always coming back ASP.Net. Security, data abstraction layers, controls, validation, scalability, application recycling, caching, session management and great development/debugging environments are just to hard to pass up." – Mike  

  

Yeah, I love ASP.NET too. I don't use anything else on a serious basis. You definitely mentioned my favorite parts of it, especially the last one.

> "This model has been created back in what 1999/ 2000 when MS started working on .NET 1.0 (was released in 2002). So we are talking the model/architecture is almost a decade old, way before the Web 2.0/Ajax days." – Bart Czernicki  
>   

Yes! It's old (mature as some say)! Is it at all possible there is a better way now?

> Chris Vanderheyden said [a lot](/blog/10-reasons-aspnet-webforms-suck#128)  
>   
> "Honestly, after more than 8 years of professional experience: YES, your SHOULD be out of that highschool mentality. (Look my editor can do only 2 colors i am so L33T...) "  
>   
> "I am a developer, i write logic, not translations. I WANT my HTML abstracted. I don't want to write zeroes and ones down to the NIC now do i. "  
>   

Since you likely know me only from my 'it sucks' post, you're going to find this shocking. I agree with most of the justifications you made (except the ones I listed above). My biggest beef is with your comment on my #1. You obviously have no sense of humor. ;) And, why wouldn't you want to write html? It's a simple human readable markup language, not binary networking protocols. XHTML+CSS is abstraction at its best. In fact it's usually just as simple as the abstractions provided by ASP.NET controls. I mean, really, can you actually point at one of your ASP.NET apps that would run outside of the context of your modern web browser? Something other than html 4.0 or whatever you're using? You have to learn a lot about the quirks of ASP.NET to get things done well. Why not learn the quirks in html/css/js? Oh wait, you *do* have to do that too. The leaky abstraction abounds.

> "I only have 1 reason... Leaky abstraction over HTTP that introduces instead of removing complexity. Every other reason is a derivative or effect of this one reason" – Greg Young  
>   

Thanks Greg. You always have a nice way of distilling things down. But that wouldn't make nearly as fun of a blog post!

> "I think that JD Conley is just sarcastic. Actually he loves .NET" - br\_other  
>   

No, I'm not being sarcastic. Perhaps dramatic. Yes, I love .NET. But it's not without its flaws.

> "sos un boludo" – Sebastian  
>   

This is cooler than the "newb" comment! Thrasing in a foreign language!

> "You don't have to use &lt;%= ClientID%&gt; stuff at all There is a much better way. I claim ASP.NET webforms has the "best" integration with client side DOM. You think I am kidding ? Have you ever heard IScriptControl ? I guess you didn't" – onur  
>   

Indeed I have heard of IScriptControl and use it quite a bit. It's an interesting and often useful abstraction. Though I always laugh at myself since to use it I add some C# code to generate some js code to call some other js code I could have just called in the first place if I were working in the markup.

And finally, we have the people who decided to write a full rebuttal on their slice of the net. Cool. Thanks for the link backs! Hope you enjoyed my comments.  

-   [ASP.NET WebForms DO NOT SUCK](http://azamsharp.com/Posts/161_ASP_NET_WebForms_DO_NOT_SUCK_.aspx) – Mohammad Azam
-   [Mythbusters – Busting the myths about WebControls](http://ra-ajax.org/mythbusters-busting-the-myths-about-webcontrols.blog) – Thomas Hansen
-   [10 Reasons ASP.NET Webforms (Still) Rock](http://leedumond.com/blog/10-reasons-asp-net-webforms-still-rock/) – Lee Dumond

[Mike Pope](http://mikepope.com/blog/AddComment.aspx?blogid=2092) also posted an interesting commentary on the matter. Us silly kids and our toys! Aren't we allowed to change our minds, backpedal, or get excited by new technology?

Happy hacking!
