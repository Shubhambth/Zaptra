const canvas = document.querySelector('canvas')
const scoreEl = document.querySelector('#scoreEl')
const startBtn = document.querySelector('#startGameBtn')
const modalEl = document.querySelector('#modalEl')
const bigScore = document.querySelector('#bigScore')
const c = canvas.getContext('2d')
canvas.width = innerWidth
canvas.height = innerHeight

// Game state
let animationId
let score = 0
let gameLevel = 1
let gameTime = 0
let gameActive = false
let spawnInterval
let difficultyInterval

// Game settings
const GAME_SETTINGS = {
  initialEnemySpawnRate: 1500,
  minimumEnemySpawnRate: 500,
  difficultyIncreaseInterval: 10000, // 10 seconds
  powerUpChance: 0.05,
  maxEnemiesOnScreen: 30
}

// Colors
const COLORS = {
  player: '#4df0ff',
  projectile: '#ffffff',
  background: 'rgba(0, 0, 0, 0.1)',
  particles: ['#ff4d4d', '#ffff4d', '#4dff4d', '#4d4dff', '#ff4dff']
}

// Player class
class Player {
  constructor(x, y, radius, color) {
    this.x = x
    this.y = y
    this.radius = radius
    this.color = color
    this.powerUps = {
      multiShot: 0,
      rapidFire: 0,
      shield: 0
    }
    this.lastShotTime = 0
    this.shieldOpacity = 0
  }

  draw() {
    // Draw shield if active
    if (this.powerUps.shield > 0) {
      c.beginPath()
      c.arc(this.x, this.y, this.radius + 10, 0, Math.PI * 2, false)
      c.strokeStyle = `rgba(77, 255, 255, ${this.shieldOpacity})`
      c.lineWidth = 3
      c.stroke()
    }
    
    // Draw player
    c.beginPath()
    c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false)
    c.fillStyle = this.color
    c.fill()
    
    // Draw inner circle
    c.beginPath()
    c.arc(this.x, this.y, this.radius * 0.7, 0, Math.PI * 2, false)
    c.fillStyle = '#ffffff'
    c.fill()
  }
  
  update() {
    this.draw()
    
    // Pulse shield effect
    if (this.powerUps.shield > 0) {
      this.shieldOpacity = 0.3 + Math.sin(Date.now() / 100) * 0.2
    }
  }
}

class Projectile {
  constructor(x, y, radius, color, velocity, damage = 1) {
    this.x = x
    this.y = y
    this.radius = radius
    this.color = color
    this.velocity = velocity
    this.damage = damage
  }

  draw() {
    c.beginPath()
    c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false)
    c.fillStyle = this.color
    c.fill()
  }

  update() {
    this.draw()
    this.x = this.x + this.velocity.x
    this.y = this.y + this.velocity.y
  }
}

class Enemy {
  constructor(x, y, radius, color, velocity, type = 'standard') {
    this.x = x
    this.y = y
    this.radius = radius
    this.color = color
    this.velocity = velocity
    this.type = type
    this.sinAngle = 0
    this.lastDirectionChange = 0
    this.health = Math.ceil(radius / 10)
    this.originalRadius = radius
    this.pulsateDirection = 1
    this.pulsateSpeed = 0.02
    this.pulsateAmount = 0
  }

  draw() {
    c.beginPath()
    c.arc(this.x, this.y, this.radius + this.pulsateAmount, 0, Math.PI * 2, false)
    c.fillStyle = this.color
    
    // Add a gradient fill based on enemy type
    if (this.type === 'boss') {
      const gradient = c.createRadialGradient(
        this.x, this.y, 0,
        this.x, this.y, this.radius
      )
      gradient.addColorStop(0, '#ffffff')
      gradient.addColorStop(0.4, this.color)
      gradient.addColorStop(1, '#440000')
      c.fillStyle = gradient
    } else if (this.type === 'zigzag') {
      const gradient = c.createRadialGradient(
        this.x, this.y, 0,
        this.x, this.y, this.radius
      )
      gradient.addColorStop(0, '#ffffff')
      gradient.addColorStop(0.6, this.color)
      gradient.addColorStop(1, '#004400')
      c.fillStyle = gradient
    } else if (this.type === 'homing') {
      const gradient = c.createRadialGradient(
        this.x, this.y, 0,
        this.x, this.y, this.radius
      )
      gradient.addColorStop(0, '#ffffff')
      gradient.addColorStop(0.6, this.color)
      gradient.addColorStop(1, '#000044')
      c.fillStyle = gradient
    }
    
    c.fill()
    
    // Draw health indicator
    if (this.health > 1) {
      c.strokeStyle = 'rgba(255, 255, 255, 0.5)'
      c.lineWidth = 2
      c.beginPath()
      c.arc(this.x, this.y, this.radius - 2, 0, (Math.PI * 2) * (this.health / Math.ceil(this.originalRadius / 10)), false)
      c.stroke()
    }
  }

