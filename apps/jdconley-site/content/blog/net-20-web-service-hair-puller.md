---
title: .net 2.0 web service hair puller
date: 2006-05-12T15:02:00.001-07:00
slug: net-20-web-service-hair-puller
description: Every couple of weeks I spend four hours doing something that should take five minutes. It just happened, and now I feel compelled to take another few minutes and explain so it…
tags:
  - .net
  - asp.net
draft: false
updated: 2011-07-27T04:34:08.821-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-2083274888998170874
originalUrl: http://blog.jdconley.com/2006/05/net-20-web-service-hair-puller.html
---

Every couple of weeks I spend four hours doing something that should take five minutes. It just happened, and now I feel compelled to take another few minutes and explain so it doesn't happen to you. Not only did I waste my time, but the time of another one of our developers. What might waste four hours, you say?

We recently migrated our entire web site to .NET 2.0 and a new portal. Since we were building a new web site anyway we thought, "What the heck, let's re-factor the licensing subsystem. The database was hacked together over three years and we don't want no stinkin' .NET 1.1 code running on our shiny new site!" Well, this didn't turn out exactly as planned.

The SoapBox licensing web service is quite simple. There's a single method called "Activate" that takes in a unique hash of some information on the user's computer (so we can track duplicate usages) and the serial number. It returns an XML document containing all the license information, signed with our private key, that the SoapBox Server then validates with the embedded public key. That's it.

We get a call from a customer today saying they can't enter a license key into the MMC. They're getting a wonderfully descriptive "Object reference not set to an instance of an object" error. We immediately kick into debug mode. Afterall, if a potential customer can't enter in our trial key they're going to get upset and likely just give up on using it all together.

After a little debugging we found the web service wasn't returning the license xml document like it should have been. This was \_very\_ weird, considering our [licensing page](http://www.coversant.com/licenses) uses the same web service as our MMC and it was working just fine with the exact same parameters. Much head to wall interaction took place and we had another breakthrough, the web method wasn't receiving any data from the parameters. The serial number was null!

Now we bust out the packet sniffer. After careful examination, a new mini test application to call the service, and three Diet Cokes, we found the problem.

Apparently, during the migration and re-factoring process, we missed a character in a copy/paste operation. That's right, the trailing "/" on the namespace declaration for the web service.

This in itself is not such a suprise. However, the suprise is that .NET did not throw a "There is no matching web method you dummy" exception. No, it didn't throw an exception at all. Instead it called the correct web method, but did not pass in any of the parameters. Oiy.

It turns out our [licensing page](http://www.coversant.com/licenses) was working because the web reference was created after the new licensing service was put in place. It all makes sense now... Time for a beer.
