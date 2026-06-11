import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import BattleArena from './components/BattleArena'
import CommanderMode, { CommanderControls } from './components/CommanderMode'
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
  const [phoneLayout, setPhoneLayout] = useState(false)
  const [runningMode, setRunningMode] = useState('standard')
  const [commanderStatus, setCommanderStatus] = useState(null)
  const [lastCommanderEvent, setLastCommanderEvent] = useState(null)
  const [selectedTapMode, setSelectedTapMode] = useState('deploy')
  const battleSequence = useRef(0)
  const countdownTimer = useRef(null)
  const arenaRef = useRef(null)
  const commanderAction = useRef(null)

  const countryA = useMemo(
    () => ({ ...(countries.find((country) => country.id === configA.countryId) ?? configA), skills: configA.skills }),
    [configA],
  )
  const countryB = useMemo(
    () => ({ ...(countries.find((country) => country.id === configB.countryId) ?? configB), skills: configB.skills }),
    [configB],
  )

  const beginBattle = useCallback((mode) => {
    clearInterval(countdownTimer.current)
    setWinnerSide(null)
    setRunningMode(mode)
    commanderAction.current = null
    setCommanderStatus(null)
    setLastCommanderEvent(null)
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
  const startBattle = useCallback(() => beginBattle('standard'), [beginBattle])
  const startCommanderBattle = useCallback(() => beginBattle('commander'), [beginBattle])

  useEffect(() => () => clearInterval(countdownTimer.current), [])
  useEffect(() => {
    const query = window.matchMedia('(max-width: 600px), (max-width: 820px) and (pointer: coarse)')
    const updatePhoneLayout = () => setPhoneLayout(query.matches)
    updatePhoneLayout()
    if (query.addEventListener) query.addEventListener('change', updatePhoneLayout)
    else query.addListener(updatePhoneLayout)
    return () => {
      if (query.removeEventListener) query.removeEventListener('change', updatePhoneLayout)
      else query.removeListener(updatePhoneLayout)
    }
  }, [])
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
    setRunningMode('standard')
    setCommanderStatus(null)
    setLastCommanderEvent(null)
  }

  function reset() {
    cancelCountdown()
    setConfigA(initialA())
    setConfigB(initialB())
    setWinnerSide(null)
    setBattleId(0)
    setRunningMode('standard')
    setCommanderStatus(null)
    setLastCommanderEvent(null)
  }

  function lockWorldCountries(worldA, worldB) {
    cancelCountdown()
    setConfigA(worldA)
    setConfigB(worldB)
    setWinnerSide(null)
    setBattleId(0)
    setRunningMode('standard')
    setCommanderStatus(null)
    setLastCommanderEvent(null)
  }

  function startSpinBattle(spinA, spinB) {
    setConfigA(spinA)
    setConfigB(spinB)
    startBattle()
  }

  function useCommanderPowerUp(side, powerUp) {
    const result = commanderAction.current?.(side, powerUp)
    if (result?.ok) setLastCommanderEvent(result)
  }

  const winner = winnerSide === 'A' ? countryA : countryB
  const loser = winnerSide === 'A' ? countryB : countryA

  return (
    <main className={phoneLayout ? 'phone-layout' : ''}>
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
        <button className={activeMode === 'commander' ? 'active' : ''} onClick={() => setActiveMode('commander')}>Commander Mode</button>
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

      {activeMode === 'commander' && (
        <CommanderMode
          configA={configA}
          configB={configB}
          countryA={countryA}
          countryB={countryB}
          onChangeA={setConfigA}
          onChangeB={setConfigB}
          onStart={startCommanderBattle}
          battleActive={runningMode === 'commander' && Boolean(battleId)}
          countdown={runningMode === 'commander' ? countdown : null}
        />
      )}

      <div ref={arenaRef} className="arena-anchor">
        <BattleArena
          battleId={battleId}
          countryA={countryA}
          countryB={countryB}
          onFinish={setWinnerSide}
          countdown={countdown}
          commanderMode={runningMode === 'commander'}
          commanderInteractionEnabled={activeMode === 'commander' && runningMode === 'commander'}
          selectedTapMode={selectedTapMode}
          onCommanderReady={(action) => { commanderAction.current = action }}
          onCommanderStatus={setCommanderStatus}
          onCommanderEvent={setLastCommanderEvent}
        />
      </div>

      {activeMode === 'commander' && (
        <CommanderControls
          countryA={countryA}
          countryB={countryB}
          onPowerUp={useCommanderPowerUp}
          status={commanderStatus ?? undefined}
          battleActive={runningMode === 'commander' && Boolean(battleId)}
          lastEvent={lastCommanderEvent}
          selectedTapMode={selectedTapMode}
          onSelectTapMode={setSelectedTapMode}
        />
      )}

      {winnerSide && (
        <ResultPanel
          winner={winner}
          loser={loser}
          onRematch={runningMode === 'commander' ? startCommanderBattle : startBattle}
          videoIdea={runningMode === 'commander'
            ? lastCommanderEvent?.powerUp === 'reinforcements'
              ? `I saved ${winner.name} with last-second reinforcements!`
              : lastCommanderEvent?.powerUp === 'tech'
                ? `${winner.name} survived because of a Tech Blast!`
                : 'This battle changed after one Chaos Event...'
            : null}
        />
      )}
      <MonetizationPanel />
    </main>
  )
}
