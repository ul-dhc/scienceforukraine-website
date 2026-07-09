

const fs = require('fs')
const path = require('path')
const { marked } = require('marked')
const { icon } = require('./icons')

const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'src')
const PUBLIC = path.join(ROOT, 'public')
const DIST = path.join(ROOT, 'dist')

const SITE_URL = 'https://scienceforukraine.eu'


const CUSTOM_DOMAIN = ''


const BASE_PATH = '/scienceforukraine-website'

function applyBasePath (html) {
  if (!BASE_PATH) return html
  return html.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE_PATH}/`)
}

const PAGES = [
  {
    slug: '',
    name: 'home',
    title: 'Home',
    description: "#ScienceForUkraine supports the Ukrainian academic community in surviving Russia's war and helps ensure the continuity of Ukrainian science.",
    template: 'home'
  },
  { slug: 'help', name: 'help', title: 'How You Can Help', description: 'Ways to support the Ukrainian academic community: become a member, donate, or submit a support offer.' },
  { slug: 'support', name: 'support', title: 'Funding Programmes and Other Support', description: 'A country-by-country list of funding programmes and support initiatives for Ukrainian researchers and students.' },
  { slug: 'about', name: 'about', title: 'About Us', description: 'Who we are, our mission, and the people behind #ScienceForUkraine.' },
  { slug: 'press', name: 'press', title: 'Press & Media', description: 'Press releases, media coverage, and press materials for #ScienceForUkraine.' },
  { slug: 'partners', name: 'partners', title: 'Our Partners', description: 'Organisations, institutions and companies supporting #ScienceForUkraine.' },
  { slug: 'donate', name: 'donate', title: 'Donate', description: 'Support #ScienceForUkraine and the Academic Micro Travel Grant programme.' },
  { slug: 'mtg', name: 'mtg', title: 'Micro Travel Grant Programme', description: 'The #ScienceForUkraine Micro Travel Grant Programme for early-career scholars based in Ukraine.' },
  { slug: 'news', name: 'news', title: 'Latest Updates', description: 'News and announcements from #ScienceForUkraine.', template: 'news', extraScripts: ['/assets/js/news.js'] }
]

// ---- helpers -------------------------------------------------------------

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
    .map(src => `  <script src="${src}"></script>`)
    .join('\n')

  return pageTemplate
    .replaceAll('{{TITLE}}', title)
    .replaceAll('{{DESCRIPTION}}', description)
    .replaceAll('{{URL}}', url)
    .replaceAll('{{PAGE}}', page)
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

// ---- shared UI fragments --------------------------------------------------

function actionLink ({ href, iconName, label, external, highlight }) {
  const targetAttr = external ? ' target="_blank" rel="noopener"' : ''
  const cls = highlight ? 'action-link action-link--highlight' : 'action-link'
  return `<a class="${cls}" href="${href}"${targetAttr}>${icon(iconName)}<span class="action-link__label">${label}</span>${icon('chevronRight', 'action-link__chevron')}</a>`
}

// ---- home page content ----------------------------------------------------

function homeContentHtml () {
  const newsByDate = readNewsByDate()
  const latest = newsByDate.slice(0, 2)

  const updatesHtml = latest.map(item => `
        <div class="updates-strip__item">
          <span class="updates-strip__item-date">${formatDate(item.date)}</span>
          <div class="updates-strip__item-title">${escapeHtml(item.title)}</div>
          <a class="read-more" href="/news#${item.slug}">Read more ${icon('arrowRight')}</a>
        </div>`).join('')

  return `
      <section class="hero">
        <div class="hero__inner">
          <h1 class="hero__title">Supporting Ukrainian research.<br>Today and for the future.</h1>
          <p class="hero__subtitle">#ScienceForUkraine supports the Ukrainian academic community in surviving Russia&rsquo;s war and helps ensure the continuity of Ukrainian science and its presence in the international arena.</p>
          <div class="hero__actions">
            <a class="btn btn-primary" href="/listings">${icon('handHeart')} Find support</a>
            <a class="btn btn-secondary" href="/donate">${icon('heart')} Donate</a>
          </div>
        </div>
      </section>

      <div class="home-cards">
        <div class="card card--warm">
          <div class="card__header">
            <div class="icon-badge icon-badge--warm">${icon('users')}</div>
            <div class="card__title">For Ukrainian researchers and students</div>
            <div class="card__subtitle">Find opportunities, funding, and other support.</div>
          </div>
          <div class="card__links">
            ${actionLink({ href: '/listings', iconName: 'search', label: 'View all support listings' })}
            ${actionLink({ href: '/support', iconName: 'gift', label: 'Funding programs and other support' })}
            ${actionLink({ href: '/mtg', iconName: 'send', label: 'Micro travel grants', highlight: true })}
          </div>
        </div>

        <div class="card card--cool">
          <div class="card__header">
            <div class="icon-badge icon-badge--cool">${icon('handHeart')}</div>
            <div class="card__title">For International research community</div>
            <div class="card__subtitle">Help the community by contributing your time, skills, or resources.</div>
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
            <div class="card__title">About Us</div>
            <div class="card__subtitle">Learn more about our mission, activities, and partners.</div>
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
      </div>`
}

// ---- news page content ------------------------------------------------

function readNews () {
  const items = JSON.parse(read(path.join(PUBLIC, 'pages', 'news.json')))
  return items.slice().sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return new Date(b.date) - new Date(a.date)
  })
}

// homepage widget: purely chronological (no pinned-first override) —
// pinned-first ordering is specific to the /news page itself
function readNewsByDate () {
  const items = JSON.parse(read(path.join(PUBLIC, 'pages', 'news.json')))
  return items.slice().sort((a, b) => new Date(b.date) - new Date(a.date))
}

function formatDate (isoDate) {
  const d = new Date(isoDate + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

function newsContentHtml () {
  const items = readNews()

  const cardsHtml = items.map((item, i) => {
    const pinnedClass = item.pinned ? ' update-card--pinned' : ''
    const openAttr = item.pinned ? ' open' : ''
    const pinnedLabel = item.pinned ? '<span class="update-card__pin-label">Pinned update</span>' : ''
    const bodyParagraphs = item.body.split('\n\n').map(p => `<p>${escapeHtml(p)}</p>`).join('')

    return `
        <details class="update-card${pinnedClass}" id="${item.slug}"${openAttr}>
          <summary class="update-card__summary">
            <div class="update-card__main">
              ${pinnedLabel}
              <div class="update-card__title-row">
                <span class="update-card__title">${escapeHtml(item.title)}</span>
                <button type="button" class="update-card__copy-link" data-slug="${item.slug}" aria-label="Copy link to this update" title="Copy link to this update">${icon('link')}</button>
              </div>
              <div class="update-card__excerpt">${escapeHtml(item.excerpt)}</div>
              <span class="update-card__date">${formatDate(item.date)}</span>
            </div>
            <div class="update-card__toggle-group">
              <span class="update-card__toggle">${icon('chevronDown')}</span>
            </div>
          </summary>
          <div class="update-card__body">${bodyParagraphs}</div>
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

