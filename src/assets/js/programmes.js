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

  // maps a filter's DOM id prefix to the state array it controls
  var MULTISELECT_FILTERS = {
    'pf-country': 'country',
    'pf-discipline': 'discipline',
    'pf-open-for': 'openFor',
    'pf-type': 'type'
  }

  var state = { search: '', country: [], discipline: [], openFor: [], type: [], sort: 'newest', recentlyAdded: false, view: 'grid', pageSize: 20, page: 1 }
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
    if (state.discipline.length && !state.discipline.some(function (d) { return p.disciplines[d] })) return false
    if (state.openFor.length && !state.openFor.some(function (o) { return p.openFor[o] })) return false
    if (state.type.length && !state.type.some(function (t) { return p.types.indexOf(t) !== -1 })) return false
    if (state.recentlyAdded && !isNew(p)) return false
    if (state.search) {
      var q = state.search.toLowerCase()
      var haystack = [p.title, p.description].join(' ').toLowerCase()
      if (haystack.indexOf(q) === -1) return false
    }
    return true
  }

  function matches (p) {
    if (state.country.length) {
      var countryMatch = state.country.some(function (c) {
        return c === INTERNATIONAL_KEY ? !p.country : p.country === c
      })
      if (!countryMatch) return false
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
    if (count === 0) return '#D9DEE5'
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
        ((p.dateUpdated || p.dateAdded) ? '<div class="programme-card__added">Last update: ' + escapeHtml(p.dateUpdated || p.dateAdded) + '</div>' : '') +
        '<span class="programme-card__link">View details &rarr;</span>' +
      '</a>'
  }

  function icon_pin () {
    return '<svg class="programme-card__pin-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>'
  }

  var COLUMN_SORT_MAP = { id: 'id', title: 'title', country: 'country', type: 'type', deadline: 'deadline', added: 'newest' }

  function isActiveSortColumn (column) {
    var mappedSort = COLUMN_SORT_MAP[column]
    var current = state.sort
    if (current === mappedSort) return true
    if (column === 'added' && current === 'oldest') return true
    if (column === 'title' && current === 'title-desc') return true
    if (column === 'country' && current === 'country-desc') return true
    if (column === 'type' && current === 'type-desc') return true
    if (column === 'id' && current === 'id-desc') return true
    if (column === 'deadline' && current === 'deadline-desc') return true
    return false
  }

  function sortIndicator (column) {
    if (!isActiveSortColumn(column)) return ''
    var descending = ['oldest', 'title-desc', 'country-desc', 'type-desc', 'id-desc', 'deadline-desc'].indexOf(state.sort) !== -1
    return descending ? ' &uarr;' : ' &darr;'
  }

  function sortHeaderClass (column) {
    return 'is-sortable' + (isActiveSortColumn(column) ? ' is-active-sort' : '')
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
          '<th class="' + sortHeaderClass('id') + '" data-sort-col="id">ID' + sortIndicator('id') + '</th>' +
          '<th class="' + sortHeaderClass('title') + '" data-sort-col="title">Title' + sortIndicator('title') + '</th>' +
          '<th class="' + sortHeaderClass('country') + '" data-sort-col="country">Country' + sortIndicator('country') + '</th>' +
          '<th class="' + sortHeaderClass('type') + '" data-sort-col="type">Type' + sortIndicator('type') + '</th>' +
          '<th class="' + sortHeaderClass('deadline') + '" data-sort-col="deadline">Deadline' + sortIndicator('deadline') + '</th>' +
          '<th class="' + sortHeaderClass('added') + '" data-sort-col="added">Last update' + sortIndicator('added') + '</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>'
  }

  function checkboxLabelFor (filterId, value) {
    var input = document.querySelector('#' + filterId + '-panel input[value="' + value.replace(/"/g, '\\"') + '"]')
    if (!input) return value
    return input.parentElement.textContent.trim()
  }

  function activeFilterChips () {
    var chips = []
    state.country.forEach(function (c) {
      chips.push({ key: 'country', value: c, label: (c === INTERNATIONAL_KEY ? 'International' : c) })
    })
    state.discipline.forEach(function (d) {
      chips.push({ key: 'discipline', value: d, label: 'Discipline: ' + checkboxLabelFor('pf-discipline', d) })
    })
    state.openFor.forEach(function (o) {
      chips.push({ key: 'openFor', value: o, label: 'Open for: ' + checkboxLabelFor('pf-open-for', o) })
    })
    state.type.forEach(function (t) {
      chips.push({ key: 'type', value: t, label: 'Type: ' + t })
    })
    if (state.recentlyAdded) chips.push({ key: 'recentlyAdded', value: '', label: 'Recently added' })
    if (state.search) chips.push({ key: 'search', value: '', label: 'Search: "' + state.search + '"' })
    return chips
  }

  function renderActiveFilters () {
    var chips = activeFilterChips()
    if (!chips.length) { activeFiltersEl.innerHTML = ''; return }
    activeFiltersEl.innerHTML = '' +
      '<span class="programmes-active-filters__label">Active filters:</span>' +
      chips.map(function (c) {
        return '<button type="button" class="programmes-filter-chip" data-clear="' + c.key + '" data-clear-value="' + escapeHtml(c.value) + '">' + escapeHtml(c.label) + ' &times;</button>'
      }).join('') +
      '<button type="button" class="programmes-filter-chip programmes-filter-chip--clear-all" id="pf-clear-all">Clear all</button>'

    activeFiltersEl.querySelectorAll('[data-clear]').forEach(function (btn) {
      btn.addEventListener('click', function () { clearFilter(btn.getAttribute('data-clear'), btn.getAttribute('data-clear-value')) })
    })
    var clearAllBtn = document.getElementById('pf-clear-all')
    if (clearAllBtn) clearAllBtn.addEventListener('click', clearAllFilters)
  }

  function removeFromArray (arr, value) {
    var i = arr.indexOf(value)
    if (i !== -1) arr.splice(i, 1)
  }

  function clearFilter (key, value) {
    if (key === 'country') removeFromArray(state.country, value)
    if (key === 'discipline') removeFromArray(state.discipline, value)
    if (key === 'openFor') removeFromArray(state.openFor, value)
    if (key === 'type') removeFromArray(state.type, value)
    if (key === 'recentlyAdded') { state.recentlyAdded = false; recentlyAddedBtn.classList.remove('is-active') }
    if (key === 'search') { state.search = ''; searchInput.value = '' }
    state.page = 1
    render()
  }

  function clearAllFilters () {
    state.search = ''; state.country = []; state.discipline = []; state.openFor = []; state.type = []; state.recentlyAdded = false; state.page = 1
    searchInput.value = ''
    recentlyAddedBtn.classList.remove('is-active')
    render()
  }

  // keeps every checkbox's checked state in sync with the underlying arrays —
  // needed because selections can also change from the map, the top-countries
  // list, or removing a filter chip, not just checking a box directly
  function syncCheckboxPanels () {
    Object.keys(MULTISELECT_FILTERS).forEach(function (filterId) {
      var arr = state[MULTISELECT_FILTERS[filterId]]
      document.querySelectorAll('#' + filterId + '-panel input[type="checkbox"]').forEach(function (input) {
        input.checked = arr.indexOf(input.value) !== -1
      })
    })
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
      path.classList.toggle('world-map__country--selected', state.country.indexOf(country) !== -1)
      path.classList.toggle('world-map__country--has-data', count > 0)
    })

    var marker = document.querySelector('.world-map__marker')
    if (marker) {
      marker.setAttribute('data-count', result.intlCount)
      marker.classList.toggle('world-map__marker--selected', state.country.indexOf(INTERNATIONAL_KEY) !== -1)
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
      var isSelected = state.country.indexOf(entry[0]) !== -1
      return '<button type="button" class="programmes-top-countries__item' + (isSelected ? ' is-active' : '') + '" data-country="' + escapeHtml(entry[0]) + '"><span>' + escapeHtml(label) + '</span><span class="programmes-top-countries__count">' + entry[1] + '</span></button>'
    }).join('')
    topCountriesListEl.querySelectorAll('.programmes-top-countries__item').forEach(function (btn) {
      btn.addEventListener('click', function () { toggleCountry(btn.getAttribute('data-country')) })
    })
    viewAllCountriesBtn.textContent = showingAllCountries ? 'Show top 5 only' : 'View all countries (' + countriesWithData.length + ') \u2192'
  }

  function toggleCountry (country) {
    var i = state.country.indexOf(country)
    if (i === -1) state.country.push(country)
    else state.country.splice(i, 1)
    state.page = 1
    render()
  }

  function paginate (results) {
    if (state.pageSize === 'all') return results
    var totalPages = Math.max(1, Math.ceil(results.length / state.pageSize))
    if (state.page > totalPages) state.page = totalPages
    var start = (state.page - 1) * state.pageSize
    return results.slice(start, start + state.pageSize)
  }

  function renderPagination (totalCount) {
    var container = document.getElementById('programmes-pagination-controls')
    if (state.pageSize === 'all' || totalCount === 0) { container.innerHTML = ''; return }
    var totalPages = Math.max(1, Math.ceil(totalCount / state.pageSize))
    var html = ''
    html += '<button type="button" class="programmes-page-btn" data-page="' + (state.page - 1) + '"' + (state.page <= 1 ? ' disabled' : '') + '>&larr; Prev</button>'
    html += '<span class="programmes-page-status">Page ' + state.page + ' of ' + totalPages + '</span>'
    html += '<button type="button" class="programmes-page-btn" data-page="' + (state.page + 1) + '"' + (state.page >= totalPages ? ' disabled' : '') + '>Next &rarr;</button>'
    container.innerHTML = html
    container.querySelectorAll('[data-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.page = parseInt(btn.getAttribute('data-page'), 10)
        render()
        gridEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
  }

  function updateFilterBadge (key, count) {
    var badge = document.getElementById('pf-' + key + '-badge')
    var wrap = badge ? badge.closest('.programmes-multiselect') : null
    if (!badge || !wrap) return
    if (count > 0) {
      badge.textContent = count
      badge.hidden = false
      wrap.classList.add('has-selection')
    } else {
      badge.textContent = ''
      badge.hidden = true
      wrap.classList.remove('has-selection')
    }
  }

  function updateFilterBadges () {
    updateFilterBadge('country', state.country.length)
    updateFilterBadge('discipline', state.discipline.length)
    updateFilterBadge('open-for', state.openFor.length)
    updateFilterBadge('type', state.type.length)
  }

  function render () {
    var results = programmes.filter(matches).sort(SORTERS[state.sort] || SORTERS.newest)
    countEl.textContent = results.length + ' programme' + (results.length === 1 ? '' : 's')
    var pageResults = paginate(results)
    if (state.view === 'list') {
      gridEl.className = 'programmes-list'
      gridEl.innerHTML = pageResults.length ? listTableHtml(pageResults) : '<div class="programmes-empty">No programmes match your filters.</div>'
      sortSelect.parentElement.hidden = true
    } else {
      gridEl.className = 'programmes-grid'
      gridEl.innerHTML = pageResults.length ? pageResults.map(cardHtml).join('') : '<div class="programmes-empty">No programmes match your filters.</div>'
      sortSelect.parentElement.hidden = false
    }
    renderPagination(results.length)
    updateMap()
    renderActiveFilters()
    updateFilterBadges()
    syncCheckboxPanels()
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
        '<div class="listing-detail__tags">' + tagsHtml(p) + '</div>' +
        '<p class="listing-detail__description">' + escapeHtml(p.description || '') + '</p>' +
        '<div class="listing-detail__field-label">Discipline</div><div class="listing-detail__field-value">' + escapeHtml(disciplineLabel(p)) + '</div>' +
        (p.deadline ? '<div class="listing-detail__field-label">Deadline</div><div class="listing-detail__field-value">' + deadlineHtml(p) + '</div>' : '') +
        ((p.dateUpdated || p.dateAdded) ? '<div class="listing-detail__field-label">Last update</div><div class="listing-detail__field-value listing-detail__field-value--muted">' + escapeHtml(p.dateUpdated || p.dateAdded) + '</div>' : '') +
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

  var pageSizeSelect = document.getElementById('pf-page-size')

  searchInput.addEventListener('input', function () { state.search = searchInput.value.trim(); state.page = 1; render() })
  function closeAllPanels (exceptId) {
    Object.keys(MULTISELECT_FILTERS).forEach(function (filterId) {
      if (filterId === exceptId) return
      var panel = document.getElementById(filterId + '-panel')
      var btn = document.getElementById(filterId + '-button')
      if (panel) panel.hidden = true
      if (btn) btn.setAttribute('aria-expanded', 'false')
    })
  }

  Object.keys(MULTISELECT_FILTERS).forEach(function (filterId) {
    var button = document.getElementById(filterId + '-button')
    var panel = document.getElementById(filterId + '-panel')
    if (!button || !panel) return

    button.addEventListener('click', function (e) {
      e.stopPropagation()
      var willOpen = panel.hidden
      closeAllPanels(filterId)
      panel.hidden = !willOpen
      button.setAttribute('aria-expanded', String(willOpen))
    })

    panel.querySelectorAll('input[type="checkbox"]').forEach(function (input) {
      input.addEventListener('change', function () {
        var arr = state[MULTISELECT_FILTERS[filterId]]
        if (input.checked) {
          if (arr.indexOf(input.value) === -1) arr.push(input.value)
        } else {
          removeFromArray(arr, input.value)
        }
        state.page = 1
        render()
      })
    })
  })

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.programmes-multiselect')) closeAllPanels()
  })
  sortSelect.addEventListener('change', function () { state.sort = sortSelect.value; render() })
  pageSizeSelect.addEventListener('change', function () {
    state.pageSize = pageSizeSelect.value === 'all' ? 'all' : parseInt(pageSizeSelect.value, 10)
    state.page = 1
    render()
  })

  recentlyAddedBtn.addEventListener('click', function () {
    state.recentlyAdded = !state.recentlyAdded
    recentlyAddedBtn.classList.toggle('is-active', state.recentlyAdded)
    state.page = 1
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
      toggleCountry(region === 'International' ? INTERNATIONAL_KEY : el.getAttribute('data-country'))
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

  var MOBILE_BREAKPOINT = 700
  function enforceGridOnMobile () {
    if (window.innerWidth <= MOBILE_BREAKPOINT && state.view === 'list') {
      state.view = 'grid'
      viewGridBtn.classList.add('is-active')
      viewListBtn.classList.remove('is-active')
      render()
    }
  }
  window.addEventListener('resize', enforceGridOnMobile)
  enforceGridOnMobile()

  var SUBMIT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyvegcSDnFslhN9F8CTZMvUnHVfPI8GYw2MpekL73ku9T_Bk7xpP9-2rwSnrclM8xz1/exec'
  var submitToggleBtn = document.getElementById('pf-submit-toggle')
  var submitForm = document.getElementById('pf-submit-form')
  var submitButton = document.getElementById('pf-submit-button')
  var submitStatus = document.getElementById('pf-submit-status')
  var formLoadedAt = Date.now()

  if (submitToggleBtn && submitForm) {
    submitToggleBtn.addEventListener('click', function () {
      submitForm.hidden = !submitForm.hidden
      if (!submitForm.hidden) {
        submitForm.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })

    submitForm.addEventListener('submit', function (e) {
      e.preventDefault()

      var honeypot = submitForm.querySelector('input[name="website"]').value
      if (honeypot) return // silently drop — a bot filled the hidden field

      var payload = {
        title: submitForm.querySelector('input[name="title"]').value.trim(),
        link: submitForm.querySelector('input[name="link"]').value.trim(),
        country: submitForm.querySelector('input[name="country"]').value.trim(),
        notes: submitForm.querySelector('textarea[name="notes"]').value.trim(),
        website: honeypot,
        loadedAt: formLoadedAt
      }

      if (!payload.title || !payload.link) {
        submitStatus.textContent = 'Please fill in both the title and link.'
        submitStatus.className = 'programmes-submit-form__status programmes-submit-form__status--error'
        return
      }

      submitButton.disabled = true
      submitStatus.textContent = 'Sending...'
      submitStatus.className = 'programmes-submit-form__status'

      fetch(SUBMIT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      })
        .then(function (res) { return res.json() })
        .then(function (data) {
          submitButton.disabled = false
          if (data && data.ok) {
            submitStatus.textContent = 'Thank you — we\u2019ll take a look!'
            submitStatus.className = 'programmes-submit-form__status programmes-submit-form__status--success'
            submitForm.reset()
            setTimeout(function () { submitForm.hidden = true; submitStatus.textContent = '' }, 2500)
          } else {
            submitStatus.textContent = (data && data.error) || 'Something went wrong. Please try again.'
            submitStatus.className = 'programmes-submit-form__status programmes-submit-form__status--error'
          }
        })
        .catch(function () {
          submitButton.disabled = false
          submitStatus.textContent = 'Something went wrong. Please try again.'
          submitStatus.className = 'programmes-submit-form__status programmes-submit-form__status--error'
        })
    })
  }

  window.addEventListener('hashchange', syncView)

  render()
  syncView()
})()
