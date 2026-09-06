---
title: Command Line VS 2008 Project Upgrade Tool
date: 2007-11-21T10:52:00.000-08:00
slug: command-line-vs-2008-project-upgrade
description: I've converted a few projects to 2008 RTM now (from 2003 to 2005 to 2008 beta projects), and I wish John Robbins had published this blog earlier. For those of us that don't…
tags:
  - .net
  - utility
draft: false
updated: 2011-07-27T01:53:01.094-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-2481574914174471447
originalUrl: http://blog.jdconley.com/2007/11/command-line-vs-2008-project-upgrade.html
---

I've converted a few projects to 2008 RTM now (from 2003 to 2005 to 2008 beta projects), and I wish John Robbins had published [this blog](http://www.wintellect.com/cs/blogs/jrobbins/archive/2007/11/21/easily-converting-to-visual-studio-2008.aspx) earlier. For those of us that don't like clicking in things he presents a built-in command line switch on devenv to upgrade solutions. I decided to take it to the next level.

I built a small [command line application](https://docs.google.com/viewer?a=v&pid=explorer&chrome=true&srcid=0B7Ew2HKAAmajMTMyZjA1MjAtMWJhNi00NjMwLWI0ZWYtYWNiNDRmYjQzYWNl&hl=en_US) that recursively scans a directory for solution files and prompts you to upgrade all of them. I tried it on a bunch of my solutions and it seemed to work pretty well.

To use the tool you just run it from the command line and specify the directory where you want to start searching. Or you can specify no arguments to search the current working directory.  

```
    upgrader.exe c:\root\of\your\tree
```

or

```
    upgrader.exe
```

That's it! Quick and easy. The output will look something like:

```
    Searching for solutions under c:\svn\websites Upgrade "c:\svn\websites\mysite\my.sln"? [Y/N] n Skipped "c:\svn\websites\mysite\my.sln" Upgrade "c:\svn\websites\broken\site.sln"? [Y/N] y Converting "c:\svn\websites\broken\site.sln" Unable to convert solution "c:\svn\websites\broken\site.sln" Check out the errors in the UpgradeLog.xml file. Upgrade "c:\svn\websites\ok\site.sln"? [Y/N] y Converting "c:\svn\websites\ok\site.sln" Converted "c:\svn\websites\ok\site.sln"
```

Well, that's my simple app that took just a few minutes to write and saved the pain of many clicks through a wizard. [Download it here](http://jdconley.com/upgrader2008.zip).
