---
title: Ditch Your Events (Part 1)
date: 2009-11-16T11:30:00.000-08:00
slug: ditch-your-events-part-1
description: About four months ago Max, Hive7's Lawful Evil CEO, decided we needed to take our games to the next level and build something fun and accessible that everyone who plays "those…
tags:
  - .net
  - as3
  - tuning
draft: false
updated: 2011-07-27T00:12:59.280-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-7793214738393095802
originalUrl: http://blog.jdconley.com/2009/11/ditch-your-events-part-1.html
ogImage: /blog-assets/og/ditch-your-events-part-1-v1.jpg
ogImageAlt: "An event symbol is discarded into a metal trash can. — JD Conley."
---

About four months ago Max, Hive7's [Lawful Evil CEO](http://corp.hive7.com/about/), decided we needed to take our games to the next level and build something fun and accessible that everyone who plays "those farming games" would want to play. We all brainstormed, pitched our ideas to the company, and everyone voted by comparing every idea against every other – I wish we had a digital photo of the giant matrix on the whiteboard. There were a bunch of great ideas, but in the end... I won! [Youtopia](http://apps.facebook.com/you-topia/landing?ref=jd) was born.

Youtopia was released to the public about three months from its inception. Hats off to the dev and art team for pulling this one together. A new technology for the developers and fully animated objects for the art team led to much blood, sweat, and tears, but we got 'er done! Of course, we're still actively developing Youtopia, and there are lots of great things planned for the future! But, back to my tech article...

It's been a long time since I've stepped out of my comfort zone and learned a new (to me) technology. Don't get me wrong, I'm always experimenting with the lastest .NET based thingie-ma-bobbers out there, but I haven't used a completely foreign development environment since C#/.NET came out over eight years ago. But for this project I needed to learn Flash/AS3, and it needed to be done yesterday. Luckily for me nobody else on our dev team knew Flash so I could still pretend like I knew what I was talking about and make lots of (un)educated architectural decisions without anyone being the wiser!

One such recent decision was to use an event driven property binding system. Youtopia's engine is based on a great open source game engine, brought to you from some of the Dyamix/GarageGames people, called the [PushButton Engine](http://www.pushbuttonengine.com/) (or PBE). In PBE there is a class called PropertyReference. This class facilitates a late-bound approach for one component to read the value of a property (member variable or getter/setter) on another component. It's a pretty cool pattern, but requires you to poll the target component whenever you want to know if the property changed. This works fine when you're talking about 10's or 100's of components. But in Youtopia we have thousands of entities in the scene at once. We needed this binding to be event-driven.

