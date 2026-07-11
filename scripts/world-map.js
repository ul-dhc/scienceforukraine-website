const topojson = require('topojson-client')
const { geoNaturalEarth1, geoPath } = require('d3-geo')
const world = require('world-atlas/countries-110m.json')

// maps our dataset's country naming onto world-atlas's naming, where they differ.
const NAME_ALIASES = {
  'U.K.': 'United Kingdom',
  'UK': 'United Kingdom',
  'U.S.': 'United States of America',
  'US': 'United States of America',
  'USA': 'United States of America',
  'U.S.A.': 'United States of America',
  'Czech Republic': 'Czechia'
}

// fixed point used to represent "International" (no specific country) programmes —
// placed in the Atlantic, further out from Europe than before, but still
// noticeably closer to the Europe side than the US side
const INTERNATIONAL_MARKER_LONLAT = [-25, 42]

function resolveWorldName (ourName) {
  return NAME_ALIASES[ourName] || ourName
}

function generateWorldMap (programmes) {
  const countsByWorldName = {}
  const worldNameToOurs = {}
  for (const p of programmes) {
    if (!p.country) continue
    const worldName = resolveWorldName(p.country)
    countsByWorldName[worldName] = (countsByWorldName[worldName] || 0) + 1
    worldNameToOurs[worldName] = p.country
  }

  const geo = topojson.feature(world, world.objects.countries)
  const width = 960
  const height = 460
  const padding = 24

  // the DRAWING projection always fits the whole world — every country gets a
  // valid, non-clipped position, so zooming/panning out always reveals
  // everything, never cuts anything off (this was the actual bug before:
  // countries outside the "dense cluster" fit had coordinates outside the
  // SVG's own viewBox and were being clipped by the SVG itself, not just
  // scaled small — no amount of client-side zoom could ever reveal them)
  const projection = geoNaturalEarth1().fitExtent(
    [[padding, padding], [width - padding, height - padding]],
    geo
  )
  const pathGen = geoPath(projection)

  const pathsHtml = geo.features.map(feature => {
    const worldName = feature.properties.name
    const ourName = worldNameToOurs[worldName] || worldName
    const d = pathGen(feature)
    if (!d) return ''
    return `<path class="world-map__country" data-country="${ourName.replace(/"/g, '&quot;')}" d="${d}"></path>`
  }).join('')

  const markerXY = projection(INTERNATIONAL_MARKER_LONLAT)
  const markerHtml = markerXY
    ? `<circle class="world-map__marker" data-region="International" cx="${markerXY[0]}" cy="${markerXY[1]}" r="13" fill="url(#flowerGlow)" filter="url(#flowerBlur)"></circle>`
    : ''

  const svg = `<svg class="world-map" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Map of countries with archived funding programmes"><defs><radialGradient id="flowerGlow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#FFD700" stop-opacity="1"/><stop offset="50%" stop-color="#FFC400" stop-opacity="0.8"/><stop offset="100%" stop-color="#FFC400" stop-opacity="0"/></radialGradient><filter id="flowerBlur" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.5"/></filter></defs>${pathsHtml}${markerHtml}</svg>`

  // separately, compute the DEFAULT VISUAL FOCUS (the dense cluster covering
  // ~90% of programmes by count) as a scale+translate to apply on top of the
  // full-world drawing — this is what makes the map open already "zoomed in"
  // on the busy region, while the full world remains reachable by zooming out
  const sortedByCount = Object.entries(countsByWorldName).sort((a, b) => b[1] - a[1])
  const totalCount = sortedByCount.reduce((sum, [, c]) => sum + c, 0)
  const coreWorldNames = new Set()
  let running = 0
  for (const [name, count] of sortedByCount) {
    coreWorldNames.add(name)
    running += count
    if (running / totalCount >= 0.9) break
  }
  const coreFeatures = geo.features.filter(f => coreWorldNames.has(f.properties.name))

  let defaultZoom = { scale: 1, x: 0, y: 0 }
  if (coreFeatures.length) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const feature of coreFeatures) {
      const bounds = pathGen.bounds(feature)
      if (bounds[0][0] < minX) minX = bounds[0][0]
      if (bounds[1][0] > maxX) maxX = bounds[1][0]
      if (bounds[0][1] < minY) minY = bounds[0][1]
      if (bounds[1][1] > maxY) maxY = bounds[1][1]
    }
    const boxW = maxX - minX
    const boxH = maxY - minY
    const focusPadding = 60
    const scale = Math.min(
      (width - focusPadding) / boxW,
      (height - focusPadding) / boxH,
      3.5
    )
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    defaultZoom = {
      scale: Math.max(1, scale),
      x: width / 2 - cx * scale,
      y: height / 2 - cy * scale
    }
  }

  return { svg, defaultZoom }
}

module.exports = { generateWorldMap }
