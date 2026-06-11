import { useEffect, useMemo, useRef, useState } from 'react'
import { geoEqualEarth, geoPath } from 'd3-geo'
import { open } from 'shapefile'
import { allCountries, findCountryStats, flagFromCode, skillNames } from '../utils/countries'

const COLOR_A = '#ff496c'
const COLOR_B = '#7c8cff'
const SPIN_DURATION = 4800
const MAP_WIDTH = 420
const MAP_HEIGHT = 205
const COUNTRIES_SHP_PATH = '/data/110m_cultural/ne_110m_admin_0_countries.shp'
const COUNTRIES_DBF_PATH = '/data/110m_cultural/ne_110m_admin_0_countries.dbf'
const CATEGORY_WEIGHTS = [34, 25, 18, 12, 7, 4]
const WHEEL_COLORS = ['#ff3d71', '#00d4ff', '#ffcc00', '#8b5cf6', '#00e676', '#ff6d00', '#ec4899', '#22d3ee', '#a3e635', '#f43f5e', '#6366f1', '#facc15']

const categories = {
  speed: [['Snail', 10, 25], ['Slow', 26, 40], ['Average', 41, 60], ['Fast', 61, 80], ['Ultra', 81, 95], ['Supersonic', 96, 100]],
  strength: [['Weak', 10, 25], ['Light', 26, 40], ['Balanced', 41, 60], ['Strong', 61, 80], ['Heavyweight', 81, 95], ['Titan', 96, 100]],
  intelligence: [['Confused', 10, 25], ['Basic', 26, 40], ['Clever', 41, 60], ['Smart', 61, 80], ['Genius', 81, 95], ['Mastermind', 96, 100]],
  defense: [['Paper Shield', 10, 25], ['Fragile', 26, 40], ['Guarded', 41, 60], ['Fortified', 61, 80], ['Iron Wall', 81, 95], ['Untouchable', 96, 100]],
  population: [['Tiny Squad', 10, 25], ['Small Team', 26, 40], ['Medium Army', 41, 60], ['Large Army', 61, 80], ['Massive Horde', 81, 95], ['Endless Swarm', 96, 100]],
  technology: [['Stone Age', 10, 25], ['Basic Tools', 26, 40], ['Modern', 41, 60], ['Advanced', 61, 80], ['Futuristic', 81, 95], ['Alien Tech', 96, 100]],
  luck: [['Cursed', 10, 25], ['Unlucky', 26, 40], ['Normal Luck', 41, 60], ['Lucky', 61, 80], ['Blessed', 81, 95], ['Plot Armor', 96, 100]],
  dotSize: [['Tiny Dots', 10, 25], ['Small Dots', 26, 40], ['Normal Dots', 41, 60], ['Big Dots', 61, 80], ['Giant Dots', 81, 95], ['Kaiju Dots', 96, 100]],
}

const statLabel = (key) => key === 'dotSize' ? 'Dot Size' : `${key[0].toUpperCase()}${key.slice(1)}`
const statKey = (side, skill) => `${side}-${skill}`
const randomItem = (items) => items[Math.floor(Math.random() * items.length)]
const randomInteger = (min, max) => Math.floor(min + Math.random() * (max - min + 1))
const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const shuffled = (items) => [...items].sort(() => Math.random() - 0.5)
const countryOptions = (blockedName) => shuffled(allCountries.filter((country) => country.name !== blockedName))
const sideColor = (side) => side === 'A' ? COLOR_A : COLOR_B

function statOptions(skill) {
  return categories[skill].map(([label, min, max], index) => ({ label, min, max, weight: CATEGORY_WEIGHTS[index] }))
}

function wheelSegments(options) {
  const total = options.reduce((sum, option) => sum + (option.weight ?? 1), 0)
  let angle = 0
  return options.map((option) => {
    const size = ((option.weight ?? 1) / total) * 360
    const segment = { option, start: angle, end: angle + size, center: angle + size / 2 }
    angle += size
    return segment
  })
}

function weightedIndex(options) {
  let roll = Math.random() * options.reduce((sum, option) => sum + (option.weight ?? 1), 0)
  for (let index = 0; index < options.length; index += 1) {
    roll -= options[index].weight ?? 1
    if (roll <= 0) return index
  }
  return options.length - 1
}

function makeWheelBackground(segments) {
  const stops = []
  segments.forEach(({ start, end }, index) => {
    const color = WHEEL_COLORS[index % WHEEL_COLORS.length]
    stops.push(`${color} ${start}deg ${Math.max(start, end - 0.22)}deg`)
    stops.push(`#080b17 ${Math.max(start, end - 0.22)}deg ${end}deg`)
  })
  return `conic-gradient(from 0deg, ${stops.join(', ')})`
}

