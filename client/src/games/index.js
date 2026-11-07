import { lazy } from 'react'

// Every game on the site. Add an entry here and it gets a navbar link, a card
// on the home page, and a page at /games/<slug>.
export const games = [
  {
    slug: 'sunwheel',
    title: 'Sunwheel',
    description: 'Turn the dials to swap and spin hexagon tiles until the sunset is whole again.',
    Component: lazy(() => import('./sunwheel/Sunwheel.jsx')),
  },
]
