'use strict'

/* ---------- Saved settings ---------- */

function readStored(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be blocked. Progress just won't be remembered.
  }
}

/* ---------- Sunwheel: rules ---------- */

const SIZE = 50 // Hexagon radius in SVG units

const LEVELS = [
  { id: 'small', label: 'Small', radius: 1, scramble: 6 },
  { id: 'medium', label: 'Medium', radius: 2, scramble: 14 },
  { id: 'large', label: 'Large', radius: 3, scramble: 30 },
]

function hexCorners(x, y) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i
    return { x: x + SIZE * Math.cos(angle), y: y + SIZE * Math.sin(angle) }
  })
}

const HEX_POINTS = hexCorners(0, 0)
  .map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`)
  .join(' ')

// Lays out a hexagon of hexagons. A dial sits on every point where exactly
// three cells meet, and `ring` lists those cells in clockwise order.
function buildBoard(radius) {
  const cells = []
  for (let q = -radius; q <= radius; q++) {
    const rMin = Math.max(-radius, -q - radius)
    const rMax = Math.min(radius, -q + radius)
    for (let r = rMin; r <= rMax; r++) {
      cells.push({ x: SIZE * 1.5 * q, y: SIZE * Math.sqrt(3) * (r + q / 2) })
    }
  }

  const corners = new Map()
  cells.forEach((cell, index) => {
    for (const corner of hexCorners(cell.x, cell.y)) {
      const key = `${Math.round(corner.x * 10)}:${Math.round(corner.y * 10)}`
      if (!corners.has(key)) corners.set(key, { ...corner, cells: [] })
      corners.get(key).cells.push(index)
    }
  })

  const dials = [...corners.values()]
    .filter((corner) => corner.cells.length === 3)
    .map(({ x, y, cells: touching }) => {
      // y points down in SVG, so increasing angle runs clockwise on screen
      const angle = (index) => Math.atan2(cells[index].y - y, cells[index].x - x)
      return { x, y, ring: [...touching].sort((a, b) => angle(a) - angle(b)) }
    })

  return {
    cells,
    dials,
    halfWidth: SIZE * (1.5 * radius + 1),
    halfHeight: SIZE * Math.sqrt(3) * (radius + 0.5),
  }
}

// tiles[position] is the tile sitting there. `home` is the position it belongs
// in, and `turns` counts its rotation in clockwise steps of 120 degrees.
function solvedTiles(board) {
  return board.cells.map((_, index) => ({ home: index, turns: 0 }))
}

function isInPlace(tile, position) {
  return tile.home === position && tile.turns === 0
}

function isSolved(tiles) {
  return tiles.every(isInPlace)
}

// dir is 1 for clockwise and -1 for counterclockwise
function turnDial(tiles, dial, dir) {
  const next = [...tiles]
  dial.ring.forEach((position, i) => {
    const target = dial.ring[(i + dir + 3) % 3]
    const tile = tiles[position]
    next[target] = { ...tile, turns: (tile.turns + dir + 3) % 3 }
  })
  return next
}

// Scrambles are made of real moves, so every puzzle can be solved. Never using
// the same dial twice in a row stops moves from cancelling each other out.
function planScramble(board, count) {
  for (;;) {
    const plan = []
    let tiles = solvedTiles(board)
    while (plan.length < count) {
      const dial = Math.floor(Math.random() * board.dials.length)
      if (dial === plan.at(-1)?.dial) continue
      const dir = Math.random() < 0.5 ? 1 : -1
      plan.push({ dial, dir })
      tiles = turnDial(tiles, board.dials[dial], dir)
    }
    if (!isSolved(tiles)) return plan
  }
}

// The moves that lead back to solved. Undoing the top entry always gets one
// step closer, which is what makes hints possible without a solver.
function pushTrail(trail, move) {
  const top = trail.at(-1)
  if (top && top.dial === move.dial && top.dir === -move.dir) return trail.slice(0, -1)
  return [...trail, move]
}

/* ---------- Sunwheel: sound ---------- */

// Synthesized with the Web Audio API, so there are no audio files
const sounds = {
  ctx: null,
  muted: false,

  // Browsers only allow audio after a click or key press
  unlock() {
    this.ctx ??= new AudioContext()
    if (this.ctx.state === 'suspended') this.ctx.resume()
  },

  tone({ type = 'sine', from, to = from, volume, length, delay = 0 }) {
    const now = this.ctx.currentTime + delay
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(from, now)
    osc.frequency.exponentialRampToValueAtTime(to, now + length)
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + length)
    osc.connect(gain).connect(this.ctx.destination)
    osc.start(now)
    osc.stop(now + length)
  },

  turn() {
    if (this.muted) return
    this.unlock()
    this.tone({ type: 'triangle', from: 520, to: 180, volume: 0.22, length: 0.12 })
    this.tone({ from: 1400, to: 900, volume: 0.05, length: 0.05 })
  },

  // Quiet tick during a scramble. Stays silent until audio is unlocked.
  tick() {
    if (this.muted || this.ctx?.state !== 'running') return
    this.tone({ type: 'triangle', from: 700, to: 300, volume: 0.06, length: 0.05 })
  },

  victory() {
    if (this.muted) return
    this.unlock()
    const notes = [392, 493.88, 587.33, 783.99, 987.77]
    notes.forEach((from, i) => {
      this.tone({ from, volume: 0.14, length: 1, delay: i * 0.1 })
    })
  },
}

/* ---------- Sunwheel: the picture ---------- */

// Drawn on a 600 x 600 canvas centred on (0, 0). Stripes and rays run across
// the whole picture so that a rotated tile is noticeable wherever it lands.
function sceneMarkup(id, scale) {
  const EDGE = 360
  const HORIZON = 50
  const SUN = { x: 70, y: 10 }
  const SKY = [
    '#2b1b5a', '#44206f', '#642580', '#8a2c82', '#b23a79',
    '#d64f68', '#ec6f52', '#f6923f', '#fbb53c', '#fdd35a',
  ]
  const SEA = ['#f0a35e', '#c9786f', '#7d6a8f', '#3f7f9c', '#1f7a8c', '#14607a', '#0f4c68', '#0b3a56']
  const STARS = [
    [-270, -280], [-205, -235], [-150, -300], [-90, -250], [-30, -310], [40, -265],
    [105, -305], [170, -250], [235, -295], [285, -235], [-295, -205], [-120, -195],
  ]
  const MOUNTAINS = `M${-EDGE} ${HORIZON} L-300 -30 L-245 15 L-190 -70 L-120 5 L-70 -25
    L-15 ${HORIZON} Z M150 ${HORIZON} L215 -15 L255 15 L310 -55 L${EDGE} 0 L${EDGE} ${HORIZON} Z`

  const wave = (y, height, phase) => {
    let path = `M${-EDGE} ${EDGE} L${-EDGE} ${y}`
    for (let x = -EDGE; x <= EDGE; x += 20) {
      path += ` L${x} ${(y + height * Math.sin(x / 34 + phase)).toFixed(1)}`
    }
    return `${path} L${EDGE} ${EDGE} Z`
  }

  const ray = (index, count) => {
    const width = Math.PI / count
    const angle = index * 2 * width
    const point = (a) =>
      `${(SUN.x + 700 * Math.cos(a)).toFixed(1)},${(SUN.y + 700 * Math.sin(a)).toFixed(1)}`
    return `${SUN.x},${SUN.y} ${point(angle)} ${point(angle + width)}`
  }

  const bandHeight = (EDGE + HORIZON) / SKY.length
  const sky = SKY.map((color, i) =>
    `<rect x="${-EDGE}" y="${-EDGE + i * bandHeight}" width="${EDGE * 2}" height="${bandHeight + 1}" fill="${color}"/>`,
  ).join('')
  const rays = Array.from({ length: 16 }, (_, i) =>
    `<polygon points="${ray(i, 16)}" fill="#fff3c4" opacity="0.13"/>`,
  ).join('')
  const stars = STARS.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#fff6d8"/>`).join('')
  const sea = SEA.map((color, i) =>
    `<path d="${wave(HORIZON + i * 40, 7 + i, i * 1.7)}" fill="${color}"/>`,
  ).join('')
  const glints = [0, 1, 2, 3, 4].map((i) =>
    `<rect x="${SUN.x - 62 + i * 9}" y="${HORIZON + 14 + i * 34}" width="${124 - i * 18}"
      height="9" rx="4.5" fill="#fff0b8" opacity="${0.8 - i * 0.12}"/>`,
  ).join('')

  return `<g id="${id}" transform="scale(${scale})">
    ${sky}${rays}${stars}
    <circle cx="${SUN.x}" cy="${SUN.y}" r="135" fill="#ffd166" opacity="0.35"/>
    <circle cx="${SUN.x}" cy="${SUN.y}" r="105" fill="#ffdf85" opacity="0.6"/>
    <circle cx="${SUN.x}" cy="${SUN.y}" r="78" fill="#fff0b8"/>
    <path d="${MOUNTAINS}" fill="#3b1d5e"/>
    ${sea}${glints}
    <g transform="translate(-175 120)" fill="#20123f">
      <path d="M-48 0 H52 L34 24 H-30 Z"/>
      <path d="M0 -6 V-92 L46 -8 Z" fill="#fff6d8"/>
      <path d="M-6 -6 V-74 L-40 -8 Z" fill="#ff8f5a"/>
    </g>
  </g>`
}

