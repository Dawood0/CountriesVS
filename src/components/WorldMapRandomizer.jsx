import { useCallback, useEffect, useMemo, useState } from 'react'
import { geoEqualEarth, geoPath } from 'd3-geo'
import { open } from 'shapefile'
import { findCountryStats, flagFromCode, skillNames } from '../utils/countries'

const WIDTH = 960
const HEIGHT = 470
const COLOR_A = '#ff496c'
const COLOR_B = '#7c8cff'

// Change these paths when replacing the bundled Natural Earth shapefile with a GeoJSON export.
const COUNTRIES_SHP_PATH = '/data/110m_cultural/ne_110m_admin_0_countries.shp'
const COUNTRIES_DBF_PATH = '/data/110m_cultural/ne_110m_admin_0_countries.dbf'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

function getCountryName(feature) {
  const properties = feature.properties ?? {}
  const rawName = properties.NAME || properties.ADMIN || properties.name || properties.NAME_EN
  return typeof rawName === 'string' ? rawName.replace(/\0/g, '').trim() || 'Unknown Country' : 'Unknown Country'
}

function makeWorldCountry(feature, side, index) {
  const name = getCountryName(feature)
  const generated = findCountryStats(name)

  return {
    countryId: `world-${slugify(name) || 'unknown'}-${index}`,
    name: generated.name,
    flag: flagFromCode(feature.properties?.ISO_A2),
    color: side === 'A' ? COLOR_A : COLOR_B,
    region: generated.region,
    skills: Object.fromEntries(skillNames.map((skill) => [skill, generated[skill]])),
  }
}

export default function WorldMapRandomizer({ onCountriesLocked, onStartBattle }) {
  const [features, setFeatures] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState('idle')
  const [candidateIndex, setCandidateIndex] = useState(null)
  const [lockedA, setLockedA] = useState(null)
  const [lockedB, setLockedB] = useState(null)

  const projection = useMemo(() => geoEqualEarth().fitSize([WIDTH, HEIGHT], { type: 'Sphere' }), [])
  const path = useMemo(() => geoPath(projection), [projection])

  useEffect(() => {
    let cancelled = false

    async function loadCountries() {
      try {
        const source = await open(COUNTRIES_SHP_PATH, COUNTRIES_DBF_PATH)
        const loaded = []
        while (true) {
          const result = await source.read()
          if (result.done) break
          loaded.push(result.value)
        }
        if (!cancelled) setFeatures(loaded.filter((feature) => feature.geometry && findCountryStats(getCountryName(feature))))
      } catch (loadError) {
        if (!cancelled) setError(`Could not load world map: ${loadError.message}`)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadCountries()
    return () => { cancelled = true }
  }, [])

  const scanForCountry = useCallback(async (side, blockedIndex) => {
    const startedAt = performance.now()
    const duration = 2200 + Math.random() * 700
    let finalIndex = null

    while (performance.now() - startedAt < duration) {
      let nextIndex = Math.floor(Math.random() * features.length)
      if (features.length > 1) {
        while (nextIndex === blockedIndex) nextIndex = Math.floor(Math.random() * features.length)
      }
      finalIndex = nextIndex
      setCandidateIndex(nextIndex)
      await sleep(Math.max(55, 150 - (performance.now() - startedAt) / 26))
    }

    const selected = makeWorldCountry(features[finalIndex], side, finalIndex)
    if (side === 'A') setLockedA({ index: finalIndex, country: selected })
    else setLockedB({ index: finalIndex, country: selected })
    setCandidateIndex(null)
    return { index: finalIndex, country: selected }
  }, [features])

  async function startRandomWorldBattle() {
    if (!features.length || phase === 'scanningA' || phase === 'scanningB') return
    setLockedA(null)
    setLockedB(null)

    setPhase('scanningA')
    const countryA = await scanForCountry('A')
    setPhase('lockedA')
    await sleep(650)

    setPhase('scanningB')
    const countryB = await scanForCountry('B', countryA.index)
    setPhase('lockedB')
    onCountriesLocked(countryA.country, countryB.country)
  }

  const statusText = {
    idle: 'Ready to scan the world.',
    scanningA: 'Scanning the world...',
    lockedA: 'Country A locked!',
    scanningB: 'Scanning the world...',
    lockedB: 'Country B locked!',
  }[phase]

  return (
    <section className="world-randomizer">
      <div className="world-randomizer-header">
        <div>
          <span className="eyebrow">Random World Battle</span>
          <h2>{statusText}</h2>
          <p>Battle stats are generated from the bundled real-world country dataset.</p>
        </div>
        <div className="world-actions">
          <button className="secondary-button" onClick={startRandomWorldBattle} disabled={loading || Boolean(error)}>
            Random World Battle
          </button>
          <button className="primary-button compact" onClick={onStartBattle} disabled={!lockedA || !lockedB}>
            Start Battle With These Countries
          </button>
        </div>
      </div>

      {error && <p className="map-message error">{error}</p>}
      {loading && <p className="map-message">Loading world map...</p>}

      <div className="map-wrap">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="World map random country selector">
          <defs>
            <filter id="mapGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect width={WIDTH} height={HEIGHT} rx="22" />
          {features.map((feature, index) => {
            const isCandidate = index === candidateIndex
            const isA = index === lockedA?.index
            const isB = index === lockedB?.index
            const className = [
              'map-country',
              isCandidate ? 'candidate' : '',
              isA ? 'locked-a' : '',
              isB ? 'locked-b' : '',
            ].filter(Boolean).join(' ')

            return (
              <path
                key={`${getCountryName(feature)}-${index}`}
                className={className}
                d={path(feature) ?? ''}
              />
            )
          })}
        </svg>
      </div>

      <div className="locked-countries">
        <div className={lockedA ? 'locked-card active a' : 'locked-card'}>
          <span>Country A</span>
          <strong>{lockedA?.country.name ?? 'Waiting...'}</strong>
          {lockedA && <small>{lockedA.country.region}</small>}
        </div>
        <div className={lockedB ? 'locked-card active b' : 'locked-card'}>
          <span>Country B</span>
          <strong>{lockedB?.country.name ?? 'Waiting...'}</strong>
          {lockedB && <small>{lockedB.country.region}</small>}
        </div>
      </div>
    </section>
  )
}
