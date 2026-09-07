---
title: How much space are all my sql tables using?
date: 2007-11-27T17:35:00.000-08:00
slug: how-much-space-are-all-my-sql-tables
description: I deal with a few dozen databases on a daily basis. Often times I wonder "What the heck is making this database 100GB?" Sure, you can click around in Management Studio and find…
tags:
  - random
  - utility
draft: false
updated: 2011-07-22T02:49:45.455-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-7346749600347321380
originalUrl: http://blog.jdconley.com/2007/11/how-much-space-are-all-my-sql-tables.html
---

I deal with a few dozen databases on a daily basis. Often times I wonder "What the heck is making this database 100GB?" Sure, you can click around in Management Studio and find figures on a table by table and index by index basis, but there has to be a better way!

So, I asked a colleague of mine – who happens to be the guy that did all the database work on the SoapBox products and the best database dude I know. He didn't have a good answer for me so he whipped up this tiny script \[Edit: After reading my blog he told me he actually adapted the script from one he found on the net that didn't quite work\] in a few minutes. It makes my head spin. It's not perfect, but it's darn close.

```sql
WITH table_space_usage
( schema_name, table_name, index_name, used, reserved, ind_rows, tbl_rows )
AS (
SELECT s.Name
    , o.Name
    , coalesce(i.Name, 'HEAP')
    , p.used_page_count * 8
    , p.reserved_page_count * 8
    , p.row_count
    , case when i.index_id in ( 0, 1 ) then p.row_count else 0 end
 FROM sys.dm_db_partition_stats p
 INNER JOIN sys.objects as o
   ON o.object_id = p.object_id
 INNER JOIN sys.schemas as s
   ON s.schema_id = o.schema_id
 LEFT OUTER JOIN sys.indexes as i
   on i.object_id = p.object_id and i.index_id = p.index_id
WHERE o.type_desc = 'USER_TABLE'
  and o.is_ms_shipped = 0
)
SELECT t.schema_name
    , t.table_name
    , t.index_name
    , sum(t.used) as used_in_kb
    , sum(t.reserved) as reserved_in_kb
    , case grouping(t.index_name)
when 0 then sum(t.ind_rows)
else sum(t.tbl_rows) end as rows
FROM table_space_usage as t
GROUP BY
      t.schema_name
    , t.table_name
    , t.index_name
WITH ROLLUP
ORDER BY
     grouping(t.schema_name)
   , t.schema_name
   , grouping(t.table_name)
   , t.table_name
   , grouping(t.index_name)
   , t.index_name
```

I hope that hurts your head as much as it does mine. Just goes to show that I'm no SQL guru, I guess. But hey, if you ever want to know where that space is going in your database, this script will tell you!
