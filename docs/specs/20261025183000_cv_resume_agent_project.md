---
title: CV personal project — Resume Agent
status: implemented
refs:
  [
    20260916214943_experience_restyle_projects.md,
    20260926194513_cv_language_switch.md,
  ]
---

## Brainstorm

Add `niconisoria/resume-agent` (public) to CV Personal Projects, EN + PL, first in list (newest, most relevant: AI agent work). Claims only what repo shows: FastAPI + Anthropic SDK agent loop (no framework), RAG with citations over Neon pgvector (Voyage embeddings), 4 tools incl. GitHub Issues handoff, SSE to Deep Chat widget on this site, Phoenix tracing, CI model-graded eval gate before Fly.io deploy, rate limits + daily budget, public `/insights`.

Constraints: same shape as other projects (title, href, achievements with `**bold**`, stack). PL mirrors EN count/stack/href (existing parity test). PDFs regenerated via `npm run pdf`.

## Story

As recruiter, want to see Nicolas's resume-agent project on CV, so I see hands-on AI agent work with a working demo.

AC:

1. Personal Projects lists "Resume Agent" first, linking to GitHub repo, in EN and PL
2. 4 bullets + stack, same style as other projects
3. EN/PL PDFs (public and ATS) include it

## Design

### Modules

- `src/data/resume.en.ts`, `src/data/resume.pl.ts` — new first `personalProjects` entry
- `src/data/resume.test.ts` — resume-agent first in both languages
- `public/resume/*.pdf` — regenerated

## Summary

Resume Agent added first in Personal Projects (EN + PL): RAG agent, no-framework tool loop, CI eval gate, cost controls + public insights. PDFs regenerated.
