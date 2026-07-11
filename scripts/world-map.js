const topojson = require('topojson-client')
const { geoNaturalEarth1, geoPath } = require('d3-geo')
const world = require('world-atlas/countries-110m.json')
const turf = require('@turf/turf')

const NAME_ALIASES = {
  'U.K.': 'United Kingdom',
  'UK': 'United Kingdom',
  'U.S.': 'United States of America',
  'US': 'United States of America',
  'USA': 'United States of America',
  'U.S.A.': 'United States of America',
  'Czech Republic': 'Czechia'
}

const INTERNATIONAL_MARKER_LONLAT = [-25, 42]

function resolveWorldName (ourName) {
  return NAME_ALIASES[ourName] || ourName
}


function correctCrimeaAttribution (geo) {
  const russiaIndex = geo.features.findIndex(f => f.properties.name === 'Russia')
  const ukraineIndex = geo.features.findIndex(f => f.properties.name === 'Ukraine')
  if (russiaIndex === -1 || ukraineIndex === -1) return

  const russia = geo.features[russiaIndex]
  const ukraine = geo.features[ukraineIndex]
  if (russia.geometry.type !== 'MultiPolygon') return

  try {
    const crimeaBox = turf.bboxPolygon([32.3, 44.0, 37.0, 46.3])
    const crimeaPieces = []
    const remainingRussianPieces = []

    russia.geometry.coordinates.forEach(coords => {
      const piece = turf.polygon(coords)
      const bbox = turf.bbox(piece)
      const spansHugeRange = (bbox[2] - bbox[0]) > 30 
      if (!spansHugeRange && turf.booleanIntersects(piece, crimeaBox)) {
        crimeaPieces.push(coords)
      } else {
        remainingRussianPieces.push(coords)
      }
    })

    if (!crimeaPieces.length) return


    const ukrainePieces = ukraine.geometry.type === 'Polygon'
      ? [ukraine.geometry.coordinates]
      : ukraine.geometry.coordinates

  
    geo.features[russiaIndex] = {
      type: 'Feature',
      properties: russia.properties,
      geometry: { type: 'MultiPolygon', coordinates: remainingRussianPieces }
    }
    geo.features[ukraineIndex] = {
      type: 'Feature',
      properties: ukraine.properties,
      geometry: { type: 'MultiPolygon', coordinates: ukrainePieces.concat(crimeaPieces) }
    }
  } catch (e) {

    console.warn('Crimea attribution correction failed, using original geometry:', e.message)
  }
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
  correctCrimeaAttribution(geo)
  const width = 960
  const height = 460
  const padding = 24


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
