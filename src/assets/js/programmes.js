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
  var resultsAreaEl = document.getElementById('programmes-results-area')

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

  function isUpdated (p) {
    if (isNew(p)) return false
    if (!p.dateUpdated) return false
    if (daysAgo(p.dateUpdated) > NEW_THRESHOLD_DAYS) return false
    if (p.dateAdded && p.dateUpdated <= p.dateAdded) return false
    return true
  }

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
      var searchFields = [p.title, p.description, p.country, p.region, p.primaryType, p.types.join(' ')]
      searchFields.push(disciplineLabel(p))
      var openForLabels = { doctoralStudents: 'Doctoral students', researchers: 'Researchers', students: 'Students', institutions: 'Institutions' }
      Object.keys(openForLabels).forEach(function (k) { if (p.openFor[k]) searchFields.push(openForLabels[k]) })
      var haystack = searchFields.join(' ').toLowerCase()
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
    'title-desc': function (a, b) { return b.title.localeCompare(a.title) },
    country: function (a, b) { return (a.country || '').localeCompare(b.country || '') },
    'country-desc': function (a, b) { return (b.country || '').localeCompare(a.country || '') },
    type: function (a, b) { return a.primaryType.localeCompare(b.primaryType) },
    'type-desc': function (a, b) { return b.primaryType.localeCompare(a.primaryType) },
    id: function (a, b) { return a.id.localeCompare(b.id, undefined, { numeric: true }) },
    'id-desc': function (a, b) { return b.id.localeCompare(a.id, undefined, { numeric: true }) },
    deadline: function (a, b) { return (a.deadline || '9999').localeCompare(b.deadline || '9999') },
    'deadline-desc': function (a, b) { return (b.deadline || '0000').localeCompare(a.deadline || '0000') }
  }

  function colorForCount (count) {
    if (count === 0) return '#F1F4F7'
    if (count <= 2) return '#DCEEFF'
    if (count <= 5) return '#9DC7F0'
    if (count <= 15) return '#4A90D9'
    return '#0057B7'
  }

  function deadlineStatus (p) {
    if (!p.deadline) return null
    var deadline = new Date(p.deadline)
    var today = new Date()
    today.setHours(0, 0, 0, 0)
    var daysUntil = (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    if (daysUntil < 0) return 'passed'
    if (daysUntil <= 30) return 'soon'
    return 'ahead'
  }

  function deadlineHtml (p, label) {
    if (!p.deadline) return ''
    var status = deadlineStatus(p)
    var statusLabel = status === 'passed' ? ' (passed)' : status === 'soon' ? ' (approaching)' : ''
    return '<span class="deadline-badge deadline-badge--' + status + '">' + (label || '') + escapeHtml(p.deadline) + statusLabel + '</span>'
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
          (isNew(p) ? '<span class="programme-card__new">NEW</span>' : (isUpdated(p) ? '<span class="programme-card__updated">UPDATED</span>' : '<span></span>')) +
          '<span class="programme-card__id">' + escapeHtml(p.id) + '</span>' +
        '</div>' +
        '<div class="programme-card__title">' + escapeHtml(p.title) + '</div>' +
        '<div class="programme-card__country">' + icon_pin() + escapeHtml(p.country || 'International') + '</div>' +
        '<div class="programme-card__description">' + escapeHtml(p.description || '') + '</div>' +
        '<div class="programme-card__meta-label">Discipline</div><div class="programme-card__meta-value">' + escapeHtml(disciplineLabel(p)) + '</div>' +
        (p.deadline ? '<div class="programme-card__meta-label">Deadline</div><div class="programme-card__meta-value">' + deadlineHtml(p) + '</div>' : '') +
        '<div class="programme-card__tags">' + tagsHtml(p) + '</div>' +
        (p.dateAdded ? '<div class="programme-card__added">Added ' + escapeHtml(p.dateAdded) + '</div>' : '') +
        '<span class="programme-card__link">View details &rarr;</span>' +
      '</a>'
  }

  function icon_pin () {
    return '<svg class="programme-card__pin-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>'
  }

  var COLUMN_SORT_MAP = { id: 'id', title: 'title', country: 'country', type: 'type', deadline: 'deadline', added: 'newest' }

  function sortIndicator (column) {
    var mappedSort = COLUMN_SORT_MAP[column]
    var current = state.sort
    if (current === mappedSort) return ' &darr;'
    if (column === 'added' && current === 'oldest') return ' &uarr;'
    if (column === 'title' && current === 'title-desc') return ' &uarr;'
    if (column === 'country' && current === 'country-desc') return ' &uarr;'
    if (column === 'type' && current === 'type-desc') return ' &uarr;'
    if (column === 'id' && current === 'id-desc') return ' &uarr;'
    if (column === 'deadline' && current === 'deadline-desc') return ' &uarr;'
    return ''
  }

  function listTableHtml (results) {
    var rows = results.map(function (p) {
      return '' +
        '<tr class="programme-row" data-id="' + escapeHtml(p.id) + '">' +
          '<td class="programme-row__new-cell">' + (isNew(p) ? '<span class="programme-card__new">NEW</span>' : (isUpdated(p) ? '<span class="programme-card__updated">UPDATED</span>' : '')) + '</td>' +
          '<td class="programme-row__id">' + escapeHtml(p.id) + '</td>' +
          '<td class="programme-row__title-cell">' +
            '<div class="programme-row__title">' + escapeHtml(p.title) + '</div>' +
            '<div class="programme-row__description">' + escapeHtml(p.description || '') + '</div>' +
          '</td>' +
          '<td class="programme-row__country">' + escapeHtml(p.country || 'International') + '</td>' +
          '<td class="programme-row__type"><span class="programme-tag">' + escapeHtml(p.primaryType) + '</span></td>' +
          '<td class="programme-row__deadline">' + (p.deadline ? deadlineHtml(p) : '') + '</td>' +
          '<td class="programme-row__added">' + escapeHtml(p.dateUpdated || p.dateAdded || '') + '</td>' +
        '</tr>'
    }).join('')

    return '' +
      '<table class="programmes-table">' +
        '<thead><tr>' +
          '<th></th>' +
          '<th class="is-sortable" data-sort-col="id">ID' + sortIndicator('id') + '</th>' +
          '<th class="is-sortable" data-sort-col="title">Title' + sortIndicator('title') + '</th>' +
          '<th class="is-sortable" data-sort-col="country">Country' + sortIndicator('country') + '</th>' +
          '<th class="is-sortable" data-sort-col="type">Type' + sortIndicator('type') + '</th>' +
          '<th class="is-sortable" data-sort-col="deadline">Deadline' + sortIndicator('deadline') + '</th>' +
          '<th class="is-sortable" data-sort-col="added">Added / Updated' + sortIndicator('added') + '</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>'
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
    }

    var countriesWithData = Object.keys(counts).filter(function (c) { return counts[c] > 0 })
    if (mapCountryCountEl) mapCountryCountEl.innerHTML = countriesWithData.length + ' countries'

    var sorted = Object.entries(counts).sort(function (a, b) { return b[1] - a[1] })
    if (result.intlCount > 0) {
      sorted.push([INTERNATIONAL_KEY, result.intlCount])
      sorted.sort(function (a, b) { return b[1] - a[1] })
    }
    var toShow = showingAllCountries ? sorted : sorted.slice(0, 5)
    topCountriesListEl.innerHTML = toShow.map(function (entry) {
      var isIntl = entry[0] === INTERNATIONAL_KEY
      var label = isIntl ? 'International (not country-specific)' : entry[0]
      return '<button type="button" class="programmes-top-countries__item" data-country="' + escapeHtml(entry[0]) + '"><span>' + escapeHtml(label) + '</span><span class="programmes-top-countries__count">' + entry[1] + '</span></button>'
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
    if (state.view === 'list') {
      gridEl.className = 'programmes-list'
      gridEl.innerHTML = results.length ? listTableHtml(results) : '<div class="programmes-empty">No programmes match your filters.</div>'
      sortSelect.parentElement.hidden = true
    } else {
      gridEl.className = 'programmes-grid'
      gridEl.innerHTML = results.length ? results.map(cardHtml).join('') : '<div class="programmes-empty">No programmes match your filters.</div>'
      sortSelect.parentElement.hidden = false
    }
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
        '<div class="programme-detail__country">' + icon_pin() + escapeHtml(p.country || 'International') + '</div>' +
        '<div class="listing-detail__institution">' + escapeHtml(p.title) + '</div>' +
        '<p class="listing-detail__description">' + escapeHtml(p.description || '') + '</p>' +
        '<div class="listing-detail__field-label">Discipline</div><div class="listing-detail__field-value">' + escapeHtml(disciplineLabel(p)) + '</div>' +
        (p.deadline ? '<div class="listing-detail__field-label">Deadline</div><div class="listing-detail__field-value">' + deadlineHtml(p) + '</div>' : '') +
        (p.dateAdded ? '<div class="listing-detail__field-label">Added to archive</div><div class="listing-detail__field-value listing-detail__field-value--muted">' + escapeHtml(p.dateAdded) + '</div>' : '') +
        (p.link ? '<div class="listing-detail__field-label">Link</div><div class="listing-detail__field-value"><a href="' + escapeHtml(p.link) + '" target="_blank" rel="noopener">' + escapeHtml(p.link) + '</a></div>' : '')
    }
    var backBtn = document.getElementById('detail-back')
    if (backBtn) backBtn.addEventListener('click', function () { window.location.hash = '' })
  }

  var headerExtra1 = document.getElementById('programmes-header-extra')
  var headerExtra2 = document.getElementById('programmes-header-extra-2')

  function syncView () {
    var id = decodeURIComponent(window.location.hash.replace(/^#/, ''))
    if (id) {
      resultsAreaEl.hidden = true
      if (headerExtra1) headerExtra1.hidden = true
      if (headerExtra2) headerExtra2.hidden = true
      detailEl.hidden = false
      renderDetail(id)
      window.scrollTo(0, 0)
    } else {
      resultsAreaEl.hidden = false
      if (headerExtra1) headerExtra1.hidden = false
      if (headerExtra2) headerExtra2.hidden = false
      detailEl.hidden = true
    }
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

  var mapDragMoved = false

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
      if (mapDragMoved) return
      var count = el.getAttribute('data-count')
      if (!count || count === '0') return
      var region = el.getAttribute('data-region')
      filterByCountry(region === 'International' ? INTERNATIONAL_KEY : el.getAttribute('data-country'))
    })
  })

  // --- map pan/zoom ---
  var mapViewport = document.getElementById('world-map-viewport')
  var mapSvgEl = mapViewport ? mapViewport.querySelector('.world-map') : null
  if (mapViewport && mapSvgEl) {
    var defaultZoomState = {
      scale: parseFloat(mapViewport.getAttribute('data-default-scale')) || 1,
      x: parseFloat(mapViewport.getAttribute('data-default-x')) || 0,
      y: parseFloat(mapViewport.getAttribute('data-default-y')) || 0
    }
    var zoomState = { scale: defaultZoomState.scale, x: defaultZoomState.x, y: defaultZoomState.y }
    var isDragging = false
    var dragStartMouse = { x: 0, y: 0 }
    var dragStartOffset = { x: 0, y: 0 }

    function clampZoom (s) { return Math.max(0.6, Math.min(8, s)) }
    function applyZoomTransform () {
      mapSvgEl.style.transform = 'translate(' + zoomState.x + 'px,' + zoomState.y + 'px) scale(' + zoomState.scale + ')'
    }
    applyZoomTransform()

    mapViewport.addEventListener('wheel', function (e) {
      e.preventDefault()
      var factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      zoomState.scale = clampZoom(zoomState.scale * factor)
      applyZoomTransform()
    }, { passive: false })

    mapViewport.addEventListener('mousedown', function (e) {
      isDragging = true
      mapDragMoved = false
      dragStartMouse = { x: e.clientX, y: e.clientY }
      dragStartOffset = { x: zoomState.x, y: zoomState.y }
      mapViewport.classList.add('is-dragging')
    })
    window.addEventListener('mousemove', function (e) {
      if (!isDragging) return
      var dx = e.clientX - dragStartMouse.x
      var dy = e.clientY - dragStartMouse.y
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) mapDragMoved = true
      zoomState.x = dragStartOffset.x + dx
      zoomState.y = dragStartOffset.y + dy
      applyZoomTransform()
    })
    window.addEventListener('mouseup', function () {
      isDragging = false
      mapViewport.classList.remove('is-dragging')
      setTimeout(function () { mapDragMoved = false }, 0)
    })

    var zoomInBtn = document.getElementById('pf-map-zoom-in')
    var zoomOutBtn = document.getElementById('pf-map-zoom-out')
    var zoomResetBtn = document.getElementById('pf-map-zoom-reset')
    if (zoomInBtn) zoomInBtn.addEventListener('click', function () { zoomState.scale = clampZoom(zoomState.scale * 1.3); applyZoomTransform() })
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', function () { zoomState.scale = clampZoom(zoomState.scale / 1.3); applyZoomTransform() })
    if (zoomResetBtn) zoomResetBtn.addEventListener('click', function () { zoomState = { scale: defaultZoomState.scale, x: defaultZoomState.x, y: defaultZoomState.y }; applyZoomTransform() })
  }

  gridEl.addEventListener('click', function (e) {
    var sortHeader = e.target.closest('[data-sort-col]')
    if (sortHeader) {
      var col = sortHeader.getAttribute('data-sort-col')
      var ascKey = COLUMN_SORT_MAP[col]
      var descKey = (col === 'added') ? 'oldest' : (ascKey + '-desc')
      state.sort = (state.sort === ascKey) ? descKey : ascKey
      render()
      return
    }
    var row = e.target.closest('.programme-row')
    if (row && row.tagName === 'TR') {
      window.location.hash = encodeURIComponent(row.getAttribute('data-id'))
    }
  })

  window.addEventListener('hashchange', syncView)

  render()
  syncView()
})()
