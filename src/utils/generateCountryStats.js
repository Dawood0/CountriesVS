import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const CSV_PATH = fileURLToPath(new URL('../data/countries of the world.csv', import.meta.url))
const OUTPUT_PATH = fileURLToPath(new URL('../data/countryStats.json', import.meta.url))
const EXPLANATION_PATH = fileURLToPath(new URL('../data/stat_explanation.md', import.meta.url))

const numericColumns = [
  'Population',
  'Area (sq. mi.)',
  'Pop. Density (per sq. mi.)',
  'Net migration',
  'GDP ($ per capita)',
  'Literacy (%)',
  'Phones (per 1000)',
  'Industry',
  'Service',
]

const statInputs = {
  speed: [
    ['Phones (per 1000)', 0.45],
    ['Net migration', 0.2],
    ['Pop. Density (per sq. mi.)', 0.35],
  ],
  strength: [
    ['Population', 0.4],
    ['GDP ($ per capita)', 0.35],
    ['Industry', 0.25],
  ],
  intelligence: [
    ['Literacy (%)', 0.4],
    ['GDP ($ per capita)', 0.3],
    ['Service', 0.3],
  ],
  defense: [
    ['Population', 0.35],
    ['Industry', 0.25],
    ['Area (sq. mi.)', 0.4],
  ],
  population: [['Population', 1]],
  technology: [
    ['Phones (per 1000)', 0.4],
    ['GDP ($ per capita)', 0.35],
    ['Service', 0.25],
  ],
  dotSize: [
    ['Area (sq. mi.)', 0.4],
    ['Population', 0.35],
    ['Pop. Density (per sq. mi.)', 0.25],
  ],
}

const explanation = `# Country Clash Arena Stat Generation

All source columns are cleaned, missing values use the column median, and final stats are normalized from 1 to 100.

## Speed
Uses:
- Phones per 1000
- Net migration
- Population density

Reason:
Represents mobility, connectivity, and movement.

## Strength
Uses:
- Population
- GDP per capita
- Industry

Reason:
Represents economic and manpower power.

## Intelligence
Uses:
- Literacy
- GDP per capita
- Service sector

Reason:
Represents education and knowledge capacity.

## Defense
Uses:
- Population
- Industry
- Area

Reason:
Represents defensive potential and resilience.

## Population
Uses:
- Population

Reason:
Represents swarm size.

## Technology
Uses:
- Phones per 1000
- GDP per capita
- Service sector

Reason:
Represents technological advancement.

## Luck
Uses:
- Random generated value

Reason:
Adds unpredictability and fun.

## Dot Size
Uses:
- Area
- Population
- Population density

Reason:
Represents the physical size and visual weight of each country’s units.
`

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"' && quoted && text[index + 1] === '"') {
      field += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(field)
      field = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(field)
      if (row.some((value) => value.length)) rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }

  const headers = rows[0]
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), values[index] ?? ''])),
  )
}

function cleanNumber(value) {
  const cleaned = String(value ?? '').trim().replace(/\s/g, '').replace(',', '.')
  if (!cleaned) return null
  const number = Number(cleaned)
  return Number.isFinite(number) ? number : null
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return 0
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function percentile(sortedValues, fraction) {
  const index = (sortedValues.length - 1) * fraction
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (index - lower)
}

function makeNormalizer(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const low = percentile(sorted, 0.05)
  const high = percentile(sorted, 0.95)
  return (value) => {
    if (high === low) return 50
    const clamped = Math.min(high, Math.max(low, value))
    return 1 + ((clamped - low) / (high - low)) * 99
  }
}

function titleCase(value) {
  return value.trim().toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function loadExistingLuck() {
  if (!existsSync(OUTPUT_PATH)) return {}
  try {
    const existing = JSON.parse(readFileSync(OUTPUT_PATH, 'utf8'))
    return Object.fromEntries(Object.entries(existing).map(([country, stats]) => [country, stats.luck]))
  } catch {
    return {}
  }
}

const rows = parseCsv(readFileSync(CSV_PATH, 'utf8')).map((row) => ({
  ...row,
  Country: row.Country.trim(),
  Region: titleCase(row.Region),
  ...Object.fromEntries(numericColumns.map((column) => [column, cleanNumber(row[column])])),
}))

const medians = Object.fromEntries(
  numericColumns.map((column) => [column, median(rows.map((row) => row[column]))]),
)

for (const row of rows) {
  for (const column of numericColumns) {
    if (!Number.isFinite(row[column])) row[column] = medians[column] ?? 0
  }
}

const normalizers = Object.fromEntries(
  numericColumns.map((column) => [column, makeNormalizer(rows.map((row) => row[column]))]),
)
const rawStats = rows.map((row) => ({
  country: row.Country,
  region: row.Region,
  stats: Object.fromEntries(
    Object.entries(statInputs).map(([stat, inputs]) => [
      stat,
      inputs.reduce((sum, [column, weight]) => sum + normalizers[column](row[column]) * weight, 0),
    ]),
  ),
}))
const finalNormalizers = Object.fromEntries(
  Object.keys(statInputs).map((stat) => [stat, makeNormalizer(rawStats.map((row) => row.stats[stat]))]),
)
const existingLuck = loadExistingLuck()

const output = Object.fromEntries(rawStats.map(({ country, region, stats }) => [
  country,
  {
    ...Object.fromEntries(Object.entries(stats).map(([stat, value]) => [stat, Math.round(finalNormalizers[stat](value))])),
    luck: Number.isInteger(existingLuck[country])
      ? existingLuck[country]
      : Math.floor(40 + Math.random() * 61),
    region,
  },
]))

writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`)
writeFileSync(EXPLANATION_PATH, explanation)
console.log(`Generated stats for ${rows.length} countries in ${OUTPUT_PATH}`)
