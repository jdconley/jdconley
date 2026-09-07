---
title: Stringbuildify!
date: 2007-09-27T14:48:00.000-07:00
slug: stringbuildify
description: A task that I often end up doing when coding an actual web site (i.e. not writing a sample or some such) is adding client script to a page/control in codebehind using the…
tags:
  - .net
  - asp.net
  - utility
draft: false
updated: 2011-07-22T01:54:08.800-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-6881000841619034399
originalUrl: http://blog.jdconley.com/2007/09/stringbuildify.html
ogImage: /blog-assets/og/stringbuildify-v1.jpg
ogImageAlt: "A crane stacks code strings like construction blocks. — JD Conley."
---

A task that I often end up doing when coding an actual web site (i.e. not writing a sample or some such) is adding client script to a page/control in codebehind using the [ClientScriptManager](http://msdn2.microsoft.com/en-us/library/ms178207.aspx). Let's say you've got the following alert script you want to add to the page so you can use it in a control:  

```csharp
function doAlert()
{
 alert('welcome!');
}
```

Well, there are now a number of ways to get this into your page, but the quickest, in-line way is to use the ClientScriptManager. Like so:  

```csharp
if (!Page.ClientScript.IsClientScriptBlockRegistered(
   this.GetType(), "alert"))
{
   System.Text.StringBuilder sb = new System.Text.StringBuilder();
   sb.Append("function doAlert() {");
   sb.Append("alert ('welcome!'); }");
   Page.ClientScript.RegisterClientScriptBlock(
       this.GetType(), "alert", sb.ToString(), true);
}
```

Ok, so that's a bit contrived. You're not going to use a StringBuilder for something that simple. But, with a more complicated script you probably would, especially if the script will be different depending on the state of the page.

I had a little Winforms utility sitting around I've been using for a while to automate that process for me, and I decided to put it up on the web. So, here you go: [http://jdconley.com/stringbuildify](http://jdconley.com/stringbuildify). You feed the engine a multi-line string (like a script) and it gives you back a StringBuilder with everything properly escaped and such. The code's a bit of a mess at this second, that's why I didn't post it. Enjoy!
