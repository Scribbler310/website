import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { games } from '../games/index.js'

export default function Home() {
  const [message, setMessage] = useState('Loading...')

  useEffect(() => {
    fetch('/api/hello')
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        return res.json()
      })
      .then((data) => setMessage(data.message))
      .catch(() => setMessage('Could not reach the API. Is the server running?'))
  }, [])

  return (
    <>
      <title>Games</title>
      <h1>Games</h1>
      <ul className="game-list">
        {games.map((game) => (
          <li key={game.slug}>
            <Link to={`/games/${game.slug}`} className="game-card">
              <strong>{game.title}</strong>
              <span>{game.description}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="api-status">{message}</p>
    </>
  )
}
