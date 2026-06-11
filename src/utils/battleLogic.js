const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const randomBetween = (min, max) => min + Math.random() * (max - min)

function createFighters(side, skills, width, height, requestedCount, idStart = 0) {
  const count = requestedCount ?? Math.round(12 + skills.population * 0.48)
  const isLeft = side === 'A'
  const maxHealth = 48 + skills.defense * 0.72 + skills.dotSize * 0.08

  return Array.from({ length: count }, (_, index) => ({
    id: `${side}-${idStart + index}`,
    side,
    x: isLeft ? randomBetween(25, width * 0.31) : randomBetween(width * 0.69, width - 25),
    y: randomBetween(28, height - 28),
    vx: 0,
    vy: 0,
    health: maxHealth,
    maxHealth,
    cooldown: randomBetween(0, 0.5),
    targetId: null,
    glow: 0,
    retreatTimer: 0,
    retreatCooldown: randomBetween(2, 6),
    retreatX: isLeft ? randomBetween(30, width * 0.27) : randomBetween(width * 0.73, width - 30),
    retreatY: randomBetween(35, height - 35),
  }))
}

export function createBattle(configA, configB, width, height, options = {}) {
  const fighters = [
    ...createFighters('A', configA.skills, width, height),
    ...createFighters('B', configB.skills, width, height),
  ]
  return {
    width,
    height,
    configs: { A: configA, B: configB },
    fighters,
    initialHealth: {
      A: fighters.filter((fighter) => fighter.side === 'A').reduce((sum, fighter) => sum + fighter.maxHealth, 0),
      B: fighters.filter((fighter) => fighter.side === 'B').reduce((sum, fighter) => sum + fighter.maxHealth, 0),
    },
    elapsed: 0,
    winner: null,
    commander: options.commanderMode ? {
      energy: { A: 0, B: 0 },
      speedUntil: { A: 0, B: 0 },
      shieldUntil: { A: 0, B: 0 },
      nextFighterId: { A: 1000, B: 1000 },
      lastPowerUp: null,
    } : null,
  }
}

function findTarget(fighter, enemies, intelligence) {
  if (!enemies.length) return null
  if (Math.random() > 0.35 + intelligence / 170) {
    return enemies[Math.floor(Math.random() * enemies.length)]
  }

  let nearest = enemies[0]
  let nearestDistance = Infinity
  for (const enemy of enemies) {
    const distance = (enemy.x - fighter.x) ** 2 + (enemy.y - fighter.y) ** 2
    if (distance < nearestDistance) {
      nearest = enemy
      nearestDistance = distance
    }
  }
  return nearest
}

function blastNearby(state, attacker, target, damage, events) {
  const enemySide = attacker.side === 'A' ? 'B' : 'A'
  for (const fighter of state.fighters) {
    if (fighter.side !== enemySide || fighter.health <= 0) continue
    const distance = Math.hypot(fighter.x - target.x, fighter.y - target.y)
    if (distance < 46) fighter.health -= damage
  }
  events.push({ type: 'tech', x: target.x, y: target.y, side: attacker.side })
}

function attack(state, attacker, target, skills, events) {
  const isCritical = Math.random() < 0.012 + skills.luck / 1800
  const luckBoost = Math.random() < 0.04 + skills.luck / 850
  const luckMultiplier = luckBoost ? 1.05 + skills.luck / 500 : 1
  const damageVariance = randomBetween(0.88, 1.12)
  const damage = (2.1 + skills.strength * 0.045) * damageVariance * luckMultiplier * (isCritical ? 1.65 : 1)
  const shieldMultiplier = state.commander && state.elapsed < state.commander.shieldUntil[target.side] ? 0.48 : 1
  target.health -= damage * shieldMultiplier
  target.glow = 0.13
  attacker.cooldown = clamp(0.7 - skills.speed * 0.0035, 0.24, 0.7)

  if (isCritical) {
    events.push({ type: 'critical', x: target.x, y: target.y, side: attacker.side })
  }

  if (luckBoost && !isCritical) {
    events.push({ type: 'luckHit', x: target.x, y: target.y, side: attacker.side })
  }

  if (Math.random() < skills.technology / 1800) {
    blastNearby(state, attacker, target, damage * 0.68, events)
  }

  if (Math.random() < skills.luck / 2600) {
    attacker.health = Math.min(attacker.maxHealth, attacker.health + attacker.maxHealth * 0.4)
    events.push({ type: 'luck', x: attacker.x, y: attacker.y, side: attacker.side })
  }
}

function nearbyEnemyCount(fighter, enemies, radius) {
  let count = 0
  for (const enemy of enemies) {
    if (Math.hypot(enemy.x - fighter.x, enemy.y - fighter.y) < radius) count += 1
  }
  return count
}

function startRetreat(fighter, state, skills) {
  const isLeft = fighter.side === 'A'
  fighter.retreatTimer = randomBetween(1.3, 2.8) + (100 - skills.intelligence) / 180
  fighter.retreatCooldown = randomBetween(4.5, 8)
  fighter.retreatX = isLeft
    ? randomBetween(28, state.width * 0.3)
    : randomBetween(state.width * 0.7, state.width - 28)
  fighter.retreatY = randomBetween(28, state.height - 28)
}

