# $martDollar

A smart, friendly, private, free personal finance app — manage, save, invest, and grow your money. Built as a local-first Progressive Web App with **zero paid dependencies**.

> **Try it locally in 30 seconds:** double-click `index.html` (or run a local
> static server — see below). All your data stays on your device.

---

## Highlights

- **Local-first.** All data is stored in your browser via IndexedDB. No accounts, no servers, no analytics, no cookies.
- **Free everywhere.** Open-source, no API keys, deployable to GitHub Pages or Cloudflare Pages at no cost.
- **PWA-ready.** Install to your home screen, works offline after first load.
- **Modern glassmorphism UI.** Frosted-glass cards, ambient gradients, gradient progress bars with subtle shimmer.
- **Accessible.** Keyboard-navigable, semantic HTML, AA-contrast palette, table fallbacks for charts, reduced-motion friendly.
- **Mobile-first.** Responsive layout, large touch targets, bottom-tab nav on small screens.
- **Plain-language.** No jargon — $martDollar explains as it goes.

---

## Features

| Area | What's included |
|---|---|
| **Onboarding** | 6-step guided setup (under 60 seconds): name, currency, pay frequency, primary goal. |
| **Dashboard** | Income / expenses / savings / cash-flow stat cards, donut chart of spending, 6-month trend line, recent activity, contextual tips. |
| **Transactions** | Add / edit / delete; expense, income, or savings; categories; merchant + notes; recurring flag; search & filter; CSV export. |
| **Budget engine** | Per-category monthly limits; 85% / 100% overspend alerts; "on track / almost / over" status; remaining balance. |
| **Goals** | Savings, emergency fund, big-purchase, custom goals; progress bar; auto-computed monthly amount needed to hit target date. |
| **Debt planner** | Track accounts (balance, APR, minimum); side-by-side **snowball vs avalanche** payoff projection in months and total interest. |
| **Learn** | 25 plain-language lessons across 5 topics (Foundations, Saving, Debt, Investing, Growing wealth), filterable topic chips, financial glossary. |
| **Privacy & data** | Export full backup (JSON) or transactions (CSV), import backup, delete-all-data with confirmation. |
| **PWA** | Installable, offline-first service worker, themed splash, app icons. |

---

## Tech stack

All free and open-source. No build step required.

- **Vanilla JavaScript** (ES2020) — fast, no toolchain needed
- **Dexie.js** — IndexedDB wrapper for local storage
- **Chart.js** — accessible charts with table fallbacks
- **Pure CSS** with design tokens — calm teal/amber palette, dark mode aware, glassmorphism

The architecture document references React + Vite + TypeScript as a future
upgrade path. The same domain logic translates directly. $martDollar's vanilla
JS approach was chosen so the app:

1. Deploys as static files (no build step)
2. Runs from a single HTML file if needed
3. Has a tiny dependency footprint (~80 KB of CDN deps, gzipped)

---

## Run locally

```bash
# Option 1 — Python (most systems)
python3 -m http.server 8080

# Option 2 — Node
npx http-server . -p 8080

# Option 3 — just double-click index.html
# (Service worker won't register from file:// but the app still works.)
```

Open http://localhost:8080 in any modern browser.

---

## Deploy

For complete deployment instructions — covering desktop browsers, iOS, Android,
GitHub Pages, Cloudflare Pages, Netlify, and self-hosting — see
**[DEPLOYMENT.md](DEPLOYMENT.md)**.

A pre-configured GitHub Actions workflow is included at
`.github/workflows/deploy.yml`.

---

## Privacy notice

$martDollar is designed to be private by default:

- Every record (transactions, budgets, goals, debts) is stored in your browser's IndexedDB. **Nothing leaves your device.**
- Two external scripts (Dexie and Chart.js) are loaded from `cdn.jsdelivr.net` on first visit. After that the service worker caches them locally and the app works offline. No user data is sent to those CDNs.
- There are no cookies, no fingerprinting, no analytics.
- Clearing your browser's site data **will erase your records.** Use **Settings → Export full backup** regularly.

---

## Accessibility

$martDollar targets WCAG 2.1 AA. Implemented patterns include:

- Semantic landmarks (`<header>`, `<nav>`, `<main>`, `<aside>`)
- Skip-to-main link
- All icons have `aria-hidden="true"` with text labels
- Charts include `<details>` + `<table>` fallbacks
- Focus-visible outlines (3px teal halo)
- Color contrast ≥ 4.5:1 for text, ≥ 3:1 for non-text
- Forms with associated labels and inline error messages
- `prefers-reduced-motion` respected
- Bottom-tab nav on mobile sized for touch (44 px+)

---

## Project layout

```
.
├── index.html              # App shell + design system (CSS tokens, layout)
├── app.js                  # All app logic (DB, state, router, pages)
├── manifest.webmanifest    # PWA manifest
├── service-worker.js       # Offline cache
├── README.md               # This file
├── DEPLOYMENT.md           # Step-by-step deployment guide
└── .github/workflows/
    └── deploy.yml          # Free GitHub Pages auto-deploy
```

---

## Roadmap

The included MVP covers Phase 1, 2, and most of Phase 3 of the architecture
document. Future enhancements that would build naturally on this foundation:

- Optional encrypted backup file using the Web Crypto API
- React + Vite + TypeScript port for larger feature surface
- Optional self-hosted Node + SQLite backend for multi-device sync
- Recurring transaction auto-generation
- More lessons & language localizations
- Printable PDF reports

---

## License

MIT. Use it, modify it, share it.
