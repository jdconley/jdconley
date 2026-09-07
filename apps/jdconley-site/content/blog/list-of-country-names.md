---
title: List of Country Names
date: 2007-09-05T11:22:00.000-07:00
slug: list-of-country-names
description: Today I had to build yet-another-list of country names for a web site drop down form. I did some Google searching for about 10 minutes and didn't find anything that was free. I…
tags:
  - .net
  - random
  - utility
draft: false
updated: 2011-07-22T01:27:05.736-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-554861436859257643
originalUrl: http://blog.jdconley.com/2007/09/list-of-country-names.html
ogImage: /blog-assets/og/list-of-country-names-v1.jpg
ogImageAlt: "A globe is assembled from colorful national flags. — JD Conley."
---

Today I had to build yet-another-list of country names for a web site drop down form. I did some Google searching for about 10 minutes and didn't find anything that was free. I dunno, maybe I'm just blind... I did, however, find a list on Wikipedia. So, I decided I'd pull it down and parse it up. Here's the code:  

```csharp
static void Main(string[] args)
{
   string fullpage;
   using (WebClient wc = new WebClient())
   {
       byte[] pageBytes = wc.DownloadData(
           @"http://en.wikipedia.org/wiki/List_of_country_name_etymologies");
       string encoding = wc.ResponseHeaders["Content-Encoding"];
       fullpage = wc.Encoding.GetString(pageBytes);
   }

   MatchCollection countryMatches = Regex.Matches(fullpage,
       @"<p><b><a href="". ""\s*title="". "">(?<country>. )</a></b>:</p>",
       RegexOptions.Multiline);

   foreach (Match m in countryMatches)
   {
       Group g = m.Groups["country"];
       Console.WriteLine(g.Value);
   }

   Console.WriteLine("done");
   Console.ReadLine();
}
```

As you can see it's dirt simple. Just a WebClient to download the page (holy crap it's big) and a simple Regex call. Presto! A list of countries I'll be dropping into a database so we can edit it later.
