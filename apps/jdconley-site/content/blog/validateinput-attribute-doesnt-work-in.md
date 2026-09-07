---
title: ValidateInput Attribute Doesn't Work in ASP.NET 4.0
date: 2010-04-19T13:28:00.000-07:00
slug: validateinput-attribute-doesnt-work-in
description: Today I decided to upgrade some of our new projects (top secret, shhh) to Visual Studio 2010, ASP.NET 4.0, and ASP.NET MVC 2.0. There are about a million new features that look…
tags:
  - .net
  - asp.net
draft: false
updated: 2011-07-23T10:59:08.795-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-7924513367780140302
originalUrl: http://blog.jdconley.com/2010/04/validateinput-attribute-doesnt-work-in.html
ogImage: /blog-assets/og/validateinput-attribute-doesnt-work-in-v1.jpg
ogImageAlt: "A cracked ASP.NET 4.0 shield and a broken chain. — JD Conley."
---

Today I decided to upgrade some of our new projects (top secret, shhh) to [Visual Studio 2010](http://weblogs.asp.net/scottgu/archive/2010/04/12/visual-studio-2010-and-net-4-released.aspx), ASP.NET 4.0, and [ASP.NET MVC 2.0](http://weblogs.asp.net/scottgu/archive/2010/03/11/asp-net-mvc-2-released.aspx). There are about a million new features that look quite useful in all of these new releases. We have some fairly complex projects so I was excepting a few speed bumps, but, not this one.

It seems with every new release Microsoft adds annoying (isn't security always?) features to protect us from ourselves. Way back when they added the idea of [Request Validation](http://www.asp.net/learn/whitepapers/request-validation/). If ASP.NET thinks a user is posting something "bad" to the server (i.e. things that lead to XSS attacks), the request is denied. This is cool except when you want to, say, allow the user to input HTML or have a web service that takes XML as a parameter in a form, or use a ":" in your URL. In ASP.NET web forms you work around this feature by turning it off at the page level or globally in your web.config through the validateRequest option. In MVC you use the ValidateInput attribute on your action.

**This is really really important:**  

In .NET 2.0-3.5 the runtime only validated requests sent to .aspx pages, but [that has now changed](http://www.asp.net/learn/whitepapers/aspnet4/breaking-changes/#0.1__Toc256770147) and **any** request will be validated, even it is sent to a custom handler, or an MVC application.

ASP.NET MVC implements its own request validation, which is also on by default. To turn it off you simply slap a ValidateInput(false) attribute on your controller action. This is fine and dandy, except with the latest ASP.NET 4.0 changes, [it no longer works](http://connectppe.microsoft.com/VisualStudio/feedback/details/543069/validateinput-false-not-working) and an exception is thrown. So you might see an error like:

**A potentially dangerous Request.Form value was detected from the client**  or **A potentially dangerous Request.Path value was detected from the client**  

The workaround is pretty easy. Just follow the instructions on the [ASP.NET 4.0 Breaking Changes](http://www.asp.net/learn/whitepapers/aspnet4/breaking-changes/#0.1__Toc256770147) page. Stick this XML in your web.config to revert to the behavior as it were in ASP.NET 2.0-3.5. This will put request validation back in the hands of the ASP.NET MVC engine and your ValidateInput attribute will start working again.