/* ---------- Sunwheel: the game ---------- */

const SCRAMBLE_STEP_MS = 110
const BEST_KEY = 'sunwheel.best'
const MUTED_KEY = 'sunwheel.muted'
const SCENE_ID = 'sunwheel-scene'
const BOARDS = Object.fromEntries(LEVELS.map((l) => [l.id, buildBoard(l.radius)]))

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// Draws the game into `root` and returns a function that stops it
function mountSunwheel(root) {
  root.innerHTML = `
    <div class="sw">
      <header class="sw-header">
        <div>
          <h1>Sunwheel</h1>
          <p>Turn the dials to put the sunset back together.</p>
        </div>
        <div class="sw-levels" role="group" aria-label="Board size">
          ${LEVELS.map((l) => `<button type="button" data-level="${l.id}">${l.label}</button>`).join('')}
        </div>
      </header>
      <div class="sw-layout">
        <div class="sw-board">
          <svg role="group" aria-label="Sunwheel puzzle board">
            <defs data-ref="defs"></defs>
            <g data-ref="tiles"></g>
            <g data-ref="dials"></g>
          </svg>
        </div>
        <aside class="sw-panel">
          <div class="sw-result" role="status" hidden>
            <h2 data-ref="resultTitle"></h2>
            <p data-ref="resultText"></p>
            <div class="sw-actions">
              <button type="button" class="is-primary" data-ref="again">Play again</button>
              <button type="button" data-ref="next"></button>
            </div>
          </div>
          <dl class="sw-stats">
            <div><dt>Moves</dt><dd data-ref="moves"></dd></div>
            <div><dt>Par</dt><dd data-ref="par"></dd></div>
            <div><dt>Time</dt><dd data-ref="time"></dd></div>
            <div><dt>Placed</dt><dd data-ref="placed"></dd></div>
            <div class="sw-best"><dt>Best</dt><dd data-ref="best"></dd></div>
          </dl>
          <div class="sw-goal">
            <svg data-ref="goal" role="img" aria-label="The finished picture"></svg>
            <span>Goal</span>
          </div>
          <div class="sw-direction" role="group" aria-label="Turn direction">
            <button type="button" data-direction="1">↻ Clockwise</button>
            <button type="button" data-direction="-1">↺ Counter</button>
          </div>
          <div class="sw-actions">
            <button type="button" data-ref="undo">Undo</button>
            <button type="button" data-ref="hint">Hint</button>
            <button type="button" data-ref="fresh">New</button>
            <button type="button" data-ref="mute"></button>
          </div>
          <p class="sw-help">
            Each dial swaps the three tiles around it and spins them a third of a turn. Right-click
            or Shift-click a dial to turn it the other way. Tiles with a pale outline are in the
            right place.
          </p>
        </aside>
      </div>
    </div>`

  const swEl = root.querySelector('.sw')
  const boardEl = root.querySelector('.sw-board')
  const boardSvg = boardEl.querySelector('svg')
  const resultEl = root.querySelector('.sw-result')
  const levelButtons = [...root.querySelectorAll('[data-level]')]
  const directionButtons = [...root.querySelectorAll('[data-direction]')]
  const ref = Object.fromEntries(
    [...root.querySelectorAll('[data-ref]')].map((el) => [el.dataset.ref, el]),
  )

  let game = null
  let direction = 1
  let hoveredDial = null
  let muted = readStored(MUTED_KEY, false)
  let best = readStored(BEST_KEY, {})
  let newBest = false
  let scrambleTimer = null
  sounds.muted = muted

  const clockTimer = setInterval(() => {
    if (game.startedAt && !game.finishedAt) ref.time.textContent = formatTime(elapsed())
  }, 250)

  function elapsed() {
    if (!game.startedAt) return 0
    return Math.max(0, (game.finishedAt ?? Date.now()) - game.startedAt)
  }

  function currentLevel() {
    return LEVELS.find((l) => l.id === game.levelId)
  }

  function currentBoard() {
    return BOARDS[game.levelId]
  }

  function dialDirection(index) {
    return game.hint?.dial === index ? game.hint.dir : direction
  }

  function applyMove(move) {
    game.tiles = turnDial(game.tiles, currentBoard().dials[move.dial], move.dir)
    game.trail = pushTrail(game.trail, move)
    game.last = move
    game.hint = null
  }

  function startGame(levelId) {
    clearInterval(scrambleTimer)
    const board = BOARDS[levelId]
    const level = LEVELS.find((l) => l.id === levelId)
    const levelChanged = game?.levelId !== levelId

    game = {
      levelId,
      tiles: solvedTiles(board),
      pending: planScramble(board, level.scramble),
      status: 'scrambling',
      trail: [],
      history: [],
      last: null,
      hint: null,
      hintsUsed: 0,
      startedAt: null,
      finishedAt: null,
    }
    newBest = false
    hoveredDial = null

    if (levelChanged) drawBoard()
    render()

    scrambleTimer = setInterval(() => {
      applyMove(game.pending.shift())
      if (game.pending.length === 0) {
        game.status = 'playing'
        clearInterval(scrambleTimer)
      }
      sounds.tick()
      render()
    }, SCRAMBLE_STEP_MS)
  }

  // Everything that only changes with the board size
  function drawBoard() {
    const board = currentBoard()
    const viewBox = `${-board.halfWidth - 8} ${-board.halfHeight - 8} ${board.halfWidth * 2 + 16} ${board.halfHeight * 2 + 16}`
    const sceneScale = (board.halfHeight * 1.04) / 300

    boardSvg.setAttribute('viewBox', viewBox)
    ref.goal.setAttribute('viewBox', viewBox)
    ref.defs.innerHTML = `
      <clipPath id="sunwheel-hex"><polygon points="${HEX_POINTS}"/></clipPath>
      ${sceneMarkup(SCENE_ID, sceneScale)}`
    ref.goal.innerHTML = board.cells
      .map((cell) => `
        <g transform="translate(${cell.x} ${cell.y})">
          <g clip-path="url(#sunwheel-hex)">
            <use href="#${SCENE_ID}" x="${-cell.x}" y="${-cell.y}"/>
          </g>
        </g>`)
      .join('')
    ref.dials.innerHTML = board.dials
      .map((dial, index) => `
        <g class="sw-dial" data-dial="${index}" role="button"
           transform="translate(${dial.x} ${dial.y})">
          <circle class="sw-dial-hit" r="${SIZE * 0.42}"/>
          <g class="sw-dial-face">
            <circle r="11"/>
            <g class="sw-dial-arrow">
              <path d="M-4.33 -2.5 A5 5 0 1 1 2.5 4.33"/>
              <polygon points="-0.1,5.83 3.75,6.5 1.25,2.15"/>
            </g>
          </g>
        </g>`)
      .join('')
  }

  function tileMarkup(position) {
    const board = currentBoard()
    const tile = game.tiles[position]
    const cell = board.cells[position]
    const home = board.cells[tile.home]
    const placed = isInPlace(tile, position) ? ' is-placed' : ''
    return `
      <g class="sw-tile${placed}" data-position="${position}"
         transform="translate(${cell.x} ${cell.y}) rotate(${tile.turns * 120})">
        <g clip-path="url(#sunwheel-hex)">
          <use href="#${SCENE_ID}" x="${-home.x}" y="${-home.y}"/>
        </g>
        <polygon class="sw-tile-edge" points="${HEX_POINTS}"/>
      </g>`
  }

  function drawTiles() {
    const board = currentBoard()
    const swingDial = game.last ? board.dials[game.last.dial] : null
    const swinging = new Set(swingDial?.ring)
    let markup = board.cells
      .map((_, position) => (swinging.has(position) ? '' : tileMarkup(position)))
      .join('')

    // The moved tiles are drawn in their final spots, and the animation swings
    // them in from where they were, pivoting on the dial
    if (swingDial) {
      markup += `
        <g class="sw-swing" style="transform-origin: ${swingDial.x}px ${swingDial.y}px; --sw-from: ${game.last.dir * -120}deg">
          ${swingDial.ring.map(tileMarkup).join('')}
        </g>`
    }
    ref.tiles.innerHTML = markup
    game.last = null
    drawHighlight()
  }

  function drawHighlight() {
    const ring = game.status === 'playing' && hoveredDial !== null
      ? currentBoard().dials[hoveredDial].ring
      : []
    for (const tile of ref.tiles.querySelectorAll('.sw-tile')) {
      tile.classList.toggle('is-highlighted', ring.includes(Number(tile.dataset.position)))
    }
  }

  function drawDials() {
    const playing = game.status === 'playing'
    ref.dials.style.display = game.status === 'won' ? 'none' : ''

    for (const el of ref.dials.children) {
      const index = Number(el.dataset.dial)
      const dir = dialDirection(index)
      el.classList.toggle('is-hint', game.hint?.dial === index)
      el.setAttribute('tabindex', playing ? '0' : '-1')
      el.setAttribute('aria-label', `Dial ${index + 1}, turn ${dir === 1 ? 'clockwise' : 'counterclockwise'}`)
      const arrow = el.querySelector('.sw-dial-arrow')
      if (dir === 1) arrow.removeAttribute('transform')
      else arrow.setAttribute('transform', 'scale(-1 1)')
    }
  }

  function drawPanel() {
    const level = currentLevel()
    const nextLevel = LEVELS[LEVELS.indexOf(level) + 1]
    const playing = game.status === 'playing'
    const won = game.status === 'won'
    const moves = game.history.length
    const levelBest = best[game.levelId]

    swEl.classList.toggle('is-scrambling', game.status === 'scrambling')
    boardEl.classList.toggle('is-won', won)
    for (const button of levelButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.level === game.levelId))
    }
    for (const button of directionButtons) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.direction) === direction))
    }

    ref.moves.textContent = moves
    ref.par.textContent = level.scramble
    ref.time.textContent = formatTime(elapsed())
    ref.placed.textContent = `${game.tiles.filter(isInPlace).length}/${game.tiles.length}`
    ref.best.textContent = levelBest
      ? `${levelBest.moves} moves, ${formatTime(levelBest.time)}`
      : 'Not set yet'

    ref.undo.disabled = !playing || moves === 0
    ref.hint.disabled = !playing || Boolean(game.hint)
    ref.mute.textContent = muted ? 'Sound off' : 'Sound on'
    ref.mute.setAttribute('aria-pressed', String(muted))

    resultEl.hidden = !won
    if (won) {
      const hints = game.hintsUsed
      ref.resultTitle.textContent = newBest ? 'New best!' : 'Picture restored'
      ref.resultText.textContent =
        `${moves} ${moves === 1 ? 'move' : 'moves'} in ${formatTime(elapsed())}` +
        (hints ? ` with ${hints} ${hints === 1 ? 'hint' : 'hints'}` : '')
      ref.next.hidden = !nextLevel
      if (nextLevel) ref.next.textContent = `Try ${nextLevel.label}`
    }
  }

  function render() {
    if (game.last || !ref.tiles.hasChildNodes() || game.status === 'scrambling') drawTiles()
    drawDials()
    drawPanel()
  }

  // Wins that used hints still count, they just can't set a record
  function recordWin() {
    const moves = game.history.length
    const time = elapsed()
    const stored = readStored(BEST_KEY, {})
    const previous = stored[game.levelId]
    const isBetter =
      !previous || moves < previous.moves || (moves === previous.moves && time < previous.time)
    if (game.hintsUsed > 0 || !isBetter) return
    best = { ...stored, [game.levelId]: { moves, time } }
    writeStored(BEST_KEY, best)
    newBest = true
  }

  function turn(dial, dir) {
    if (game.status !== 'playing') return
    const at = Date.now()
    const move = { dial, dir }
    applyMove(move)
    game.history.push(move)
    game.startedAt ??= at

    if (isSolved(game.tiles)) {
      game.status = 'won'
      game.finishedAt = at
      recordWin()
      sounds.victory()
    } else {
      sounds.turn()
    }
    render()
  }

  function undo() {
    const move = game.history.pop()
    if (game.status !== 'playing' || !move) return
    sounds.turn()
    applyMove({ dial: move.dial, dir: -move.dir })
    render()
  }

  function showHint() {
    const top = game.trail.at(-1)
    if (game.status !== 'playing' || !top || game.hint) return
    game.hint = { dial: top.dial, dir: -top.dir }
    game.hintsUsed += 1
    render()
  }

  function setHover(index) {
    hoveredDial = index
    drawHighlight()
  }

  const dialIndex = (event) => {
    const el = event.target.closest('.sw-dial')
    return el ? Number(el.dataset.dial) : null
  }

  ref.dials.addEventListener('click', (event) => {
    const index = dialIndex(event)
    if (index === null) return
    const dir = dialDirection(index)
    turn(index, event.shiftKey ? -dir : dir)
  })
  ref.dials.addEventListener('contextmenu', (event) => {
    const index = dialIndex(event)
    if (index === null) return
    event.preventDefault()
    turn(index, -dialDirection(index))
  })
  ref.dials.addEventListener('keydown', (event) => {
    const index = dialIndex(event)
    if (index === null || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    const dir = dialDirection(index)
    turn(index, event.shiftKey ? -dir : dir)
  })
  ref.dials.addEventListener('pointerover', (event) => setHover(dialIndex(event)))
  ref.dials.addEventListener('pointerleave', () => setHover(null))
  ref.dials.addEventListener('focusin', (event) => setHover(dialIndex(event)))
  ref.dials.addEventListener('focusout', () => setHover(null))

  const startFromClick = (levelId) => {
    sounds.unlock()
    startGame(levelId)
  }

  for (const button of levelButtons) {
    button.addEventListener('click', () => startFromClick(button.dataset.level))
  }
  for (const button of directionButtons) {
    button.addEventListener('click', () => {
      direction = Number(button.dataset.direction)
      render()
    })
  }
  ref.undo.addEventListener('click', undo)
  ref.hint.addEventListener('click', showHint)
  ref.fresh.addEventListener('click', () => startFromClick(game.levelId))
  ref.again.addEventListener('click', () => startFromClick(game.levelId))
  ref.next.addEventListener('click', () => {
    startFromClick(LEVELS[LEVELS.indexOf(currentLevel()) + 1].id)
  })
  ref.mute.addEventListener('click', () => {
    sounds.unlock()
    muted = !muted
    sounds.muted = muted
    writeStored(MUTED_KEY, muted)
    render()
  })

  startGame('small')

  return () => {
    clearInterval(scrambleTimer)
    clearInterval(clockTimer)
  }
}

