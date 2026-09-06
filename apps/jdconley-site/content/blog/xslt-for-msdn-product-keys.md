---
title: XSLT For MSDN Product Keys
date: 2006-11-21T15:00:00.000-08:00
slug: xslt-for-msdn-product-keys
description: Here at Coversant we're Microsoft partners. We have MSDN subscriptions for all our developers/testers, and we share the same set of license keys. Rather than give everyone…
tags:
  - random
draft: false
updated: 2011-07-22T00:13:22.585-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-8638020826163728097
originalUrl: http://blog.jdconley.com/2006/11/xslt-for-msdn-product-keys.html
---

Here at Coversant we're Microsoft partners. We have MSDN subscriptions for all our developers/testers, and we share the same set of license keys. Rather than give everyone willy-nilly access to the MSDN download web site (ick, lots of bandwidth suck) we setup an internal file share for MSDN installation files, CD images, etc. We used to have all the product keys in there just saved as html from Microsoft's web site. However, that's no fun!  
  
In the spirit of having fun and being developer friendly, Microsoft is nice enough to offer an "Export Key List to XML" button on the web page where we view all our product keys. So, I clicked the button. Out popped a very nicely/simply formatted XML document, like the following:  
  

```
<?xml version="1.0" standalone="yes"?><Your_Product_Keys> <Product_Key  Name="All products requiring a 10-digit product key"  Key="xxx-xxx-xxxx"  Key_Type="Retail"/> <Product_Key  Name="Windows Vista Ultimate"  Key="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"  Key_Type="Retail"  Date_Key_Claimed="2006-11-20 17:36:11.787"/> <Product_Key  Name="Windows Server 2003 R2 Standard Edition"  Key="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"  Key_Type="Retail"  Date_Key_Claimed="2006-11-20 17:36:08.270"/> <Product_Key  Name="Office 2007 Desktop Programs"  Key="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"  Key_Type="Retail"  Date_Key_Claimed="2006-11-20 17:35:57.537"/>  ...</Your_Product_Keys>
```

  
I whipped up a quick XSLT you might find useful to transform this to a really ugly, really simple, x-html page (yeah without the namespace declaration).  
  

```
<?xml version="1.0" encoding="ISO-8859-1"?><xsl:stylesheet version="1.0"xmlns:xsl="http://www.w3.org/1999/XSL/Transform"><xsl:template match="/"> <html> <body>   <h2>MSDN Product Keys</h2>   <table border="1">   <tr bgcolor="#9acd32">     <th align="left">Product Name</th>     <th align="left">Product Key</th>   </tr>   <xsl:for-each select="/Your_Product_Keys/Product_Key">   <tr>     <td><xsl:value-of select="@Name"/></td>     <td><xsl:value-of select="@Key"/></td>   </tr>   </xsl:for-each>   </table> </body> </html></xsl:template></xsl:stylesheet>
```

  
Then I made one quick edit to the xml file so friendly xslt aware web browsers will do the transform for me:  
  

```
<?xml version="1.0" standalone="yes"?><?xml-stylesheet type="text/xsl" href="productkeys.xslt"?><Your_Product_Keys>  ...</Your_Product_Keys>
```

  
Presto-chango, we now have an easy to update central listing of our MSDN keys. Now if only MS had a web service that took my Live ID credentials and gave me back that XML...
