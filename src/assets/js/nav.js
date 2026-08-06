(function () {
  var toggle = document.getElementById('menu-toggle')
  var menu = document.getElementById('menu')
  var icon = document.getElementById('burger-icon')

  if (toggle && menu) {
    // the full-screen overlay (and its scroll lock) only applies below the
    // desktop breakpoint where the menu becomes an anchored dropdown
    var isMobileMenu = function () {
      return window.matchMedia('(max-width: 767px)').matches
    }

    function closeMenu () {
      menu.classList.remove('open')
      icon.classList.remove('open')
      toggle.setAttribute('aria-expanded', 'false')
      document.body.style.overflow = ''
    }

    toggle.addEventListener('click', function () {
      var isOpen = menu.classList.toggle('open')
      icon.classList.toggle('open', isOpen)
      toggle.setAttribute('aria-expanded', String(isOpen))
      document.body.style.overflow = (isOpen && isMobileMenu()) ? 'hidden' : ''
    })

    // close menu after following a link (mirrors the Vue app's @click="toggleMenu")
    menu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeMenu)
    })

    // close when clicking outside the menu panel (dropdown-style dismissal)
    document.addEventListener('click', function (e) {
      if (!menu.classList.contains('open')) return
      if (menu.contains(e.target) || toggle.contains(e.target)) return
      closeMenu()
    })

    // close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('open')) closeMenu()
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

  // --- Font size control (single "Aa" toggle, cycles through steps) ---
  var FONT_SCALE_KEY = 'sfu-font-scale'
  var FONT_SCALE_STEPS = [100, 115, 130, 145]
  var BASE_FONT_SIZES = { '--font-size': 16, '--font-size-s': 12, '--font-size-l': 20, '--font-size-xl': 32 }

  var fontSizeToggle = document.getElementById('font-size-toggle')

  function applyFontScale (scale) {
    Object.keys(BASE_FONT_SIZES).forEach(function (name) {
      document.documentElement.style.setProperty(name, (BASE_FONT_SIZES[name] * scale / 100) + 'px')
    })
    if (fontSizeToggle) {
      fontSizeToggle.setAttribute('aria-label', 'Change text size (currently ' + scale + '%)')
    }
  }

  var storedScale = parseInt(localStorage.getItem(FONT_SCALE_KEY), 10)
  var fontScaleIndex = FONT_SCALE_STEPS.indexOf(storedScale)
  if (fontScaleIndex === -1) fontScaleIndex = 0

  applyFontScale(FONT_SCALE_STEPS[fontScaleIndex])

  if (fontSizeToggle) {
    fontSizeToggle.addEventListener('click', function () {
      fontScaleIndex = (fontScaleIndex + 1) % FONT_SCALE_STEPS.length
      applyFontScale(FONT_SCALE_STEPS[fontScaleIndex])
      localStorage.setItem(FONT_SCALE_KEY, String(FONT_SCALE_STEPS[fontScaleIndex]))
    })
  }
})()
