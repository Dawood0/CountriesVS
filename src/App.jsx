import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import BattleArena from './components/BattleArena'
import CountryPanel from './components/CountryPanel'
import MonetizationPanel from './components/MonetizationPanel'
import ResultPanel from './components/ResultPanel'
import SpinWheelMode from './components/SpinWheelMode'
import WorldMapRandomizer from './components/WorldMapRandomizer'
import { countries, makeCountryConfig } from './utils/countries'

const initialA = () => makeCountryConfig('canada')
const initialB = () => makeCountryConfig('japan')

export default function App() {
  const [configA, setConfigA] = useState(initialA)
  const [configB, setConfigB] = useState(initialB)
  const [battleId, setBattleId] = useState(0)
  const [winnerSide, setWinnerSide] = useState(null)
  const [activeMode, setActiveMode] = useState('classic')
  const [countdown, setCountdown] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('country-clash-theme') ?? 'dark')
  const battleSequence = useRef(0)
  const countdownTimer = useRef(null)
  const arenaRef = useRef(null)

  const countryA = useMemo(
    () => ({ ...(countries.find((country) => country.id === configA.countryId) ?? configA), skills: configA.skills }),
    [configA],
  )
  const countryB = useMemo(
    () => ({ ...(countries.find((country) => country.id === configB.countryId) ?? configB), skills: configB.skills }),
    [configB],
  )

  const startBattle = useCallback(() => {
    clearInterval(countdownTimer.current)
    setWinnerSide(null)
    setBattleId(0)
    setCountdown(3)
    requestAnimationFrame(() => arenaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))

    let count = 3
    countdownTimer.current = setInterval(() => {
      count -= 1
      if (count > 0) {
        setCountdown(count)
        return
      }
      clearInterval(countdownTimer.current)
      setCountdown(null)
      battleSequence.current += 1
      setBattleId(battleSequence.current)
    }, 1000)
  }, [])

  useEffect(() => () => clearInterval(countdownTimer.current), [])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('country-clash-theme', theme)
  }, [theme])

  function cancelCountdown() {
    clearInterval(countdownTimer.current)
    setCountdown(null)
  }

  function randomize() {
    cancelCountdown()
    const shuffled = [...countries].sort(() => Math.random() - 0.5)
    setConfigA(makeCountryConfig(shuffled[0].id))
    setConfigB(makeCountryConfig(shuffled[1].id))
    setWinnerSide(null)
    setBattleId(0)
  }

  function reset() {
    cancelCountdown()
    setConfigA(initialA())
    setConfigB(initialB())
    setWinnerSide(null)
    setBattleId(0)
  }

  function lockWorldCountries(worldA, worldB) {
    cancelCountdown()
    setConfigA(worldA)
    setConfigB(worldB)
    setWinnerSide(null)
    setBattleId(0)
  }

  function startSpinBattle(spinA, spinB) {
    setConfigA(spinA)
    setConfigB(spinB)
    startBattle()
  }

  const winner = winnerSide === 'A' ? countryA : countryB
  const loser = winnerSide === 'A' ? countryB : countryA

  return (
    <main>
      <header className="hero">
        <button className="theme-toggle" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
        <span className="hero-kicker">Strategy goes in. Chaos comes out.</span>
        <h1>Country Clash <em>Arena</em></h1>
        <p>Build two nations, tune their strengths, and unleash the swarm.</p>
      </header>

      <nav className="mode-tabs" aria-label="Battle modes">
        <button className={activeMode === 'classic' ? 'active' : ''} onClick={() => setActiveMode('classic')}>Classic Battle</button>
        <button className={activeMode === 'world' ? 'active' : ''} onClick={() => setActiveMode('world')}>Random World Battle</button>
        <button className={activeMode === 'spin' ? 'active' : ''} onClick={() => setActiveMode('spin')}>Spin Wheel Mode</button>
      </nav>

      {activeMode === 'classic' && (
        <>
          <section className="setup-grid">
            <CountryPanel label="Country A" config={configA} onChange={setConfigA} accent={countryA.color} />
            <div className="versus-mark">VS</div>
            <CountryPanel label="Country B" config={configB} onChange={setConfigB} accent={countryB.color} />
          </section>

          <div className="battle-controls">
            <button className="secondary-button" onClick={randomize}>Randomize</button>
            <button className="primary-button" onClick={startBattle}>Start Battle</button>
            <button className="secondary-button" onClick={reset}>Reset</button>
          </div>
        </>
      )}

      {activeMode === 'world' && (
        <WorldMapRandomizer onCountriesLocked={lockWorldCountries} onStartBattle={startBattle} />
      )}

      {activeMode === 'spin' && <SpinWheelMode onStartBattle={startSpinBattle} />}

      <div ref={arenaRef} className="arena-anchor">
        <BattleArena
          battleId={battleId}
          countryA={countryA}
          countryB={countryB}
          onFinish={setWinnerSide}
          countdown={countdown}
        />
      </div>

      {winnerSide && <ResultPanel winner={winner} loser={loser} onRematch={startBattle} />}
      <MonetizationPanel />
    </main>
  )
}
