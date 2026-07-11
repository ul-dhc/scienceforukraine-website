const fs = require('fs')
const path = require('path')
const { marked } = require('marked')
const { icon } = require('./icons')
const { fetchListings } = require('./listings')
const { fetchProgrammes } = require('./funding-programmes')
const { generateWorldMap } = require('./world-map')

const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'src')
const PUBLIC = path.join(ROOT, 'public')
const DIST = path.join(ROOT, 'dist')

const SITE_URL = 'https://scienceforukraine.eu'

const CUSTOM_DOMAIN = ''

const BASE_PATH = '/scienceforukraine-website'

const DEPLOY_URL = BASE_PATH ? 'https://ul-dhc.github.io' + BASE_PATH : SITE_URL

const BUILD_VERSION = Date.now()

function applyBasePath (html) {
  if (!BASE_PATH) return html
  return html.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE_PATH}/`)
}

const PAGES = [
  {
    slug: '',
    name: 'home',
    title: 'Home',
    description: "#ScienceForUkraine supports the Ukrainian academic community in surviving Russia's war and helps ensure the continuity of Ukrainian research.",
    template: 'home',
    extraScripts: ['/assets/js/home.js']
  },
  { slug: 'help', name: 'help', title: 'How You Can Help', description: 'Ways to support the Ukrainian academic community: donate, or submit a support offer.' },
  { slug: 'support', name: 'support', title: 'Funding Programmes and Other Support', description: 'A country-by-country list of funding programmes and support initiatives for Ukrainian researchers and students.' },
  { slug: 'funding-programmes', name: 'funding-programmes', title: 'Funding & Support Programmes', description: 'A curated archive of funding programmes, fellowships, grants, and support opportunities for Ukrainian researchers and students.', template: 'programmes', extraScripts: ['/assets/js/programmes.js'] },
  { slug: 'about', name: 'about', title: 'About Us', description: 'Who we are, our mission, and the people behind #ScienceForUkraine.' },
  { slug: 'press', name: 'press', title: 'Press & Media', description: 'Press releases, media coverage, and press materials for #ScienceForUkraine.' },
  { slug: 'partners', name: 'partners', title: 'Our Partners', description: 'Organisations, institutions and companies supporting #ScienceForUkraine.' },
  { slug: 'donate', name: 'donate', title: 'Donate', description: 'Support #ScienceForUkraine and the Academic Micro Travel Grant programme.' },
  { slug: 'mtg', name: 'mtg', title: 'Micro Travel Grant Programme', description: 'The #ScienceForUkraine Micro Travel Grant Programme for early-career scholars based in Ukraine.' },
  { slug: 'news', name: 'news', title: 'Latest Updates', description: 'News and announcements from #ScienceForUkraine.', template: 'news', extraScripts: ['/assets/js/news.js'] },
  { slug: 'listings', name: 'listings', title: 'Positions & Support Offers', description: 'Browse open funding, scholarship, position, and support listings for Ukrainian researchers and students.', template: 'listings', extraScripts: ['/assets/js/listings.js'] }
]

function read (p) {
  return fs.readFileSync(p, 'utf8')
}

function mkdirp (p) {
  fs.mkdirSync(p, { recursive: true })
}

function copyDir (from, to) {
  mkdirp(to)
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name)
    const dest = path.join(to, entry.name)
    if (entry.isDirectory()) {
      copyDir(src, dest)
    } else if (BASE_PATH && entry.name.endsWith('.css')) {
      const css = read(src).replace(/url\("\/(?!\/)/g, `url("${BASE_PATH}/`)
      fs.writeFileSync(dest, css)
    } else {
      fs.copyFileSync(src, dest)
    }
  }
}

function renderMarkdownFile (name) {
  const md = read(path.join(PUBLIC, 'pages', `${name}.md`))
  return marked.parse(md)
}

function escapeHtml (str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]))
}

const headerHtml = read(path.join(SRC, 'partials', 'header.html'))
const footerHtml = read(path.join(SRC, 'partials', 'footer.html'))
const pageTemplate = read(path.join(SRC, 'partials', 'page-template.html'))

