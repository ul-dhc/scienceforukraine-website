(function () {
  var input = document.getElementById('site-search-input')
  var resultsEl = document.getElementById('site-search-results')
  var wrapEl = document.getElementById('site-search')
  if (!input || !resultsEl || !wrapEl) return

  var BASE_PATH = document.body.getAttribute('data-base-path') || ''
  var SEARCH_LOG_ENDPOINT = 'https://script.google.com/macros/s/AKfycbw0WHnAeTs4HA15oKqIWzB8GOSjfR6McZabFNsGRSNHWOqQIQFCb5BY8i8ECkuwvvJ0/exec'
  var TYPE_LABELS = {
    listing: 'Positions & support offers',
    programme: 'Funding programmes',
    news: 'News',
    page: 'Pages'
  }
  var TYPE_ORDER = ['listing', 'programme', 'news', 'page']
  var MAX_PER_TYPE = 4
  var SNIPPET_RADIUS = 70
  var LOG_DEBOUNCE_MS = 1500

  var index = null
  var indexPromise = null
  var debounceTimer = null
  var logDebounceTimer = null
  var lastLoggedQuery = ''

  function logQuery (query) {
    var trimmed = query.trim()
    if (trimmed.length < 2 || trimmed === lastLoggedQuery) return
    if (!SEARCH_LOG_ENDPOINT || SEARCH_LOG_ENDPOINT.indexOf('REPLACE_WITH') === 0) return
    lastLoggedQuery = trimmed
    fetch(SEARCH_LOG_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ query: trimmed, page: 'Homepage' })
    }).catch(function () {})
  }

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

  function escapeRegExp (str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  function matches (entry, tokens) {
    var haystack = ((entry.title || '') + ' ' + (entry.text || '')).toLowerCase()
    return tokens.every(function (t) { return haystack.indexOf(t) !== -1 })
  }

  function buildSnippet (entry, tokens) {
    var text = entry.text || ''
    var lower = text.toLowerCase()
    var firstIndex = -1
    tokens.forEach(function (t) {
      var found = lower.indexOf(t)
      if (found !== -1 && (firstIndex === -1 || found < firstIndex)) firstIndex = found
    })

    var start, excerpt
    if (firstIndex === -1) {
      start = 0
      excerpt = text.slice(0, SNIPPET_RADIUS * 2)
    } else {
      start = Math.max(0, firstIndex - SNIPPET_RADIUS)
      excerpt = text.slice(start, start + SNIPPET_RADIUS * 2)
    }

    var prefix = start > 0 ? '…' : ''
    var suffix = start + excerpt.length < text.length ? '…' : ''
    var escaped = escapeHtml(excerpt)

    tokens.forEach(function (t) {
      var re = new RegExp('(' + escapeRegExp(t) + ')', 'ig')
      escaped = escaped.replace(re, '<mark>$1</mark>')
    })

    return prefix + escaped + suffix
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
          '<span class="search-strip__result-snippet">' + buildSnippet(entry, tokens) + '</span>' +
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

    clearTimeout(logDebounceTimer)
    logDebounceTimer = setTimeout(function () {
      logQuery(value)
    }, LOG_DEBOUNCE_MS)
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
