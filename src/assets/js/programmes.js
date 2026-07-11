(function () {
  var dataEl = document.getElementById('programmes-data')
  if (!dataEl) return

  var programmes = JSON.parse(dataEl.textContent)
  var byId = {}
  programmes.forEach(function (p) { byId[p.id] = p })

  var NEW_THRESHOLD_DAYS = 60
  var INTERNATIONAL_KEY = '__INTERNATIONAL__'

  var gridEl = document.getElementById('programmes-grid')
  var countEl = document.getElementById('programmes-count')
  var searchInput = document.getElementById('pf-search')
  var countrySelect = document.getElementById('pf-country')
  var disciplineSelect = document.getElementById('pf-discipline')
  var openForSelect = document.getElementById('pf-open-for')
  var typeSelect = document.getElementById('pf-type')
  var sortSelect = document.getElementById('pf-sort')
  var recentlyAddedBtn = document.getElementById('pf-recently-added')
  var activeFiltersEl = document.getElementById('programmes-active-filters')
  var viewGridBtn = document.getElementById('pf-view-grid')
  var viewListBtn = document.getElementById('pf-view-list')
  var mapSection = document.getElementById('programmes-map-section')
  var mapBody = document.getElementById('programmes-map-body')
  var mapCollapseBtn = document.getElementById('pf-map-collapse')
  var mapCountryCountEl = document.getElementById('programmes-map-country-count')
  var topCountriesListEl = document.getElementById('programmes-top-countries-list')
  var viewAllCountriesBtn = document.getElementById('pf-view-all-countries')
  var tooltip = document.getElementById('programmes-map-tooltip')
  var detailEl = document.getElementById('programme-detail')
  var resultsSections = [
    document.querySelector('.programmes-toolbar'),
    document.querySelector('.programmes-recent-toggles'),
    mapSection,
    document.querySelector('.programmes-results-bar'),
    activeFiltersEl,
    gridEl
  ]

  var state = { search: '', country: '', discipline: '', openFor: '', type: '', sort: 'newest', recentlyAdded: false, view: 'grid' }
  var showingAllCountries = false

  function escapeHtml (str) {
    var div = document.createElement('div')
    div.textContent = str == null ? '' : String(str)
    return div.innerHTML
  }

  function daysAgo (dateStr) {
    if (!dateStr) return Infinity
    return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  }

  function isNew (p) { return daysAgo(p.dateAdded) <= NEW_THRESHOLD_DAYS }

  // matches everything EXCEPT the country filter — used by the map, so hovering
  // and clicking a country always show the same number (previously these could
  // disagree, since the map ignored whatever other filters were already active)
  function matchesExceptCountry (p) {
    if (state.discipline && !p.disciplines[state.discipline]) return false
    if (state.openFor && !p.openFor[state.openFor]) return false
    if (state.type && p.types.indexOf(state.type) === -1) return false
    if (state.recentlyAdded && !isNew(p)) return false
    if (state.search) {
      var q = state.search.toLowerCase()
      var haystack = [p.title, p.description, p.country].join(' ').toLowerCase()
      if (haystack.indexOf(q) === -1) return false
    }
    return true
  }

  function matches (p) {
    if (state.country === INTERNATIONAL_KEY) {
      if (p.country) return false
    } else if (state.country && p.country !== state.country) {
      return false
    }
    return matchesExceptCountry(p)
  }

  var SORTERS = {
    newest: function (a, b) { return (b.dateAdded || '').localeCompare(a.dateAdded || '') },
    oldest: function (a, b) { return (a.dateAdded || '').localeCompare(b.dateAdded || '') },
    title: function (a, b) { return a.title.localeCompare(b.title) },
    country: function (a, b) { return (a.country || '').localeCompare(b.country || '') }
  }

  function colorForCount (count) {
    if (count === 0) return '#F1F4F7'
    if (count <= 2) return '#DCEEFF'
    if (count <= 5) return '#9DC7F0'
    if (count <= 15) return '#4A90D9'
    return '#0057B7'
  }

  function tagsHtml (p) {
    var tags = ['<span class="programme-tag">' + escapeHtml(p.primaryType) + '</span>']
    p.types.forEach(function (t) {
      if (t !== p.primaryType) tags.push('<span class="programme-tag programme-tag--secondary">' + escapeHtml(t) + '</span>')
    })
    return tags.join('')
  }

  function disciplineLabel (p) {
    if (p.disciplines.unspecified) return 'All disciplines'
    var labels = { naturalSciences: 'Natural sciences', socialSciences: 'Social sciences', humanitiesAndTheArts: 'Humanities & the arts', engineeringAndTechnology: 'Engineering & technology', medicalAndHealthSciences: 'Medical & health sciences', agriculturalAndVeterinarySciences: 'Agricultural & veterinary sciences' }
    var matched = Object.keys(labels).filter(function (k) { return p.disciplines[k] })
    return matched.length ? matched.map(function (k) { return labels[k] }).join(', ') : 'Not specified'
  }

  function cardHtml (p) {
    return '' +
      '<a class="programme-card" href="#' + encodeURIComponent(p.id) + '">' +
        '<div class="programme-card__top">' +
          (isNew(p) ? '<span class="programme-card__new">NEW</span>' : '<span></span>') +
          '<span class="programme-card__id">' + escapeHtml(p.id) + '</span>' +
        '</div>' +
        '<div class="programme-card__title">' + escapeHtml(p.title) + '</div>' +
        '<div class="programme-card__country">' + icon_pin() + escapeHtml(p.country || 'International') + '</div>' +
        '<div class="programme-card__description">' + escapeHtml(p.description || '') + '</div>' +
        '<div class="programme-card__meta-label">Discipline</div><div class="programme-card__meta-value">' + escapeHtml(disciplineLabel(p)) + '</div>' +
        (p.deadline ? '<div class="programme-card__meta-label">Deadline</div><div class="programme-card__meta-value">' + escapeHtml(p.deadline) + '</div>' : '') +
        '<div class="programme-card__tags">' + tagsHtml(p) + '</div>' +
        (p.dateAdded ? '<div class="programme-card__added">Added ' + escapeHtml(p.dateAdded) + '</div>' : '') +
        '<span class="programme-card__link">View details &rarr;</span>' +
      '</a>'
  }

  function icon_pin () {
    return '<svg class="programme-card__pin-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>'
  }

  function listRowHtml (p) {
    return '' +
      '<a class="programme-row" href="#' + encodeURIComponent(p.id) + '">' +
        (isNew(p) ? '<span class="programme-card__new">NEW</span>' : '<span class="programme-row__spacer"></span>') +
        '<span class="programme-row__id">' + escapeHtml(p.id) + '</span>' +
        '<span class="programme-row__title">' + escapeHtml(p.title) + '</span>' +
        '<span class="programme-row__country">' + escapeHtml(p.country || 'International') + '</span>' +
        '<span class="programme-row__type">' + escapeHtml(p.primaryType) + '</span>' +
        (p.deadline ? '<span class="programme-row__deadline">Deadline: ' + escapeHtml(p.deadline) + '</span>' : '<span></span>') +
      '</a>'
  }

  function activeFilterChips () {
    var chips = []
    if (state.country) chips.push({ key: 'country', label: (state.country === INTERNATIONAL_KEY ? 'International' : state.country) })
    if (state.discipline) chips.push({ key: 'discipline', label: 'Discipline: ' + (disciplineSelect.options[disciplineSelect.selectedIndex] || {}).text })
    if (state.openFor) chips.push({ key: 'openFor', label: 'Open for: ' + (openForSelect.options[openForSelect.selectedIndex] || {}).text })
    if (state.type) chips.push({ key: 'type', label: 'Type: ' + state.type })
    if (state.recentlyAdded) chips.push({ key: 'recentlyAdded', label: 'Recently added' })
    if (state.search) chips.push({ key: 'search', label: 'Search: "' + state.search + '"' })
    return chips
  }

  function renderActiveFilters () {
    var chips = activeFilterChips()
    if (!chips.length) { activeFiltersEl.innerHTML = ''; return }
    activeFiltersEl.innerHTML = '' +
      '<span class="programmes-active-filters__label">Active filters:</span>' +
      chips.map(function (c) {
        return '<button type="button" class="programmes-filter-chip" data-clear="' + c.key + '">' + escapeHtml(c.label) + ' &times;</button>'
      }).join('') +
      '<button type="button" class="programmes-filter-chip programmes-filter-chip--clear-all" id="pf-clear-all">Clear all</button>'

    activeFiltersEl.querySelectorAll('[data-clear]').forEach(function (btn) {
      btn.addEventListener('click', function () { clearFilter(btn.getAttribute('data-clear')) })
    })
    var clearAllBtn = document.getElementById('pf-clear-all')
    if (clearAllBtn) clearAllBtn.addEventListener('click', clearAllFilters)
  }

  function clearFilter (key) {
    if (key === 'country') { state.country = ''; countrySelect.value = '' }
    if (key === 'discipline') { state.discipline = ''; disciplineSelect.value = '' }
    if (key === 'openFor') { state.openFor = ''; openForSelect.value = '' }
    if (key === 'type') { state.type = ''; typeSelect.value = '' }
    if (key === 'recentlyAdded') { state.recentlyAdded = false; recentlyAddedBtn.classList.remove('is-active') }
    if (key === 'search') { state.search = ''; searchInput.value = '' }
    render()
  }

  function clearAllFilters () {
    state.search = ''; state.country = ''; state.discipline = ''; state.openFor = ''; state.type = ''; state.recentlyAdded = false
    searchInput.value = ''; countrySelect.value = ''; disciplineSelect.value = ''; openForSelect.value = ''; typeSelect.value = ''
    recentlyAddedBtn.classList.remove('is-active')
    render()
  }

  function computeCountryCounts () {
    var counts = {}
    var intlCount = 0
    programmes.filter(matchesExceptCountry).forEach(function (p) {
      if (p.country) counts[p.country] = (counts[p.country] || 0) + 1
      else intlCount++
    })
    return { counts: counts, intlCount: intlCount }
  }

  function updateMap () {
    var result = computeCountryCounts()
    var counts = result.counts

    document.querySelectorAll('.world-map__country').forEach(function (path) {
      var country = path.getAttribute('data-country')
      var count = counts[country] || 0
      path.setAttribute('data-count', count)
      path.style.fill = colorForCount(count)
    })

    var marker = document.querySelector('.world-map__marker')
    if (marker) {
      marker.setAttribute('data-count', result.intlCount)
      marker.style.fill = colorForCount(result.intlCount)
    }

    var countriesWithData = Object.keys(counts).filter(function (c) { return counts[c] > 0 })
    if (mapCountryCountEl) mapCountryCountEl.innerHTML = countriesWithData.length + ' countries'

    var sorted = Object.entries(counts).sort(function (a, b) { return b[1] - a[1] })
    var toShow = showingAllCountries ? sorted : sorted.slice(0, 5)
    topCountriesListEl.innerHTML = toShow.map(function (entry) {
      return '<button type="button" class="programmes-top-countries__item" data-country="' + escapeHtml(entry[0]) + '"><span>' + escapeHtml(entry[0]) + '</span><span class="programmes-top-countries__count">' + entry[1] + '</span></button>'
    }).join('')
    topCountriesListEl.querySelectorAll('.programmes-top-countries__item').forEach(function (btn) {
      btn.addEventListener('click', function () { filterByCountry(btn.getAttribute('data-country')) })
    })
    viewAllCountriesBtn.textContent = showingAllCountries ? 'Show top 5 only' : 'View all countries (' + sorted.length + ') \u2192'
  }

  function filterByCountry (country) {
    state.country = country
    countrySelect.value = (country === INTERNATIONAL_KEY) ? '' : country
    render()
  }

  function render () {
    var results = programmes.filter(matches).sort(SORTERS[state.sort] || SORTERS.newest)
    countEl.textContent = results.length + ' programme' + (results.length === 1 ? '' : 's')
    gridEl.className = state.view === 'list' ? 'programmes-list' : 'programmes-grid'
    gridEl.innerHTML = results.length
      ? results.map(state.view === 'list' ? listRowHtml : cardHtml).join('')
      : '<div class="programmes-empty">No programmes match your filters.</div>'
    updateMap()
    renderActiveFilters()
  }

  function renderDetail (id) {
    var p = byId[id]
    if (!p) {
      detailEl.innerHTML = '<button type="button" class="listing-detail__back" id="detail-back">&larr; All programmes</button><div class="listing-detail__not-found">This programme could not be found.</div>'
    } else {
      detailEl.innerHTML = '' +
        '<button type="button" class="listing-detail__back" id="detail-back">&larr; All programmes</button>' +
        '<span class="listing-detail__id">' + escapeHtml(p.id) + '</span>' +
        '<div class="listing-detail__country">' + escapeHtml(p.country || 'International') + '</div>' +
        '<div class="listing-detail__institution">' + escapeHtml(p.title) + '</div>' +
        '<div class="listing-detail__tags">' + tagsHtml(p) + '</div>' +
        '<p class="listing-detail__description">' + escapeHtml(p.description || '') + '</p>' +
        '<div class="listing-detail__field-label">Discipline</div><div class="listing-detail__field-value">' + escapeHtml(disciplineLabel(p)) + '</div>' +
        (p.deadline ? '<div class="listing-detail__field-label">Deadline</div><div class="listing-detail__field-value">' + escapeHtml(p.deadline) + '</div>' : '') +
        (p.dateAdded ? '<div class="listing-detail__field-label">Added to archive</div><div class="listing-detail__field-value">' + escapeHtml(p.dateAdded) + '</div>' : '') +
        (p.link ? '<div class="listing-detail__field-label">Source</div><div class="listing-detail__field-value"><a href="' + escapeHtml(p.link) + '" target="_blank" rel="noopener">' + escapeHtml(p.link) + '</a></div>' : '')
    }
    var backBtn = document.getElementById('detail-back')
    if (backBtn) backBtn.addEventListener('click', function () { window.location.hash = '' })
  }

  function syncView () {
    var id = decodeURIComponent(window.location.hash.replace(/^#/, ''))
    var showDetail = !!id
    resultsSections.forEach(function (el) { if (el) el.hidden = showDetail })
    detailEl.hidden = !showDetail
    if (showDetail) { renderDetail(id); window.scrollTo(0, 0) }
  }

  // --- wiring ---

  searchInput.addEventListener('input', function () { state.search = searchInput.value.trim(); render() })
  countrySelect.addEventListener('change', function () { state.country = countrySelect.value; render() })
  disciplineSelect.addEventListener('change', function () { state.discipline = disciplineSelect.value; render() })
  openForSelect.addEventListener('change', function () { state.openFor = openForSelect.value; render() })
  typeSelect.addEventListener('change', function () { state.type = typeSelect.value; render() })
  sortSelect.addEventListener('change', function () { state.sort = sortSelect.value; render() })

  recentlyAddedBtn.addEventListener('click', function () {
    state.recentlyAdded = !state.recentlyAdded
    recentlyAddedBtn.classList.toggle('is-active', state.recentlyAdded)
    render()
  })

  viewGridBtn.addEventListener('click', function () {
    state.view = 'grid'
    viewGridBtn.classList.add('is-active')
    viewListBtn.classList.remove('is-active')
    render()
  })
  viewListBtn.addEventListener('click', function () {
    state.view = 'list'
    viewListBtn.classList.add('is-active')
    viewGridBtn.classList.remove('is-active')
    render()
  })

  mapCollapseBtn.addEventListener('click', function () {
    var isCollapsed = mapBody.hasAttribute('hidden')
    if (isCollapsed) {
      mapBody.removeAttribute('hidden')
    } else {
      mapBody.setAttribute('hidden', '')
    }
    var label = mapCollapseBtn.querySelector('.programmes-map-collapse__label')
    if (label) label.textContent = isCollapsed ? 'Collapse map' : 'Expand map'
  })

  viewAllCountriesBtn.addEventListener('click', function () {
    showingAllCountries = !showingAllCountries
    updateMap()
  })

  document.querySelectorAll('.world-map__country, .world-map__marker').forEach(function (el) {
    el.addEventListener('mousemove', function (e) {
      var count = el.getAttribute('data-count')
      if (!tooltip || !count || count === '0') { if (tooltip) tooltip.style.display = 'none'; return }
      var label = el.getAttribute('data-region') || el.getAttribute('data-country')
      tooltip.textContent = label + ': ' + count + ' programme' + (count === '1' ? '' : 's')
      tooltip.style.display = 'block'
      tooltip.style.left = (e.clientX + 12) + 'px'
      tooltip.style.top = (e.clientY + 12) + 'px'
    })
    el.addEventListener('mouseleave', function () { if (tooltip) tooltip.style.display = 'none' })
    el.addEventListener('click', function () {
      var count = el.getAttribute('data-count')
      if (!count || count === '0') return
      var region = el.getAttribute('data-region')
      filterByCountry(region === 'International' ? INTERNATIONAL_KEY : el.getAttribute('data-country'))
    })
  })

  window.addEventListener('hashchange', syncView)

  render()
  syncView()
})()
