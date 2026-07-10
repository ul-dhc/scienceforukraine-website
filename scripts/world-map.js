const topojson = require('topojson-client')
const { geoNaturalEarth1, geoPath } = require('d3-geo')
const world = require('world-atlas/countries-110m.json')

const NAME_ALIASES = {
  'U.K.': 'United Kingdom',
  'UK': 'United Kingdom',
  'U.S.': 'United States of America',
  'US': 'United States of America',
  'USA': 'United States of America',
  'U.S.A.': 'United States of America',
  'Czech Republic': 'Czechia'
}


const INTERNATIONAL_MARKER_LONLAT = [-38, 40]

function resolveWorldName (ourName) {
  return NAME_ALIASES[ourName] || ourName
}

function generateWorldMap (programmes) {
  const activeCountries = new Set()
  for (const p of programmes) {
    if (p.country) activeCountries.add(resolveWorldName(p.country))
  }

  const geo = topojson.feature(world, world.objects.countries)

  // zoom the projection to the countries that actually have data, not the
  // whole world — with a little padding so nothing sits at the edge
  const activeFeatures = geo.features.filter(f => activeCountries.has(f.properties.name))
  const fitTarget = activeFeatures.length
    ? { type: 'FeatureCollection', features: activeFeatures }
    : geo

  const width = 960
  const height = 460
  const padding = 24
  const projection = geoNaturalEarth1().fitExtent(
    [[padding, padding], [width - padding, height - padding]],
    fitTarget
  )
  const pathGen = geoPath(projection)

  const worldNameToOurs = {}
  for (const p of programmes) {
    if (p.country) worldNameToOurs[resolveWorldName(p.country)] = p.country
  }

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