/* ---------- Site ---------- */

// Every game on the site. Add an entry here and it gets a navbar link, a card
// on the home page, and a page at #/games/<slug>. `mount` draws the game into
// an element and returns a function that stops it.
const GAMES = [
  {
    slug: 'sunwheel',
    title: 'Sunwheel',
    description: 'Turn the dials to swap and spin hexagon tiles until the sunset is whole again.',
    mount: mountSunwheel,
  },
]

const app = document.getElementById('app')
const navLinks = document.getElementById('nav-links')
let stopPage = null

navLinks.innerHTML = GAMES
  .map((game) => `<li><a href="#/games/${game.slug}">${game.title}</a></li>`)
  .join('')

function showHome() {
  document.title = 'Games'
  app.innerHTML = `
    <h1>Games</h1>
    <ul class="game-list">
      ${GAMES.map((game) => `
        <li>
          <a class="game-card" href="#/games/${game.slug}">
            <strong>${game.title}</strong>
            <span>${game.description}</span>
          </a>
        </li>`).join('')}
    </ul>`
}

function showNotFound() {
  document.title = 'Page not found'
  app.innerHTML = '<h1>Page not found</h1><p><a href="#/">Back to all games</a></p>'
}

function route() {
  stopPage?.()
  stopPage = null

  const path = location.hash.slice(1) || '/'
  const game = GAMES.find(({ slug }) => path === `/games/${slug}`)

  if (game) {
    document.title = game.title
    stopPage = game.mount(app)
  } else if (path === '/') {
    showHome()
  } else {
    showNotFound()
  }

  for (const link of navLinks.querySelectorAll('a')) {
    const active = link.getAttribute('href') === `#${path}`
    link.classList.toggle('active', active)
    if (active) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  }
}

addEventListener('hashchange', route)
route()