function renderShell ({ page, title, description, url, contentHtml, extraScripts }) {
  const extraScriptsHtml = (extraScripts || [])
    .map(src => `  <script src="${src}?v=${BUILD_VERSION}"></script>`)
    .join('\n')
  const ogImage = `${DEPLOY_URL}/media/ScienceForUkraine-1128x191px-blue.png`

  return pageTemplate
    .replaceAll('{{TITLE}}', title)
    .replaceAll('{{DESCRIPTION}}', description)
    .replaceAll('{{URL}}', url)
    .replaceAll('{{PAGE}}', page)
    .replaceAll('{{OG_IMAGE}}', ogImage)
    .replaceAll('{{BUILD_VERSION}}', BUILD_VERSION)
    .replace('{{HEADER}}', headerHtml)
    .replace('{{FOOTER}}', footerHtml)
    .replace('{{CONTENT}}', contentHtml)
    .replace('{{EXTRA_SCRIPTS}}', extraScriptsHtml)
    .replace('{{BASE_PATH}}', BASE_PATH)
}

function writePage (slug, html) {
  const dir = slug === '' ? DIST : path.join(DIST, slug)
  mkdirp(dir)
  fs.writeFileSync(path.join(dir, 'index.html'), applyBasePath(html))
}

function actionLink ({ href, iconName, label, external, highlight }) {
  const targetAttr = external ? ' target="_blank" rel="noopener"' : ''
  const cls = highlight ? 'action-link action-link--highlight' : 'action-link'
  return `<a class="${cls}" href="${href}"${targetAttr}>${icon(iconName)}<span class="action-link__label">${label}</span>${icon('chevronRight', 'action-link__chevron')}</a>`
}

function homeContentHtml () {
  const newsByDate = readNewsByDate()
  const latest = newsByDate.slice(0, 2)

  const updatesHtml = latest.map(item => `
        <div class="updates-strip__item">
          <span class="updates-strip__item-date">${formatDate(item.date)}</span>
          <div class="updates-strip__item-title">${escapeHtml(item.title || '')}</div>
          <a class="read-more" href="/news#${item.slug}">Read more ${icon('arrowRight')}</a>
        </div>`).join('')

  return `
      <section class="hero">
        <div class="hero__inner">
          <h1 class="hero__title">Supporting Ukrainian research.<br>Today and for the future.</h1>
          <p class="hero__subtitle">Since 26 February 2022, #ScienceForUkraine supports the Ukrainian academic community in surviving Russia&rsquo;s war and helps ensure the continuity of Ukrainian research and its presence in the international scholarly community.</p>
          <div class="hero__actions">
            <a class="btn btn-primary" href="#support-options">${icon('handHeart')} Find support</a>
            <a class="btn btn-secondary" href="/donate">${icon('heart')} Donate</a>
          </div>
        </div>
      </section>

      <div class="home-cards">
        <div class="card card--warm" id="support-options">
          <div class="card__header">
            <div class="icon-badge icon-badge--warm">${icon('users')}</div>
            <div class="card__title">For Ukrainian researchers and students</div>
         
          </div>
          <div class="card__links">
            ${actionLink({ href: '/listings', iconName: 'search', label: 'Positions and support listings' })}
            ${actionLink({ href: '/funding-programmes', iconName: 'gift', label: 'Funding programmes and other support' })}
            ${actionLink({ href: '/mtg', iconName: 'send', label: 'Micro Travel Grants', highlight: true })}
          </div>
        </div>

        <div class="card card--cool">
          <div class="card__header">
            <div class="icon-badge icon-badge--cool">${icon('handHeart')}</div>
            <div class="card__title">For international research community</div>
    
          </div>
          <div class="card__links">
            ${actionLink({ href: '/help', iconName: 'users', label: 'How can you help?', highlight: true })}
            ${actionLink({ href: 'https://docs.google.com/forms/d/e/1FAIpQLSe0a7SOe1BeSbZsI2py43gaC2MgpuaaiAcl5cqmskCxzeuHvg/viewform', iconName: 'fileEdit', label: 'Submit listing', external: true })}
            ${actionLink({ href: 'mailto:data@scienceforukraine.eu', iconName: 'edit', label: 'Request changes' })}
            ${actionLink({ href: '/donate', iconName: 'heart', label: 'Support Ukrainian scholars' })}
          </div>
        </div>

        <div class="card card--cool">
          <div class="card__header">
            <div class="icon-badge icon-badge--cool">${icon('info')}</div>
            <div class="card__title">About NGO<br>Science for Ukraine</div>
            
          </div>
          <div class="card__links">
            ${actionLink({ href: '/about', iconName: 'info', label: 'Our mission' })}
            ${actionLink({ href: '/press', iconName: 'newspaper', label: 'Press & media' })}
            ${actionLink({ href: '/partners', iconName: 'handshake', label: 'Our partners' })}
          </div>
        </div>
      </div>

      <div class="updates-strip">
        <div class="updates-strip__heading">
          <div class="icon-badge icon-badge--cool">${icon('megaphone')}</div>
          <div class="updates-strip__heading-text">
            <h2>Latest updates</h2>
            <a href="/news">View all updates ${icon('arrowRight')}</a>
          </div>
        </div>
        <div class="updates-strip__items">${updatesHtml}
        </div>
      </div>

      <div class="updates-strip search-strip" id="site-search">
        <div class="updates-strip__heading">
          <div class="icon-badge icon-badge--cool">${icon('search')}</div>
          <div class="updates-strip__heading-text">
            <h2>Search the website</h2>
            <p class="search-strip__subtitle">Search pages, support offers, funding programmes, and updates.</p>
          </div>
        </div>
        <div class="search-strip__input-area">
          <div class="search-strip__input-wrap">
            ${icon('search')}
            <input type="search" id="site-search-input" class="search-strip__input" placeholder="Search the full website..." autocomplete="off">
          </div>
          <div class="search-strip__results" id="site-search-results" hidden></div>
        </div>
      </div>`
}

