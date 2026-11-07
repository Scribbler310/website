// The picture players restore, drawn in code on a 600 x 600 canvas centred on
// (0, 0). Stripes and rays run across the whole picture so that a rotated tile
// is noticeable wherever it lands.

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

function wave(y, height, phase) {
  let path = `M${-EDGE} ${EDGE} L${-EDGE} ${y}`
  for (let x = -EDGE; x <= EDGE; x += 20) {
    path += ` L${x} ${(y + height * Math.sin(x / 34 + phase)).toFixed(1)}`
  }
  return `${path} L${EDGE} ${EDGE} Z`
}

function ray(index, count) {
  const width = Math.PI / count
  const angle = index * 2 * width
  const point = (a) =>
    `${(SUN.x + 700 * Math.cos(a)).toFixed(1)},${(SUN.y + 700 * Math.sin(a)).toFixed(1)}`
  return `${SUN.x},${SUN.y} ${point(angle)} ${point(angle + width)}`
}

export default function Scene({ id, scale }) {
  const bandHeight = (EDGE + HORIZON) / SKY.length

  return (
    <g id={id} transform={`scale(${scale})`}>
      {SKY.map((color, i) => (
        <rect
          key={color}
          x={-EDGE}
          y={-EDGE + i * bandHeight}
          width={EDGE * 2}
          height={bandHeight + 1}
          fill={color}
        />
      ))}

      {Array.from({ length: 16 }, (_, i) => (
        <polygon key={i} points={ray(i, 16)} fill="#fff3c4" opacity="0.13" />
      ))}

      {STARS.map(([x, y]) => (
        <circle key={`${x}:${y}`} cx={x} cy={y} r="4" fill="#fff6d8" />
      ))}

      <circle cx={SUN.x} cy={SUN.y} r="135" fill="#ffd166" opacity="0.35" />
      <circle cx={SUN.x} cy={SUN.y} r="105" fill="#ffdf85" opacity="0.6" />
      <circle cx={SUN.x} cy={SUN.y} r="78" fill="#fff0b8" />

      <path d={MOUNTAINS} fill="#3b1d5e" />

      {SEA.map((color, i) => (
        <path key={color} d={wave(HORIZON + i * 40, 7 + i, i * 1.7)} fill={color} />
      ))}

      {[0, 1, 2, 3, 4].map((i) => (
        <rect
          key={i}
          x={SUN.x - 62 + i * 9}
          y={HORIZON + 14 + i * 34}
          width={124 - i * 18}
          height="9"
          rx="4.5"
          fill="#fff0b8"
          opacity={0.8 - i * 0.12}
        />
      ))}

      <g transform="translate(-175 120)" fill="#20123f">
        <path d="M-48 0 H52 L34 24 H-30 Z" />
        <path d="M0 -6 V-92 L46 -8 Z" fill="#fff6d8" />
        <path d="M-6 -6 V-74 L-40 -8 Z" fill="#ff8f5a" />
      </g>
    </g>
  )
}
