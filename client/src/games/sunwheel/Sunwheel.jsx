import { useEffect, useReducer, useState } from 'react'
import { sounds } from './audio.js'
import {
  HEX_POINTS,
  LEVELS,
  SIZE,
  buildBoard,
  isInPlace,
  isSolved,
  planScramble,
  pushTrail,
  solvedTiles,
  turnDial,
} from './board.js'
import Scene from './Scene.jsx'
import './sunwheel.css'

const SCRAMBLE_STEP_MS = 110
const BEST_KEY = 'sunwheel.best'
const MUTED_KEY = 'sunwheel.muted'
const SCENE_ID = 'sunwheel-scene'

const BOARDS = Object.fromEntries(LEVELS.map((l) => [l.id, buildBoard(l.radius)]))

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

function newGame({ levelId, round }) {
  const board = BOARDS[levelId]
  const level = LEVELS.find((l) => l.id === levelId)
  return {
    levelId,
    round,
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
}

function applyMove(state, move) {
  return {
    ...state,
    tiles: turnDial(state.tiles, BOARDS[state.levelId].dials[move.dial], move.dir),
    trail: pushTrail(state.trail, move),
    last: { ...move, id: (state.last?.id ?? 0) + 1 },
    hint: null,
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'new':
      return newGame({ levelId: action.levelId, round: state.round + 1 })

    case 'scramble-step': {
      if (state.status !== 'scrambling') return state
      const [move, ...pending] = state.pending
      const next = applyMove(state, move)
      return { ...next, pending, status: pending.length ? 'scrambling' : 'playing' }
    }

    case 'turn': {
      if (state.status !== 'playing') return state
      const next = applyMove(state, action.move)
      const won = isSolved(next.tiles)
      return {
        ...next,
        history: [...state.history, action.move],
        startedAt: state.startedAt ?? action.at,
        status: won ? 'won' : 'playing',
        finishedAt: won ? action.at : null,
      }
    }

    case 'undo': {
      const move = state.history.at(-1)
      if (state.status !== 'playing' || !move) return state
      const next = applyMove(state, { dial: move.dial, dir: -move.dir })
      return { ...next, history: state.history.slice(0, -1) }
    }

    case 'hint': {
      const top = state.trail.at(-1)
      if (state.status !== 'playing' || !top || state.hint) return state
      return {
        ...state,
        hint: { dial: top.dial, dir: -top.dir },
        hintsUsed: state.hintsUsed + 1,
      }
    }

    default:
      return state
  }
}

function useElapsed(startedAt, finishedAt) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!startedAt || finishedAt) return undefined
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [startedAt, finishedAt])

  if (!startedAt) return 0
  return Math.max(0, (finishedAt ?? now) - startedAt)
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function Tile({ tile, cell, home, position, highlighted }) {
  const classes = ['sw-tile']
  if (isInPlace(tile, position)) classes.push('is-placed')
  if (highlighted) classes.push('is-highlighted')

  return (
    <g
      className={classes.join(' ')}
      transform={`translate(${cell.x} ${cell.y}) rotate(${tile.turns * 120})`}
    >
      <g clipPath="url(#sunwheel-hex)">
        <use href={`#${SCENE_ID}`} x={-home.x} y={-home.y} />
      </g>
      <polygon className="sw-tile-edge" points={HEX_POINTS} />
    </g>
  )
}

function Dial({ index, dial, dir, hinted, disabled, onTurn, onHover }) {
  const reverse = (event) => {
    event.preventDefault()
    onTurn(index, -dir)
  }

  return (
    <g
      className={`sw-dial${hinted ? ' is-hint' : ''}`}
      transform={`translate(${dial.x} ${dial.y})`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`Dial ${index + 1}, turn ${dir === 1 ? 'clockwise' : 'counterclockwise'}`}
      onClick={(event) => onTurn(index, event.shiftKey ? -dir : dir)}
      onContextMenu={reverse}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onTurn(index, event.shiftKey ? -dir : dir)
      }}
      onPointerEnter={() => onHover(index)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(index)}
      onBlur={() => onHover(null)}
    >
      <circle className="sw-dial-hit" r={SIZE * 0.42} />
      <g className="sw-dial-face">
        <circle r="11" />
        <g transform={dir === 1 ? undefined : 'scale(-1 1)'}>
          <path d="M-4.33 -2.5 A5 5 0 1 1 2.5 4.33" />
          <polygon points="-0.1,5.83 3.75,6.5 1.25,2.15" />
        </g>
      </g>
    </g>
  )
}

