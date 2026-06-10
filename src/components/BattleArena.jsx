import { useEffect, useRef, useState } from 'react'
import { createBattle, stepBattle } from '../utils/battleLogic'
import { skillNames } from '../utils/countries'

const WIDTH = 900
const HEIGHT = 470
const STAT_COLORS = {
  speed: '#22d3ee',
  strength: '#ff496c',
  intelligence: '#c084fc',
  defense: '#6495ff',
  population: '#52e681',
  technology: '#ffc857',
  luck: '#f472b6',
  dotSize: '#ff9f43',
}

const statLabel = (skill) => skill === 'dotSize' ? 'Dots' : skill.slice(0, 4)
const randomBetween = (min, max) => min + Math.random() * (max - min)
const summarizeHealth = (state) => ({
  A: { current: state.fighters.filter((fighter) => fighter.side === 'A').reduce((sum, fighter) => sum + Math.max(0, fighter.health), 0), max: state.initialHealth.A },
  B: { current: state.fighters.filter((fighter) => fighter.side === 'B').reduce((sum, fighter) => sum + Math.max(0, fighter.health), 0), max: state.initialHealth.B },
})

function StatPreview({ country }) {
  const visibleStats = country.previewStats?.length ? country.previewStats : skillNames
  return (
    <div className="arena-stat-card" style={{ '--country-color': country.color }}>
      <div className="arena-stat-title"><span>{country.flag}</span><strong>{country.name}</strong></div>
      <div className="arena-stat-bars">
        {visibleStats.map((skill) => (
          <div className="arena-stat-row" key={skill} title={`${skill}: ${country.skills[skill]}`}>
            <span>{statLabel(skill)}</span>
            <div><i style={{ width: `${country.skills[skill]}%`, background: STAT_COLORS[skill] }} /></div>
            <strong style={{ color: STAT_COLORS[skill] }}>{country.skills[skill]}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function drawBackground(ctx) {
  ctx.fillStyle = '#080b17'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  ctx.strokeStyle = 'rgba(107, 124, 255, 0.12)'
  ctx.lineWidth = 1
  for (let x = 0; x <= WIDTH; x += 45) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, HEIGHT)
    ctx.stroke()
  }
  for (let y = 0; y <= HEIGHT; y += 45) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(WIDTH, y)
    ctx.stroke()
  }
  ctx.setLineDash([6, 12])
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.beginPath()
  ctx.moveTo(WIDTH / 2, 0)
  ctx.lineTo(WIDTH / 2, HEIGHT)
  ctx.stroke()
  ctx.setLineDash([])
}

function drawFighters(ctx, state, colors) {
  for (const fighter of state.fighters) {
    const color = colors[fighter.side]
    const dotSize = state.configs[fighter.side].skills.dotSize ?? 55
    const radius = 2 + (dotSize / 100) * 6
    ctx.shadowBlur = fighter.glow > 0 ? 24 : 12
    ctx.shadowColor = color
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(fighter.x, fighter.y, fighter.glow > 0 ? radius + 1.6 : radius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.shadowBlur = 0
}

function drawEffects(ctx, effects, colors) {
  ctx.textAlign = 'center'
  ctx.font = '800 15px system-ui'
  for (const effect of effects) {
    const progress = effect.age / effect.duration
    const alpha = Math.max(0, 1 - progress)
    if (effect.type === 'laser') {
      const gradient = ctx.createLinearGradient(effect.x, effect.y, effect.targetX, effect.targetY)
      gradient.addColorStop(0, colors[effect.side])
      gradient.addColorStop(0.55, '#ffffff')
      gradient.addColorStop(1, colors[effect.side])
      ctx.globalAlpha = alpha
      ctx.strokeStyle = gradient
      ctx.shadowBlur = 12
      ctx.shadowColor = colors[effect.side]
      ctx.lineWidth = 1.5 + alpha * 2
      ctx.beginPath()
      ctx.moveTo(effect.x, effect.y)
      ctx.lineTo(effect.targetX, effect.targetY)
      ctx.stroke()
      ctx.shadowBlur = 0
      continue
    }
    if (effect.type === 'tech') {
      ctx.strokeStyle = colors[effect.side]
      ctx.globalAlpha = alpha
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(effect.x, effect.y, 8 + progress * 52, 0, Math.PI * 2)
      ctx.stroke()
    }
    const labels = { critical: 'CRITICAL!', tech: 'TECH BLAST!', luck: 'LUCK BONUS!', luckHit: 'LUCK HIT!' }
    ctx.fillStyle = effect.type === 'luck' || effect.type === 'luckHit' ? '#ffe66d' : '#ffffff'
    ctx.globalAlpha = alpha
    ctx.fillText(labels[effect.type], effect.x, effect.y - 14 - progress * 28)
  }
  ctx.globalAlpha = 1
}

function formationPoint(pattern, index, count) {
  const angle = (index / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2
  if (pattern === 'star') {
    const radius = index % 2 ? 82 : 178
    return { x: WIDTH / 2 + Math.cos(angle * 2.5) * radius, y: HEIGHT / 2 + Math.sin(angle * 2.5) * radius }
  }
  if (pattern === 'diamond') {
    const radius = 115 + (index % 3) * 24
    const diamondAngle = angle + Math.PI / 4
    const scale = Math.max(Math.abs(Math.cos(diamondAngle)), Math.abs(Math.sin(diamondAngle)))
    return { x: WIDTH / 2 + (Math.cos(diamondAngle) / scale) * radius * 1.45, y: HEIGHT / 2 + (Math.sin(diamondAngle) / scale) * radius }
  }
  if (pattern === 'wave') {
    const columns = Math.ceil(Math.sqrt(count * 1.8))
    const row = Math.floor(index / columns)
    const column = index % columns
    return { x: 170 + column * (560 / Math.max(1, columns - 1)), y: 145 + row * 34 + Math.sin(column * 0.9) * 48 }
  }
  const ring = index % 3
  const radius = 72 + ring * 58
  return { x: WIDTH / 2 + Math.cos(angle * 3) * radius, y: HEIGHT / 2 + Math.sin(angle * 3) * radius }
}

function prepareVictoryFormation(state) {
  const patterns = ['star', 'diamond', 'wave', 'rings']
  const pattern = patterns[Math.floor(Math.random() * patterns.length)]
  state.fighters = state.fighters.filter((fighter) => fighter.side === state.winner)
  state.fighters.forEach((fighter, index) => {
    const point = formationPoint(pattern, index, state.fighters.length)
    fighter.formationX = point.x
    fighter.formationY = point.y
    fighter.formationPhase = Math.random() * Math.PI * 2
  })
  return pattern
}

function stepVictoryFormation(state, delta, celebrationTime) {
  const dt = Math.min(delta, 0.04)
  const settled = celebrationTime > 1.4
  for (const fighter of state.fighters) {
    const orbit = settled ? 7 : 0
    const targetX = fighter.formationX + Math.cos(celebrationTime * 1.8 + fighter.formationPhase) * orbit
    const targetY = fighter.formationY + Math.sin(celebrationTime * 1.8 + fighter.formationPhase) * orbit
    const dx = targetX - fighter.x
    const dy = targetY - fighter.y
    fighter.vx = fighter.vx * 0.86 + dx * 3.8 * dt
    fighter.vy = fighter.vy * 0.86 + dy * 3.8 * dt
    fighter.x += fighter.vx
    fighter.y += fighter.vy
    fighter.glow = Math.max(0, fighter.glow - dt)
  }

  if (!settled || !state.fighters.length || Math.random() > dt * 10) return []
  const shooter = state.fighters[Math.floor(Math.random() * state.fighters.length)]
  const target = state.fighters[Math.floor(Math.random() * state.fighters.length)]
  const outward = Math.random() < 0.45
  const targetX = outward ? Math.max(8, Math.min(WIDTH - 8, shooter.x + randomBetween(-180, 180))) : target.x
  const targetY = outward ? Math.max(8, Math.min(HEIGHT - 8, shooter.y + randomBetween(-130, 130))) : target.y
  shooter.glow = 0.12
  return [{ type: 'laser', side: state.winner, x: shooter.x, y: shooter.y, targetX, targetY, age: 0, duration: 0.22 }]
}

export default function BattleArena({ battleId, countdown, countryA, countryB, onFinish }) {
  const canvasRef = useRef(null)
  const finishRef = useRef(onFinish)
  const [counts, setCounts] = useState({ A: 0, B: 0 })
  const [health, setHealth] = useState({ A: { current: 0, max: 1 }, B: { current: 0, max: 1 } })
  const [victorySide, setVictorySide] = useState(null)

  useEffect(() => {
    finishRef.current = onFinish
  }, [onFinish])

  useEffect(() => {
    if (!battleId) return undefined
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const state = createBattle(countryA, countryB, WIDTH, HEIGHT)
    setVictorySide(null)
    const colors = { A: countryA.color, B: countryB.color }
    let effects = []
    let animationFrame
    let previousTime = performance.now()
    let countTimer = 0
    let shake = 0
    let announcedWinner = false
    let celebrationTime = 0

    function frame(time) {
      const delta = (time - previousTime) / 1000
      previousTime = time
      const battleEvents = announcedWinner ? stepVictoryFormation(state, delta, celebrationTime) : stepBattle(state, delta)
      const newEffects = battleEvents.map((event) => ({
        ...event,
        age: event.age ?? 0,
        duration: event.duration ?? (event.type === 'tech' ? 0.85 : 0.7),
      }))
      if (announcedWinner) celebrationTime += delta
      effects.push(...newEffects)
      effects.forEach((effect) => { effect.age += delta })
      effects = effects.filter((effect) => effect.age < effect.duration)
      if (newEffects.some((effect) => effect.type === 'critical' || effect.type === 'tech')) shake = 7

      countTimer += delta
      if (countTimer > 0.25) {
        countTimer = 0
        setCounts({
          A: state.fighters.filter((fighter) => fighter.side === 'A').length,
          B: state.fighters.filter((fighter) => fighter.side === 'B').length,
        })
        setHealth(summarizeHealth(state))
      }

      ctx.save()
      if (shake > 0.2) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake)
        shake *= 0.82
      }
      drawBackground(ctx)
      drawFighters(ctx, state, colors)
      drawEffects(ctx, effects, colors)
      ctx.restore()

      if (state.winner && !announcedWinner) {
        announcedWinner = true
        prepareVictoryFormation(state)
        setCounts({
          A: state.fighters.filter((fighter) => fighter.side === 'A').length,
          B: state.fighters.filter((fighter) => fighter.side === 'B').length,
        })
        setHealth(summarizeHealth(state))
        setVictorySide(state.winner)
        finishRef.current(state.winner)
      }
      animationFrame = requestAnimationFrame(frame)
    }

    setCounts({
      A: state.fighters.filter((fighter) => fighter.side === 'A').length,
      B: state.fighters.filter((fighter) => fighter.side === 'B').length,
    })
    setHealth({ A: { current: state.initialHealth.A, max: state.initialHealth.A }, B: { current: state.initialHealth.B, max: state.initialHealth.B } })
    animationFrame = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animationFrame)
  }, [battleId, countryA, countryB])

  return (
    <section className="arena-shell">
      <div className="arena-header">
        <div><span className="status-dot left" />{countryA.flag} {countryA.name}: <strong>{counts.A}</strong></div>
        <span className="live-pill">{victorySide ? 'VICTORY SHOW' : countdown ? 'GET READY' : battleId ? 'LIVE BATTLE' : 'READY'}</span>
        <div>{countryB.flag} {countryB.name}: <strong>{counts.B}</strong><span className="status-dot right" /></div>
      </div>
      <div className="arena-stat-preview">
        <StatPreview country={countryA} />
        <span className="arena-stat-vs">VS</span>
        <StatPreview country={countryB} />
      </div>
      <div className="battle-health-bars">
        {['A', 'B'].map((side) => {
          const country = side === 'A' ? countryA : countryB
          const percent = Math.max(0, (health[side].current / health[side].max) * 100)
          return (
            <div className={`battle-health side-${side.toLowerCase()}`} key={side}>
              <div><strong>{country.flag} {country.name}</strong><span>{Math.round(health[side].current)} / {Math.round(health[side].max)} HP</span></div>
              <div className="health-track"><i style={{ width: `${percent}%`, background: country.color }} /></div>
            </div>
          )
        })}
      </div>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} aria-label="Animated battle arena" />
      {!battleId && (
        <div className="arena-empty">
          {countdown ? (
            <div className="battle-countdown" key={countdown}>{countdown}</div>
          ) : (
            <>
              <span>⚔</span>
              <h2>Configure your countries</h2>
              <p>Then start the clash.</p>
            </>
          )}
        </div>
      )}
    </section>
  )
}
