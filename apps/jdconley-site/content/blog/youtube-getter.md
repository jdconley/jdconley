---
title: YouTube Getter
date: 2007-04-05T18:13:00.000-07:00
slug: youtube-getter
description: Usually everything I post here is serious business. Well, not today! Today, we're going to look at how to get the raw video stream for YouTube videos. Why, you ask? Well,…
tags:
  - .net
  - random
draft: false
updated: 2011-07-22T00:30:30.866-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-6469503447914068558
originalUrl: http://blog.jdconley.com/2007/04/youtube-getter.html
---

Usually everything I post here is serious business. Well, not today! Today, we're going to look at how to get the raw video stream for YouTube videos. Why, you ask? Well, curiosity, mostly. :) Some people like sports, I like problem solving. There are a number of browser plug-ins and web sites that do this already, but hey, it was still fun.

YouTube offers a [bit of an API](http://www.youtube.com/dev) for developers to mess with. It's mostly for grabbing sets of videos and preview images and such. They also let you embed their player in your pages. That's awfully nice of them, but what if I don't like their player? What if I want a sexier player? Well, if you've got something that can play/convert Flash Video (FLV's), here's the full C# code to grab the FLV URI (pieces dissected below):

```csharp
using System;
using System.Collections.Generic;
using System.Text;
using System.Net;
using System.IO;
using System.Web;
using System.Collections.Specialized;

namespace JDFun
{
  public static class YouTubeGetter
  {
      public static Uri GetFlvUri(string viewUri)
      {
          return GetFlvUri(new Uri(viewUri));
      }

      public static Uri GetWatchUri(Uri flvUri)
      {
          NameValueCollection qry = HttpUtility.ParseQueryString(flvUri.Query);

          string videoID = qry["video_id"];
          string watchUri = string.Concat("http://www.youtube.com/watch?v=", HttpUtility.UrlEncode(videoID));

          return new Uri(watchUri);
      }

      public static Uri GetImageUri(Uri flvUri)
      {
          NameValueCollection qry = HttpUtility.ParseQueryString(flvUri.Query);

          string imageUri = qry["iurl"];

          return new Uri(imageUri);
      }

      public static Uri GetFlvUri(Uri viewUri)
      {
          // so either i've got the embed link or the watch link

          //watch link: http://www.youtube.com/watch?v=up-RX_YN7yA
          //embed link: http://www.youtube.com/v/up-RX_YN7yA

          string toQuery = null;

          NameValueCollection queryString = HttpUtility.ParseQueryString(viewUri.Query);

          string videoId = queryString["v"];

          if (null != videoId)
          {
              toQuery = string.Concat("http://www.youtube.com/v/", videoId);
          }
          else
          {
              toQuery = viewUri.ToString();
          }

          if (null == toQuery)
              throw new InvalidOperationException("Not a valid YouTube Uri.");

          Uri queryUri = new Uri(toQuery);
          //ok we have the uri to query, now go there and get redirected.
          HttpWebRequest req = (HttpWebRequest)HttpWebRequest.Create(queryUri);
          req.AllowAutoRedirect = true;

          // make them think we're coming from a direct link
          req.Referer = string.Empty;

          // firefox rules!
          req.UserAgent = "Mozilla/5.0 (Windows; U; Windows NT 5.1; en-GB; rv:1.8.1.3) Gecko/20070309 Firefox/2.0.0.3";
          using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
          {
              string absoluteRedirectLocation = resp.ResponseUri.AbsoluteUri;

              //replace the swf with the get_video request
              if (!absoluteRedirectLocation.Contains("/p.swf?"))
                  throw new InvalidOperationException("Unrecognized Uri. YouTube changed something.");

              absoluteRedirectLocation = absoluteRedirectLocation.Replace("/p.swf?", "/get_video?");

              //return the absolute URI for this request
              return new Uri(absoluteRedirectLocation);
          }
      }
  }
}
```

Ok, wow, that's a lot bigger than I remember. Here's the basic idea.  

1.  Get the video ID from the given URI. The URI could be the "watch" URI, or it could be the URI from the embed code they give you.
2.  Load the video directly based on the video ID, at the embed URI.
3.  Make a HTTP Request and get redirected to another URI, (which happens to contain the Image URI, and a special token "t").
4.  Know the magic URI where they keep the video streams ([I cheated](http://www.methodshop.com/gadgets/tutorials/youtuberip/)) and use it.

Now wasn't that fun? :)
