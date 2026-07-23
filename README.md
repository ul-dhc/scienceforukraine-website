# ScienceForUkraine Website

Static website for [scienceforukraine.eu](https://scienceforukraine.eu) — an NGO supporting Ukrainian academics during Russia's war. The site aggregates support listings, funding programmes, and news for Ukrainian researchers and students.

## Prerequisites

- [Node.js](https://nodejs.org/) 22 or later
- Internet access (the build fetches live data from Google Sheets)

## Getting Started

```bash
npm install
npm run build
```

This generates the full static site into `dist/`. There is no dev server — to preview locally, serve the `dist/` directory with any static file server (e.g. `npx serve dist`).

## How It Works

This is a **custom static site generator** with no framework. The single build command (`node scripts/build.js`) does everything:

1. **Fetches data** — `scripts/listings.js` and `scripts/funding-programmes.js` pull CSV data from published Google Sheets via `papaparse` and normalize rows into structured JSON
2. **Generates HTML** — Pages are rendered by combining `src/partials/page-template.html` (a shell with `{{PLACEHOLDER}}` substitution) with content generators. Markdown pages use `marked`; special pages (home, news, listings, funding programmes) have dedicated HTML-generating functions in `build.js`
3. **Generates a world map** — `scripts/world-map.js` produces an SVG world map at build time using `d3-geo`, `topojson`, and `@turf/turf`, with Crimea correctly attributed to Ukraine
4. **Outputs static files** — Everything is written to `dist/`, including per-item share-preview redirect pages and a `search-index.json` for client-side search

### Project Structure

```
scripts/              Node.js build scripts (CommonJS)
  build.js            Main build orchestrator
  listings.js         Fetches & normalizes listing data from Google Sheets
  funding-programmes.js  Fetches & normalizes programme data from Google Sheets
  world-map.js        SVG world map generator
  constants.js        Shared filter option constants (disciplines, open-for, categories)
  icons.js            Inline SVG icon helper

src/
  partials/           HTML template shell (header, footer, page-template)
  assets/css/         Stylesheets (plain CSS, no preprocessor)
  assets/js/          Client-side JS (vanilla, no bundler) — each file is an IIFE

public/
  pages/              Markdown content pages and news.json
  media/              Static images and PDFs (copied as-is to dist/)

dist/                 Build output (not committed)
```

### Page Routing

Pages are defined in the `PAGES` array in `build.js`. Each entry specifies a `slug`, `template` type, and optional `extraScripts`. Simple pages render their markdown file from `public/pages/{slug}.md`. Special templates (`home`, `news`, `listings`, `programmes`) have dedicated rendering logic in `build.js`.

### Client-Side Data Flow

Listings and programmes data is embedded as `<script type="application/json">` blocks in the HTML at build time. Client-side JS (`src/assets/js/listings.js`, `programmes.js`) parses this JSON and handles filtering, sorting, pagination, and detail views entirely in the browser — no API calls needed after page load.

## Deployment

The site is deployed to **GitHub Pages** via **GitHub Actions**.

### How it works

The workflow is defined in `.github/workflows/deploy.yml`:

1. **Trigger** — Any push to the `main` branch, or a manual trigger via `workflow_dispatch`
2. **Build job** — Runs on `ubuntu-latest` with Node 22:
   - Checks out the repository
   - Runs `npm install` and `npm run build`
   - Uploads the `dist/` directory as a Pages artifact using `actions/upload-pages-artifact@v3`
3. **Deploy job** — Runs after the build job completes:
   - Deploys the uploaded artifact to GitHub Pages using `actions/deploy-pages@v4`
   - The repository must have GitHub Pages configured to deploy from **GitHub Actions** (not from a branch) under Settings > Pages

The workflow uses a concurrency group (`pages`) with `cancel-in-progress: true`, so if a new push arrives while a deploy is running, the old deploy is cancelled.

### Permissions

The workflow requires three permissions on the `GITHUB_TOKEN`:
- `contents: read` — to check out the repository
- `pages: write` — to deploy to GitHub Pages
- `id-token: write` — for Pages deployment authentication (OIDC)

### Configuration

Deployment-related constants are at the top of `scripts/build.js`:

| Constant | Purpose |
|---|---|
| `SITE_URL` | Canonical site URL (`https://scienceforukraine.eu`), used for OG tags |
| `BASE_PATH` | Path prefix for GitHub Pages subdirectory deployments (empty for root domain) |
| `DEPLOY_URL` | Computed from `BASE_PATH` and `SITE_URL`, used for absolute URLs in meta tags |

### Deploying to a different GitHub Pages setup

To deploy under a repository subdirectory (e.g. `https://username.github.io/repo-name/`):
1. Set `BASE_PATH` in `build.js` to `'/repo-name'`

To deploy with a custom domain:
1. Leave `BASE_PATH` empty
2. Configure your custom domain in your GitHub repository's Pages settings and DNS ([GitHub docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-github-pages))

## License

ISC
