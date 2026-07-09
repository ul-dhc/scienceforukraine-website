(function () {
  var expandAllBtn = document.getElementById('expand-all')
  var collapseAllBtn = document.getElementById('collapse-all')
  var items = document.querySelectorAll('.update-card')

  if (expandAllBtn) {
    expandAllBtn.addEventListener('click', function () {
      items.forEach(function (el) { el.open = true })
    })
  }

  if (collapseAllBtn) {
    collapseAllBtn.addEventListener('click', function () {
      items.forEach(function (el) { el.open = false })
    })
  }


  document.querySelectorAll('.update-card__copy-link').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault()
      e.stopPropagation()

      var slug = btn.getAttribute('data-slug')
      var basePath = document.body.getAttribute('data-base-path') || ''
      var url = window.location.origin + basePath + '/news/#' + slug
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
        // fallback for browsers without the Clipboard API
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
  })


  if (window.location.hash) {
    var target = document.querySelector(window.location.hash)
    if (target && target.classList.contains('update-card')) {
      target.open = true
      target.scrollIntoView({ block: 'start' })
    }
  }

  var current = document.body.getAttribute('data-page')
  if (current) {
    document.querySelectorAll('[data-nav="' + current + '"]').forEach(function (el) {
      el.classList.add('active')
    })
  }


  var yearEl = document.getElementById('footer-year')
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear())
  }
})()
