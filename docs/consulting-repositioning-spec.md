# jdconley.com — repositioning for consulting contracts

Written 2026-08-06.

Goal: contract income for JD, first invoice inside 30 days of 2026-08-06.

This repo owns the **individual** offer — fractional CTO, advisory, and the lead offer below.
The team offer (JD + Alec, fixed-scope builds) lives in the private `jdconley/conleychaos`
repo and ships on conleychaos.com. The two sites cross-reference nothing about Meanwhile.

---

## The one thing to understand first

The site is not broken. The writing is good and most of it should survive untouched.
The problem is entirely commercial:

1. **There is no offer and no price.** "Stuff I'm Available to Do" is an 18-item list that
   ends with "Hang out on boats." Charming, unbuyable.
2. **The highest-demand capability is buried.** Getting an engineering org onto agentic
   engineering is items 4–6 in that list, when it is the thing to lead with.
3. **The bio says JD does "an itty bitty bit of consulting."** That sentence tells a buyer
   he is unavailable. It is the single most costly line on the site.
4. **There is no contact form.** Contact is a `mailto:` and a phone number. Since the
   decision is to publish no prices, the contact path *is* the conversion surface.

## Two facts about this repo that will bite

**Webflow is dead and the repo does not know it.** `jdconley-com.webflow.zip` is dated
2026-03-01, but commits after it hand-edit `index.html` directly — `8d6d2e1` (Meanwhile as
current role), `c1eb570` (A Better Time on homepage), `e30e7f4` (Work With Me refinement).
**The repo is canonical now.** Running the `webflow-static-site-refresh` skill would silently
clobber every post-export edit. Fence or retire that skill as part of this work, and say so
in `AGENTS.md`.

**This repo is public and auto-publishes agent transcripts.** The `pre-commit` hook exports
Cursor transcripts to `apps/jdconley-site/public/how-this-is-built/logs`. Nothing about the
prospect pipeline — names, emails, phone numbers, company lists — may ever appear in a
session that commits here. That data lives only in `jdconley/conleychaos`, which is private.

---

## Positioning

**Lead offer:** get an existing engineering organization actually shipping with agents.
Highest urgency in the market, and the thing JD can prove better than almost anyone.

**Entry product:** one-day team workshop, up to 12 engineers, ~$7,500. Chosen because it
needs no repo access, no security review, and no procurement — the fastest possible yes, and
the only shape that realistically invoices inside 30 days.

**Ladder behind it:** 2-week assessment → fractional / advisory retainer.

**Prices are NOT published.** Operator decision. Tradeoff accepted: every deal now needs a
call before an invoice, which is the main drag on the 30-day target. Compensate by making the
offer concrete enough on the page that the call is a scheduling call, not a discovery call.

**Meanwhile stays.** It is JD's current role and his single best proof that he runs an
agent-native engineering org. Separate businesses, not a secret: no co-branding, no shared
inbox, no lead routing, and conleychaos.com never mentions it.

---

## Changes

### Keep, untouched

The bio, the three named recommendations (Max Skibinsky, Noah Kindler, Min Kim), the
principles, the project history, the vibe-coded section, "How this is built."

### Rewrite

- **Hero** → the offer. Currently "I make things that people want."
- **"Stuff I'm Available to Do"** (18 items) → three: *get your team onto agentic
  engineering* / *fractional CTO* / *build it*. Everything else that survives becomes prose
  inside those three, not a list.
- **Bio** → delete "I'm working on stealth startup and do an itty bitty bit of consulting."

### Add

- **A real contact form.** There is a proven pattern in this repo already: the A Better Time
  supporters endpoint in `apps/jdconley-site/worker/supporters.js` is Turnstile-protected and
  rate-limited via the `SUPPORT_RATE_LIMITER` binding. Copy that shape. Cover it with a worker
  test and a Playwright case like the existing suites.
- **A proof page for the agentic claim.** "I'll get your team shipping with agents" needs
  evidence a CTO can inspect. The build-in-public logs already here are half of it. Pair them
  with concrete before/after numbers from the engineering org JD actually runs.

### Do not add

A phone number, unless JD confirms which is current. The live site shows `+1.530.494.9447`;
his Meanwhile operator profile shows `+1-916-342-6485`. Defaulting to omit — form plus email
is sufficient for B2B.

Contact address is `jd@jdconley.com`. Wildcard forwarding is already configured on the domain.

---

## Sequencing

This site gates **Tier 1 outreach** (a direct ask under JD's own name). It does not gate
Wave 1 — the ~25 warmest contacts know JD and will not read the site before replying — so
outreach starts before this lands and should not wait on it.

Target: live by day 6 of the 30-day window.

## Verification

Existing suites stay green: `pnpm run test:unit:site`, `test:worker:site`, `test:e2e:site`,
`test:e2e:wrangler:site`. The contact form needs new coverage in the worker and E2E suites.
Check the rendered result at 360/390/768px before calling it done.