export default function Sunwheel() {
  const [state, dispatch] = useReducer(reducer, { levelId: 'small', round: 0 }, newGame)
  const [direction, setDirection] = useState(1)
  const [hoveredDial, setHoveredDial] = useState(null)
  const [muted, setMuted] = useState(() => readStored(MUTED_KEY, false))
  const [best, setBest] = useState(() => readStored(BEST_KEY, {}))
  const [newBest, setNewBest] = useState(false)

  const { levelId, tiles, status, last, hint, history } = state
  const level = LEVELS.find((l) => l.id === levelId)
  const levelIndex = LEVELS.indexOf(level)
  const nextLevel = LEVELS[levelIndex + 1]
  const board = BOARDS[levelId]

  const elapsed = useElapsed(state.startedAt, state.finishedAt)
  const playing = status === 'playing'
  const won = status === 'won'
  const placed = tiles.filter(isInPlace).length

  useEffect(() => {
    if (status !== 'scrambling') return undefined
    const timer = setInterval(() => {
      dispatch({ type: 'scramble-step' })
      sounds.tick()
    }, SCRAMBLE_STEP_MS)
    return () => clearInterval(timer)
  }, [status, state.round])

  useEffect(() => {
    sounds.muted = muted
  }, [muted])

  const startGame = (id) => {
    sounds.unlock()
    setNewBest(false)
    setHoveredDial(null)
    dispatch({ type: 'new', levelId: id })
  }

  // Wins that used hints still count, they just can't set a record
  const recordWin = (time) => {
    const moves = history.length + 1
    const stored = readStored(BEST_KEY, {})
    const previous = stored[levelId]
    const isBetter =
      !previous || moves < previous.moves || (moves === previous.moves && time < previous.time)
    if (state.hintsUsed > 0 || !isBetter) return
    const updated = { ...stored, [levelId]: { moves, time } }
    writeStored(BEST_KEY, updated)
    setBest(updated)
    setNewBest(true)
  }

  const turn = (dial, dir) => {
    if (!playing) return
    const at = Date.now()
    if (isSolved(turnDial(tiles, board.dials[dial], dir))) {
      sounds.victory()
      recordWin(at - (state.startedAt ?? at))
    } else {
      sounds.turn()
    }
    dispatch({ type: 'turn', move: { dial, dir }, at })
  }

  const undo = () => {
    sounds.turn()
    dispatch({ type: 'undo' })
  }

  const toggleMuted = () => {
    setMuted(!muted)
    writeStored(MUTED_KEY, !muted)
  }

  const swingDial = last ? board.dials[last.dial] : null
  const swinging = new Set(swingDial?.ring)
  const highlighted = new Set(
    playing && hoveredDial !== null ? board.dials[hoveredDial].ring : [],
  )
  const viewBox = `${-board.halfWidth - 8} ${-board.halfHeight - 8} ${
    board.halfWidth * 2 + 16
  } ${board.halfHeight * 2 + 16}`
  const sceneScale = (board.halfHeight * 1.04) / 300

  const renderTile = (position) => (
    <Tile
      key={position}
      tile={tiles[position]}
      cell={board.cells[position]}
      home={board.cells[tiles[position].home]}
      position={position}
      highlighted={highlighted.has(position)}
    />
  )

  const levelBest = best[levelId]

  return (
    <div className={`sw${status === 'scrambling' ? ' is-scrambling' : ''}`}>
      <title>Sunwheel</title>

      <header className="sw-header">
        <div>
          <h1>Sunwheel</h1>
          <p>Turn the dials to put the sunset back together.</p>
        </div>
        <div className="sw-levels" role="group" aria-label="Board size">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={l.id === levelId}
              onClick={() => startGame(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </header>

      <div className="sw-layout">
        <div className={`sw-board${won ? ' is-won' : ''}`}>
          <svg viewBox={viewBox} role="group" aria-label="Sunwheel puzzle board">
            <defs>
              <clipPath id="sunwheel-hex">
                <polygon points={HEX_POINTS} />
              </clipPath>
              <Scene id={SCENE_ID} scale={sceneScale} />
            </defs>

            {board.cells.map((_, position) =>
              swinging.has(position) ? null : renderTile(position),
            )}

            {swingDial && (
              <g
                key={last.id}
                className="sw-swing"
                style={{
                  transformOrigin: `${swingDial.x}px ${swingDial.y}px`,
                  '--sw-from': `${last.dir * -120}deg`,
                }}
              >
                {swingDial.ring.map(renderTile)}
              </g>
            )}

            {!won &&
              board.dials.map((dial, index) => (
                <Dial
                  key={index}
                  index={index}
                  dial={dial}
                  dir={hint?.dial === index ? hint.dir : direction}
                  hinted={hint?.dial === index}
                  disabled={!playing}
                  onTurn={turn}
                  onHover={setHoveredDial}
                />
              ))}
          </svg>
        </div>

        <aside className="sw-panel">
          {won && (
            <div className="sw-result" role="status">
              <h2>{newBest ? 'New best!' : 'Picture restored'}</h2>
              <p>
                {history.length} {history.length === 1 ? 'move' : 'moves'} in{' '}
                {formatTime(elapsed)}
                {state.hintsUsed > 0 &&
                  ` with ${state.hintsUsed} ${state.hintsUsed === 1 ? 'hint' : 'hints'}`}
              </p>
              <div className="sw-actions">
                <button type="button" className="is-primary" onClick={() => startGame(levelId)}>
                  Play again
                </button>
                {nextLevel && (
                  <button type="button" onClick={() => startGame(nextLevel.id)}>
                    Try {nextLevel.label}
                  </button>
                )}
              </div>
            </div>
          )}

          <dl className="sw-stats">
            <div>
              <dt>Moves</dt>
              <dd>{history.length}</dd>
            </div>
            <div>
              <dt>Par</dt>
              <dd>{level.scramble}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{formatTime(elapsed)}</dd>
            </div>
            <div>
              <dt>Placed</dt>
              <dd>
                {placed}/{tiles.length}
              </dd>
            </div>
            <div className="sw-best">
              <dt>Best</dt>
              <dd>
                {levelBest
                  ? `${levelBest.moves} moves, ${formatTime(levelBest.time)}`
                  : 'Not set yet'}
              </dd>
            </div>
          </dl>

          <div className="sw-goal">
            <svg viewBox={viewBox} aria-label="The finished picture" role="img">
              {board.cells.map((cell, index) => (
                <g key={index} transform={`translate(${cell.x} ${cell.y})`}>
                  <g clipPath="url(#sunwheel-hex)">
                    <use href={`#${SCENE_ID}`} x={-cell.x} y={-cell.y} />
                  </g>
                </g>
              ))}
            </svg>
            <span>Goal</span>
          </div>

          <div className="sw-direction" role="group" aria-label="Turn direction">
            <button type="button" aria-pressed={direction === 1} onClick={() => setDirection(1)}>
              ↻ Clockwise
            </button>
            <button type="button" aria-pressed={direction === -1} onClick={() => setDirection(-1)}>
              ↺ Counter
            </button>
          </div>

          <div className="sw-actions">
            <button type="button" onClick={undo} disabled={!playing || history.length === 0}>
              Undo
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'hint' })}
              disabled={!playing || Boolean(hint)}
            >
              Hint
            </button>
            <button type="button" onClick={() => startGame(levelId)}>
              New
            </button>
            <button type="button" aria-pressed={muted} onClick={toggleMuted}>
              {muted ? 'Sound off' : 'Sound on'}
            </button>
          </div>

          <p className="sw-help">
            Each dial swaps the three tiles around it and spins them a third of a turn. Right-click
            or Shift-click a dial to turn it the other way. Tiles with a pale outline are in the
            right place.
          </p>
        </aside>
      </div>
    </div>
  )
}
