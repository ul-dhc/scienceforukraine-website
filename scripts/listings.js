const Papa = require('papaparse')

const LISTINGS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSztgSncrgS2WaCm8J4SRqL0FU4czD8xzV_yIXa-ldc0uHM9-1RK8sp_rpEXLhjHmaFFI0hFWNngOW6/pub?gid=0&single=true&output=csv'

const CATEGORY_SLUGS = {
  Position: 'position',
  Scholarship: 'scholarship',
  'Joint application': 'joint-application',
  Resources: 'resources',
  Mentoring: 'mentoring',
  'Academic transfer': 'academic-transfer'
}

function isYes (v) {
  if (!v) return false
  return /^y/i.test(String(v).trim())
}

function clean (v) {
  if (v === undefined || v === null) return ''
  return String(v).trim()
}

function parseDate (v) {
  const s = clean(v)
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function normalizeRow (row, order) {
  const id = clean(row.ID)
  if (!id) return null

  const archivedRaw = clean(row.Archived)
  const accommodationRaw = clean(row.Accommodation)
  const accommodationIsPlainYes = /^y/i.test(accommodationRaw)

  return {
    id,
    slug: id,
    order: typeof order === 'number' ? order : 0,
    archived: Boolean(archivedRaw),
    category: clean(row.Category) || null,
    categorySlug: CATEGORY_SLUGS[clean(row.Category)] || null,
    institution: clean(row.Institution) || null,
    country: clean(row.Country) || null,
    description: clean(row.Description) || null,
    contact: clean(row.Contact) || null,
    link: clean(row.Link) || null,
    researchFocus: clean(row['Research focus']) || null,
    applicationDeadline: parseDate(row['Application deadline']),
    supportPeriod: clean(row['Support period']) || null,
    additionalSupport: clean(row['Additional support']) || null,
    remote: isYes(row.Remote),
    accommodation: accommodationRaw
      ? { available: true, note: accommodationIsPlainYes ? null : accommodationRaw }
      : { available: false, note: null },
    openFor: {
      researchers: isYes(row.Researchers),
      doctoralStudents: isYes(row['Doctoral students']),
      students: isYes(row.Students),
      others: isYes(row.Others)
    },
    disciplines: {
      naturalSciences: isYes(row['Natural sciences']),
      socialSciences: isYes(row['Social sciences']),
      humanitiesAndTheArts: isYes(row['Humanities and the arts']),
      engineeringAndTechnology: isYes(row['Engineering and technology']),
      medicalAndHealthSciences: isYes(row['Medical and health sciences']),
      agriculturalAndVeterinarySciences: isYes(row['Agricultural and veterinary sciences']),
      unspecified: isYes(row.Unspecified)
    }
  }
}

function toMinimal (listing) {
  return {
    id: listing.id,
    archived: true,
    category: listing.category,
    categorySlug: listing.categorySlug,
    institution: listing.institution,
    country: listing.country
  }
}

async function fetchListings (fetchImpl) {
  const res = await fetchImpl(LISTINGS_CSV_URL)
  const csvText = await res.text()
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true })
  const all = parsed.data.map((row, i) => normalizeRow(row, i)).filter(Boolean)
  const open = all.filter(l => !l.archived)
  const closed = all.filter(l => l.archived).map(toMinimal)
  return { open, closed }
}

module.exports = { fetchListings, normalizeRow, LISTINGS_CSV_URL }
