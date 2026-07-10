(function () {
  var dataEl = document.getElementById('programmes-data')
  if (!dataEl) return

  var programmes = JSON.parse(dataEl.textContent)

  var gridEl = document.getElementById('programmes-grid')
  var countEl = document.getElementById('programmes-count')
  var searchInput = document.getElementById('pf-search')
  var countrySelect = document.getElementById('pf-country')
  var disciplineSelect = document.getElementById('pf-discipline')
  var openForSelect = document.getElementById('pf-open-for')
  var typeSelect = document.getElementById('pf-type')
  var sortSelect = document.getElementById('pf-sort')

  var state = { search: '', country: '', discipline: '', openFor: '', type: '', sort: 'newest' }

  function escapeHtml (str) {
    var div = document.createElement('div')
    div.textContent = str == null ? '' : String(str)
    return div.innerHTML
  }

  function isNew (p) {
    if (!p.dateAdded) return false
    var added = new Date(p.dateAdded)
    var days = (Date.now() - added.getTime()) / (1000 * 60 * 60 * 24)
    return days <= 60
  }

  function matches (p) {
    if (state.country && p.country !== state.country) return false
    if (state.discipline && !p.disciplines[state.discipline]) return false
    if (state.openFor && !p.openFor[state.openFor]) return false
    if (state.type && p.types.indexOf(state.type) === -1) return false
    if (state.search) {
      var q = state.search.toLowerCase()
      var haystack = [p.title, p.description, p.country].join(' ').toLowerCase()
      if (haystack.indexOf(q) === -1) return false
    }
    return true
  }

  var SORTERS = {
    newest: function (a, b) { return (b.dateAdded || '').localeCompare(a.dateAdded || '') },
    oldest: function (a, b) { return (a.dateAdded || '').localeCompare(b.dateAdded || '') },
    title: function (a, b) { return a.title.localeCompare(b.title) },
    country: function (a, b) { return (a.country || '').localeCompare(b.country || '') }
  }

  function tagsHtml (p) {
    var tags = ['<span class="programme-tag">' + escapeHtml(p.primaryType) + '</span>']
    p.types.forEach(function (t) {
      if (t !== p.primaryType) tags.push('<span class="programme-tag programme-tag--secondary">' + escapeHtml(t) + '</span>')
    })
    return tags.join('')
  }

  function cardHtml (p) {
    var meta = ''
    if (p.deadline) {
      meta += '<div class="programme-card__meta-label">Deadline</div><div class="programme-card__meta-value">' + escapeHtml(p.deadline) + '</div>'
    }
    var linkHtml = p.link
      ? '<a class="programme-card__link" href="' + escapeHtml(p.link) + '" target="_blank" rel="noopener">View programme &rarr;</a>'
      : ''
    return '' +
      '<div class="programme-card">' +
        '<div class="programme-card__top">' +
          (isNew(p) ? '<span class="programme-card__new">NEW</span>' : '<span></span>') +
        '</div>' +
        '<div class="programme-card__title">' + escapeHtml(p.title) + '</div>' +
        (p.country ? '<div class="programme-card__country">' + escapeHtml(p.country) + '</div>' : '') +
        '<div class="programme-card__description">' + escapeHtml(p.description || '') + '</div>' +
        meta +
        '<div class="programme-card__tags">' + tagsHtml(p) + '</div>' +
        linkHtml +
      '</div>'
  }

  function render () {
    var results = programmes.filter(matches).sort(SORTERS[state.sort] || SORTERS.newest)
    countEl.textContent = results.length + ' programme' + (results.length === 1 ? '' : 's')
    gridEl.innerHTML = results.length
      ? results.map(cardHtml).join('')
      : '<div class="programmes-empty">No programmes match your filters.</div>'
  }

  searchInput.addEventListener('input', function () { state.search = searchInput.value.trim(); render() })
  countrySelect.addEventListener('change', function () { state.country = countrySelect.value; render() })
  disciplineSelect.addEventListener('change', function () { state.discipline = disciplineSelect.value; render() })
  openForSelect.addEventListener('change', function () { state.openFor = openForSelect.value; render() })
  typeSelect.addEventListener('change', function () { state.type = typeSelect.value; render() })
  sortSelect.addEventListener('change', function () { state.sort = sortSelect.value; render() })

  function filterByCountry (country) {
    countrySelect.value = country
    state.country = country
    render()
    var gridEl2 = document.getElementById('programmes-grid')
    if (gridEl2) gridEl2.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // world map: hover tooltip + click to filter
  var tooltip = document.getElementById('programmes-map-tooltip')
  document.querySelectorAll('.world-map__country').forEach(function (path) {
    path.addEventListener('mousemove', function (e) {
      var country = path.getAttribute('data-country')
      var count = path.getAttribute('data-count')
      if (!tooltip || count === '0') return
      tooltip.textContent = country + ': ' + count + ' programme' + (count === '1' ? '' : 's')
      tooltip.style.display = 'block'
      tooltip.style.left = (e.clientX + 12) + 'px'
      tooltip.style.top = (e.clientY + 12) + 'px'
    })
    path.addEventListener('mouseleave', function () {
      if (tooltip) tooltip.style.display = 'none'
    })
    path.addEventListener('click', function () {
      var count = path.getAttribute('data-count')
      if (count === '0') return
      filterByCountry(path.getAttribute('data-country'))
    })
  })

  // top-countries list: click to filter
  document.querySelectorAll('.programmes-top-countries__item').forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterByCountry(btn.getAttribute('data-country'))
    })
  })

  var viewAllBtn = document.getElementById('pf-view-all-countries')
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', function () { filterByCountry('') })
  }

  render()
})()
