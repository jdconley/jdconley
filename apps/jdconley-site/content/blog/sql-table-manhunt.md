---
title: A SQL Table Manhunt
date: 2008-03-19T14:54:00.000-07:00
slug: sql-table-manhunt
description: As I mentioned in my last post I recently took on the exciting new position of Chief Software Architect at Hive7, Inc. We're building all kinds of great stuff. Our most popular…
tags:
  - sql
  - tuning
draft: false
updated: 2011-07-23T05:02:37.969-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-6275555993787182064
originalUrl: http://blog.jdconley.com/2008/03/sql-table-manhunt.html
ogImage: /blog-assets/og/sql-table-manhunt-v1.jpg
ogImageAlt: "A magnifying glass searches a missing-table notice. — JD Conley."
---

As I mentioned in my last post I recently took on the exciting new position of Chief Software Architect at [Hive7, Inc.](http://www.hive7.com/) We're building all kinds of great stuff. Our most popular game [Knighthood](http://apps.facebook.com/knighthood) has over a million registered users and over 100,000 daily actives. This game is growing quickly. Over 125,000 people added the game two weeks ago, and over 150,000 added it in the last week. The game came into existence in December.

This massive growth leads to some exciting scalability challenges. I'll be spending a lot of time talking about that in the future. Today, is a simple tidbit related to databases. Our current performance bottleneck is with database write I/O. We have enough memory in the systems and a caching layer, so the disks barely need to read. Tracking this down is a whole other post, but it's fairly simple. Once we knew we were write I/O limited we set out to find out why.

The original DB physical layout started out pretty simple. There was one File for data, one for logs. In the next 3 or 4 revisions more and more files were created. Why? Well, so we could run this nifty little query and find out *which* of our db tables/indexes/etc were causing the write bottlenecks:  

```sql
select
  db.name as DbName,
  f.name as FileName,
  f.physical_name as FilePhysicalName,
  vf.TimeStamp,
  vf.NumberReads,
  vf.BytesRead,
  vf.IoStallReadMS,
  vf.NumberWrites,
  vf.BytesWritten,
  vf.IoStallWriteMS,
  vf.BytesOnDisk
from fn_virtualfilestats(-1,-1) vf
  inner join sys.databases db on db.database_id = vf.DbId
  inner join sys.database_files f on f.file_id = vf.FileId
order by vf.NumberWrites desc
```

If you have physically separated your various database tables and indexes into different files, the output from this function will give you all kinds of useful information about which ones are most accessed, and which put the most strain on your I/O subsystem. Optimizing it, of course, is up to you. :)

If you enjoy big scale, fast moving, tough problems, we're hiring for a [Lead Web Designer](http://www.linkedin.com/jobs?viewJob=&jobId=493724&fromSearch=0&sik=1205963575638) and [Brilliant Lead DBA/Sysadmin](http://www.linkedin.com/jobs?viewJob=&jobId=493713&fromSearch=1&sik=1205963575638) and [Web Games Developer (.NET)!](http://www.linkedin.com/jobs?viewJob=&jobId=493706&fromSearch=2&sik=1205963575638)
