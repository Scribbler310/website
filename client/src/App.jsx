import { Suspense } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router'
import { games } from './games/index.js'
import Home from './pages/Home.jsx'

function NotFound() {
  return (
    <>
      <title>Page not found</title>
      <h1>Page not found</h1>
      <p>
        <Link to="/">Back to all games</Link>
      </p>
    </>
  )
}

function App() {
  return (
    <>
      <nav className="navbar" aria-label="Main">
        <Link to="/" className="navbar-brand">
          Games
        </Link>
        <ul>
          {games.map((game) => (
            <li key={game.slug}>
              <NavLink to={`/games/${game.slug}`}>{game.title}</NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <main>
        <Suspense fallback={<p>Loading...</p>}>
          <Routes>
            <Route path="/" element={<Home />} />
            {games.map(({ slug, Component }) => (
              <Route key={slug} path={`/games/${slug}`} element={<Component />} />
            ))}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
    </>
  )
}

export default App
