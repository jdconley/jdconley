---
title: "A Sorted Affair: History of the C# Sort"
date: 2008-01-30T23:43:00.000-08:00
slug: sorted-affair-history-of-c-sort
description: Next month I'll be giving a talk at the Sacramento .NET User's group titled C# 3.0 Overview where I'll be presenting the great new features in the third version of C#. I've…
tags:
  - .net
  - linq
draft: false
updated: 2011-07-27T01:37:34.086-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-4735818999066519398
originalUrl: http://blog.jdconley.com/2008/01/sorted-affair-history-of-c-sort.html
---

Next month I'll be giving a talk at the Sacramento .NET User's group titled [C# 3.0 Overview](http://www.sacnetug.org/sacnet/speakers16.htm#JDConley) where I'll be presenting the great new features in the third version of C#. I've been developing .NET/C# software since the first pre-release copies of Visual Studio .NET reached MSDN. It's been fun to see the fledgling C# language evolve with the times. In just a few short years it's gone from what many considered to be an uninspired Java clone to a highly productive, unique, language.

Today I'm going to spoil the opener code sample to my user group presentation. Let's take a journey through the life of C# as a developer with a simple task: sorting a list! I even made a super [1337](http://en.wikipedia.org/wiki/Leet) [Winforms app](https://docs.google.com/viewer?a=v&pid=explorer&chrome=true&srcid=0B7Ew2HKAAmajMTY2MjkxMTYtMDE0My00OTkxLTgzMDItMjZmMmY5MDRjMjY0&hl=en_US) you can play with.

  

<a id="BLOGGER_PHOTO_ID_5632512635503791154"></a>

[![](/blog-assets/imported/677e7b141e81e737955a7d30.png)](/blog-assets/imported/677e7b141e81e737955a7d30.png)  

For the purposes of this example, we're going to use a simple class called Person. We'll be sorting the list by the person's first name.  

```
public class Person{  public string FirstName { get; set; }  public string LastName { get; set; }  public override string ToString()  {      return FirstName + " " + LastName;  }  public override int GetHashCode()  {      return FirstName.GetHashCode() ^ LastName.GetHashCode();  }  public static ICollection<Person> GetPeople()  {      return new List<Person>      {          new Person{FirstName="Ray",LastName="Ozzie"},          new Person{FirstName="Larry",LastName="Ellison"},          new Person{FirstName="Steve",LastName="Jobs"},          new Person{FirstName="Bill",LastName="Gates"},          new Person{FirstName="Britney",LastName="Spears"}      };  }}
```

**C# 1.0**  

In the beginning, there was C# 1.0. C++, VB, and COM be damned! For the majority of Microsoft based development, this new environment was a godsend. We enjoyed the benefits of a garbage collected, managed runtime, with the speed of native code. Life was good, but more than a bit clunky.

For the prim and proper developer out there, the ArrayList just didn't cut it. We used CollectionBase and implemented our own strongly typed collections. Here's my collection, in all its glory!  

```
public class PersonCollection  : CollectionBase{  public PersonCollection()  {  }  public PersonCollection(IEnumerable people)  {      foreach (Person p in people)          base.InnerList.Add(p);  }  public int Add(Person p)  {      return base.InnerList.Add(p);  }  public void Remove(Person p)  {      base.InnerList.Remove(p);  }  public Person this[int index]  {      get      {          return (Person)base.InnerList[index];      }      set      {          base.InnerList[index] = value;      }  }  public void Sort()  {      base.InnerList.Sort();  }  public void Sort(IComparer comparer)  {      base.InnerList.Sort(comparer);  }  public void Sort(int index, int count, IComparer comparer)  {      base.InnerList.Sort(index, count, comparer);  }}
```

Ok, we've got a collection of people. Now, we can finally sort them, C# 1.0 style! There's a class called Sorting in the download that these methods are a part of.

```
public PersonCollection SortCS1(PersonCollection people){  PersonCollection sortedList = new PersonCollection();  foreach (Person p in people)      sortedList.Add(p);  sortedList.Sort(new PersonFirstNameComparer());  return sortedList;}private class PersonFirstNameComparer : IComparer{  public int Compare(object x, object y)  {      return ((Person)x).FirstName.CompareTo(((Person)y).FirstName);  }}
```

Goodness, that's a lot of code! No wonder we didn't sort anything in C# 1.0. Not only do you have to create a custom collection class, there is also a custom Comparer class! And there's no getting around this when you want to sort by a member of a complex business object.

**C# 2.0**  

C# 2.0 came along with the .NET Framework 2.0 and a host of improvements. Features like generics, anonymous methods, custom iterators, and partial classes changed the face of the language for the better. No longer did we have to spend time writing the same code like Collection classes over and over, and could focus more on getting things done.  

```
public IEnumerable<Person> SortCS2(IEnumerable<Person> people){  List<Person> sortedList = new List<Person>(people);  sortedList.Sort(delegate(Person x, Person y) { return x.FirstName.CompareTo(y.FirstName); });  return sortedList;}
```

Wow, so compared to C# 1.0's 60+ lines of code, in 2.0 we wrote one. Very nice. Though, that anonymous method syntax still really bugs me. It's ugly! Why should I have create a full method signature just to do a simple one line function. Ah yes...

**C# 3.0**  

Enter C# 3.0. This is by far the biggest leap forward in C# to date. With the inclusion of lambda expressions we're now able to do some real functional programming, without the anonymous method gunk to get in the way. Check out the list sorting now!  

```
public IEnumerable<Person> SortCS3(IEnumerable<Person> people){  return people.OrderBy(p => p.FirstName);}
```

Doesn't that look so much better than the 2.0 version? And it's *light years* better than the 1.0 version. Clear, concise code. It isn't cluttered up with extra, unnecessary syntax. It's just business. The way it should be.

Since 3.0 also comes with the LINQ syntax, I thought I'd throw that example in there as well.  

```
public IEnumerable<Person> SortCS3Linq(IEnumerable<Person> people){  return from p in people orderby p.FirstName select p;}
```

I admit, in this casee the LINQ syntax weighs you down, but you can't say it's not clear what's going on. Throw some cross joins and advanced filters in there and it will start to look at lot more appealing.

**The End**  

C# has changed quite a bit over the last six years, and I can't say I disklike any of it.
