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
      if (listing.disciplines[key]) tags.push('<span class="listing-tag listing-tag--attr">' + DISCIPLINE_LABELS[key] + '</span>')
    })
    Object.keys(OPEN_FOR_LABELS).forEach(function (key) {
      if (listing.openFor[key]) tags.push('<span class="listing-tag listing-tag--attr">' + OPEN_FOR_LABELS[key] + '</span>')
    })
    return tags.join('')
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
  }

  function renderDetail (id) {
    var listing = byId[id]

    if (!listing) {
      detailEl.innerHTML = '<button type="button" class="listing-detail__back" id="detail-back">&larr; All listings</button>' +
        '<div class="listing-detail__not-found">This listing could not be found.</div>'
    } else if (listing.archived) {
      detailEl.innerHTML = '' +
        '<button type="button" class="listing-detail__back" id="detail-back">&larr; All listings</button>' +
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
        (listing.link ? '<div class="listing-detail__field-label">Link</div><div class="listing-detail__field-value"><a href="' + escapeHtml(listing.link) + '" target="_blank" rel="noopener">' + escapeHtml(listing.link) + '</a></div>' : '')
    }

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