function readNews () {
  const items = JSON.parse(read(path.join(PUBLIC, 'pages', 'news.json')))
  return items.slice().sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return new Date(b.date) - new Date(a.date)
  })
}

function readNewsByDate () {
  const items = JSON.parse(read(path.join(PUBLIC, 'pages', 'news.json')))
  return items.slice().sort((a, b) => new Date(b.date) - new Date(a.date))
}

function formatDate (isoDate) {
  if (!isoDate) return ''
  const d = new Date(isoDate + 'T00:00:00Z')
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

function newsContentHtml () {
  const items = readNews()

  const cardsHtml = items.map((item, i) => {
    const pinnedClass = item.pinned ? ' update-card--pinned' : ''
    const openAttr = ''
    const pinnedLabel = item.pinned ? `<span class="update-card__pin-label" title="Pinned update" aria-label="Pinned update">${icon('pin')}</span>` : ''
    const bodyParagraphs = (item.body || '').split('\n\n').filter(Boolean).map(p => {
      const withBold = escapeHtml(p).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      const withLinks = withBold.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
        const external = /^https?:\/\//.test(url)
        const targetAttr = external ? ' target="_blank" rel="noopener"' : ''
        return `<a href="${url}"${targetAttr}>${label}</a>`
      })
      return `<p>${withLinks}</p>`
    }).join('')
    const bodyImage = item.image ? `<img class="update-card__image" src="${item.image}" alt="">` : ''
    const readMoreLink = item.link ? `<a class="update-card__external-link" href="${item.link}" target="_blank" rel="noopener">Read more ${icon('arrowRight')}</a>` : ''
    const excerptHtml = item.excerpt ? `<div class="update-card__excerpt">${escapeHtml(item.excerpt)}</div>` : ''

    return `
        <details class="update-card${pinnedClass}" id="${item.slug}"${openAttr}>
          <summary class="update-card__summary">
            <div class="update-card__main">
              ${pinnedLabel}
              <div class="update-card__title-row">
                <span class="update-card__title">${escapeHtml(item.title || '')}</span>
                <button type="button" class="update-card__copy-link" data-slug="${item.slug}" aria-label="Copy link to this update" title="Copy link to this update">${icon('link')}</button>
              </div>
              ${excerptHtml}
              <span class="update-card__date">${formatDate(item.date)}</span>
            </div>
            <div class="update-card__toggle-group">
              <span class="update-card__toggle">${icon('chevronDown')}</span>
            </div>
          </summary>
          <div class="update-card__body">${bodyImage}${bodyParagraphs}${readMoreLink}</div>
        </details>`
  }).join('')

  return `
      <div class="news-header">
        <h1 class="news-header__title">Latest updates</h1>
        <p class="news-header__subtitle">News and announcements from #ScienceForUkraine.</p>
        <div class="news-toolbar">
          <div class="news-toolbar__buttons">
            <button type="button" class="news-toolbar__btn" id="expand-all">${icon('chevronDown')} Expand all</button>
            <button type="button" class="news-toolbar__btn" id="collapse-all">${icon('chevronDown')} Collapse all</button>
          </div>
        </div>
      </div>
      <div class="news-list">${cardsHtml}
      </div>`
}

