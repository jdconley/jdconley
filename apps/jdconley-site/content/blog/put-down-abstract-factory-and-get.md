---
title: Put down the abstract factory and get something done
date: 2009-01-26T12:58:00.000-08:00
slug: put-down-abstract-factory-and-get
description: It seems as a group, us programmers have our priorities screwed up. Programmers value clean, concise code. Code that requires no documentation. Code that perfectly uses design…
tags:
  - business
draft: false
updated: 2011-07-23T09:23:32.911-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-7314456103484989963
originalUrl: http://blog.jdconley.com/2009/01/put-down-abstract-factory-and-get.html
---

It seems as a group, us programmers have our priorities screwed up. Programmers value clean, concise code. Code that requires no documentation. Code that perfectly uses design patterns and best practices. Code that other programmers will look at and think "wow, I wish I was as l33t as this guy."

But, let's get real. That stuff *doesn't matter* .

Why do you write code? Well, chances are someone pays you to do it. Of course the best programmers also love what they do and do it for fun. But at the end of the day it's your profession. Maybe you're (un)lucky enough to be doing it for yourself in your own startup.

In the early years of a startup only one thing should matter to a programmer: shipping your product to meet your customers' needs. Everything else we do is simply a result of this, the humblest of goals. Without the product people want you have no revenue. Without the revenue you have no company. Without the company, well, you get the idea.

Startups are widely considered the purest form of a company. You exist to meet a perceived need with a pretty small scope. There aren't layers of management or TPS reports to get in the way of getting things done. The only barrier to getting something done is yourself. No excuses. It is in this environment where an engineer's need for perfection must be replaced with a hacker's passion to get things done, and get them done fast. Nothing else matters.

Maintainability isn't a factor. Best practices don't matter. Design patterns don't matter. All that matters is getting things done. Don't worry about scalability until you have to. Instantiate that object. Who cares about the factory. Skip the interface, and create a static class. Some day if you need the interface come back and *re-factor your code* . With the power of the IDE these days re-factoring is a lot less scary than it used to be.

This may sound short sighted, and it is. In fact, that's the point. Who knows if the company will even exist in a year to have anything to maintain. Projects change. You have to adapt. You will never know how your code will be used 5 years from now. Stop thinking about it. 5 years ago did you think you'd be integrating your \[random business application\] with this Facebook thing? I bet you've thought about it now. Not to mention, 5 years from now it's likely the entire programming paradigm will have changed. Were they thinking about AJAX when they designed ASP.NET? How about 3D graphics in desktop applications when the window message pump was developed? Such is life in our fast paced world. No amount of overly designed or perfectly formatted code will change it.

If you find yourself maintaining this horribly designed, hacked together legacy code from the early days of a company be thankful and bask in its glory. Without that spaghetti nightmare you wouldn't have that job. It was that short sighted thinking that was able to get something done and create a profitable product/company.

Of course, I'm not advocating you just toss all your code in a button's click event or anything that silly. Be smart, organize things well, but don't waste time overly designing code to be flexible. If you have to spend more than a couple hours sketching out your design, it's probably too complicated. Write some code. Re-factor it if you need to. You don't need a proper [RESTful architecture](http://en.wikipedia.org/wiki/Representational_State_Transfer), or a perfect [DDD](http://en.wikipedia.org/wiki/Domain-driven_design). Your application isn't going to change from Microsoft SQL to MySQL some day.

Alright, I'll admit it. If you're building enterprise server products, or work on a large team, or are building framework products for developers to use, then ignore everything I've said. Of course, then I'd question why you're a startup in that position in the first place....

So I urge you, especially if you're in a startup, to put down put down the abstract factory and get something done.
