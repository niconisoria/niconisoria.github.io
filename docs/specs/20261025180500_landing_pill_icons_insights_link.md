---
title: Landing pill icons and insights link
status: implemented
refs:
  [20261025174000_insights_page.md, 20261022011355_landing_grain_redesign.md]
---

## Brainstorm

`/insights` is live but unlinked. User call: link it from the chat widget (next to privacy notice) and from resume-agent README (none yet → M5 README task notes it). Landing pills get the CV header's icons so destinations read at a glance.

Scope: reuse Header's SVG icons (no icon lib). View CV gets document icon, keeps trailing arrow. Icons `aria-hidden`, labels unchanged.

Related: [Insights page](20261025174000_insights_page.md)

## Story

As visitor, want icons on landing links and a way to find assistant stats, so I recognize destinations fast and can see how the assistant is used.

AC:

1. LinkedIn, GitHub, Book a call, View CV pills show their icon before label
2. icons decorative (aria-hidden), labels unchanged
3. chat widget notice links to `/insights/`
4. resume-agent M5 README task lists the `/insights` link

## Design

### Modules

- `src/components/icons.ts` — NEW: `ICONS` (moved from Header.astro)
- `src/components/Header.astro` — imports `ICONS`
- `src/pages/index.astro` — pills render `ICONS[icon]` before label; View CV `ICONS.pdf`
- `src/components/ChatWidget.astro` — notice gains "See how it's used" link to `/insights/` (new tab, focus ring)
- `test/pages/landing.test.ts`, `src/components/ChatWidget.test.ts` — icon per pill, insights link
- `../resume-agent/docs/tasks.md` — M5 README bullet mentions `/insights`

## Summary

Header icons moved to `icons.ts`; landing pills show them (View CV: document + arrow). Widget notice links `/insights/` in new tab so open chat survives. Backend M5 README task notes link (`tasks.md` gitignored there, local only).

[icons.ts](src/components/icons.ts) [Header.astro](src/components/Header.astro) [index.astro](src/pages/index.astro) [landing.test.ts](test/pages/landing.test.ts) [ChatWidget.astro](src/components/ChatWidget.astro) [ChatWidget.test.ts](src/components/ChatWidget.test.ts) [tasks.md](../resume-agent/docs/tasks.md)
