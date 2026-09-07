---
title: ASP.NET Centric Extensions
date: 2007-09-19T16:05:00.000-07:00
slug: aspnet-centric-extensions
description: I've been loving the new Extension Methods in Orcas. If you haven't had the pleasure of working with them, well, you're really missing out. They are utility at its finest. Here…
tags:
  - .net
  - asp.net
  - utility
draft: false
updated: 2011-07-22T01:41:22.982-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-2009462146535283982
originalUrl: http://blog.jdconley.com/2007/09/aspnet-centric-extensions.html
ogImage: /blog-assets/og/aspnet-centric-extensions-v1.jpg
ogImageAlt: "A wrench connects a .NET hub to useful extension pieces. — JD Conley."
---

I've been loving the new [Extension Methods](http://weblogs.asp.net/scottgu/archive/2007/03/13/new-orcas-language-feature-extension-methods.aspx) in Orcas. If you haven't had the pleasure of working with them, well, you're really missing out. They are utility at its finest. Here is a list of my favorite extensions I've written thus far.

**URLEncode**  

Ok, I know this sounds stupid, but for some reason I really hate typing HttpUtility.UrlEncode(myString) all over the place so I wrote this extension.

```csharp
public static string UrlEncode(this string toEncode)
{
   return HttpUtility.UrlEncode(toEncode);
}
```

**ToHexString**  

For some reason my memory for .NET format strings really sucks. I blame Intellisense. I *always* forget how to hex encode integers. In case you're wondering, this is quite useful for giving users short strings that can be very unique and directly represent a primary key in a database. Hex is generally friendlier on the eyes than a number alone.  

```csharp
public static string ToHexString(this int val)
{
   return string.Format("{0:x2}", val);
}
```

  
**FromHexString**  

Likewise, when you have a hex encoded integer, it's quite useful to get that value back out. I have no idea why, but I forget this neat trick all the time and constantly have to look it up. No more!  

```csharp
public static int FromHexString(this string val)
{
   return Convert.ToInt32(val, 16);
}
```

**ToUrlString**  

I [posted this](/blog/clean-up-string-for-url) a few weeks ago. I love it...

**GetRootPath**  

This is something I have struggled with since the early days of ASP. There has never been a straightforward way to get the root of the URI of a request. This method extends HttpRequest and gives you the scheme (http/https) and host/port of the request. So, provided a request to http://jdconley.com/blog/ this extension would return http://jdconley.com

```csharp
public static string GetRootPath(this HttpRequest r)
{
   string hostPort = r.Url.Authority;
   string scheme = r.Url.Scheme;

   string path = string.Concat(scheme, @"://", hostPort);

   return path;
}
```

**GetConfigBasedPath**  

A common task in a web app is to send out an email for one reason or another. Maybe you want to send someone a link to a download, confirm their registration, or bug them when they haven't visited your site in a while. This method takes an application relative path stored in your App.Config appSettings and translates it into a fully qualified URL based on the current executing page. Your configuration might look like:  

```csharp
<add key="EventDetailsFormatString" value="~/events/{0}.aspx"/>
```

You could then use the following extension to turn that relative URL into a fully qualified based on the current page that is executing. It relies on the GetRootPath method above.  

```csharp
public static string GetConfigBasedPath(
   this Page p,
   string configKey,
   params object[] formatArgs)
{
   if (null == p)
       throw new ArgumentNullException("p");

   if (string.IsNullOrEmpty(configKey))
       throw new ArgumentNullException("configKey");

   string valFromConfig = ConfigurationManager.AppSettings.Get(configKey);

   if (null == valFromConfig)
       throw new ArgumentOutOfRangeException("configKey",
           configKey,
           "The specified key was not found in the configuration.");

   Uri rootUri = new Uri(p.Request.GetRootPath(), UriKind.Absolute);

   Uri relativeUri = new Uri(
       p.ResolveUrl(string.Format(valFromConfig, formatArgs)),
       UriKind.Relative);

   Uri fullUri = new Uri(rootUri, relativeUri);

   return fullUri.ToString();
}
```

**IsDescendentOrSelfSelected**  

In a Treeview you often want to see if a node or any of its children are selected to help determine how to display the tree. This is especially useful when using the Treeview for navigation.  

```csharp
public static bool IsDescendantOrSelfSelected(this TreeNode node)
{
   if (node.Selected)
   {
       return true;
   }
   else if (node.ChildNodes.Count > 0)
   {
       foreach (TreeNode n in node.ChildNodes)
       {
           if (IsDescendantOrSelfSelected(n))
               return true;
       }

       return false;
   }
   else     {         return false;
   }
}
```

**EnsureVisible**  

This one is quite simple. It just makes sure that the provided node is visible in the tree by making sure all of its parent nodes are expanded. This is a useful function for stateless Treeviews or synchronizing the same Treeview across multiple pages.  

```csharp
public static void EnsureVisible(this TreeNode node)
{
   if (null != node.Parent)
   {
       node.Parent.Expand();
       EnsureVisible(node.Parent);
   }
}
```

Well, that's it for now! I hope someone finds these as useful as I do.
