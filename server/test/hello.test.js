import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { app } from '../src/app.js'

let server
let baseUrl

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve)
  })
  baseUrl = `http://localhost:${server.address().port}`
})

after(() => {
  server.close()
})

test('GET /api/hello returns a message', async () => {
  const res = await fetch(`${baseUrl}/api/hello`)

  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { message: 'Hello from the API' })
})