function getMapCountryName(feature) {
  const properties = feature.properties ?? {}
  const rawName = properties.NAME || properties.ADMIN || properties.name || properties.NAME_EN
  return typeof rawName === 'string' ? rawName.replace(/\0/g, '').trim() : ''
}

function MiniSpinMap({ activeCountry, onMapLoaded, side, spinning }) {
  const [features, setFeatures] = useState([])
  const projection = useMemo(() => geoEqualEarth().fitSize([MAP_WIDTH, MAP_HEIGHT], { type: 'Sphere' }), [])
  const path = useMemo(() => geoPath(projection), [projection])

  useEffect(() => {
    let cancelled = false
    async function loadMap() {
      const source = await open(COUNTRIES_SHP_PATH, COUNTRIES_DBF_PATH)
      const loaded = []
      while (true) {
        const result = await source.read()
        if (result.done) break
        const generated = findCountryStats(getMapCountryName(result.value))
        if (result.value.geometry && generated) loaded.push({ ...result.value, statsName: generated.name, flag: flagFromCode(result.value.properties?.ISO_A2) })
      }
      if (!cancelled) {
        setFeatures(loaded)
        onMapLoaded(new Set(loaded.map((feature) => feature.statsName)), Object.fromEntries(loaded.map((feature) => [feature.statsName, feature.flag])))
      }
    }
    loadMap().catch(() => {})
    return () => { cancelled = true }
  }, [])

  return (
    <div className="mini-spin-map" style={{ '--side-color': sideColor(side) }}>
      <div className="mini-map-heading"><span>{spinning ? 'Random map scan' : 'Map selection'}</span><strong>{activeCountry ?? 'Waiting for spin'}</strong></div>
      <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}>
        {features.map((feature, index) => <path className={feature.statsName === activeCountry ? 'mini-map-country active' : 'mini-map-country'} d={path(feature) ?? ''} key={`${feature.statsName}-${index}`} />)}
      </svg>
    </div>
  )
}

function Wheel({ step, state, spinning, reveal, onSpin }) {
  const segments = wheelSegments(state.options)
  const isCountry = step.type === 'country'
  const labelInterval = Math.ceil(state.options.length / 18)
  return (
    <div className="wheel-unit" style={{ '--side-color': sideColor(step.side) }}>
      <div className="wheel-wrap">
        <div className="wheel-pointer" />
        <div className="spin-wheel" style={{ background: makeWheelBackground(segments), transform: `rotate(${state.rotation}deg)`, transitionDuration: spinning ? `${SPIN_DURATION}ms` : '0ms' }}>
          {state.options.map((option, index) => {
            const label = option.name ?? option.label
            const show = !isCountry || index % labelInterval === 0
            return <span className={isCountry ? 'wheel-option country-option' : 'wheel-option'} key={label} title={label} style={{ transform: `rotate(${segments[index].center}deg) translateY(${isCountry ? '-156px' : '-132px'}) rotate(90deg)`, visibility: show ? 'visible' : 'hidden' }}>{label}</span>
          })}
        </div>
        <button
          className="wheel-center"
          type="button"
          onClick={onSpin}
          disabled={spinning || !onSpin}
          aria-label={spinning ? 'Wheel is spinning' : `Spin ${step.label}`}
        >
          <span>Country {step.side === 'A' ? '1' : '2'}</span>
          <strong>{state.label}</strong>
          {isCountry && <small>{state.options.length} countries</small>}
        </button>
        {reveal && <div className="spin-reveal-card" style={{ '--reveal-color': sideColor(step.side) }}><span className="reveal-kicker">{reveal.title}</span><div className={reveal.flag ? 'reveal-icon flag' : 'reveal-icon'}>{reveal.flag ?? '★'}</div><strong>{reveal.primary}</strong><small>{reveal.secondary}</small><span className="reveal-next">Click next spin to continue</span></div>}
      </div>
    </div>
  )
}

