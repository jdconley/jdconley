#!/usr/bin/env node
// Tells IndexNow (Bing, Yandex, Seznam, Naver; Bing shares with others) about
// every URL in the live sitemap. The key is public by design: it is served at
// https://jdconley.com/<key>.txt from apps/jdconley-site/public.
// Usage: node scripts/indexnow-submit.mjs [url ...]  (defaults to the sitemap)
const HOST = "jdconley.com";
const KEY = "7d52caa92eed31495c3ecbb8eb20e593";
const urls = process.argv.slice(2);
if (urls.length === 0) {
  const xml = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.push(m[1]);
}
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }),
});
console.log(`IndexNow: HTTP ${res.status} for ${urls.length} URLs`);
if (!res.ok && res.status !== 202) process.exit(1);
