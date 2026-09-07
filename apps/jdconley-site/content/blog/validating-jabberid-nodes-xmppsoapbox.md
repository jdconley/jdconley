---
title: Validating JabberID Nodes (XMPP/SoapBox User Names)
date: 2007-03-13T10:48:00.000-07:00
slug: validating-jabberid-nodes-xmppsoapbox
description: One of the most common, and tedious, tasks that comes up while writing software is validating user input. "Don't trust the user," the mantra goes. Even with current development…
tags:
  - asp.net
  - xmpp
draft: false
updated: 2011-07-22T00:25:02.945-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-2948995150946085884
originalUrl: http://blog.jdconley.com/2007/03/validating-jabberid-nodes-xmppsoapbox.html
ogImage: /blog-assets/og/validating-jabberid-nodes-xmppsoapbox-v1.jpg
ogImageAlt: "A shield admits valid message identities and blocks an invalid one. — JD Conley."
---

One of the most common, and tedious, tasks that comes up while writing software is validating user input. "Don't trust the user," the mantra goes. Even with current development tools it is still suprisingly difficult (i.e. not automatic) to validate user input and provide useful feedback to people who enter bad data.

For the web (http/dhtml), ASP.Net provides the best implementation I've seen so far. Controls like the [RegularExpressionValidator](http://msdn2.microsoft.com/en-us/eahwtc9e.aspx) combined with a [ValidationSummary](http://msdn2.microsoft.com/en-us/system.web.ui.webcontrols.validationsummary.aspx) or the more recent [Validator Callout](http://ajax.asp.net/ajaxtoolkit/ValidatorCallout/ValidatorCallout.aspx) allow you to create a very intuitive and reactive interface while still providing server side input validation. Well, how does all this apply to JabberID Nodes?

A [JabberID Node](http://www.xmpp.org/rfcs/rfc3920.html#addressing) is essentially your user name on an XMPP domain. I am jconley@coversant.net, thus "jconley" is my JabberID Node. A JabberID is represented by the ABNF form: \[ node "@" \] domain \[ "/" resource \] (for more details see the [Addressing Scheme](http://www.xmpp.org/rfcs/rfc3920.html#addressing) section of [RFC 3920](http://www.xmpp.org/rfcs/rfc3920.html)). Now, as with any good RFC the exact definition of what is permitted is available. It's, long, it's complicated, it's (eek) Unicode, it's called StringPrep. To be more precise, the [NodePrep Profile Prohibited Output](http://www.xmpp.org/rfcs/rfc3920.html#nodeprep). The domain and resource also have their own rules, but maybe we'll talk about that another day.

Up until recently I haven't had to worry much about StringPrep. [Chris](http://www.blogger.com/www.coversant.com/blogs/cmullins.aspx) was the unlucky soul here to bite that one off, so he is officially our in-house Unicode geek. Way down deep in our coversant.corlib assembly of the SoapBox Framework there is a namespace called "Coversant.StringPrep". This is automatically used by our JabberID class to make sure that JabberID's are always in the right format and do not contain any bad data. Well, this last week I had to build a web page that someone could enter JabberID Node information on. I wanted this to be, for the most part, handled on the client side to provide instant feedback and correction for common mistakes (like including a space), but still use the server for final validation (don't want those evil bots trying to mess with my page!).

The most elegant way I could think of was to create a regular expression to validate the input. This would let me utilize the controls already in ASP.Net for client and server side validation. As it turns out this isn't straighforward. From what I could figure out, the Regex engine included with Microsoft.Net (and today's browsers) do not support unicode code points above 16bits. Nodeprep Prohibit says There are thousands of disallowed code points above there (it goes up to 32 bits).

So, in the end, we validate as much as we can on the client with the following expression (I shamelessly stole the ASCII portions from [Artur](http://crucially.livejournal.com/) - a guy I met at the [XMPP Interop Event](http://www.coversant.com/Coversant/Blogs/tabid/88/EntryID/11/Default.aspx) last year): ^(\[\\x29\\x23-\\x25\\x28-\\x2E\\x30-\\x39\\x3B\\x3D\\x3F\\x41-\\x7E\\xA0 \\u1680\\u202F\\u205F\\u3000\\u2000-\\u2009\\u200A-\\u200B\\u06DD \\u070F\\u180E\\u200C-\\u200D\\u2028-\\u2029\\u0080-\\u009F \\u2060-\\u2063\\u206A-\\u206F\\uFFF9-\\uFFFC\\uE000-\\uF8FF\\uFDD0-\\uFDEF \\uFFFE-\\uFFFF\\uD800-\\uDFFF\\uFFF9-\\uFFFD\\u2FF0-\\u2FFB\]{1,1023}) Oh, there are some artificial line breaks in that Regex. Don't include those. :) We leave the rest up to a [CustomValidator](http://msdn2.microsoft.com/en-us/9eee01cx.aspx) on the server side and the SoapBox JabberID.ValidateUserText method.