Of course, with my .NET background I immediately reached for the [INotifyPropertyChanged](http://msdn.microsoft.com/en-us/library/system.componentmodel.inotifypropertychanged.aspx) pattern used in .NET's data binding infrastructure. With INotifyPropertyChanged it is the responsibility of the object owning the property to raise an event whenever a property value changes. Any listeners will then immediately know they need to poll for the new value if they want it.

This works great in .NET and is very performant. But in Flash, events are a whole other story. They are an extremely feature-rich subsystem that I don't really want to get into. In the end, all the features and memory allocations when you raise an event lead to poorer performance than we needed for Youtopia. We need every bit of CPU power on that single Flash thread and really shouldn't be wasting it raising events.

So, I shamelessly copied the .NET patterns and brought them over to AS3. Let's start at the core. In order for things to perform their best, I [couldn't use](http://troygilbert.com/2009/09/events-vs-callbacks/) the built-in Events. Though Troy did the benchmarking legwork, he didn't provide an implementation we could use to register callbacks and call multiple functions. So, I wrote a MulticastFunction that behaves a whole lot like the [MulticastDelegate](http://msdn.microsoft.com/en-us/library/system.multicastdelegate.aspx) in .NET. Usage is really straightforward.

```actionscript
var func:MulticastFunction = new MulticastFunction();

//register my listener callback
func.add(
  function():void 
  {
    //this callback does amazingly cool stuff
    trace("hello from the callback");
  });

//calls all the callbacks that have been added, in the order they were added
func.apply();
```

As you can see, dealing with the MulticastFunction is a lot like the EventDispatcher, but each MulticastFunction is only designed to be used for a single event. So, to use it for events, create a public getter on your class named something reasonable and add your callbacks to it. Done!

Ok, I realize I keep talking about event dispatching speed, but haven't put my money where my mouth is. I wrote some benchmarks of my own and here is the output with a release build, in the latest standalone Flash 10 player. It does five test runs. [Download the Source](https://docs.google.com/viewer?a=v&pid=explorer&chrome=true&srcid=0B7Ew2HKAAmajMTM5NmIzMTUtYTJiNC00MTcxLWFhOGYtMjRmM2Q2ODA0YThh&hl=en_US)

```
running tests...
Event dispatching took 848ms
MulticastFunction took 355ms

running tests...
Event dispatching took 846ms
MulticastFunction took 351ms

running tests...
Event dispatching took 834ms
MulticastFunction took 352ms

running tests...
Event dispatching took 836ms
MulticastFunction took 351ms

running tests...
Event dispatching took 823ms
MulticastFunction took 343ms
```

Yup, that's right. MulticastFunction is nearly 2.5x faster, and I haven't spent much time tuning it. For example, it's using an Array under the hood and doing more work than it needs to during the apply call. Events will also become less performant over time as you have to create (and potentially clone) Event objects for every dispatch, causing a lot of garbage collection pressure. Here's the MulticastFunction, with lots of comments or you can [download the source](https://docs.google.com/viewer?a=v&pid=explorer&chrome=true&srcid=0B7Ew2HKAAmajMTM5NmIzMTUtYTJiNC00MTcxLWFhOGYtMjRmM2Q2ODA0YThh&hl=en_US)

```actionscript
package com.jdconley
{
    /**
     * A wrapper that mimics the synchronous behavior of the MulticastDelegate used in .NET for events.
     * This doesn't support any of the async methods, as we don't have free threading here.
     * It also doesn't support return values.
     * See: http://msdn.microsoft.com/en-us/library/system.multicastdelegate.aspx
     */
    public class MulticastFunction
    {
        private var _functions:Array = [];
        private var _iterators:int = 0;

        /**
         * Adds a function to be called when apply is called.
         * If the function is already in the list it won't be added twice.
         * Returns true if the function was added.
         **/
        public function add(func:Function):Boolean
        {
            var i:int = _functions.indexOf(func);
            if (i > -1)
                return false;

            //add new functions to the end so they are picked up live during an apply
            _functions.push(func);
            return true;
        }

        /**
         * Removes a function to be called when apply is called.
         * Returns true if the function was removed.
         **/
        public function remove(func:Function):Boolean
        {
            var i:int = _functions.indexOf(func);
            if (i < 0)
                return false;

            if (_iterators == 0)
                _functions.splice(i, 1);
            else
                _functions[i] = null;

            return true;
        }

        /**
         * Synchronously applies all functions that have been added.
         * Functions can be safely added or removed during an apply and changes will take effect immediately.
         * Added functions will be called, and removed functions will not.
         **/
        public function apply(thisArg:*=null, argArray:*=null):void
        {
            _iterators  ;
            var holes:Boolean = false;
            
            for (var i:int = 0; i < _functions.length; i  )
            {
                var f:Function = _functions[i];
                if (f == null)
                    holes = true;
                else
                    f.apply(thisArg, argArray);
            }

            //cleanup holes left by removing functions during this apply call.
            //if any of the function apply's throw an error the state of _iterators will be off.
            //but, we'll only leak array slot memory if functions are removed.
            //putting a try/finally or try/catch block here significantly decreases performance.
            if (--_iterators == 0 && holes)
            {
                for (i = _functions.length - 1; i >= 0; i--)
                {
                    if (_functions[i] == null)
                        _functions.splice(i, 1);
                }            
            }
        }

        /**
         * Removes all functions from the list. Stops the current apply call, if there is one.
         **/
        public function clear():void
        {
            _functions = [];
        }
    }
}
```

Although capture, bubble, weak references, and priority are handy features of the Flash eventing system, they're not always necessary and will hurt your performance when you might have thousands of them firing per frame.

In Part 2 we'll put this MulticastFunction to use in a more meaningful way with the INotifyPropertyChanged implementation.