  update() {
    this.draw()
    
    // Pulsate effect
    this.pulsateAmount += this.pulsateSpeed * this.pulsateDirection
    if (Math.abs(this.pulsateAmount) > 2) {
      this.pulsateDirection *= -1
    }
    
    // Different movement patterns based on enemy type
    switch (this.type) {
      case 'zigzag':
        // ZigZag movement
        this.sinAngle += 0.05
        this.x += this.velocity.x
        this.y += this.velocity.y + Math.sin(this.sinAngle) * 2
        break
        
      case 'homing':
        // Homing movement (adjusts direction toward player)
        if (Date.now() - this.lastDirectionChange > 500) {
          const player = getPlayer()
          const angle = Math.atan2(
            player.y - this.y,
            player.x - this.x
          )
          this.velocity = {
            x: Math.cos(angle) * (0.5 + gameLevel * 0.1),
            y: Math.sin(angle) * (0.5 + gameLevel * 0.1)
          }
          this.lastDirectionChange = Date.now()
        }
        this.x += this.velocity.x
        this.y += this.velocity.y
        break
        
      case 'boss':
        // Slower but more health
        this.x += this.velocity.x * 0.7
        this.y += this.velocity.y * 0.7
        break
        
      default:
        // Standard movement
        this.x += this.velocity.x
        this.y += this.velocity.y
    }
  }
}

class Particle {
  constructor(x, y, radius, color, velocity) {
    this.x = x
    this.y = y
    this.radius = radius
    this.color = color
    this.velocity = velocity
    this.alpha = 1
    this.friction = 0.98
  }

  draw() {
    c.save()
    c.globalAlpha = this.alpha
    c.beginPath()
    c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false)
    c.fillStyle = this.color
    c.fill()
    c.restore()
  }

  update() {
    this.draw()
    this.velocity.x *= this.friction
    this.velocity.y *= this.friction
    this.x += this.velocity.x
    this.y += this.velocity.y
    this.alpha -= 0.01
  }
}

class PowerUp {
  constructor(x, y, type) {
    this.x = x
    this.y = y
    this.radius = 15
    this.type = type
    this.color = this.getColorByType()
    
    // Power-up movement
    const angle = Math.random() * Math.PI * 2
    const speed = 1
    this.velocity = {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed
    }
    
    this.createdAt = Date.now()
    this.lifespan = 10000 // 10 seconds lifespan
  }
  
  getColorByType() {
    switch(this.type) {
      case 'multiShot':
        return '#ffff00' // Yellow
      case 'rapidFire':
        return '#ff0000' // Red
      case 'shield':
        return '#00ffff' // Cyan
      default:
        return '#ffffff'
    }
  }
  
  draw() {
    c.beginPath()
    c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false)
    
    // Create gradient based on type
    const gradient = c.createRadialGradient(
      this.x, this.y, 0,
      this.x, this.y, this.radius
    )
    gradient.addColorStop(0, '#ffffff')
    gradient.addColorStop(0.5, this.color)
    gradient.addColorStop(1, '#000000')
    
    c.fillStyle = gradient
    c.fill()
    
    // Add blinking effect as lifespan runs out
    const remainingLife = 1 - ((Date.now() - this.createdAt) / this.lifespan)
    if (remainingLife < 0.3) {
      c.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.5
    }
    
