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

  // copy-link buttons: copy a direct URL to this update, without also
  // triggering the <summary>'s native open/close toggle
  document.querySelectorAll('.update-card__copy-link').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault()
      e.stopPropagation()

      var slug = btn.getAttribute('data-slug')
      var url = window.location.origin + '/news/#' + slug
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

  // deep-linking: /news#some-update-slug opens and scrolls to that item
  if (window.location.hash) {
    var target = document.querySelector(window.location.hash)
    if (target && target.classList.contains('update-card')) {
      target.open = true
      target.scrollIntoView({ block: 'start' })
    }
  }
})()