function moveToward(fighter, x, y, speed, directness, dt, state) {
  const dx = x - fighter.x
  const dy = y - fighter.y
  const distance = Math.max(1, Math.hypot(dx, dy))
  fighter.vx = fighter.vx * (1 - directness * dt * 5) + (dx / distance) * speed * directness
  fighter.vy = fighter.vy * (1 - directness * dt * 5) + (dy / distance) * speed * directness
  fighter.x = clamp(fighter.x + fighter.vx * dt, 7, state.width - 7)
  fighter.y = clamp(fighter.y + fighter.vy * dt, 7, state.height - 7)
  return distance
}

// Mutating the battle object keeps the animation loop small and avoids React rerenders per frame.
export function stepBattle(state, deltaSeconds) {
  if (state.winner) return []

  const dt = Math.min(deltaSeconds, 0.04)
  const events = []
  state.elapsed += dt
  if (state.commander) {
    for (const side of ['A', 'B']) {
      const luck = state.configs[side].skills.luck ?? 50
      state.commander.energy[side] = clamp(state.commander.energy[side] + dt * 2 * (1 + luck / 500), 0, 100)
    }
  }

  for (const fighter of state.fighters) {
    if (fighter.health <= 0) continue
    const skills = state.configs[fighter.side].skills
    const enemies = state.fighters.filter(
      (candidate) => candidate.side !== fighter.side && candidate.health > 0,
    )
    const speedMultiplier = state.commander && state.elapsed < state.commander.speedUntil[fighter.side] ? 1.8 : 1
    const movementSpeed = (14 + skills.speed * 0.34) * speedMultiplier
    const directness = 0.76 + skills.intelligence / 420
    fighter.retreatCooldown -= dt
    fighter.retreatTimer = Math.max(0, fighter.retreatTimer - dt)
    fighter.cooldown -= dt
    fighter.glow = Math.max(0, fighter.glow - dt)

    if (fighter.retreatTimer > 0) {
      const retreatSpeed = movementSpeed * 1.15
      const distanceToSafety = moveToward(fighter, fighter.retreatX, fighter.retreatY, retreatSpeed, 0.9, dt, state)
      if (distanceToSafety < 16) fighter.retreatTimer = Math.min(fighter.retreatTimer, 0.35)
      continue
    }

    if (fighter.retreatCooldown <= 0 && enemies.length) {
      const livingAllies = state.fighters.filter(
        (candidate) => candidate.side === fighter.side && candidate.health > 0,
      )
      const retreatingAllies = livingAllies.filter((candidate) => candidate.retreatTimer > 0).length
      const retreatLimit = Math.max(2, Math.round(livingAllies.length * 0.18))
      const healthRatio = fighter.health / fighter.maxHealth
      const crowded = nearbyEnemyCount(fighter, enemies, 38)
      const lowHealthChance = healthRatio < 0.42 ? (0.42 - healthRatio) * 0.012 : 0
      const crowdChance = crowded >= 4 ? (crowded - 3) * 0.0004 : 0
      const tacticalChance = (100 - skills.defense + skills.intelligence) / 600000
      if (retreatingAllies < retreatLimit && Math.random() < lowHealthChance + crowdChance + tacticalChance) {
        startRetreat(fighter, state, skills)
        continue
      }
    }

    const target = findTarget(fighter, enemies, skills.intelligence)
    if (!target) continue
    const distance = moveToward(fighter, target.x, target.y, movementSpeed, directness, dt, state)

    if (distance < 12 && fighter.cooldown <= 0) {
      attack(state, fighter, target, skills, events)
    }
  }

  state.fighters = state.fighters.filter((fighter) => fighter.health > 0)
  const hasA = state.fighters.some((fighter) => fighter.side === 'A')
  const hasB = state.fighters.some((fighter) => fighter.side === 'B')
  if (!hasA || !hasB || state.elapsed > 120) {
    if (hasA && !hasB) state.winner = 'A'
    else if (hasB && !hasA) state.winner = 'B'
    else {
      const healthA = state.fighters
        .filter((fighter) => fighter.side === 'A')
        .reduce((sum, fighter) => sum + fighter.health, 0)
      const healthB = state.fighters
        .filter((fighter) => fighter.side === 'B')
        .reduce((sum, fighter) => sum + fighter.health, 0)
      state.winner = healthA >= healthB ? 'A' : 'B'
    }
  }

  return events
}

export const commanderPowerUps = {
  reinforcements: { label: 'REINFORCEMENTS!', cost: 25 },
  speed: { label: 'SPEED BOOST!', cost: 20 },
  shield: { label: 'SHIELD WALL!', cost: 30 },
  heal: { label: 'HEAL SWARM!', cost: 25 },
  tech: { label: 'TECH BLAST!', cost: 40 },
  chaos: { label: 'CHAOS EVENT!', cost: 50 },
}

function centerOf(fighters, fallbackX, fallbackY) {
  if (!fighters.length) return { x: fallbackX, y: fallbackY }
  return {
    x: fighters.reduce((sum, fighter) => sum + fighter.x, 0) / fighters.length,
    y: fighters.reduce((sum, fighter) => sum + fighter.y, 0) / fighters.length,
  }
}

