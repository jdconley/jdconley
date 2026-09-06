---
title: Concurrency. It's like doing the dishes
date: 2009-01-20T10:22:00.000-08:00
slug: concurrency-its-like-doing-dishes
description: Since we moved to Palo Alto I've had the luxury of walking to work every day. Usually that's where I do my deep thinking. By the time I cruise by the Whole Foods it's really…
tags:
  - random
draft: false
updated: 2011-07-23T09:21:45.657-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-3845481521114917521
originalUrl: http://blog.jdconley.com/2009/01/concurrency-its-like-doing-dishes.html
---

Since we moved to Palo Alto I've had the luxury of walking to work every day. Usually that's where I do my deep thinking. By the time I cruise by the Whole Foods it's really easy to ignore the activist-of-the-day petitioning something about global warming. But yesterday was different.

My walks to and from work were pretty normal. When I got home I decided to clean up a bit around the house, was doing the dishes, and had an odd moment of clarity. I threw down the sponge and ran over to my laptop to jot this down.

Usually I'm at a loss for analogy when explaining how concurrency works to a developer who has never had to deal with it before. So I throw out all kinds of highly technical terms and their eyes glaze over. But you know, it's actually really simple.

<a id="BLOGGER_PHOTO_ID_5632583287208177266"></a>

[![](/blog-assets/imported/e1a7ffa8f735273bd4df49bc.jpg)](/blog-assets/imported/6d6ec83c329ac21f37a87801.jpg)Managing concurrency is like doing the dishes. You can hand wash everything and be sure it gets cleaned perfectly every time or you can stick the dishes straight into the dish washer and take your chances. Most of the time everything will come out clean, but every couple loads you'll get a dish you need to wash again. Going straight into the dishwasher is way faster, and you can even do more than one dish at a time (assuming you have two hands).  

If you want the technical description, I leave that as an excercise to the reader. Here's a [Wikipedia](http://en.wikipedia.org/wiki/Optimistic_concurrency_control) article. And another over at [Microsoft](http://msdn.microsoft.com/en-us/library/aa0416cz%28VS.71%29.aspx) that's specific to database concurrency. See, told ya it's like doing the dishes.