// ---- build ----------------------------------------------------------------

function contentForPage (page) {
  if (page.template === 'home') return homeContentHtml()
  if (page.template === 'news') return newsContentHtml()
  return `      <div class="markdown">${renderMarkdownFile(page.name)}</div>`
}

function build () {
  fs.rmSync(DIST, { recursive: true, force: true })
  mkdirp(DIST)

  for (const page of PAGES) {
    const url = `${SITE_URL}/${page.slug}`
    const html = renderShell({
      page: page.name,
      title: page.title,
      description: page.description,
      url,
      contentHtml: contentForPage(page),
      extraScripts: page.extraScripts
    })
    writePage(page.slug, html)
    console.log(`built /${page.slug}`)
  }

  // static assets
  copyDir(path.join(SRC, 'assets'), path.join(DIST, 'assets'))
  copyDir(path.join(PUBLIC, 'media'), path.join(DIST, 'media'))
  fs.copyFileSync(path.join(PUBLIC, 'favicon.ico'), path.join(DIST, 'favicon.ico'))

  if (CUSTOM_DOMAIN) {
    fs.writeFileSync(path.join(DIST, 'CNAME'), CUSTOM_DOMAIN)
    console.log(`CNAME written for ${CUSTOM_DOMAIN}`)
  }

  console.log('\nDone. Output in /dist')
}

build()
