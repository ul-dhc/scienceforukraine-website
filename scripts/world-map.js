const topojson = require('topojson-client')
const { geoNaturalEarth1, geoPath } = require('d3-geo')
const world = require('world-atlas/countries-110m.json')

// maps our dataset's country naming onto world-atlas's naming, where they differ.
// Includes a few likely variants (not just the current exact spelling) so a
// minor rename in the sheet is less likely to silently break the map again.
const NAME_ALIASES = {
  'U.K.': 'United Kingdom',
  'UK': 'United Kingdom',
  'U.S.': 'United States of America',
  'US': 'United States of America',
  'USA': 'United States of America',
  'U.S.A.': 'United States of America',
  'Czech Republic': 'Czechia'
}

function colorForCount (count) {
  if (count === 0) return '#F1F4F7' // var(--pale-gray) — no data
  if (count <= 2) return '#DCEEFF'
  if (count <= 5) return '#9DC7F0'
  if (count <= 15) return '#4A90D9'
  return '#0057B7' // var(--accent-1) — highest tier
}

function resolveWorldName (ourName) {
  return NAME_ALIASES[ourName] || ourName
}

function generateWorldMap (programmes) {
  const counts = {}
  for (const p of programmes) {
    if (!p.country) continue
    counts[p.country] = (counts[p.country] || 0) + 1
  }

  const geo = topojson.feature(world, world.objects.countries)
  const projection = geoNaturalEarth1().fitSize([960, 460], geo)
  const pathGen = geoPath(projection)

  // resolve forward from whatever country strings are ACTUALLY in the data right
  // now (not a static reverse table) — this way tooltips/click-filtering always
  // use the real current spelling from the sheet, even if it changes later
  const worldNameToData = {}
  for (const [ourName, count] of Object.entries(counts)) {
    worldNameToData[resolveWorldName(ourName)] = { ourName, count }
  }

  const pathsHtml = geo.features.map(feature => {
    const worldName = feature.properties.name
    const match = worldNameToData[worldName]
    const ourName = match ? match.ourName : worldName
    const count = match ? match.count : 0
    const d = pathGen(feature)
    if (!d) return ''
    return `<path class="world-map__country" data-country="${ourName.replace(/"/g, '&quot;')}" data-count="${count}" d="${d}" fill="${colorForCount(count)}" stroke="#ffffff" stroke-width="0.5"></path>`
  }).join('')

  const svg = `<svg class="world-map" viewBox="0 0 960 460" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Map of countries with archived funding programmes">${pathsHtml}</svg>`

  const topCountries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return { svg, countByCountry: counts, topCountries, countryCount: Object.keys(counts).length }
}

module.exports = { generateWorldMap }
