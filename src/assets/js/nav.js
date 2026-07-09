(function () {
  var toggle = document.getElementById('menu-toggle')
  var menu = document.getElementById('menu')
  var icon = document.getElementById('burger-icon')

  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var isOpen = menu.classList.toggle('open')
      icon.classList.toggle('open', isOpen)
      toggle.setAttribute('aria-expanded', String(isOpen))
      document.body.style.overflow = isOpen ? 'hidden' : ''
    })

    // close menu after following a link (mirrors the Vue app's @click="toggleMenu")
    menu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        menu.classList.remove('open')
        icon.classList.remove('open')
        toggle.setAttribute('aria-expanded', 'false')
        document.body.style.overflow = ''
      })
    })
  }

  // highlight the current page's nav link (mirrors Vue Router's .router-link-active)
  var current = document.body.getAttribute('data-page')
  if (current) {
    document.querySelectorAll('[data-nav="' + current + '"]').forEach(function (el) {
      el.classList.add('active')
    })
  }

  // keep the footer's copyright year current
  var yearEl = document.getElementById('footer-year')
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear())
  }
})()
