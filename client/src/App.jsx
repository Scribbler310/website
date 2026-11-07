import { useEffect, useState } from 'react'

function App() {
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
    <main>
      <h1>Website</h1>
      <p>{message}</p>
    </main>
  )
}

export default App
