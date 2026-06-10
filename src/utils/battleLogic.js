const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const randomBetween = (min, max) => min + Math.random() * (max - min)

function createFighters(side, skills, width, height) {
  const count = Math.round(12 + skills.population * 0.48)
  const isLeft = side === 'A'
  const maxHealth = 48 + skills.defense * 0.72 + skills.dotSize * 0.08

  return Array.from({ length: count }, (_, index) => ({
    id: `${side}-${index}`,
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

export function createBattle(configA, configB, width, height) {
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
  target.health -= damage
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

  for (const fighter of state.fighters) {
    if (fighter.health <= 0) continue
    const skills = state.configs[fighter.side].skills
    const enemies = state.fighters.filter(
      (candidate) => candidate.side !== fighter.side && candidate.health > 0,
    )
    const movementSpeed = 14 + skills.speed * 0.34
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