function damageFighters(fighters, damage, chance = 1) {
  for (const fighter of fighters) {
    if (Math.random() <= chance) {
      fighter.health -= damage
      fighter.glow = 0.25
    }
  }
}

export function applyCommanderPowerUp(state, side, powerUp) {
  const definition = commanderPowerUps[powerUp]
  if (!state.commander || state.winner || !definition || !['A', 'B'].includes(side)) return { ok: false }
  if (state.commander.energy[side] < definition.cost) return { ok: false }

  state.commander.energy[side] -= definition.cost
  const enemySide = side === 'A' ? 'B' : 'A'
  const allies = state.fighters.filter((fighter) => fighter.side === side && fighter.health > 0)
  const enemies = state.fighters.filter((fighter) => fighter.side === enemySide && fighter.health > 0)
  const events = []
  let detail = definition.label

  if (powerUp === 'reinforcements') {
    const count = Math.floor(randomBetween(5, 16))
    const reinforcements = createFighters(
      side,
      state.configs[side].skills,
      state.width,
      state.height,
      count,
      state.commander.nextFighterId[side],
    )
    state.commander.nextFighterId[side] += count
    state.fighters.push(...reinforcements)
    state.initialHealth[side] += reinforcements.reduce((sum, fighter) => sum + fighter.maxHealth, 0)
    detail = `${definition.label} +${count}`
  } else if (powerUp === 'speed') {
    state.commander.speedUntil[side] = Math.max(state.commander.speedUntil[side], state.elapsed) + 5
  } else if (powerUp === 'shield') {
    state.commander.shieldUntil[side] = Math.max(state.commander.shieldUntil[side], state.elapsed) + 5
  } else if (powerUp === 'heal') {
    allies.forEach((fighter) => {
      fighter.health = Math.min(fighter.maxHealth, fighter.health + fighter.maxHealth * 0.38)
      fighter.glow = 0.4
    })
  } else if (powerUp === 'tech') {
    const target = centerOf(enemies, state.width / 2, state.height / 2)
    for (const fighter of enemies) {
      const distance = Math.hypot(fighter.x - target.x, fighter.y - target.y)
      if (distance < 145) fighter.health -= 28 + state.configs[side].skills.technology * 0.24
    }
    events.push({ type: 'commanderBlast', x: target.x, y: target.y, side })
  } else if (powerUp === 'chaos') {
    const chaos = ['METEOR STRIKE!', 'GIANT LUCKY DOT!', 'SUDDEN RETREAT!', 'CONFETTI CONFUSION!', 'CRITICAL HIT WAVE!']
    detail = chaos[Math.floor(Math.random() * chaos.length)]
    if (detail === 'METEOR STRIKE!') {
      damageFighters(enemies, 38, 0.42)
      const target = enemies[Math.floor(Math.random() * Math.max(1, enemies.length))]
      events.push({ type: 'meteor', x: target?.x ?? state.width / 2, y: target?.y ?? state.height / 2, side })
    } else if (detail === 'GIANT LUCKY DOT!') {
      const lucky = allies[Math.floor(Math.random() * Math.max(1, allies.length))]
      if (lucky) {
        lucky.maxHealth *= 2.4
        lucky.health = lucky.maxHealth
        lucky.commanderGiantUntil = state.elapsed + 8
        lucky.glow = 1
      }
    } else if (detail === 'SUDDEN RETREAT!') {
      enemies.forEach((fighter) => startRetreat(fighter, state, state.configs[enemySide].skills))
    } else if (detail === 'CONFETTI CONFUSION!') {
      enemies.forEach((fighter) => {
        fighter.retreatTimer = randomBetween(1.5, 3)
        fighter.retreatX = randomBetween(20, state.width - 20)
        fighter.retreatY = randomBetween(20, state.height - 20)
      })
      events.push({ type: 'confetti', x: state.width / 2, y: state.height / 2, side })
    } else {
      damageFighters(enemies, 24 + state.configs[side].skills.strength * 0.2, 0.72)
    }
  }

  state.commander.lastPowerUp = { side, powerUp, detail }
  events.push({
    type: 'commanderText',
    x: side === 'A' ? state.width * 0.28 : state.width * 0.72,
    y: 70,
    side,
    label: powerUp === 'chaos' ? `CHAOS EVENT! ${detail}` : detail,
  })
  return { ok: true, events, detail, powerUp, side }
}

export function getCommanderStatus(state) {
  if (!state.commander) return null
  return {
    energy: { ...state.commander.energy },
    active: {
      A: {
        speed: Math.max(0, state.commander.speedUntil.A - state.elapsed),
        shield: Math.max(0, state.commander.shieldUntil.A - state.elapsed),
      },
      B: {
        speed: Math.max(0, state.commander.speedUntil.B - state.elapsed),
        shield: Math.max(0, state.commander.shieldUntil.B - state.elapsed),
      },
    },
    lastPowerUp: state.commander.lastPowerUp,
    finished: Boolean(state.winner),
  }
}