export default function SpinWheelMode({ onStartBattle }) {
  const [wheelMode, setWheelMode] = useState('one')
  const [selectedStats, setSelectedStats] = useState(skillNames)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [results, setResults] = useState({})
  const [spinning, setSpinning] = useState(false)
  const [mappedCountries, setMappedCountries] = useState(new Set())
  const [countryFlags, setCountryFlags] = useState({})
  const [wheelState, setWheelState] = useState({ A: { options: countryOptions(), rotation: 0, label: 'Spin to begin', map: null }, B: { options: countryOptions(), rotation: 0, label: 'Spin to begin', map: null } })
  const [reveals, setReveals] = useState({})
  const [revealedGroup, setRevealedGroup] = useState(null)
  const timer = useRef(null)
  const mapTimer = useRef(null)

  const groups = useMemo(() => {
    const countries = [{ type: 'country', key: 'countryA', side: 'A', label: 'Country 1' }, { type: 'country', key: 'countryB', side: 'B', label: 'Country 2' }]
    const stats = selectedStats.flatMap((skill) => ['A', 'B'].map((side) => ({ type: 'stat', key: statKey(side, skill), side, skill, label: statLabel(skill) })))
    if (wheelMode === 'one') return [...countries, ...stats].map((step) => [step])
    return [[...countries], ...selectedStats.map((skill) => stats.filter((step) => step.skill === skill))]
  }, [wheelMode, selectedStats])

  const currentGroupIndex = groups.findIndex((group) => group.some((step) => !results[step.key]))
  const complete = currentGroupIndex === -1
  const currentGroup = complete ? [] : groups[currentGroupIndex]
  const hasReveals = Object.keys(reveals).length > 0
  const displayGroup = hasReveals && revealedGroup ? revealedGroup : currentGroup

  useEffect(() => () => { clearTimeout(timer.current); clearInterval(mapTimer.current) }, [])
  useEffect(() => {
    if (spinning || complete || hasReveals) return
    setWheelState((current) => {
      const next = { ...current }
      currentGroup.forEach((step) => {
        next[step.side] = { ...next[step.side], options: step.type === 'country' ? countryOptions(results.countryA?.name) : statOptions(step.skill), label: 'Spin to choose', map: null }
      })
      return next
    })
  }, [currentGroupIndex, wheelMode, selectedStats.join(','), hasReveals])

  function spinCurrent() {
    if (spinning || complete || hasReveals) return
    const selections = {}
    const nextStates = {}
    let selectedCountryA = results.countryA?.name
    currentGroup.forEach((step) => {
      const options = step.type === 'country' ? countryOptions(step.side === 'B' ? selectedCountryA : results.countryA?.name) : statOptions(step.skill)
      const index = weightedIndex(options)
      const selected = options[index]
      if (step.key === 'countryA') selectedCountryA = selected.name
      const segments = wheelSegments(options)
      const oldRotation = wheelState[step.side].rotation
      const normalized = ((oldRotation % 360) + 360) % 360
      const correction = (360 - segments[index].center - normalized + 360) % 360
      selections[step.key] = { step, selected }
      nextStates[step.side] = { options, rotation: oldRotation + 360 * 5 + correction, label: 'Spinning...', map: null }
    })
    setReveals({})
    setRevealedGroup(null)
    setSpinning(true)
    setWheelState((current) => ({ ...current, ...nextStates }))

    const mapOptions = currentGroup.filter((step) => step.type === 'country').map((step) => ({ side: step.side, options: nextStates[step.side].options.filter((country) => mappedCountries.has(country.name)) }))
    clearInterval(mapTimer.current)
    mapTimer.current = setInterval(() => setWheelState((current) => {
      const next = { ...current }
      mapOptions.forEach(({ side, options }) => { if (options.length) next[side] = { ...next[side], map: randomItem(options).name } })
      return next
    }), 115)

    timer.current = setTimeout(() => {
      clearInterval(mapTimer.current)
      const additions = {}
      const revealAdditions = {}
      const settledStates = {}
      Object.values(selections).forEach(({ step, selected }) => {
        const result = step.type === 'country' ? selected : { category: selected.label, value: randomInteger(selected.min, selected.max) }
        additions[step.key] = result
        settledStates[step.side] = { ...nextStates[step.side], label: step.type === 'country' ? selected.name : `${selected.label} (${result.value})`, map: step.type === 'country' ? selected.name : null }
        revealAdditions[step.side] = { title: step.type === 'country' ? `Country ${step.side === 'A' ? '1' : '2'} selected` : step.label, primary: step.type === 'country' ? selected.name : selected.label, secondary: step.type === 'country' ? selected.region : `Value: ${result.value}`, flag: step.type === 'country' ? countryFlags[selected.name] ?? '🌍' : null }
      })
      setResults((current) => ({ ...current, ...additions }))
      setWheelState((current) => ({ ...current, ...settledStates }))
      setReveals(revealAdditions)
      setRevealedGroup(currentGroup)
      setSpinning(false)
    }, SPIN_DURATION)
  }

  function goToNextSpin() {
    setReveals({})
    setRevealedGroup(null)
  }

  function toggleStat(skill) {
    if (selectedStats.includes(skill) && selectedStats.length === 1) return
    setResults((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.endsWith(`-${skill}`))))
    setSelectedStats((current) => current.includes(skill) ? current.filter((item) => item !== skill) : skillNames.filter((item) => [...current, skill].includes(item)))
  }

  function startSpinBattle() {
    setReveals({})
    setRevealedGroup(null)
    const makeConfig = (country, side) => {
      const generated = findCountryStats(country.name)
      return { countryId: `spin-${slugify(country.name)}-${side}`, name: country.name, region: country.region, flag: countryFlags[country.name] ?? '🌍', color: sideColor(side), previewStats: selectedStats, skills: Object.fromEntries(skillNames.map((skill) => [skill, results[statKey(side, skill)]?.value ?? generated[skill]])) }
    }
    onStartBattle(makeConfig(results.countryA, 'A'), makeConfig(results.countryB, 'B'))
  }

  function resetSpins() {
    clearTimeout(timer.current); clearInterval(mapTimer.current)
    setResults({}); setReveals({}); setRevealedGroup(null); setSpinning(false)
    setWheelState({ A: { options: countryOptions(), rotation: 0, label: 'Spin to begin', map: null }, B: { options: countryOptions(), rotation: 0, label: 'Spin to begin', map: null } })
  }

  return (
    <section className="spin-mode">
      <div className="spin-heading">
        <div><span className="eyebrow">Spin Wheel Mode</span><h2>{complete ? 'The matchup is ready!' : `Step ${currentGroupIndex + 1} of ${groups.length}: ${currentGroup.map((step) => step.label).join(' + ')}`}</h2><p>Use one wheel for suspense or two wheels to roll both countries at the same time.</p></div>
        <button className="secondary-button" onClick={resetSpins}>Reset Spins</button>
      </div>
      <div className="spin-options-bar">
        <div className="wheel-mode-toggle"><button className={wheelMode === 'one' ? 'active' : ''} onClick={() => setWheelMode('one')} disabled={spinning}>One Wheel</button><button className={wheelMode === 'two' ? 'active' : ''} onClick={() => setWheelMode('two')} disabled={spinning}>Two Wheels</button></div>
        <button className="secondary-button compact" onClick={() => setAdvancedOpen((open) => !open)}>Advanced Options</button>
      </div>
      {advancedOpen && <div className="advanced-options"><strong>Stats to spin</strong><div>{skillNames.map((skill) => <label key={skill}><input type="checkbox" checked={selectedStats.includes(skill)} onChange={() => toggleStat(skill)} /><span>{statLabel(skill)}</span></label>)}</div><small>Unselected stats use each country's generated real-world value.</small></div>}
      <div className="spin-side-key"><span className="side-a">Country 1: {results.countryA?.name ?? 'Not selected'}</span><span className="side-b">Country 2: {results.countryB?.name ?? 'Not selected'}</span></div>
      <div className="spin-layout">
        <div className={wheelMode === 'two' ? 'wheel-stage dual' : 'wheel-stage'}>
          <div className="active-wheels">{displayGroup.map((step) => <div className="active-wheel-column" key={step.key}><Wheel step={step} state={wheelState[step.side]} spinning={spinning} reveal={reveals[step.side]} onSpin={!hasReveals && !complete ? spinCurrent : null} />{step.type === 'country' && <MiniSpinMap activeCountry={wheelState[step.side].map} side={step.side} spinning={spinning} onMapLoaded={(mapped, flags) => { setMappedCountries(mapped); setCountryFlags(flags) }} />}</div>)}</div>
          {hasReveals && !complete ? (
            <button className="primary-button spin-button next-spin-button" onClick={goToNextSpin}>Next Spin</button>
          ) : !complete ? (
            <button className="primary-button spin-button" onClick={spinCurrent} disabled={spinning}>{spinning ? 'Spinning...' : wheelMode === 'two' ? 'Spin Both Wheels' : `Spin ${currentGroup[0].label}`}</button>
          ) : (
            <button className="primary-button spin-button" onClick={startSpinBattle}>Start Spin Battle</button>
          )}
        </div>
        <div className="spin-results"><span className="eyebrow">Selected Results</span><div className="spin-country-results">{['A', 'B'].map((side) => <div className={`spin-country-column side-${side.toLowerCase()}`} key={side}><h3>Country {side === 'A' ? '1' : '2'}: {results[`country${side}`]?.name ?? 'Waiting...'}</h3>{skillNames.map((skill) => { const result = results[statKey(side, skill)]; const enabled = selectedStats.includes(skill); return <div className={`${result ? 'spin-result-row complete' : 'spin-result-row'}${enabled ? '' : ' disabled'}`} key={skill}><span>{statLabel(skill)}</span><strong>{enabled ? result ? `${result.category} (${result.value})` : 'Waiting...' : 'Real-world default'}</strong></div> })}</div>)}</div></div>
      </div>
    </section>
  )
}
