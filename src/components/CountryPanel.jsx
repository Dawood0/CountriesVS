import { useEffect, useMemo, useState } from 'react'
import { geoEqualEarth, geoPath } from 'd3-geo'
import { open } from 'shapefile'
import { allCountries, countries, findCountryStats, flagFromCode, makeCountryConfig, skillNames } from '../utils/countries'

const MAP_WIDTH = 460
const MAP_HEIGHT = 225
const COUNTRIES_SHP_PATH = '/data/110m_cultural/ne_110m_admin_0_countries.shp'
const COUNTRIES_DBF_PATH = '/data/110m_cultural/ne_110m_admin_0_countries.dbf'

let mapFeaturesPromise

const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

function getMapCountryName(feature) {
  const properties = feature.properties ?? {}
  const rawName = properties.NAME || properties.ADMIN || properties.name || properties.NAME_EN
  return typeof rawName === 'string' ? rawName.replace(/\0/g, '').trim() : ''
}

function loadMapFeatures() {
  if (!mapFeaturesPromise) {
    mapFeaturesPromise = (async () => {
      const source = await open(COUNTRIES_SHP_PATH, COUNTRIES_DBF_PATH)
      const loaded = []
      while (true) {
        const result = await source.read()
        if (result.done) break
        const generated = findCountryStats(getMapCountryName(result.value))
        if (result.value.geometry && generated) {
          loaded.push({
            ...result.value,
            statsName: generated.name,
            flag: flagFromCode(result.value.properties?.ISO_A2),
          })
        }
      }
      return loaded
    })()
  }
  return mapFeaturesPromise
}

function CountryPickerMap({ features, hoveredCountry, selectedCountry }) {
  const projection = useMemo(() => geoEqualEarth().fitSize([MAP_WIDTH, MAP_HEIGHT], { type: 'Sphere' }), [])
  const path = useMemo(() => geoPath(projection), [projection])

  return (
    <div className="classic-picker-map">
      <div className="classic-map-heading">
        <span>Country preview</span>
        <strong>{hoveredCountry ?? selectedCountry}</strong>
      </div>
      <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="img" aria-label={`World map highlighting ${hoveredCountry ?? selectedCountry}`}>
        {features.map((feature, index) => {
          const active = feature.statsName === hoveredCountry
          const selected = !hoveredCountry && feature.statsName === selectedCountry
          return (
            <path
              className={`classic-map-country${active ? ' active' : ''}${selected ? ' selected' : ''}`}
              d={path(feature) ?? ''}
              key={`${feature.statsName}-${index}`}
            />
          )
        })}
      </svg>
    </div>
  )
}

export default function CountryPanel({ label, config, onChange, accent }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [hoveredCountry, setHoveredCountry] = useState(null)
  const [mapFeatures, setMapFeatures] = useState([])
  const country = countries.find((item) => item.id === config.countryId) ?? config
  const panelAccent = accent ?? '#7c8cff'

  useEffect(() => {
    let cancelled = false
    loadMapFeatures()
      .then((features) => {
        if (!cancelled) setMapFeatures(features)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const flagsByName = useMemo(
    () => Object.fromEntries(mapFeatures.map((feature) => [feature.statsName, feature.flag])),
    [mapFeatures],
  )

  function updateSkill(skill, value) {
    onChange({
      ...config,
      skills: { ...config.skills, [skill]: Number(value) },
    })
  }

  function selectCountry(selected) {
    const countryId = `classic-${slugify(selected.name)}`
    onChange(makeCountryConfig(countryId, undefined, {
      name: selected.name,
      flag: flagsByName[selected.name] ?? '🌍',
      color: panelAccent,
      region: selected.region,
    }))
    setPickerOpen(false)
    setMapOpen(false)
    setHoveredCountry(null)
  }

  return (
    <section className="country-panel" style={{ '--accent': panelAccent }}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{label}</span>
          <h2>{country.flag} {country.name}</h2>
          {country.region && (
            <p className="country-region">
              {country.region}
              <span className="stats-tooltip" title="Generated from real-world country data." aria-label="Generated from real-world country data.">i</span>
            </p>
          )}
        </div>
        <span className="power-score">
          {Math.round(Object.values(config.skills).reduce((sum, value) => sum + value, 0) / skillNames.length)}
        </span>
      </div>

      <div className="country-select">
        <span>Choose country</span>
        <button
          className="country-picker-trigger"
          type="button"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((open) => !open)}
        >
          <span>{country.flag ?? '🌍'} {country.name}</span>
          <span aria-hidden="true">{pickerOpen ? '▲' : '▼'}</span>
        </button>

        {pickerOpen && (
          <div className="country-picker-popover">
            <div className="country-picker-toolbar">
              <span>{allCountries.length} countries</span>
              <div>
                <button className="show-map-button" type="button" onClick={() => setMapOpen((open) => !open)}>
                  {mapOpen ? 'Hide map' : 'Show map'}
                </button>
                <button className="picker-close-button" type="button" onClick={() => setPickerOpen(false)}>Done</button>
              </div>
            </div>

            {mapOpen && (
              <CountryPickerMap
                features={mapFeatures}
                hoveredCountry={hoveredCountry}
                selectedCountry={country.name}
              />
            )}

            <div className="country-flag-grid" role="listbox" aria-label={`Choose ${label}`}>
              {allCountries.map((item) => (
                <button
                  className={item.name === country.name ? 'country-flag-option selected' : 'country-flag-option'}
                  type="button"
                  role="option"
                  aria-label={item.name}
                  aria-selected={item.name === country.name}
                  data-country-name={item.name}
                  title={item.name}
                  key={item.name}
                  onClick={() => selectCountry(item)}
                  onMouseEnter={() => setHoveredCountry(item.name)}
                  onMouseLeave={() => setHoveredCountry(null)}
                  onFocus={() => setHoveredCountry(item.name)}
                  onBlur={() => setHoveredCountry(null)}
                  onTouchStart={() => setHoveredCountry(item.name)}
                >
                  <span aria-hidden="true">{flagsByName[item.name] ?? '🌍'}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="skills">
        {skillNames.map((skill) => (
          <label className="skill-row" key={skill}>
            <span>{skill === 'dotSize' ? 'Dot Size' : skill}</span>
            <input
              type="range"
              min="1"
              max="100"
              value={config.skills[skill]}
              onChange={(event) => updateSkill(skill, event.target.value)}
            />
            <strong>{config.skills[skill]}</strong>
          </label>
        ))}
      </div>
    </section>
  )
}
