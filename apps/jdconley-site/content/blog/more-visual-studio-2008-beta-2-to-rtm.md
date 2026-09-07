---
title: More Visual Studio 2008 Beta 2 to RTM Upgrade Gotchas
date: 2007-11-20T16:05:00.000-08:00
slug: more-visual-studio-2008-beta-2-to-rtm
description: Yesterday I posted on the first thing I ran into. Today I ported another project and hit a couple more snags. Linq to Sql Unicode Byte Header Linq to Sql Add/Remove Method…
tags:
  - .net
  - asp.net
  - linq
  - random
draft: false
updated: 2011-07-22T02:29:10.095-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-2140608852551935922
originalUrl: http://blog.jdconley.com/2007/11/more-visual-studio-2008-beta-2-to-rtm.html
ogImage: /blog-assets/og/more-visual-studio-2008-beta-2-to-rtm-v1.jpg
ogImageAlt: "Visual Studio release boxes stand beside a hidden trap. — JD Conley."
---

Yesterday I posted on the first thing I ran into. Today I ported another project and hit a couple more snags.  

1.  Linq to Sql Unicode Byte Header
2.  Linq to Sql Add/Remove Method Changes
3.  ASP.NET Listview Changed from itemContainer to itemPlaceholder

**Linq to Sql Unicode Byte Header**  

The xml document that makes up the Linq to Sql dbml file is declared to be in unicode format. For some reason my file was not saved with the unicode byte header. Apparently this didn't matter to the beta 2 framework, but in RTM release the project failed to build and double clicking on the designer caused the error "There is no Unicode byte order mark. Cannot switch to Unicode."

When the error occurs it opens the dbml file as XML. So, I just moved my cursor to the first position. Hit *enter* then *backspace* and saved the file. Visual Studio 2008 RTM put the Unicode Byte Header in for me and everything was kosher.

**Linq to Sql Add/Remove Method Changes**  

The Linq to Sql Table&lt;T&gt; and ITable has changed the signature for adding and removing entities. Instead of the *Add* and *Remove* methods there are now *InsertOnSubmit* and *DeleteOnSubmit* . This makes sense, as it was not obvious what Add and Remove would do. These new names make a lot of sense to me and were outlined in a [msdn forum posting](http://forums.microsoft.com/MSDN/ShowPost.aspx?PostID=2060651&SiteID=1) a few months ago.

**ASP.NET Listview Changed from itemContainer to itemPlaceholder**  

It looks like a few bloggers already beat me to this one, but the behavior of the itemContainer in an ASP.NET Listview has changed and the new control ID you have to use is called itemPlaceholder. Daniel Moth has a good description [on his blog here](http://www.danielmoth.com/Blog/2007/11/item-placeholder-must-be-specified-on.html). The annoying thing about this change for me was that it showed up at runtime, and not compile time. Though the runtime message is pretty descriptive: System.InvalidOperationException: An item placeholder must be specified on ListView 'ListView1'. Specify an item placeholder by setting a control's ID property to "itemPlaceholder". The item placeholder control must also specify runat="server".

**Wrap Up**  

Well, that's all I've run into so far. I'm sure I'll find more issues as I wrote quite a bit of (production) code under 2008 Beta 2. I'll make sure to summarize any more findings here.
