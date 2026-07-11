const Papa = require('papaparse')

const PROGRAMMES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSztgSncrgS2WaCm8J4SRqL0FU4czD8xzV_yIXa-ldc0uHM9-1RK8sp_rpEXLhjHmaFFI0hFWNngOW6/pub?gid=166247531&single=true&output=csv'

function clean (v) {
  if (v === undefined || v === null) return ''
  return String(v).trim()
}

function isTrue (v) {
  return /^(true|yes|1)$/i.test(clean(v))
}

function parseDate (v) {
  const s = clean(v)
  if (!s) return null

  // ISO format: YYYY-MM-DD (with an optional time component the sheet sometimes includes)
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    const [, y, m, d] = iso
    const date = new Date(Date.UTC(+y, +m - 1, +d))
    if (!isNaN(date.getTime())) return date.toISOString().slice(0, 10)
  }

  // DD.MM.YYYY format (this dataset's usual convention) — must be parsed
  // explicitly, since JS's native Date constructor assumes the American
  // MM.DD.YYYY order and will silently produce the wrong date otherwise
  const eu = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (eu) {
    const [, d, m, y] = eu
    const date = new Date(Date.UTC(+y, +m - 1, +d))
    if (!isNaN(date.getTime())) return date.toISOString().slice(0, 10)
  }

  // last resort: native parsing (handles anything unusual, best-effort)
  const fallback = new Date(s)
  if (!isNaN(fallback.getTime())) return fallback.toISOString().slice(0, 10)
  return null
}

function normalizeRow (row) {
  const id = clean(row.programme_id)
  if (!id) return null

  return {
    id,
    programmeId: id,
    title: clean(row.programme_title) || 'Untitled programme',
    region: clean(row.region) || null,
    country: clean(row.country) || null,
    description: clean(row.description) || null,
    link: clean(row.link) || null,
    dateAdded: parseDate(row.date_added),
    deadline: parseDate(row.deadline),
    types: [...new Set([clean(row.primary_type), ...clean(row.other_types).split(',').map(t => t.trim())].filter(Boolean))],
    primaryType: clean(row.primary_type) || 'Other',
    disciplines: {
      naturalSciences: isTrue(row.discipline_natural_sciences),
      socialSciences: isTrue(row.discipline_social_sciences),
      humanitiesAndTheArts: isTrue(row.discipline_humanities_arts),
      engineeringAndTechnology: isTrue(row.discipline_engineering_technology),
      medicalAndHealthSciences: isTrue(row.discipline_medical_health),
      agriculturalAndVeterinarySciences: isTrue(row.discipline_agricultural_veterinary),
      unspecified: isTrue(row.discipline_unspecified)
    },
    openFor: {
      doctoralStudents: isTrue(row.open_for_doctoral_students),
      researchers: isTrue(row.open_for_researchers),
      students: isTrue(row.open_for_students),
      institutions: isTrue(row.open_for_institutions)
    }
  }
}

async function fetchProgrammes (fetchImpl) {
  const res = await fetchImpl(PROGRAMMES_CSV_URL)
  const csvText = await res.text()
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true })

  // dedupe rows sharing a programmeId (recurring calls of the same programme) —
  // keep the most recent one for the card grid, since we don't have a
  // dedicated detail page for each individual call in Phase 1
  const byId = new Map()
  for (const raw of parsed.data) {
    const row = normalizeRow(raw)
    if (!row) continue
    const existing = byId.get(row.id)
    if (!existing || (row.dateAdded && (!existing.dateAdded || row.dateAdded > existing.dateAdded))) {
      byId.set(row.id, row)
    }
  }
  return [...byId.values()]
}

module.exports = { fetchProgrammes, normalizeRow, PROGRAMMES_CSV_URL }
