# JD Conley

Product-oriented engineering leader. I build software people want.

- **[Website](https://www.jdconley.com)**
- **[LinkedIn](https://www.linkedin.com/in/jdconley)**
- **[X / Twitter](https://twitter.com/wackie)**
- **[Hacker News](https://news.ycombinator.com/user?id=jconley)**

Based in **South Lake Tahoe, CA**. I’ve been shipping software for **25+ years**. I’m a **Y Combinator alum**, startup advisor, builder, and (rarely) investor.

## What I do

- **Engineering leadership**: building and coaching teams that ship
- **Architecture**: pragmatic systems that scale without over-engineering
- **Product + execution**: tight feedback loops, measurable outcomes
- **Hard problems**: performance, reliability, observability, “this is on fire”

## Highlights

- **Meanwhile** Co-Founder. Websites, apps, and back office tools for SMB operators.
- **AfterHour** Head of Engineering, 2022–2026. Consumer finance social, AI trading, AI product development workflows.
- **Brava**: VP / Head of Engineering (software). Complex consumer IoT + custom Linux OS; acquired in 2019 by [Middleby](https://www.google.com/finance/quote/MIDD:NASDAQ) (`$MIDD`).
- **RealCrowd**: Co-founder / CTO. Direct commercial real estate investing marketplace (YC Summer 2013).
- **Disney / Playdom**: Principal engineer; shipped profitable games and platform tech.

## How I work (principles)

- **First principles**: start with the real problem, not the default solution
- **Serve the customer**: build what people want, not what engineers want
- **Don’t over-engineer**: keep optionality, ship, then iterate
- **Ship often**: feedback is the engine
- **Assume good intentions**: fix systems and communication before blame
- **Over-communicate**: alignment beats heroics

## What I’m up to now

I started **[Meanwhile](https://meanwhile.so)** in 2026. We build websites, apps, and back office tools for the people SaaS forgot: small businesses run by their owners. Restaurants, charters, dog trainers, CRE syndicators. The folks who've been stuck with templates for thirty years because a real shop wanted a year of their revenue. With AI, a small team can ship a fully branded stack in days and keep it current month after month.

We're making custom software affordable for owner-operators today. The bigger bet is that everyone in every business gets software built for how they actually work.

Previously Head of Engineering at AfterHour. Still doing a little advising and investing (incl. **Pioneer Fund** / **Orange Fund**).

## Recent projects

- **[A Better Time](https://www.jdconley.com/a-better-time)** — A gentler clock that follows the sun. Explore your location’s optimal time.
- **[wodbrains](https://github.com/jdconley/wodbrains)** — Builds a smart timer from any workout: paste text, drop a screenshot, share a URL, or describe what you want.
- **[deadhand](https://github.com/jdconley/deadhand)** — Remote command and control for Cursor AI local agents.
- **[jdconley](https://github.com/jdconley/jdconley)** — This repo: jdconley.com plus build-in-public logs and tooling.

## How this repo is “built in public”

My site publishes real build artifacts (plans + redacted transcripts) so you can inspect the process end-to-end:

- [https://www.jdconley.com/how-this-is-built](https://www.jdconley.com/how-this-is-built)

Local commits auto-refresh website log artifacts through a Husky `pre-commit` hook (`pnpm run logs:sync:site` + staged log outputs). For a one-off bypass, use `HUSKY=0 git commit ...`.

If you’re here for the code and workflows, see `DEVELOPING.md`.
