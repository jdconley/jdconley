---
title: Functional Optimistic Concurrency in C#
date: 2009-06-26T00:00:00.000-07:00
slug: functional-optimistic-concurrency-in-c
description: A few months ago Phil Haack wrote about how C# 3.0 is a gateway drug to functional programming. (Yeah, that's how long ago I started writing this blog.) I couldn't agree more.…
tags:
  - architecture
  - linq
  - utility
draft: false
updated: 2011-07-27T00:23:20.462-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-148808662145526727
originalUrl: http://blog.jdconley.com/2009/01/functional-optimistic-concurrency-in-c.html
---

A few months ago Phil Haack wrote about how C# 3.0 is a [gateway drug](http://haacked.com/archive/2009/02/15/the-functional-language-gateway-drug.aspx) to functional programming. (Yeah, that's how long ago I started writing this blog.) I couldn't agree more. I find myself solving problems using functional rather than imperative programming quite often nowadays. It's much more elegant for many problem spaces.

Before we go any further, here's the sample app used for this article. Even if you don't like my writing, you should play with it. Yeah, you! [optimistic-concurrency.zip](https://docs.google.com/viewer?a=v&pid=explorer&chrome=true&srcid=0B7Ew2HKAAmajMGNmZGNjNTMtYzQwMy00MWJkLTk3MDItODJhYzJjOGIyZGZi&hl=en_US)

One problem space that fits very well with functional patterns is in developing apps that have to use [optimistic concurrency](/blog/concurrency-its-like-doing-dishes) to maintain data consistency at scale. Here at Hive7 we build PvP games. In such games, multiple people and background processes are often affecting the same entity at the same time. We can't use coarse grained locks or high isolation levels in MS-SQL, or the whole game would come to a halt. Here's a common scenario in a game like [Knighthood](http://corp.hive7.com/games/knighthood/):  

> Image unavailable: archived image ([original source](http://knight.fb.hive7.com/res/img/area/wall.png?63356112540)) Multiple rival lords are attacking my Kingdom at once trying to steal my most prized vassal, my wife! My wall is staffed with a heavy defense, and my hospital has a strong set of medics healing my kingdom over time. But to keep a handle on the attack I also have to continuously spend gold to heal my defensive army.

In this common use case there are a number of subtleties. First, multiple people are attacking me at once. That means they're doing damage to my defenses in real time, and at the same time. My hospital is healing my vassals over time. This occurs in a background process once every few minutes. And I'm triggering an instant heal to my defensive vassals using my gold supply. My Marketplace is also generating gold for me over time in another background process. To top it all off, this is happening across a cluster of application servers that are certain to be processing multiple requests simultaneously. Phew!

So what does all that mean? Well, basically, there are a lot of possibilities for change conflicts. And we have to deal with those conflicts to both keep a consistent data model and perform well.

There are a a number of potential strategies for managing these change conflicts in the persistent store – a few beefy Microsoft SQL Server databases in our case. We chose to go with optimistic concurrency and an abort on conflict transaction strategy. That basically means when we write data to the database we make sure we are always writing the most recent version of a row. If an application attempts to write an old version of the row, the data access layer throws an exception and aborts the transaction. Knighthood uses [NHibernate](http://www.hibernate.org/) so the validation is done for us automatically using a simple version number on the row. The basic algorithm is:  

1.  Read data and serialize into objects (done by NHibernate)
2.  Modify objects in code
3.  Tell NHibernate to persist the changes, which does the following  
      
    2.  Increments the version number
    3.  Finds all the changes and batches up insert/update calls
    4.  Uses the version number in the WHERE clause of updates like: "UPDATE Table SET Col1='blah' WHERE Version=36"
    5.  Checks the rows modified reported by SQL server and throws an exception if it's an unexpected number

As you can imagine, this fails regularly in a high concurrency scenario, but it succeeds orders of magnitude more often than not. It's also pretty standard for any web app nowadays.

The only problem is, to preserve consistency, an exception is thrown and the transaction is aborted when change conflicts occur. That means whatever request the application or user issued fails. We could show the user a friendly error message, but that would be a frustrating experience. Nobody likes seeing errors for non-obvious reasons. And in the case of headless software running in the background the error would just be in a log somewhere. If it's something important that needs to happen, then we have to make sure it gets done! So us imperative programmers devise a retry scheme and write a loop with an exception trap around our code. Maybe you get clever and create a class that does this which raises an event any time you need to execute your retry-able code. But, this gets pretty cumbersome. Enter functional programming!

We have a little class named DataActions that is used to simplify and consolidate this retry process and make it painless to use. I'm going to use LINQ to SQL as the example here. Here's some usage code:

```
DataActions.ExecuteOptimisticSubmitChanges<GameDataContext>(dc =>{    var playerToMod = dc.Players.Where(p => p.ID == playerId).Single();    SetRandomGold(playerToMod);});
```

As you can see it's really straight forward. Notice all the goodness going on there. We don't have to instantiate our own DataContext, manually submit the changes, or worry at all about transactions. It's all handled by the wrapper. And, you just have to provide some code to execute once the DataContext has been instantiated.

The ExecuteOptimisticSubmitChanges helper method itself is pretty simple as well:

```
public static voidExecuteOptimisticSubmitChanges<TDataContext>(Action<TDataContext> action) where TDataContext : DataContext, new(){ Retry(() =>     {         using (var ts = new TransactionScope())         {             using (var dc = new TDataContext())             {                 action(dc);                 dc.SubmitChanges();                 ts.Complete();             }         }     });}
```

And, finally, we have the Retry method:

```
public static void Retry(Action a){ const int retries = 5; for (int i = 0; i < retries; i  ) {     try          {             a();             break;     }     catch         {             if (i == retries - 1) throw;         //exponential/random retry back-off.             var rand = new Random(Guid.NewGuid().GetHashCode());         int nextTry = rand.Next(           (int)Math.Pow(i, 2), (int)Math.Pow(i + 1, 2) + 1);         Thread.Sleep(nextTry);     } }}
```

When you string all this together you get pseudo-stacks that look like:

```
MyCodeExecuteOptimisticSubmitChangesRetry  ExecuteOptimisticSubmitChanges    MyCode
```

So, why should you care? The calling code is really easy to read, and you get a number of other benefits with this code. In addition to handling exceptions caused by concurrency errors, you also get retries on deadlocks, and more common Sql Connection errors.

I put together a little sample application you can play with. It uses these helpers and has a SQL Database with it. The sample simulates really high concurrency and you can watch it deal gracefully with deadlocks. Then you can change line 29 of Program.cs and execute the same concurrent code without retries enabled. It ouputs the number of failed transactions and a bunch of other interesting stuff to the console. Here's some example output:

```
 ...  Retrying after iteration 0 in 1ms Retrying after iteration 0 in 0ms Thread finished with 0 failures. Concurrency at 3Retrying after iteration 1 in 3msRetrying after iteration 1 in 4msThread finished with 0 failures. Concurrency at 2Retrying after iteration 2 in 5msThread finished with 0 failures. Concurrency at 1Retrying after iteration 3 in 15msThread finished with 0 failures. Concurrency at 00 total failures and 7 total retries.All done. Hit enter to exit.
```

And the same test run with retries disabled:

```
 ...  Starting worker. Concurrency at 8Thread finished with 0 failures. Concurrency at 7Thread finished with 0 failures. Concurrency at 6Thread finished with 1 failures. Concurrency at 5Thread finished with 1 failures. Concurrency at 4Thread finished with 1 failures. Concurrency at 2Thread finished with 2 failures. Concurrency at 3Thread finished with 0 failures. Concurrency at 1Thread finished with 2 failures. Concurrency at 07 total failures and 0 total retries.All done. Hit enter to exit.
```

Here's the download link again: [optimistic-concurrency.zip](https://docs.google.com/viewer?a=v&pid=explorer&chrome=true&srcid=0B7Ew2HKAAmajMGNmZGNjNTMtYzQwMy00MWJkLTk3MDItODJhYzJjOGIyZGZi&hl=en_US)

Let me know if you have any questions.
