---
title: "update my copyright to 2026 and..."
sourceType: transcript
sourceId: "d5eb1703-b35d-4e1f-9833-d9c8039559c9"
timestampSortable: "2026-03-01-22-09-35"
timestampIOS: "Mar 1, 2026 at 2:09 PM"
---

# update my copyright to 2026 and...

- Source: Cursor parent transcript `d5eb1703-b35d-4e1f-9833-d9c8039559c9`
- Timestamp (iOS): Mar 1, 2026 at 2:09 PM

## 1. USER

<user_query>
update my copyright to 2026 and have it auto-update to the current year in javascript in jdconley-site
</user_query>

## 2. ASSISTANT

I’m going to locate where the copyright year is rendered in `apps/jdconley-site`, then I’ll update it to start at 2026 and make it auto-fill the current year with JavaScript.

**Planning copyright update**

## 3. ASSISTANT

I found the footer year hard-coded in several HTML pages. Next I’ll patch those footers with a JS-driven year token so it always stays current.

**Scoping footer script updates**

## 4. ASSISTANT

**Inspecting script insertion points**

## 5. ASSISTANT

I’m about to update all footer instances in `apps/jdconley-site` to use a `2026` fallback plus a small JavaScript snippet that replaces it with the current year at runtime.

**Choosing multi-page update approach**
**Planning single-file patching**

## 6. ASSISTANT

**Patching multiple home versions**

## 7. ASSISTANT

I’ve applied the same year-token + JS updater pattern to the main pages; I’m finishing the last legacy page and then I’ll quickly verify no `Copyright 2022` remains.

## 8. ASSISTANT

**Verifying copyright and year data insertion**

## 9. ASSISTANT

**Planning targeted linting**

## 10. ASSISTANT

Updated `jdconley-site` so copyright starts at `2026` and auto-updates to the current year via JavaScript.

### What I changed
- Replaced hardcoded `2022` with a year token=[REDACTED] data-current-year>2026</span>`
- Added a small JS snippet on each page to set that token to `new Date().getFullYear()`
- Applied in:
  - `apps/jdconley-site/index.html`
  - `apps/jdconley-site/how-this-is-built.html`
  - `apps/jdconley-site/home-version-3.html`
  - `apps/jdconley-site/home-version-2.html`
  - `apps/jdconley-site/old-home.html`

### Result
- If JS is disabled, it still shows `2026` (safe fallback).
- With JS enabled, it always shows the current year automatically.

No linter issues were introduced.

**Summarizing final changes**
