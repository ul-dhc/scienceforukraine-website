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
// placed in the Atlantic, roughly between Europe and North America
const INTERNATIONAL_MARKER_LONLAT = [-38, 40]

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

  // fit the zoom to the DENSE cluster of countries (covering ~90% of programmes
  // by count), not every country with any data at all — a couple of geographic
  // outliers (e.g. India, Brazil) would otherwise force a near-global bounding
  // box and defeat the zoom entirely, even though they're a small fraction of
  // the actual data
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
  const fitTarget = coreFeatures.length
    ? { type: 'FeatureCollection', features: coreFeatures }
    : geo

  const width = 960
  const height = 460
  const padding = 24
  const projection = geoNaturalEarth1().fitExtent(
    [[padding, padding], [width - padding, height - padding]],
    fitTarget
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
    ? `<circle class="world-map__marker" data-region="International" cx="${markerXY[0]}" cy="${markerXY[1]}" r="8"></circle>`
    : ''

  const svg = `<svg class="world-map" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Map of countries with archived funding programmes">${pathsHtml}${markerHtml}</svg>`

  return { svg }
}

module.exports = { generateWorldMap }
