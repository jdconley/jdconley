# JD Conley

Product-oriented engineering leader. I build software people want.

- **Website**: `https://www.jdconley.com`
- **LinkedIn**: `https://www.linkedin.com/in/jdconley`
- **GitHub**: `https://github.com/jdconley`
- **X / Twitter**: `https://twitter.com/wackie`
- **Hacker News**: `https://news.ycombinator.com/user?id=jconley`

Based in **South Lake Tahoe, CA**. I’ve been shipping software for **25+ years**. I’m a **Y Combinator alum**, startup advisor, builder, and (rarely) investor.

## What I do

- **Engineering leadership**: building and coaching teams that ship
- **Architecture**: pragmatic systems that scale without over-engineering
- **Product + execution**: tight feedback loops, measurable outcomes
- **Hard problems**: performance, reliability, observability, “this is on fire”

## Highlights

- **AfterHour** Head of Engineering. Consumer finance social, AI trading, AI product development workflows.
- **Brava**: VP / Head of Engineering (software). Complex consumer IoT + custom Linux OS; acquired in 2019 by Middleby (`$MIDD`).
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

I’m working on AfterHour, doing a little consulting, and investing (including through **Pioneer Fund** / **Orange Fund**). I’m also exploring AI (and a bunch of other buzzwords) with a builder’s lens.

## How this repo is “built in public”

My site publishes real build artifacts (plans + redacted transcripts) so you can inspect the process end-to-end:

- `https://www.jdconley.com/how-this-is-built`

Local commits auto-refresh website log artifacts through a Husky `pre-commit` hook (`pnpm run logs:sync:site` + staged log outputs). For a one-off bypass, use `HUSKY=0 git commit ...`.

If you’re here for the code and workflows, see `DEVELOPING.md`.