import countryStats from '../data/countryStats.json'

const countryCatalog = [
  { id: 'canada', name: 'Canada', flag: '🇨🇦', color: '#ff496c' },
  { id: 'japan', name: 'Japan', flag: '🇯🇵', color: '#f7f8ff' },
  { id: 'brazil', name: 'Brazil', flag: '🇧🇷', color: '#52e681' },
  { id: 'egypt', name: 'Egypt', flag: '🇪🇬', color: '#ffc857' },
  { id: 'france', name: 'France', flag: '🇫🇷', color: '#6495ff' },
  { id: 'india', name: 'India', flag: '🇮🇳', color: '#ff9f43' },
  { id: 'mexico', name: 'Mexico', flag: '🇲🇽', color: '#36d399' },
  { id: 'south-korea', name: 'South Korea', flag: '🇰🇷', color: '#c084fc' },
  { id: 'usa', name: 'United States', flag: '🇺🇸', color: '#58b7ff' },
  { id: 'germany', name: 'Germany', flag: '🇩🇪', color: '#f4d35e' },
]

const aliases = {
  'bosnia and herz': 'Bosnia & Herzegovina',
  'central african rep': 'Central African Rep.',
  'czechia': 'Czech Republic',
  'dem rep congo': 'Congo, Dem. Rep.',
  'dominican rep': 'Dominican Republic',
  'eq guinea': 'Equatorial Guinea',
  'eswatini': 'Swaziland',
  'ivory coast': "Cote d'Ivoire",
  'macedonia': 'Macedonia',
  'myanmar': 'Burma',
  'north korea': 'Korea, North',
  'north macedonia': 'Macedonia',
  'republic of the congo': 'Congo, Repub. of the',
  'solomon is': 'Solomon Islands',
  'south korea': 'Korea, South',
  'the bahamas': 'Bahamas, The',
  'the gambia': 'Gambia, The',
  'timor leste': 'East Timor',
  'united republic of tanzania': 'Tanzania',
  'united states of america': 'United States',
  'w sahara': 'Western Sahara',
}

const normalizeName = (value) => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

export function flagFromCode(code) {
  const cleanCode = String(code ?? '').replace(/\0/g, '').trim()
  if (!/^[A-Z]{2}$/.test(cleanCode)) return '🌍'
  return String.fromCodePoint(...[...cleanCode].map((letter) => 127397 + letter.charCodeAt()))
}

const statsByNormalizedName = Object.fromEntries(
  Object.entries(countryStats).map(([name, stats]) => [normalizeName(name), { name, ...stats }]),
)

export function findCountryStats(name) {
  const normalized = normalizeName(name)
  const aliasedName = aliases[normalized]
  return statsByNormalizedName[normalizeName(aliasedName ?? name)] ?? null
}

export const countries = countryCatalog.map((country) => ({
  ...country,
  region: findCountryStats(country.name)?.region,
}))

export const allCountries = Object.values(statsByNormalizedName)
  .map(({ name, region }) => ({ name, region }))
  .sort((a, b) => a.name.localeCompare(b.name))

export const skillNames = [
  'speed',
  'strength',
  'intelligence',
  'defense',
  'population',
  'technology',
  'luck',
  'dotSize',
]

export const defaultSkills = {
  speed: 55,
  strength: 55,
  intelligence: 55,
  defense: 55,
  population: 55,
  technology: 55,
  luck: 55,
  dotSize: 55,
}

export function makeCountryConfig(countryId, skills, countryOverrides = {}) {
  const country = countries.find((item) => item.id === countryId) ?? countryOverrides
  const generated = findCountryStats(country.name)
  const generatedSkills = generated
    ? Object.fromEntries(skillNames.map((skill) => [skill, generated[skill]]))
    : defaultSkills
  return {
    countryId,
    skills: { ...(skills ?? generatedSkills) },
    region: generated?.region ?? country.region,
    ...countryOverrides,
  }
}