const CATEGORY_OPTIONS = ['Position', 'Scholarship', 'Joint application', 'Resources', 'Mentoring', 'Academic transfer']
const DISCIPLINE_OPTIONS = [
  ['naturalSciences', 'Natural sciences'],
  ['socialSciences', 'Social sciences'],
  ['humanitiesAndTheArts', 'Humanities & the arts'],
  ['engineeringAndTechnology', 'Engineering & technology'],
  ['medicalAndHealthSciences', 'Medical & health sciences'],
  ['agriculturalAndVeterinarySciences', 'Agricultural & veterinary sciences'],
  ['unspecified', 'Unspecified']
]
const OPEN_FOR_OPTIONS = [
  ['researchers', 'Researchers'],
  ['doctoralStudents', 'Doctoral students'],
  ['students', 'Students'],
  ['others', 'Others']
]

function pillGroup (filterKey, options) {
  const pills = options.map(opt => {
    const [value, label] = Array.isArray(opt) ? opt : [opt, opt]
    return `<button type="button" class="filter-pill" data-filter="${filterKey}" data-value="${value}">${label}</button>`
  }).join('')
  return `<button type="button" class="filter-pill is-active" data-filter="${filterKey}" data-value="">Any</button>${pills}`
}

function listingsContentHtml (openListings, closedListings) {
  const countries = [...new Set(openListings.map(l => l.country).filter(Boolean))].sort()
  const countryOptions = countries.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')
  const dataJson = JSON.stringify({ open: openListings, closed: closedListings }).replace(/</g, '\\u003c')

  return `
      <div class="listings-header">
        <h1 class="listings-header__title">Positions &amp; Support Offers</h1>
        <p class="listings-header__subtitle">A growing collection of positions, mentoring, research visits, and support offers for Ukrainian researchers and students.</p>
        <div class="listings-stats">
          <div class="listings-stat">${icon('search')}<span class="listings-stat__value">${openListings.length}</span><span class="listings-stat__label">listings</span></div>
          <div class="listings-stat">${icon('globePin')}<span class="listings-stat__value">${countries.length}</span><span class="listings-stat__label">countries represented</span></div>
          <div class="listings-stat">${icon('refresh')}<span class="listings-stat__value">Rolling</span><span class="listings-stat__label">new listings added regularly</span></div>
        </div>
        <div class="listings-banner">
          ${icon('info')}
          <p>#ScienceForUkraine cannot guarantee that any given opportunity is still open, or that the host institution will respond. If you are affiliated with a listing and would like it corrected or removed, please contact <a href="mailto:data@scienceforukraine.eu">data@scienceforukraine.eu</a>. Know of an opportunity that should be listed? <a href="https://docs.google.com/forms/d/e/1FAIpQLSe0a7SOe1BeSbZsI2py43gaC2MgpuaaiAcl5cqmskCxzeuHvg/viewform" target="_blank" rel="noopener">Submit a listing</a>.</p>
        </div>
        <div class="listings-crosslink">
          ${icon('arrowRight')}
          <span>Looking for general funding programmes, fellowships, and grants? <br><a href="/funding-programmes">Browse Funding &amp; Support Programmes &rarr;</a></span>
        </div>
      </div>
      <div class="listings-page">
        <aside class="listings-filters" id="listings-filters">
          <input type="search" id="lf-search" class="listings-search" placeholder="Search">

          <div class="filter-group">
            <span class="filter-label">Category</span>
            <div class="filter-pills">${pillGroup('category', CATEGORY_OPTIONS)}</div>
          </div>

          <div class="filter-group">
            <span class="filter-label">Country</span>
            <select id="lf-country" class="listings-select">
              <option value="">Any</option>
              ${countryOptions}
            </select>
          </div>

          <div class="filter-group">
            <span class="filter-label">Discipline</span>
            <div class="filter-pills">${pillGroup('discipline', DISCIPLINE_OPTIONS)}</div>
          </div>

          <div class="filter-group">
            <span class="filter-label">Open for</span>
            <div class="filter-pills">${pillGroup('openFor', OPEN_FOR_OPTIONS)}</div>
          </div>

          <label class="filter-toggle">
            <span>Remote</span>
            <input type="checkbox" id="lf-remote">
          </label>
          <label class="filter-toggle">
            <span>Accommodation</span>
            <input type="checkbox" id="lf-accommodation">
          </label>

          <button type="button" class="listings-clear" id="lf-clear">Clear filters</button>
        </aside>

        <main class="listings-main">
          <div class="listings-toolbar">
            <div class="listings-count" id="listings-count"></div>
            <label class="listings-sort">
              <span>Sort by</span>
              <select id="lf-sort">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="institution">Institution A&ndash;Z</option>
                <option value="country">Country A&ndash;Z</option>
              </select>
            </label>
          </div>
          <div class="programmes-active-filters" id="listings-active-filters"></div>
          <div class="listings-list" id="listings-list"></div>
          <div class="programmes-pagination" id="listings-pagination">
            <label class="programmes-page-size">
              <span>Show</span>
              <select id="lf-page-size">
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="all">All</option>
              </select>
              <span>per page</span>
            </label>
            <div class="programmes-pagination__controls" id="listings-pagination-controls"></div>
          </div>
        </main>

        <div class="listing-detail" id="listing-detail" hidden></div>
      </div>
      <script id="listings-data" type="application/json">${dataJson}</script>`
}