    // Draw icon based on type
    c.fillStyle = '#ffffff'
    switch(this.type) {
      case 'multiShot':
        // Draw three small dots in a triangle
        c.beginPath()
        c.arc(this.x, this.y - 5, 2, 0, Math.PI * 2)
        c.arc(this.x - 4, this.y + 3, 2, 0, Math.PI * 2)
        c.arc(this.x + 4, this.y + 3, 2, 0, Math.PI * 2)
        c.fill()
        break
      case 'rapidFire':
        // Draw lightning bolt
        c.beginPath()
        c.moveTo(this.x - 3, this.y - 5)
        c.lineTo(this.x + 2, this.y)
        c.lineTo(this.x - 1, this.y)
        c.lineTo(this.x + 3, this.y + 5)
        c.lineTo(this.x, this.y + 1)
        c.lineTo(this.x + 3, this.y + 1)
        c.lineTo(this.x - 3, this.y - 5)
        c.fill()
        break
      case 'shield':
        // Draw circle outline
        c.beginPath()
        c.arc(this.x, this.y, 5, 0, Math.PI * 2)
        c.lineWidth = 2
        c.strokeStyle = '#ffffff'
        c.stroke()
        break
    }
    
    c.globalAlpha = 1
  }
  
  update() {
    this.draw()
    
    // Bounce off walls
    if (this.x + this.radius > canvas.width || this.x - this.radius < 0) {
      this.velocity.x = -this.velocity.x
    }
    if (this.y + this.radius > canvas.height || this.y - this.radius < 0) {
      this.velocity.y = -this.velocity.y
    }
    
    this.x += this.velocity.x
    this.y += this.velocity.y
    
    // Check if power-up has expired
    return Date.now() - this.createdAt < this.lifespan
  }
}

// Game objects
let player
let projectiles = []
let enemies = []
let particles = []
let powerUps = []

// Helper functions
function getPlayer() {
  return player
}

function createProjectile(angle, speed = 5, damage = 1) {
  const velocity = {
    x: Math.cos(angle) * speed,
    y: Math.sin(angle) * speed
  }
  
  return new Projectile(
    player.x, 
    player.y, 
    5, 
    COLORS.projectile, 
    velocity,
    damage
  )
}

function spawnEnemy() {
  // Don't spawn too many enemies
  if (enemies.length >= GAME_SETTINGS.maxEnemiesOnScreen) return
  
  // Determine radius based on level (smaller = harder)
  const minRadius = Math.max(8, 30 - gameLevel)
  const maxRadius = Math.max(minRadius + 20, 40)
  const radius = Math.random() * (maxRadius - minRadius) + minRadius
  
  // Determine position (outside screen)
  let x, y
  if (Math.random() < 0.5) {
    x = Math.random() < 0.5 ? 0 - radius : canvas.width + radius
    y = Math.random() * canvas.height
  } else {
    x = Math.random() * canvas.width
    y = Math.random() < 0.5 ? 0 - radius : canvas.height + radius
  }
  
  // Generate random hue for enemy
  const hue = Math.random() * 360
  const color = `hsl(${hue}, 70%, 50%)`
  
  // Calculate direction toward player
  const angle = Math.atan2(
    player.y - y,
    player.x - x
  )
  
  // Speed increases with game level
  const speed = 0.7 + (gameLevel * 0.1)
  const velocity = {
    x: Math.cos(angle) * speed,
    y: Math.sin(angle) * speed
  }
  
  // Determine enemy type
  let enemyType = 'standard'
  const typeRoll = Math.random()
  
  if (gameLevel >= 3 && typeRoll < 0.1) {
    enemyType = 'boss'
  } else if (gameLevel >= 2 && typeRoll < 0.2) {
    enemyType = 'homing'
  } else if (gameLevel >= 1 && typeRoll < 0.3) {
    enemyType = 'zigzag'
  }
  
  // Adjust radius for special types
  if (enemyType === 'boss') {
    radius *= 1.5
  }
  
  enemies.push(new Enemy(x, y, radius, color, velocity, enemyType))
}

function createExplosion(x, y, color, radius, particleCount) {
  for (let i = 0; i < particleCount; i++) {
    const speed = Math.random() * 6 + 1
    const angle = Math.random() * Math.PI * 2
    
    particles.push(
      new Particle(
        x, 
        y, 
        Math.random() * 3 + 1, 
        color || COLORS.particles[Math.floor(Math.random() * COLORS.particles.length)], 
        {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed
        }
      )
    )
  }
}

function checkProjectileOutOfBounds(projectile, index) {
  if (
    projectile.x + projectile.radius < 0 ||
    projectile.x - projectile.radius > canvas.width ||
    projectile.y + projectile.radius < 0 ||
    projectile.y - projectile.radius > canvas.height
  ) {
    projectiles.splice(index, 1)
    return true
  }
  return false
}

