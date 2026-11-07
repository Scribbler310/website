# Website

A website with a React frontend and a Node.js (Express) API.

## Getting started

You need [Node.js](https://nodejs.org) 22 or newer and [Git](https://git-scm.com).

```sh
git clone https://github.com/Scribbler310/website.git
cd website
npm install
npm run dev
```

Then open http://localhost:5173. You should see "Hello from the API", which means the frontend and API are talking to each other.

## Project layout

| Folder    | What's in it                               | Runs on               |
| --------- | ------------------------------------------ | --------------------- |
| `client/` | The React app, built with Vite             | http://localhost:5173 |
| `server/` | The Express API. All routes start `/api/`  | http://localhost:3001 |

During development, Vite forwards any request starting with `/api` to the server, so the frontend can call `fetch('/api/hello')` directly.

## Commands

Run these from the project root.

| Command         | What it does                              |
| --------------- | ----------------------------------------- |
| `npm run dev`   | Starts the client and server together     |
| `npm test`      | Runs the server tests                     |
| `npm run lint`  | Checks the client code for problems       |
| `npm run build` | Builds the client into `client/dist`      |

## Local settings

To change server settings, copy `server/.env.example` to `server/.env` and edit it. Never commit `.env` files or put passwords and API keys in the code, because this repository is public.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
