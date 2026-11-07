// Game rules for Sunwheel. No React here, so the logic stays easy to test.

export const SIZE = 50 // Hexagon radius in SVG units

export const LEVELS = [
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

export const HEX_POINTS = hexCorners(0, 0)
  .map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`)
  .join(' ')

// Lays out a hexagon of hexagons. A dial sits on every point where exactly
// three cells meet, and `ring` lists those cells in clockwise order.
export function buildBoard(radius) {
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
export function solvedTiles(board) {
  return board.cells.map((_, index) => ({ home: index, turns: 0 }))
}

export function isInPlace(tile, position) {
  return tile.home === position && tile.turns === 0
}

export function isSolved(tiles) {
  return tiles.every(isInPlace)
}

// dir is 1 for clockwise and -1 for counterclockwise
export function turnDial(tiles, dial, dir) {
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
export function planScramble(board, count, random = Math.random) {
  for (;;) {
    const plan = []
    let tiles = solvedTiles(board)
    while (plan.length < count) {
      const dial = Math.floor(random() * board.dials.length)
      if (dial === plan.at(-1)?.dial) continue
      const dir = random() < 0.5 ? 1 : -1
      plan.push({ dial, dir })
      tiles = turnDial(tiles, board.dials[dial], dir)
    }
    if (!isSolved(tiles)) return plan
  }
}

// The moves that lead back to solved. Undoing the top entry always gets one
// step closer, which is what makes hints possible without a solver.
export function pushTrail(trail, move) {
  const top = trail.at(-1)
  if (top && top.dial === move.dial && top.dir === -move.dir) return trail.slice(0, -1)
  return [...trail, move]
}
