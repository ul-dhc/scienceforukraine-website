(function () {
  var input = document.getElementById('site-search-input')
  var resultsEl = document.getElementById('site-search-results')
  var wrapEl = document.getElementById('site-search')
  if (!input || !resultsEl || !wrapEl) return

  var BASE_PATH = document.body.getAttribute('data-base-path') || ''
  var TYPE_LABELS = {
    listing: 'Positions & support offers',
    programme: 'Funding programmes',
    news: 'News',
    page: 'Pages'
  }
  var TYPE_ORDER = ['listing', 'programme', 'news', 'page']
  var MAX_PER_TYPE = 4

  var index = null
  var indexPromise = null
  var debounceTimer = null

  function loadIndex () {
    if (indexPromise) return indexPromise
    indexPromise = fetch(BASE_PATH + '/search-index.json')
      .then(function (res) { return res.json() })
      .then(function (data) { index = data; return data })
      .catch(function () { index = []; return index })
    return indexPromise
  }

  function escapeHtml (str) {
    var div = document.createElement('div')
    div.textContent = str == null ? '' : String(str)
    return div.innerHTML
  }

  function truncate (str, max) {
    if (!str || str.length <= max) return str || ''
    return str.slice(0, max).replace(/\s+\S*$/, '') + '…'
  }

  function matches (entry, tokens) {
    var haystack = ((entry.title || '') + ' ' + (entry.snippet || '')).toLowerCase()
    return tokens.every(function (t) { return haystack.indexOf(t) !== -1 })
  }

  function render (q) {
    var query = q.trim().toLowerCase()
    if (!query || query.length < 2 || !index) {
      resultsEl.hidden = true
      resultsEl.innerHTML = ''
      return
    }

    var tokens = query.split(/\s+/).filter(Boolean)
    var matched = index.filter(function (entry) { return matches(entry, tokens) })

    if (!matched.length) {
      resultsEl.innerHTML = '<div class="search-strip__empty">No results for &ldquo;' + escapeHtml(q.trim()) + '&rdquo;</div>'
      resultsEl.hidden = false
      return
    }

    var html = ''
    TYPE_ORDER.forEach(function (type) {
      var group = matched.filter(function (e) { return e.type === type }).slice(0, MAX_PER_TYPE)
      if (!group.length) return
      html += '<div class="search-strip__group">'
      html += '<div class="search-strip__group-label">' + TYPE_LABELS[type] + '</div>'
      group.forEach(function (entry) {
        html += '<a class="search-strip__result search-strip__result--' + type + '" href="' + BASE_PATH + entry.url + '">' +
          '<span class="search-strip__result-title">' + escapeHtml(entry.title) + '</span>' +
          (entry.snippet ? '<span class="search-strip__result-snippet">' + escapeHtml(truncate(entry.snippet, 110)) + '</span>' : '') +
          '</a>'
      })
      html += '</div>'
    })

    resultsEl.innerHTML = html
    resultsEl.hidden = false
  }

  input.addEventListener('input', function () {
    var value = input.value
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(function () {
      loadIndex().then(function () { render(value) })
    }, 120)
  })

  input.addEventListener('focus', function () {
    loadIndex()
    if (input.value.trim().length >= 2) render(input.value)
  })

  document.addEventListener('click', function (e) {
    if (!wrapEl.contains(e.target)) {
      resultsEl.hidden = true
    }
  })

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      resultsEl.hidden = true
      input.blur()
    }
  })
})()
