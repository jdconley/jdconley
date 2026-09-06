---
title: Clean Up a String for a Url
date: 2007-08-28T09:54:00.000-07:00
slug: clean-up-string-for-url
description: This is a quickie. Yesterday I was doing some Url rewriting for a project and accepting user input for said Url. It's basically like this blog system. I can specify the…
tags:
  - .net
  - asp.net
draft: false
updated: 2011-07-22T01:16:52.286-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-3636100427201199919
originalUrl: http://blog.jdconley.com/2007/08/clean-up-string-for-url.html
---

This is a quickie. Yesterday I was doing some Url rewriting for a project and accepting user input for said Url. It's basically like this blog system. I can specify the friendly url of each post. So, I wrote a little extension method to clean up a string and make it URL friendly. Yes, you can just escape everything someone enters, but it's much friendlier to just make it work. Be lenient in what you accept! Here it is:  

```
public static string ToUrlString(this string s){   if (null == s)       throw new NullReferenceException();     string tmp = Regex.Replace(s.ToLower(), @"\s", @"-");   tmp = Regex.Replace(tmp, @"[^-_\.\w]", @"");   return tmp;}
```

This simply replaces all whitespace with a "-", and all characters that are not "-", "\_", ".", or Word Characters with an empty string.

In the end, if your input is "this is a @#)(\*&\*@$^ crock!" you'll get "this-is-a--crock". As a guy who was, at one time, scared of regular expressions I hope this helps someone.
