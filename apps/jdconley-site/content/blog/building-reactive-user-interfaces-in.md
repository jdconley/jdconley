---
title: "Building Reactive User Interfaces in .NET: ISynchronizeInvoke on Idle Time"
date: 2007-04-10T20:55:00.000-07:00
slug: building-reactive-user-interfaces-in
description: One of the most common things to do in a multi-threaded .NET Windows Forms application is to use the ISynchronizeInvoke interface on a Control to marshal things into the UI…
tags:
  - tuning
  - winforms
draft: false
updated: 2011-07-29T23:17:12.459-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-5839251310447380729
originalUrl: http://blog.jdconley.com/2007/04/building-reactive-user-interfaces-in.html
---

One of the most common things to do in a multi-threaded .NET Windows Forms application is to use the [ISynchronizeInvoke interface](http://msdn2.microsoft.com/en-us/library/system.componentmodel.isynchronizeinvoke.aspx) on [a Control](http://www.interact-sw.co.uk/iangblog/2004/08/17/badsynclocking) to marshal things into the UI thread. The basic jist of things is: you can have the Windows Forms engine call your delegate on the thread that created the Control instance you're using. It does this using the window message pump. Typical uses of the ISynchronizeInvoke are: you want to read some data from a file, database, socket, or web service and you want your application to be responsive while you do it. When you're done you do a BeginInvoke/Invoke on the Control to update some UI elements. Well, sometimes using a Control's ISynchronizeInvoke leads to hung GUI's.

If you have a lot of asynchronous operations pending and they complete in bunches the affect on your UI can be the appearance of a hang or sluggishness as drawing is queued behind the delegates you registered with BeginInvoke on your control. During the login sequeunce in [SoapBox Communicator](http://www.coversant.com/products/communicator/overview.aspx) there are potentially thousands of events that need to be processed on the UI thread. Yup, thousands. Your roster arrives from the server. You receive the current avialability from every online person on your roster. You got 10 messages while you were offline. Each of your contact's cached profiles (avatars, names, client capabilities, etc) are read from disk and compared with the user's current presence. This onslought of activity can be handled a number of ways. The basic principles I stumbled into after much trial and error is:

1.  Never, ever, ever, ever, ever do IO on a UI thread. Even something as simple as reading a 1KB image from disk can bring your UI to a halt under the right circumstances.
2.  Use timers and update common pieces of UI (like list views) in batches whose changes were caused changes by background operations. This will reduce flicker as you invalidate areas to redraw.
3.  Use [Application.Idle](http://www.informit.com/guides/content.asp?g=dotnet&seqNum=486&rl=1) to your advantage. (see my take on this below)
4.  Be careful how many window handles you create. Controls are useful, but sometimes you've just gotta draw your own.
5.  Profile your code where it seems sluggish.

I mentioned above that you should use Application.Idle to your advantage. The articles I've found on it all mention coding precise things you want to do in that event, like updating a single form. I wanted to do it more generically. So, I created an implementation of ISynchronizeInvoke that uses the [Application.Idle event](http://msdn2.microsoft.com/en-us/library/system.windows.forms.application.idle.aspx) to process qeued items. I've created a (only slightly) contrived example that uses a [Pi Calculator](http://www.personalmicrocosms.com/pages/cspc_samples_pi.aspx) I found and an animated Gif to demonstrate a hanging GUI.

<a id="BLOGGER_PHOTO_ID_5635022983022101410"></a>

[![](/blog-assets/imported/2b8ff899c303642584ed16e6.png)](/blog-assets/imported/2b8ff899c303642584ed16e6.png)  

Both buttons calculate Pi to 50 digits on the UI thread using 100 separate ISynchronizeInvoke.BeginInvoke calls. The "Idle Invoke" button does so using my [ApplicationIdleSynchronizer](https://docs.google.com/viewer?a=v&pid=explorer&chrome=true&srcid=0B7Ew2HKAAmajMTkxY2NmMWQtZWE3ZS00MDdkLWE5NGUtZTA3YjUyY2JiMGEz&hl=en_US). The "Direct Invoke" button calls BeginInvoke on the Form directly. You can click the buttons any number of times and more and more Pi calculation runs will be queued. The completed label is incremented after every run. Here's the code:

```csharp
    public partial class Form1 : Form
 {
     private const int WorkItems = 100;
     private const int PiDigitsToCalc = 50;

     private int _workItemsCompleted = 0;

     private ApplicationIdleSynchronizer _idleSynchronizer = new ApplicationIdleSynchronizer();

     public Form1()
     {
         InitializeComponent();
     }

     protected override void OnClosed(EventArgs e)
     {
         base.OnClosed(e);
         _idleSynchronizer.Dispose();
     }

     private void button1_Click(object sender, EventArgs e)
     {
         System.Threading.ThreadPool.QueueUserWorkItem(QueueOnBackgroundThread, _idleSynchronizer);
     }

     private void button2_Click(object sender, EventArgs e)
     {
         System.Threading.ThreadPool.QueueUserWorkItem(QueueOnBackgroundThread, this);
     }

     private void QueueOnBackgroundThread(object state)
     {
         for (int i = 0; i < WorkItems; i  )
         {
             ((ISynchronizeInvoke)state).BeginInvoke(new ThreadStart(MyWorkItem), null);
         }
     }

     private void MyWorkItem()
     {
         PiCalculator.CalculatePi(PiDigitsToCalc);
         _workItemsCompleted++;
         label2.Text = _workItemsCompleted.ToString();
     }
 }
```

Click the buttons. Move the form around. Resize it. You might be suprised by the result (or not). Both very adequately use your CPU, but the Idle Invoke produces a much more reactive UI. You can download the full source code here: [ApplicationIdleInvoker.zip](https://docs.google.com/viewer?a=v&pid=explorer&chrome=true&srcid=0B7Ew2HKAAmajMTkxY2NmMWQtZWE3ZS00MDdkLWE5NGUtZTA3YjUyY2JiMGEz&hl=en_US). Note, this exact code isn't in use in production. I wrote it for this blog. YMMV. Let me know if it has any issues.