function trySpawnPowerUp(x, y) {
  if (Math.random() < GAME_SETTINGS.powerUpChance) {
    const types = ['multiShot', 'rapidFire', 'shield']
    const type = types[Math.floor(Math.random() * types.length)]
    powerUps.push(new PowerUp(x, y, type))
  }
}

function applyPowerUp(type) {
  const duration = 10000 // 10 seconds
  
  switch(type) {
    case 'multiShot':
      player.powerUps.multiShot = Date.now() + duration
      break
    case 'rapidFire':
      player.powerUps.rapidFire = Date.now() + duration
      break
    case 'shield':
      player.powerUps.shield = Date.now() + duration
      break
  }
  
  // Create nice visual effect
  createExplosion(player.x, player.y, '#ffffff', player.radius, 20)
}

function shootProjectile(event) {
  if (!gameActive) return
  
  const now = Date.now()
  const fireRate = player.powerUps.rapidFire > now ? 100 : 250 // ms between shots
  
  if (now - player.lastShotTime < fireRate) return
  player.lastShotTime = now
  
  // Calculate angle to cursor
  const angle = Math.atan2(
    event.clientY - player.y,
    event.clientX - player.x
  )
  
  // Create projectile(s)
  if (player.powerUps.multiShot > now) {
    // Create 3 projectiles in a spread
    projectiles.push(createProjectile(angle, 6, 2))
    projectiles.push(createProjectile(angle - 0.2, 6, 1))
    projectiles.push(createProjectile(angle + 0.2, 6, 1))
  } else {
    projectiles.push(createProjectile(angle))
  }
  
  // Sound effect could go here
}

function increaseDifficulty() {
  gameLevel++
  
  // Reduce enemy spawn interval
  clearInterval(spawnInterval)
  const newSpawnRate = Math.max(
    GAME_SETTINGS.minimumEnemySpawnRate,
    GAME_SETTINGS.initialEnemySpawnRate - (gameLevel * 100)
  )
  spawnInterval = setInterval(spawnEnemy, newSpawnRate)
  
  // Visual effect to show level up
  createExplosion(canvas.width/2, canvas.height/2, '#ffffff', 10, 50)
  
  // Display level up text
  c.save()
  c.fillStyle = '#ffffff'
  c.font = 'bold 40px Arial'
  c.textAlign = 'center'
  c.fillText(`LEVEL ${gameLevel}`, canvas.width/2, canvas.height/2)
  c.restore()
}

function endGame() {
  gameActive = false
  cancelAnimationFrame(animationId)
  clearInterval(spawnInterval)
  clearInterval(difficultyInterval)
  modalEl.style.display = 'flex'
  bigScore.innerHTML = score
}

function init() {
  // Reset game state
  player = new Player(canvas.width / 2, canvas.height / 2, 12, COLORS.player)
  projectiles = []
  enemies = []
  particles = []
  powerUps = []
  score = 0
  gameLevel = 1
  gameTime = 0
  gameActive = true
  
  // Update UI
  scoreEl.innerHTML = score
  bigScore.innerHTML = score
  
  // Set up enemy spawning
  clearInterval(spawnInterval)
  spawnInterval = setInterval(spawnEnemy, GAME_SETTINGS.initialEnemySpawnRate)
  
  // Set up difficulty progression
  clearInterval(difficultyInterval)
  difficultyInterval = setInterval(increaseDifficulty, GAME_SETTINGS.difficultyIncreaseInterval)
}