const DISCIPLINE_LABELS_P = [
  ['naturalSciences', 'Natural sciences'],
  ['socialSciences', 'Social sciences'],
  ['humanitiesAndTheArts', 'Humanities & the arts'],
  ['engineeringAndTechnology', 'Engineering & technology'],
  ['medicalAndHealthSciences', 'Medical & health sciences'],
  ['agriculturalAndVeterinarySciences', 'Agricultural & veterinary sciences'],
  ['unspecified', 'Discipline unspecified']
]
const OPEN_FOR_LABELS_P = [
  ['doctoralStudents', 'Doctoral students'],
  ['researchers', 'Researchers'],
  ['students', 'Students'],
  ['institutions', 'Institutions']
]

function checkboxDropdown (id, label, options) {
  const items = options.map(([value, text]) =>
    `<label class="programmes-multiselect__option"><input type="checkbox" value="${value}" data-filter-key="${id}"> ${text}</label>`
  ).join('')
  return `
          <span class="programmes-multiselect" id="${id}-wrap">
            <button type="button" class="programmes-select programmes-multiselect__button" id="${id}-button" aria-haspopup="true" aria-expanded="false">
              ${label}
              <span class="programmes-select-badge" id="${id}-badge" hidden></span>
            </button>
            <div class="programmes-multiselect__panel" id="${id}-panel" hidden>${items}</div>
          </span>`
}

