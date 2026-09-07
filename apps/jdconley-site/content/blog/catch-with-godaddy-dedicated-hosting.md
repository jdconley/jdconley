---
title: The Catch with GoDaddy Dedicated Hosting
date: 2006-09-29T11:40:00.000-07:00
slug: catch-with-godaddy-dedicated-hosting
description: I'm not known to get easily frustrated or publicly rant about something, but here goes. The public web site and soapbox.net IM service for Coversant is hosted with GoDaddy…
tags:
  - random
draft: false
updated: 2011-07-21T23:52:43.519-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-4142246971923325819
originalUrl: http://blog.jdconley.com/2006/09/catch-with-godaddy-dedicated-hosting.html
ogImage: /blog-assets/og/catch-with-godaddy-dedicated-hosting-v1.jpg
ogImageAlt: "THE HOSTING TRAP. Money drains from a hosting server caught in a trap. — JD Conley."
---

I'm not known to get easily frustrated or publicly rant about something, but here goes. The public web site and soapbox.net IM service for Coversant is hosted with [GoDaddy](http://www.godaddy.com/) using their [dedicated server](https://www.godaddy.com/gdshop/hosting/dedicated.asp?se=%2B&ci=722&display=dedicated) plans. This makes things real easy for us. We don't have to manage hardware somewhere in a colo. We get an ftp site for backups. And most of all we get the convenience and control of a dedicated system. It's also very reasonably priced. Ah, but there's always a catch.

Some time near the end of last month our daily and hourly SQL Server backups went on a rampage. The hourly transaction log backup we have scheduled was stuck in a loop so it never reset itself. We were uploading the entire transaction log for the month every hour. The end result was a constant stream of uploading to our FTP backup site, which is hosted by GoDaddy as well. Oh, I should mention the FTP backup is a service we pay for monthly in addition to any dedicated server plan. Here comes the fun part. The bandwidth used to connect to our FTP backup site is charged at the normal rate as if you were serving up web pages to customers. If you go over your monthly allotment you get charged the burst bandwidth rate of $1.99/1000MB. Last month we went over 661 times, or roughly 661GB. You can do the multiplication there. I should mention a nice customer support rep discounted it 50% for us. I'd really hate to have his job. . .

While this isn't that much money in the scheme of things, it is really freaking annoying. It would have been nice to get a phone call letting us know the first time we went over, not when we got our monthly statement. And why do we have to pay for bandwidth to a service we pay for that's hosted by our hosting provider and is very likely even located in the same data center. Aaargh!

So, in conclusion, we're researching what needs to be done to move to a local colo or perhaps another, slightly more expensive but not so unreasonable, dedicated hosting provider. Oh, we're still sorting out what caused the SQL backup issue.
