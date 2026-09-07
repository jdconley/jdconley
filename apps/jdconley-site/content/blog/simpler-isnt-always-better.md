---
title: Simpler isn't always better - AsyncOperationsManager
date: 2007-06-08T11:51:00.000-07:00
slug: simpler-isnt-always-better
description: AsyncOperationManager... die! We have a new invitation system coming out soon for SoapBox Communicator and I was doing a little premature optimization, err, I mean, capacity…
tags:
  - asp.net
  - async
draft: false
updated: 2011-07-22T00:55:46.344-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-4159598516278882360
originalUrl: http://blog.jdconley.com/2007/06/simpler-isnt-always-better.html
ogImage: /blog-assets/og/simpler-isnt-always-better-v1.jpg
ogImageAlt: "A tangled asynchronous machine struggles to process messages. — JD Conley."
---

AsyncOperationManager... die!  

We have a new invitation system coming out soon for [SoapBox Communicator](http://soapbox.net/) and I was doing a little premature optimization, err, I mean, capacity planning. :) I set about to perform the simple task (or so I thought) of sending all of our email based invitations asynchronously. The architecture of the system is pretty simple. We have an ASP.NET 2.0 web site that you use inside SoapBox for sending invitations to your friends. The web site talks to an internal web service. The web service talks to a database. It's a pretty classic nTier design, with one exception. All layers are asynchronous.

The UI uses asynchronous ASP.NET pages and [RegisterAsyncTask](http://msdn2.microsoft.com/en-us/library/system.web.ui.page.registerasynctask.aspx) to make the call to the EnqueueEmailInvites web service. The web service uses [asynchronous web methods](https://msdn2.microsoft.com/en-us/library/aa480516.aspx) and reads from/writes to our database using the [asynchronous data methods](http://www.csharphelp.com/archives4/archive640.html) in SqlClient.

**Async Web Method**  

```csharp

     [WebMethod]
     public IAsyncResult BeginEnqueueEmailInvites(EmailInvitation invite, AsyncCallback callback, object state)
     {
         return InvitationFactory.BeginEnqueueEmailInvites(invite, callback, state);
     }

     [WebMethod]
     public string[] EndEnqueueEmailInvites(IAsyncResult ar)
     {
         return InvitationFactory.EndEnqueueEmailInvites(ar);
     }
```

**Factory Calling DAL**  

```csharp

public static IAsyncResult BeginEnqueueEmailInvites(EmailInvitation invite, 

AsyncCallback callback, object state)
        {
            InviteEmailAsyncState myAs = new InviteEmailAsyncState();
            myAs.Invitation = invite;
            InviteEmailAsyncResult myAR = new InviteEmailAsyncResult(myAs, callback, state);

            int emailInviteId = invite.Mutual ? GetInvitationTypeId(Constants.InviteTypeEmailMutual) : 

GetInvitationTypeId(Constants.InviteTypeEmail);
            string csvAddresses = string.Join(",", new List<string>(invite.Addresses).ToArray());

            Data.Invitations.BeginCreateReadInvitation(emailInviteId, invite.FromJid, invite.FromName, invite.Subject, invite.UserBodyPlain, string.Empty, csvAddresses, EmailInvitationCreatedCallback, myAR);

            return myAR;
        }
```

I write a lot of asynchronous code. A lot. I'm a bit of an asynchronous I/O zealot. In fact, I've had an article on the shelf called "Asyncify your code" for months now. l I just haven't got the sample code written for it yet. Anyway, my experience has led me to a simple conclusion: I hate the [AsyncOperationManager](http://msdn2.microsoft.com/en-us/library/system.componentmodel.asyncoperationmanager.aspx).

Maybe it's because I write a lot of asynchronous code, or maybe just because people tend to [Mistake Familiarity with Superiority](http://arstechnica.com/news.ars/post/20070605-product-loyalty-consumers-mistake-familiarity-with-superiority.html), but whatever the reasoning, I can't stand it. The AsyncOperationManager is used all over the .NET 2.0 framework where you see calls ending in "Async", even though you probably don't even know it. One such instance that rubbed me the wrong way yesterday (and into this morning) is the [SmtpClient](http://msdn2.microsoft.com/en-us/library/system.net.mail.smtpclient.aspx). Don't get me wrong, the SmtpClient is a great improvement over the old CDO based classes, but the Async support leaves something to be desired.

First off, you can't call Send or SendAsync until the previous operation has completed. That means if you're sending out more than one email in succession you're going to need to do your own queueing. So I said to myself "Ok, this is easy, I'll rip out the loop, register an eventhandler for SendCompleted, and pass a Queue through as state to SendAsync." This led me to the next problem.

The asynchronous web method called the asynchronous data method, which led to a callback. Inside of this callback I grabbed some info from the data reader result and composed the MailMessage. I created a SmtpClient, registered for the SendCompleted event kicked off the first SendAsync, and completed the asynchronus web method. The mail sent great, but my SendCompleted event handler was never called.

Apparently, if you make an async call there is the potential that the completed event handler you registered will never get called. Yep. You can call SendAsync, and the SendCompleted event will never be raised. I admit, the circumstances this happened in were kind of abnormal, but still. That just shouldn't happen.

After a little reflectoring it was apparent this had something to do with the SynchronizationContext at the time of the call used by the AsyncOperationManager inside of the SmtpClient. I got a litte cross-eyed looking through the code in reflector so I gave up my hunt for the exact answer. My workaround: Call ThreadPool.QueueUserWorkItem and create the SmtpClient and call SendAsync inside of that callback. This gets you the generic SynchronizationContext that doesn't have anything weird associated with it, just plain ole async delegates. If someone has a better solution, please let me know.

**The Hack**  

```csharp

             if (messagesToSend.Count > 0)
             {
                 //this seems strange, but we queue up the creation of the SmtpClient to a threadpool thread.
                 //the synchronization context seems to become invalid when we complete the async web method call                     
                 //and we don't want to wait for the emails to go out to complete the web service call.                     

                 System.Threading.ThreadPool.QueueUserWorkItem(StartSendingEmailCallback, new object[] { myAr.MyAsyncState.Invitation, messagesToSend });
             }
```

I have a plea to all framework designers out there. Have the decency to give me the good ole IAsyncResult based async pattern without all that extra AsyncOperationManager baggage! I don't want to have to worry about all that. I'm a big boy. I can handle my own synchronization, and I like it that way.
