---
title: Don't forget to close your Linq to Sql connections
date: 2007-08-30T13:51:00.000-07:00
slug: dont-forget-to-close-your-linq-to-sql
description: Today I was working on some Linq to Sql code that dealt with an event management system. There are events people can attend, and attendees fill out a form to register for the…
tags:
  - .net
  - linq
draft: false
updated: 2011-07-22T01:22:57.597-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-2521490268521831687
originalUrl: http://blog.jdconley.com/2007/08/dont-forget-to-close-your-linq-to-sql.html
---

Today I was working on some Linq to Sql code that dealt with an event management system. There are events people can attend, and attendees fill out a form to register for the event. The fields for each event are configurable by the person that creates the event. When I save a set of event fields I want to do it in a transaction so I don't end up with a partial "record". Here's what my code looked like originally:  

```csharp
public void SaveEventAttendeeFields(EventAttendeeField[] fields)
{
   using (LinqToSqlDataContext dc = new LinqToSqlDataContext())
   {
       dc.DeferredLoadingEnabled = false;

       try         {             dc.Connection.Open();             dc.Transaction = dc.Connection.BeginTransaction();              foreach (EventAttendeeField f in fields)
           {
               if (f.EventAddendeeFieldId > 0)
                   dc.EventAttendeeFields.Attach(f, true);
               else                     dc.EventAttendeeFields.Add(f);             }              dc.SubmitChanges();             dc.Transaction.Commit();         }         catch         {             if (null != dc.Transaction)
               dc.Transaction.Rollback();

           throw;
       }
   }
}
```

I assumed this was perfectly fine, until I ran it through my unit test library. My test library automatically creates a new database, tables, sprocs, and then populates it with seed test data. At the end of the test run it drops the database that was created. Well, the drop was failing because the database was in use! I thought "hmm, I wonder if my connections aren't being closed." Sure enough, if you manually open the connection in the DataContext you had better manually close it as well!

```csharp
public void SaveEventAttendeeFields(EventAttendeeField[] fields)
{
   using (LinqToSqlDataContext dc = new LinqToSqlDataContext())
   {
       dc.DeferredLoadingEnabled = false;

       try         {             dc.Connection.Open();             dc.Transaction = dc.Connection.BeginTransaction();              foreach (EventAttendeeField f in fields)
           {
               if (f.EventAddendeeFieldId > 0)
                   dc.EventAttendeeFields.Attach(f, true);
               else                     dc.EventAttendeeFields.Add(f);             }              dc.SubmitChanges();             dc.Transaction.Commit();         }         finally         {             if (null != dc.Connection && dc.Connection.State != System.Data.ConnectionState.Closed)
               dc.Connection.Close();
       }
   }
}
```

This code didn't cause any leaks. So, moral of the story, close your connections in your DataContext if you open them.