function programmesContentHtml (programmes) {
  const countries = [...new Set(programmes.map(p => p.country).filter(Boolean))].sort()
  const types = [...new Set(programmes.flatMap(p => p.types))].sort()
  const dataJson = JSON.stringify(programmes).replace(/</g, '\\u003c')

  const map = generateWorldMap(programmes)

  return `
      <div class="programmes-header">
        <h1 class="programmes-header__title">Funding &amp; Support Programmes</h1>
        <div id="programmes-header-extra">
          <p class="programmes-header__subtitle">A curated archive of funding programmes, fellowships, grants, and support opportunities for Ukrainian researchers and students.</p>
          <div class="programmes-stats">
            <div class="programmes-stat">${icon('archive')}<span class="programmes-stat__value">${programmes.length}</span><span class="programmes-stat__label">archive listings</span></div>
            <div class="programmes-stat">${icon('globePin')}<span class="programmes-stat__value">${countries.length}</span><span class="programmes-stat__label">countries represented</span></div>
            <div class="programmes-stat">${icon('refresh')}<span class="programmes-stat__value">Rolling</span><span class="programmes-stat__label">new listings added regularly</span></div>
          </div>
        </div>
        <div class="programmes-banner">
          ${icon('info')}
          <p><strong>This archive is updated on a rolling basis.</strong> Listings accumulate over time, and deadlines or programme status may change. Please check the original source for the latest information. Know of a current or past funding programme that isn&rsquo;t listed here? <a href="#submit-programme">Submit a programme</a>.</p>
        </div>
        <div id="programmes-header-extra-2">
          <div class="programmes-crosslink">
            ${icon('arrowRight')}
            <span>Looking for individual positions, mentorship, and other direct opportunities? <br><a href="/listings">Browse Positions &amp; Support Offers &rarr;</a></span>
          </div>
        </div>
      </div>

      <div class="programmes-page">
        <div class="programmes-results-area" id="programmes-results-area">
        <div class="programmes-toolbar">
          <input type="search" id="pf-search" class="programmes-search" placeholder="Search programmes, institutions, keywords...">
          ${checkboxDropdown('pf-country', 'Country', countries.map(c => [escapeHtml(c), escapeHtml(c)]))}
          ${checkboxDropdown('pf-discipline', 'Discipline', DISCIPLINE_LABELS_P)}
          ${checkboxDropdown('pf-open-for', 'Open for', OPEN_FOR_LABELS_P)}
          ${checkboxDropdown('pf-type', 'Type', types.map(t => [escapeHtml(t), escapeHtml(t)]))}
        </div>

        <div class="programmes-map-section" id="programmes-map-section">
          <button type="button" class="programmes-map-collapse" id="pf-map-collapse"><span class="programmes-map-collapse__label">Collapse map</span> ${icon('chevronDown')}</button>
          <div class="programmes-map-section__body" id="programmes-map-body">
            <div class="programmes-map">
              <div class="programmes-map__heading">Countries covered in this archive</div>
              <div class="programmes-map__subheading">Programmes in <strong id="programmes-map-country-count">${countries.length} countries</strong> (past and present)</div>
              <div class="world-map-viewport" id="world-map-viewport" data-default-scale="${map.defaultZoom.scale}" data-default-x="${map.defaultZoom.x}" data-default-y="${map.defaultZoom.y}">
                <div class="world-map-zoom-controls">
                  <button type="button" id="pf-map-zoom-in" aria-label="Zoom in">+</button>
                  <button type="button" id="pf-map-zoom-out" aria-label="Zoom out">&minus;</button>
                  <button type="button" id="pf-map-zoom-reset">Reset view</button>
                </div>
                ${map.svg}
              </div>
            </div>
            <div class="programmes-top-countries">
              <div class="programmes-top-countries__heading">Top countries by archive listings</div>
              <div class="programmes-top-countries__list" id="programmes-top-countries-list"></div>
              <button type="button" class="programmes-top-countries__view-all" id="pf-view-all-countries">View all countries &rarr;</button>
            </div>
          </div>
        </div>
        <div class="programmes-map-tooltip" id="programmes-map-tooltip"></div>

        <div class="programmes-recent-toggles">
          <button type="button" class="programmes-chip-toggle" id="pf-recently-added">Recently added <span class="programmes-chip-toggle__hint">(last 2 months)</span></button>
          <label class="programmes-sort">
            <span>Sort by</span>
            <select id="pf-sort" class="programmes-select">
              <option value="newest">Newest added</option>
              <option value="oldest">Oldest added</option>
              <option value="title">Title A&ndash;Z</option>
              <option value="country">Country A&ndash;Z</option>
            </select>
          </label>
        </div>

        <div class="programmes-results-bar">
          <div class="programmes-count" id="programmes-count"></div>
          <div class="programmes-view-toggle">
            <button type="button" class="programmes-view-toggle__btn is-active" id="pf-view-grid">${icon('grid')} Grid</button>
            <button type="button" class="programmes-view-toggle__btn" id="pf-view-list">${icon('newspaper')} List</button>
          </div>
        </div>
        <div class="programmes-active-filters" id="programmes-active-filters"></div>

        <div class="programmes-grid" id="programmes-grid"></div>
        <div class="programmes-pagination" id="programmes-pagination">
          <label class="programmes-page-size">
            <span>Show</span>
            <select id="pf-page-size">
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="all">All</option>
            </select>
            <span>per page</span>
          </label>
          <div class="programmes-pagination__controls" id="programmes-pagination-controls"></div>
        </div>

        </div>
        <div class="programme-detail" id="programme-detail" hidden></div>

        <div class="programmes-submit-banner" id="submit-programme">
          <p>Do you know of a programme that should be listed here?</p>
          <button type="button" class="btn btn-outline" id="pf-submit-toggle">Submit a programme</button>
        </div>

        <form id="pf-submit-form" class="programmes-submit-form" hidden>
          <h3>Submit a programme</h3>
          <p class="programmes-submit-form__note">Just the title and a link are enough — we'll fill in the rest.</p>

          <label class="programmes-submit-form__field">
            <span>Title <em>(required)</em></span>
            <input type="text" name="title" required maxlength="200">
          </label>

          <label class="programmes-submit-form__field">
            <span>Link <em>(required)</em></span>
            <input type="url" name="link" required placeholder="https://" maxlength="500">
          </label>

          <label class="programmes-submit-form__field">
            <span>Country <em>(optional)</em></span>
            <input type="text" name="country" maxlength="100">
          </label>

          <label class="programmes-submit-form__field">
            <span>Anything else we should know? <em>(optional)</em></span>
            <textarea name="notes" rows="3" maxlength="1000"></textarea>
          </label>

          <label class="programmes-submit-form__honeypot" aria-hidden="true">
            <span>Leave this field empty</span>
            <input type="text" name="hp_extra_field_2847" tabindex="-1" autocomplete="new-password">
          </label>

          <div class="programmes-submit-form__actions">
            <button type="submit" class="btn btn-primary" id="pf-submit-button">Submit</button>
            <span class="programmes-submit-form__status" id="pf-submit-status"></span>
          </div>
        </form>
      </div>
      <script id="programmes-data" type="application/json">${dataJson}</script>`
}

