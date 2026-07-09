# scienceforukraine.eu — static site (phase 1: informational pages)

This replaces the informational pages of the old Vue/Netlify app with plain,
dependency-light static HTML + CSS, built with a small Node script.
**The listings/institutions "database" pages are intentionally not part of
this yet** — those come next, generated from the Google Sheet as discussed.

## Why this structure

- **No framework runtime.** Pages are plain HTML files generated once at
  build time. Nothing fetches data or renders templates in the visitor's
  browser except the ~30-line menu-toggle script.
- **Content stays in Markdown**, in the exact same `public/pages/*.md` files
  and format the old site used — so whoever edits page copy doesn't need to
  learn anything new.
- **Every route the old Vue Router defined for these pages is reproduced
  exactly**, as a real folder + `index.html`, so links don't change:
  `/`, `/help`, `/support`, `/about`, `/press`, `/partners`, `/donate`, `/mtg`.

## Structure

```
public/pages/*.md        content — unchanged from the old site
public/media/*           images/PDFs referenced from the content
src/assets/css/*.css     styles, split by concern:
                            base.css        design tokens, resets, typography
                            navigation.css  header / mobile menu
                            markdown.css    rendered markdown content
                            home.css        homepage link-grid layout
src/assets/js/nav.js     mobile menu toggle + active-link highlighting
src/assets/img/logo.svg  logo
src/assets/fonts/*       Inter webfont
src/partials/
  header.html            shared site header, included on every page
  page-template.html     HTML shell (head/meta/OG tags) every page is wrapped in
scripts/build.js         the build script — reads the above, writes dist/
dist/                    ⟵ build output, this is what gets deployed
```

## Building

```
npm install
npm run build
```

Output goes to `dist/`. Preview locally with any static server, e.g.:

```
npx serve dist
```

## Adding or editing a page

- **Editing existing copy** (About, Help, Support, etc.) → just edit the
  corresponding file in `public/pages/*.md` and rebuild. No HTML/CSS touched.
- **Adding a brand-new informational page** → add a `.md` file in
  `public/pages/`, then add one entry to the `PAGES` array in
  `scripts/build.js` with its slug/title/description.

## Deploying

This is a static output folder — deploy `dist/` to GitHub Pages (or any
static host). No server-side code, no build-time secrets. See the separate
notes on setting up the GitHub Actions workflow for this.

## What's next (not in this phase)

- `/listings`, `/institutions`, `/d/:id`, `/i/:id` — generated from the
  Google Sheet at build time, one static page per row, per the plan already
  discussed. Will plug into this same `dist/` output and reuse
  `header.html` / `page-template.html` / the CSS files here unchanged.
