# CLAUDE.md — resume

## Iron Laws

1. **Spec first** — no code without a spec file in `docs/specs/`.
2. **Test first** — write failing tests before implementation.
3. **Verify before done** — run the app and confirm the feature works end-to-end before closing a task.
4. **No secrets in code** — credentials/tokens go in `.env` (never committed).
5. **CLAUDE.md < 200 lines** — move detail into linked docs, not here.

---

## Tech Stack

| Layer     | Choice                                                           |
| --------- | ---------------------------------------------------------------- |
| Language  | JavaScript/TypeScript                                            |
| Framework | Astro 7                                                          |
| Styling   | Tailwind CSS 4 (`@tailwindcss/vite`)                             |
| Runtime   | Node.js ≥22.12                                                   |
| Test      | `npm test` (Vitest + Astro Container API)                        |
| Verify    | `astro check`                                                    |
| Lint      | `npm run lint` (ESLint + eslint-plugin-astro)                    |
| Format    | `npm run format` (Prettier + prettier-plugin-astro/-tailwindcss) |

- framework: vitest
- test_cmd: npm test

---

## Project Map

```
resume/
├── CLAUDE.md              ← you are here (symlink → AGENTS.md)
├── astro.config.mjs
├── package.json
├── docs/
│   └── specs/             ← one .md per feature (brainstorm → stories → flows → impl)
├── src/
│   ├── assets/             ← static images/svg used by components
│   ├── components/         ← Astro UI components
│   ├── layouts/             ← page layout wrappers
│   └── pages/               ← file-based routes
└── public/                 ← static files served as-is (favicon etc)
```

---

## Dev Server

Run in background:

```
astro dev --background
```

Manage with `astro dev stop`, `astro dev status`, `astro dev logs`.

---

## Docs

- [docs/specs/](docs/specs/) — feature specs (start here for any new work)
- [Astro routing](https://docs.astro.build/en/guides/routing/)
- [Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Content collections](https://docs.astro.build/en/guides/content-collections/)
- [Styling / Tailwind](https://docs.astro.build/en/guides/styling/)
- [i18n](https://docs.astro.build/en/guides/internationalization/)