function stripHtml (html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function buildSearchIndex (listingsData, programmesData) {
  const index = []

  listingsData.open.forEach(l => {
    index.push({
      type: 'listing',
      title: l.institution || l.id,
      snippet: l.description || l.category || '',
      url: `/listings#${encodeURIComponent(l.id)}`
    })
  })

  programmesData.forEach(p => {
    index.push({
      type: 'programme',
      title: p.title,
      snippet: p.description || p.country || '',
      url: `/funding-programmes#${encodeURIComponent(p.id)}`
    })
  })

  readNews().forEach(n => {
    index.push({
      type: 'news',
      title: n.title || '',
      snippet: n.excerpt || '',
      url: `/news#${n.slug}`
    })
  })

  PAGES.filter(p => !p.template).forEach(p => {
    const text = stripHtml(renderMarkdownFile(p.name))
    index.push({
      type: 'page',
      title: p.title,
      snippet: text.slice(0, 220),
      url: `/${p.slug}`
    })
  })

  return index
}

function contentForPage (page, listingsData, programmesData) {
  if (page.template === 'home') return homeContentHtml()
  if (page.template === 'news') return newsContentHtml()
  if (page.template === 'listings') return listingsContentHtml(listingsData.open, listingsData.closed)
  if (page.template === 'programmes') return programmesContentHtml(programmesData)
  return `      <div class="markdown">${renderMarkdownFile(page.name)}</div>`
}

async function build () {
  fs.rmSync(DIST, { recursive: true, force: true })
  mkdirp(DIST)

  console.log('Fetching listings data...')
  const listingsData = await fetchListings(fetch)
  console.log(`Listings: ${listingsData.open.length} open, ${listingsData.closed.length} closed`)

  console.log('Fetching funding programmes data...')
  const programmesData = await fetchProgrammes(fetch)
  console.log(`Programmes: ${programmesData.length}`)

  for (const page of PAGES) {
    const url = `${SITE_URL}/${page.slug}`
    const fullTitle = page.slug === '' ? '#ScienceForUkraine' : `${page.title} – #ScienceForUkraine`
    const html = renderShell({
      page: page.name,
      title: fullTitle,
      description: page.description,
      url,
      contentHtml: contentForPage(page, listingsData, programmesData),
      extraScripts: page.extraScripts
    })
    writePage(page.slug, html)
    console.log(`built /${page.slug}`)
  }

  const searchIndex = buildSearchIndex(listingsData, programmesData)
  fs.writeFileSync(path.join(DIST, 'search-index.json'), JSON.stringify(searchIndex))
  console.log(`built search index: ${searchIndex.length} entries`)

  copyDir(path.join(SRC, 'assets'), path.join(DIST, 'assets'))
  copyDir(path.join(PUBLIC, 'media'), path.join(DIST, 'media'))
  fs.copyFileSync(path.join(PUBLIC, 'favicon.ico'), path.join(DIST, 'favicon.ico'))

  if (CUSTOM_DOMAIN) {
    fs.writeFileSync(path.join(DIST, 'CNAME'), CUSTOM_DOMAIN)
    console.log(`CNAME written for ${CUSTOM_DOMAIN}`)
  }

  console.log('\nDone. Output in /dist')
}

build().catch(err => {
  console.error(err)
  process.exit(1)
})
