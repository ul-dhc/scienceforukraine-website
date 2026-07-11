(function () {
  var dataEl = document.getElementById('listings-data')
  if (!dataEl) return

  var data = JSON.parse(dataEl.textContent)
  var openListings = data.open
  var closedListings = data.closed
  var byId = {}
  openListings.forEach(function (l) { byId[l.id] = l })
  closedListings.forEach(function (l) { byId[l.id] = l })

  var filtersEl = document.getElementById('listings-filters')
  var mainEl = document.querySelector('.listings-main')
  var detailEl = document.getElementById('listing-detail')
  var listEl = document.getElementById('listings-list')
  var countEl = document.getElementById('listings-count')
  var searchInput = document.getElementById('lf-search')
  var countrySelect = document.getElementById('lf-country')
  var remoteToggle = document.getElementById('lf-remote')
  var accommodationToggle = document.getElementById('lf-accommodation')
  var clearBtn = document.getElementById('lf-clear')
  var sortSelect = document.getElementById('lf-sort')
  var activeFiltersEl = document.getElementById('listings-active-filters')

  var SEARCH_LOG_ENDPOINT = 'https://script.google.com/macros/s/AKfycbw0WHnAeTs4HA15oKqIWzB8GOSjfR6McZabFNsGRSNHWOqQIQFCb5BY8i8ECkuwvvJ0/exec'
  var searchLogDebounceTimer = null
  var lastLoggedSearch = ''

  function logSearchQuery (query) {
    var trimmed = query.trim()
    if (trimmed.length < 2 || trimmed === lastLoggedSearch) return
    lastLoggedSearch = trimmed
    fetch(SEARCH_LOG_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ query: trimmed, page: 'Listings' })
    }).catch(function () {})
  }

  var state = { category: [], discipline: [], openFor: [], country: '', search: '', remote: false, accommodation: false, sort: 'newest', pageSize: 20, page: 1 }

  var DISCIPLINE_LABELS = {
    naturalSciences: 'Natural sciences',
    socialSciences: 'Social sciences',
    humanitiesAndTheArts: 'Humanities & the arts',
    engineeringAndTechnology: 'Engineering & technology',
    medicalAndHealthSciences: 'Medical & health sciences',
    agriculturalAndVeterinarySciences: 'Agricultural & veterinary sciences',
    unspecified: 'Unspecified'
  }
  var OPEN_FOR_LABELS = {
    researchers: 'Researchers',
    doctoralStudents: 'Doctoral students',
    students: 'Students',
    others: 'Others'
  }

  function escapeHtml (str) {
    var div = document.createElement('div')
    div.textContent = str == null ? '' : String(str)
    return div.innerHTML
  }

  function pinIcon () {
    return '<svg class="listing-detail__pin-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>'
  }

  function matches (listing) {
    if (state.category.length && state.category.indexOf(listing.category) === -1) return false
    if (state.country && listing.country !== state.country) return false
    if (state.discipline.length && !state.discipline.some(function (d) { return listing.disciplines[d] })) return false
    if (state.openFor.length && !state.openFor.some(function (o) { return listing.openFor[o] })) return false
    if (state.remote && !listing.remote) return false
    if (state.accommodation && !listing.accommodation.available) return false
    if (state.search) {
      var q = state.search.toLowerCase()
      var haystack = [listing.institution, listing.description, listing.researchFocus].join(' ').toLowerCase()
      if (haystack.indexOf(q) === -1) return false
    }
    return true
  }

  function tagsHtml (listing) {
    var tags = []
    if (listing.category) tags.push('<span class="listing-tag listing-tag--category">' + escapeHtml(listing.category) + '</span>')
    Object.keys(DISCIPLINE_LABELS).forEach(function (key) {
      if (listing.disciplines[key]) tags.push('<span class="listing-tag listing-tag--discipline">' + DISCIPLINE_LABELS[key] + '</span>')
    })
    Object.keys(OPEN_FOR_LABELS).forEach(function (key) {
      if (listing.openFor[key]) tags.push('<span class="listing-tag listing-tag--attr">' + OPEN_FOR_LABELS[key] + '</span>')
    })
    return tags.join('')
  }

  function syncFilterPills () {
    document.querySelectorAll('.filter-pill').forEach(function (b) {
      var group = b.getAttribute('data-filter')
      var v = b.getAttribute('data-value')
      var selected = state[group]
      b.classList.toggle('is-active', v === '' ? selected.length === 0 : selected.indexOf(v) !== -1)
    })
  }

  function removeFromArray (arr, value) {
    var i = arr.indexOf(value)
    if (i !== -1) arr.splice(i, 1)
  }

  function activeFilterChips () {
    var chips = []
    state.category.forEach(function (c) {
      chips.push({ key: 'category', value: c, label: c })
    })
    state.discipline.forEach(function (d) {
      chips.push({ key: 'discipline', value: d, label: 'Discipline: ' + (DISCIPLINE_LABELS[d] || d) })
    })
    state.openFor.forEach(function (o) {
      chips.push({ key: 'openFor', value: o, label: 'Open for: ' + (OPEN_FOR_LABELS[o] || o) })
    })
    if (state.country) chips.push({ key: 'country', value: state.country, label: state.country })
    if (state.remote) chips.push({ key: 'remote', value: '', label: 'Remote' })
    if (state.accommodation) chips.push({ key: 'accommodation', value: '', label: 'Accommodation' })
    if (state.search) chips.push({ key: 'search', value: '', label: 'Search: "' + state.search + '"' })
    return chips
  }

  function clearFilterChip (key, value) {
    if (key === 'category') removeFromArray(state.category, value)
    if (key === 'discipline') removeFromArray(state.discipline, value)
    if (key === 'openFor') removeFromArray(state.openFor, value)
    if (key === 'country') { state.country = ''; countrySelect.value = '' }
    if (key === 'remote') { state.remote = false; remoteToggle.checked = false }
    if (key === 'accommodation') { state.accommodation = false; accommodationToggle.checked = false }
    if (key === 'search') { state.search = ''; searchInput.value = '' }
    syncFilterPills()
    state.page = 1
    renderList()
  }

  function renderActiveFilters () {
    if (!activeFiltersEl) return
    var chips = activeFilterChips()
    if (!chips.length) { activeFiltersEl.innerHTML = ''; return }
    activeFiltersEl.innerHTML = '' +
      '<span class="programmes-active-filters__label">Active filters:</span>' +
      chips.map(function (c) {
        return '<button type="button" class="programmes-filter-chip" data-clear="' + c.key + '" data-clear-value="' + escapeHtml(c.value) + '">' + escapeHtml(c.label) + ' &times;</button>'
      }).join('') +
      '<button type="button" class="programmes-filter-chip programmes-filter-chip--clear-all" id="lf-clear-all">Clear all</button>'

    activeFiltersEl.querySelectorAll('[data-clear]').forEach(function (btn) {
      btn.addEventListener('click', function () { clearFilterChip(btn.getAttribute('data-clear'), btn.getAttribute('data-clear-value')) })
    })
    var clearAllBtn = document.getElementById('lf-clear-all')
    if (clearAllBtn) clearAllBtn.addEventListener('click', function () { clearBtn.click() })
  }

  function cardHtml (listing) {
    var meta = ''
    if (listing.researchFocus) {
      meta += '<div class="listing-card__meta-label">Research Focus / Keywords</div><div class="listing-card__meta-value">' + escapeHtml(listing.researchFocus) + '</div>'
    }
    if (listing.supportPeriod) {
      meta += '<div class="listing-card__meta-label">Support Period</div><div class="listing-card__meta-value">' + escapeHtml(listing.supportPeriod) + '</div>'
    }
    if (listing.applicationDeadline) {
      meta += '<div class="listing-card__meta-label">Application Deadline</div><div class="listing-card__meta-value">' + escapeHtml(listing.applicationDeadline) + '</div>'
    }
    return '' +
      '<a class="listing-card" href="#' + encodeURIComponent(listing.id) + '">' +
        '<span class="listing-card__country">' + pinIcon() + escapeHtml(listing.country) + '<span class="listing-card__id">' + escapeHtml(listing.id) + '</span></span>' +
        '<div class="listing-card__institution">' + escapeHtml(listing.institution) + '</div>' +
        '<div class="listing-card__description">' + escapeHtml(listing.description) + '</div>' +
        meta +
        '<div class="listing-card__tags">' + tagsHtml(listing) + '</div>' +
      '</a>'
  }

  var SORTERS = {
    newest: function (a, b) { return b.order - a.order },
    oldest: function (a, b) { return a.order - b.order },
    institution: function (a, b) { return (a.institution || '').localeCompare(b.institution || '') },
    country: function (a, b) { return (a.country || '').localeCompare(b.country || '') }
  }

  function paginate (results) {
    if (state.pageSize === 'all') return results
    var totalPages = Math.max(1, Math.ceil(results.length / state.pageSize))
    if (state.page > totalPages) state.page = totalPages
    var start = (state.page - 1) * state.pageSize
    return results.slice(start, start + state.pageSize)
  }

  function renderPagination (totalCount) {
    var container = document.getElementById('listings-pagination-controls')
    if (!container) return
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
        renderList()
        listEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
  }

  function renderList () {
    var results = openListings.filter(matches).sort(SORTERS[state.sort] || SORTERS.newest)
    countEl.textContent = results.length + ' listing' + (results.length === 1 ? '' : 's')
    var pageResults = paginate(results)
    listEl.innerHTML = pageResults.length
      ? pageResults.map(cardHtml).join('')
      : '<div class="listings-empty">No listings match your filters.</div>'
    renderPagination(results.length)
    renderActiveFilters()
  }

  function copyLinkButtonHtml () {
    return '<button type="button" class="detail-action-btn" id="detail-copy-link" aria-label="Copy link to this listing" title="Copy link to this listing">' +
      '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>' +
      '</button>'
  }

  function detailUrl (id) {
    var basePath = document.body.getAttribute('data-base-path') || ''
    return window.location.origin + basePath + '/listings/' + encodeURIComponent(id) + '/'
  }

  function shareRowHtml (id, title) {
    var url = detailUrl(id)
    var encodedUrl = encodeURIComponent(url)
    var text = encodeURIComponent(title + ' — ' + url)
    var subject = encodeURIComponent(title)
    var body = encodeURIComponent('Thought this might be relevant:\n\n' + url)

    return '' +
      '<div class="share-row">' +
        '<span class="share-row__label">Share this listing</span>' +
        '<a class="share-row__link" href="mailto:?subject=' + subject + '&amp;body=' + body + '">' +
          '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>' +
          '<span>Email</span>' +
        '</a>' +
        '<a class="share-row__link" href="https://www.linkedin.com/sharing/share-offsite/?url=' + encodedUrl + '" target="_blank" rel="noopener">' +
          '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>' +
          '<span>LinkedIn</span>' +
        '</a>' +
        '<a class="share-row__link" href="https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl + '" target="_blank" rel="noopener">' +
          '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>' +
          '<span>Facebook</span>' +
        '</a>' +
        '<a class="share-row__link" href="https://wa.me/?text=' + text + '" target="_blank" rel="noopener">' +
          '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' +
          '<span>WhatsApp</span>' +
        '</a>' +
      '</div>'
  }

  function wireCopyLink (id) {
    var btn = document.getElementById('detail-copy-link')
    if (!btn) return
    btn.addEventListener('click', function (e) {
      e.preventDefault()
      e.stopPropagation()

      var url = detailUrl(id)
      var originalHtml = btn.innerHTML

      function showCopied () {
        btn.classList.add('is-copied')
        btn.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>'
        setTimeout(function () {
          btn.classList.remove('is-copied')
          btn.innerHTML = originalHtml
        }, 1500)
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(showCopied)
      } else {
        var tmp = document.createElement('textarea')
        tmp.value = url
        tmp.style.position = 'fixed'
        tmp.style.opacity = '0'
        document.body.appendChild(tmp)
        tmp.select()
        document.execCommand('copy')
        document.body.removeChild(tmp)
        showCopied()
      }
    })
  }

  function renderDetail (id) {
    var listing = byId[id]

    if (!listing) {
      detailEl.innerHTML = '<button type="button" class="listing-detail__back" id="detail-back">&larr; All listings</button>' +
        '<div class="listing-detail__not-found">This listing could not be found.</div>'
    } else if (listing.archived) {
      detailEl.innerHTML = '' +
        '<button type="button" class="listing-detail__back" id="detail-back">&larr; All listings</button>' +
        copyLinkButtonHtml() +
        '<span class="listing-detail__id">' + escapeHtml(listing.id) + '</span>' +
        '<div class="listing-detail__closed-banner">This opportunity has closed</div>' +
        '<div class="listing-detail__country">' + pinIcon() + escapeHtml(listing.country || '') + '</div>' +
        '<div class="listing-detail__institution">' + escapeHtml(listing.institution) + '</div>' +
        '<div class="listing-detail__tags">' + (listing.category ? '<span class="listing-tag listing-tag--category">' + escapeHtml(listing.category) + '</span>' : '') + '</div>' +
        '<div class="listing-detail__blurred">' +
          '<p class="listing-detail__description">This listing\u2019s details are no longer shown, to avoid contacting institutions after an opportunity has ended.</p>' +
        '</div>'
    } else {
      var accommodationText = listing.accommodation.available
        ? (listing.accommodation.note || 'Available')
        : null

      detailEl.innerHTML = '' +
        '<button type="button" class="listing-detail__back" id="detail-back">&larr; All listings</button>' +
        copyLinkButtonHtml() +
        '<span class="listing-detail__id">' + escapeHtml(listing.id) + '</span>' +
        '<div class="listing-detail__country">' + pinIcon() + escapeHtml(listing.country || '') + '</div>' +
        '<div class="listing-detail__institution">' + escapeHtml(listing.institution) + '</div>' +
        '<div class="listing-detail__tags">' + tagsHtml(listing) + '</div>' +
        '<p class="listing-detail__description">' + escapeHtml(listing.description) + '</p>' +
        (listing.researchFocus ? '<div class="listing-detail__field-label">Research Focus / Keywords</div><div class="listing-detail__field-value">' + escapeHtml(listing.researchFocus) + '</div>' : '') +
        (listing.supportPeriod ? '<div class="listing-detail__field-label">Support Period</div><div class="listing-detail__field-value">' + escapeHtml(listing.supportPeriod) + '</div>' : '') +
        (listing.applicationDeadline ? '<div class="listing-detail__field-label">Application Deadline</div><div class="listing-detail__field-value">' + escapeHtml(listing.applicationDeadline) + '</div>' : '') +
        (accommodationText ? '<div class="listing-detail__field-label">Accommodation</div><div class="listing-detail__field-value">' + escapeHtml(accommodationText) + '</div>' : '') +
        (listing.additionalSupport ? '<div class="listing-detail__field-label">Additional Support</div><div class="listing-detail__field-value">' + escapeHtml(listing.additionalSupport) + '</div>' : '') +
        (listing.contact ? '<div class="listing-detail__field-label">Contact</div><div class="listing-detail__field-value">' + escapeHtml(listing.contact) + '</div>' : '') +
        (listing.link ? '<div class="listing-detail__field-label">Link</div><div class="listing-detail__field-value"><a href="' + escapeHtml(listing.link) + '" target="_blank" rel="noopener">' + escapeHtml(listing.link) + '</a></div>' : '') +
        shareRowHtml(listing.id, listing.institution)
    }

    if (listing) wireCopyLink(listing.id)

    var backBtn = document.getElementById('detail-back')
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        window.location.hash = ''
      })
    }
  }

  function syncView () {
    var id = decodeURIComponent(window.location.hash.replace(/^#/, ''))
    if (id) {
      filtersEl.hidden = true
      mainEl.hidden = true
      detailEl.hidden = false
      renderDetail(id)
      window.scrollTo(0, 0)
    } else {
      filtersEl.hidden = false
      mainEl.hidden = false
      detailEl.hidden = true
    }
  }

  document.querySelectorAll('.filter-pill').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.getAttribute('data-filter')
      var value = btn.getAttribute('data-value')
      var selected = state[group]

      if (value === '') {
        selected.length = 0
      } else {
        var i = selected.indexOf(value)
        if (i === -1) {
          selected.push(value)
        } else {
          selected.splice(i, 1)
        }
      }

      document.querySelectorAll('.filter-pill[data-filter="' + group + '"]').forEach(function (b) {
        var v = b.getAttribute('data-value')
        b.classList.toggle('is-active', v === '' ? selected.length === 0 : selected.indexOf(v) !== -1)
      })
      state.page = 1
      renderList()
    })
  })

  searchInput.addEventListener('input', function () {
    state.search = searchInput.value.trim()
    state.page = 1
    renderList()

    var value = searchInput.value
    clearTimeout(searchLogDebounceTimer)
    searchLogDebounceTimer = setTimeout(function () { logSearchQuery(value) }, 1500)
  })

  countrySelect.addEventListener('change', function () {
    state.country = countrySelect.value
    state.page = 1
    renderList()
  })

  remoteToggle.addEventListener('change', function () {
    state.remote = remoteToggle.checked
    state.page = 1
    renderList()
  })

  accommodationToggle.addEventListener('change', function () {
    state.accommodation = accommodationToggle.checked
    state.page = 1
    renderList()
  })

  sortSelect.addEventListener('change', function () {
    state.sort = sortSelect.value
    renderList()
  })

  var pageSizeSelect = document.getElementById('lf-page-size')
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', function () {
      state.pageSize = pageSizeSelect.value === 'all' ? 'all' : parseInt(pageSizeSelect.value, 10)
      state.page = 1
      renderList()
    })
  }

  clearBtn.addEventListener('click', function () {
    state = { category: [], discipline: [], openFor: [], country: '', search: '', remote: false, accommodation: false, sort: 'newest', pageSize: 20, page: 1 }
    searchInput.value = ''
    countrySelect.value = ''
    remoteToggle.checked = false
    accommodationToggle.checked = false
    sortSelect.value = 'newest'
    if (pageSizeSelect) pageSizeSelect.value = '20'
    document.querySelectorAll('.filter-pill').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-value') === '')
    })
    renderList()
  })

  window.addEventListener('hashchange', syncView)

  renderList()
  syncView()
})()
