import CountryPanel from './CountryPanel'
import { commanderPowerUps, commanderTapModes } from '../utils/battleLogic'

const powerUps = [
  { id: 'reinforcements', icon: '+', name: 'Reinforcements', description: 'Deploy 5-15 new fighters.' },
  { id: 'speed', icon: '»', name: 'Speed Boost', description: 'Move faster for 5 seconds.' },
  { id: 'shield', icon: '◇', name: 'Shield Wall', description: 'Reduce damage for 5 seconds.' },
  { id: 'heal', icon: '♥', name: 'Heal Swarm', description: 'Restore surviving fighters.' },
  { id: 'tech', icon: '✦', name: 'Tech Blast', description: 'Strike an enemy cluster.' },
  { id: 'chaos', icon: '?', name: 'Chaos Meme Event', description: 'Trigger a random disaster.' },
]

const tapModes = [
  { id: 'deploy', icon: '+', name: 'Deploy Troops' },
  { id: 'rally', icon: '◎', name: 'Rally Point' },
  { id: 'healZone', icon: '♥', name: 'Heal Zone' },
  { id: 'airStrike', icon: '⌖', name: 'Air Strike' },
  { id: 'trap', icon: '◇', name: 'Trap Zone' },
  { id: 'chaosTap', icon: '?', name: 'Chaos Tap' },
]

const emptyStatus = {
  energy: { A: 0, B: 0 },
  active: { A: { speed: 0, shield: 0 }, B: { speed: 0, shield: 0 } },
}

function CommanderSide({ side, country, status, canCommand, onPowerUp }) {
  const energy = status.energy[side] ?? 0
  const active = status.active[side]

  return (
    <section className={`commander-side side-${side.toLowerCase()}`} style={{ '--side-color': country.color }}>
      <div className="commander-side-heading">
        <div><span>Command Country {side}</span><strong>{country.flag} {country.name}</strong></div>
        <b>{Math.floor(energy)} EP</b>
      </div>
      <div className="commander-energy-track" aria-label={`${country.name} energy ${Math.floor(energy)} out of 100`}>
        <i style={{ width: `${energy}%` }} />
      </div>
      <div className="commander-active-effects">
        <span className={active.speed > 0 ? 'active' : ''}>Speed {active.speed > 0 ? `${active.speed.toFixed(1)}s` : 'ready'}</span>
        <span className={active.shield > 0 ? 'active' : ''}>Shield {active.shield > 0 ? `${active.shield.toFixed(1)}s` : 'ready'}</span>
      </div>
      <div className="commander-power-grid">
        {powerUps.map((power) => {
          const cost = commanderPowerUps[power.id].cost
          return (
            <button
              className={`commander-power power-${power.id}`}
              type="button"
              disabled={!canCommand || energy < cost}
              key={power.id}
              onClick={() => onPowerUp(side, power.id)}
              title={power.description}
            >
              <span>{power.icon}</span>
              <strong>{power.name}</strong>
              <small>{cost} EP</small>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function CommanderControls({
  countryA,
  countryB,
  onPowerUp,
  status = emptyStatus,
  battleActive,
  lastEvent,
  selectedTapMode,
  onSelectTapMode,
}) {
  const canCommand = battleActive && !status.finished

  return (
    <section className="commander-live-panel commander-live-below">
      <div className="commander-tap-panel">
        <div>
          <span className="eyebrow">Arena Tap Mode</span>
          <strong>Tap the arena to command the battle.</strong>
        </div>
        <div className="commander-tap-modes" role="radiogroup" aria-label="Commander arena tap mode">
          {tapModes.map((mode) => (
            <button
              className={selectedTapMode === mode.id ? 'commander-tap-mode active' : 'commander-tap-mode'}
              type="button"
              role="radio"
              aria-checked={selectedTapMode === mode.id}
              key={mode.id}
              onClick={() => onSelectTapMode(mode.id)}
            >
              <span>{mode.icon}</span>
              <strong>{mode.name}</strong>
              <small>{commanderTapModes[mode.id].cost} EP</small>
            </button>
          ))}
        </div>
      </div>
      <div className="commander-live-heading">
        <div><span className="eyebrow">Live Command Deck</span><h3>{canCommand ? 'Spend energy now' : 'Start the battle to unlock power-ups'}</h3></div>
        <strong>{lastEvent?.detail ?? status.lastPowerUp?.detail ?? 'Energy charges automatically during battle.'}</strong>
      </div>
      <div className="commander-sides">
        <CommanderSide side="A" country={countryA} status={status} canCommand={canCommand} onPowerUp={onPowerUp} />
        <CommanderSide side="B" country={countryB} status={status} canCommand={canCommand} onPowerUp={onPowerUp} />
      </div>
    </section>
  )
}

export default function CommanderMode({ configA, configB, countryA, countryB, onChangeA, onChangeB, onStart, battleActive, countdown }) {
  return (
    <section className="commander-mode">
      <div className="commander-heading">
        <div>
          <span className="eyebrow">Interactive Battle</span>
          <h2>Commander Mode</h2>
          <p>Build energy during the fight, then spend it to change the battle live.</p>
        </div>
        <button className="primary-button commander-start" onClick={onStart} disabled={Boolean(countdown)}>
          {countdown ? `Deploying in ${countdown}` : battleActive ? 'Restart Commander Battle' : 'Start Commander Battle'}
        </button>
      </div>

      <section className="setup-grid commander-setup">
        <CountryPanel label="Country A" config={configA} onChange={onChangeA} accent={countryA.color} />
        <div className="versus-mark">VS</div>
        <CountryPanel label="Country B" config={configB} onChange={onChangeB} accent={countryB.color} />
      </section>
    </section>
  )
}