function animate() {
  if (!gameActive) return
  
  animationId = requestAnimationFrame(animate)
  gameTime++
  
  // Clear screen with fading effect
  c.fillStyle = COLORS.background
  c.fillRect(0, 0, canvas.width, canvas.height)
  
  // Update player
  player.update()
  
  // Update particles
  particles.forEach((particle, index) => {
    if (particle.alpha <= 0) {
      particles.splice(index, 1)
    } else {
      particle.update()
    }
  })
  
  // Update power-ups
  powerUps = powerUps.filter((powerUp, index) => {
    const isActive = powerUp.update()
    
    // Check for player collision with power-up
    const dist = Math.hypot(player.x - powerUp.x, player.y - powerUp.y)
    if (dist - player.radius - powerUp.radius < 0) {
      applyPowerUp(powerUp.type)
      return false // Remove power-up
    }
    
    return isActive // Keep power-up if still active
  })
  
  // Update projectiles
  projectiles.forEach((projectile, projectileIndex) => {
    projectile.update()
    
    // Remove projectiles that are off-screen
    if (checkProjectileOutOfBounds(projectile, projectileIndex)) {
      return
    }
  })
  
  // Check for player power-up expiration
  const now = Date.now()
  for (const [powerUp, expireTime] of Object.entries(player.powerUps)) {
    if (expireTime > 0 && expireTime < now) {
      player.powerUps[powerUp] = 0
    }
  }
  
  // Update enemies
  enemies.forEach((enemy, enemyIndex) => {
    enemy.update()
    
    // Check for collision with player
    const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y)
    if (distToPlayer - enemy.radius - player.radius < 1) {
      // Check if player has shield
      if (player.powerUps.shield > Date.now()) {
        // Destroy enemy instead of dying
        createExplosion(enemy.x, enemy.y, enemy.color, enemy.radius, enemy.radius * 3)
        enemies.splice(enemyIndex, 1)
        score += 100
        scoreEl.innerHTML = score
        
        // Reduce shield time as penalty
        player.powerUps.shield = Math.max(
          Date.now() + 2000, // At least 2 more seconds
          player.powerUps.shield - 3000 // Penalty of 3 seconds
        )
      } else {
        // Game over
        endGame()
      }
    }
    
    // Check for collision with projectiles
    projectiles.forEach((projectile, projectileIndex) => {
      const dist = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y)
      
      // Collision detected
      if (dist - enemy.radius - projectile.radius < 1) {
        // Create particles for visual effect
        createExplosion(projectile.x, projectile.y, enemy.color, enemy.radius, enemy.radius * 2)
        
        // Remove projectile
        projectiles.splice(projectileIndex, 1)
        
        // Reduce enemy health
        enemy.health -= projectile.damage
        
        // If enemy still has health, shrink it
        if (enemy.health > 0) {
          // Add points
          score += 25
          scoreEl.innerHTML = score
          
          // Visually shrink the enemy
          gsap.to(enemy, {
            radius: enemy.radius * (enemy.health / Math.ceil(enemy.originalRadius / 10))
          })
        } else {
          // Enemy destroyed
          setTimeout(() => {
            enemies.splice(enemyIndex, 1)
          }, 0)
          
          // Add score based on enemy size/type
          let pointValue = 100
          if (enemy.type === 'boss') pointValue = 500
          else if (enemy.type === 'homing') pointValue = 250
          else if (enemy.type === 'zigzag') pointValue = 150
          
          score += pointValue
          scoreEl.innerHTML = score
          
          // Chance to spawn power-up
          trySpawnPowerUp(enemy.x, enemy.y)
        }
      }
    })
  })
  
  // Display active power-ups
  const powerUpY = 40
  let powerUpX = 40
  
  c.font = '16px Arial'
  c.fillStyle = '#ffffff'
  
  for (const [type, expireTime] of Object.entries(player.powerUps)) {
    if (expireTime > Date.now()) {
      const timeLeft = Math.ceil((expireTime - Date.now()) / 1000)
      let label
      let color
      
      switch(type) {
        case 'multiShot': 
          label = 'Multi Shot'
          color = '#ffff00'
          break
        case 'rapidFire': 
          label = 'Rapid Fire'
          color = '#ff0000'
          break
        case 'shield': 
          label = 'Shield'
          color = '#00ffff'
          break
      }
      
      c.fillStyle = color
      c.fillText(`${label}: ${timeLeft}s`, powerUpX, powerUpY)
      powerUpX += 150
    }
  }
  
  // Display current level
  c.fillStyle = '#ffffff'
  c.font = '18px Arial'
  c.fillText(`Level: ${gameLevel}`, canvas.width - 100, 40)
}

// Event Listeners
startBtn.addEventListener('click', () => {
  init()
  animate()
  modalEl.style.display = 'none'
})

addEventListener('click', shootProjectile)

// Handle window resize
addEventListener('resize', () => {
  canvas.width = innerWidth
  canvas.height = innerHeight
  
  if (player) {
    player.x = canvas.width / 2
    player.y = canvas.height / 2
  }
})