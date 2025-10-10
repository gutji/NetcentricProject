# 🚢 Battleship Game - React & Node.js

A real-time multiplayer Battleship game built with React, TypeScript, Node.js, Express, and Socket.IO. Includes a simple admin UI on the server and full LAN play support.

## ✨ Features

### Client
- ✅ Nickname entry and welcome messages
- ✅ Player info display (nickname, score)
- ✅ Ship placement (random placement supported)
- ✅ Hidden ship positions between players
- ✅ Game timer (5 minutes)
- ✅ Hit/Miss indicators and turn updates
- ✅ Realtime connected players list
- ✅ Configurable server URL via env or automatic LAN fallback

### Server
- ✅ Admin UI (connected clients, stats, reset) at port 3001
- ✅ Reset endpoint to wipe all game state
- ✅ Random first player selection
- ✅ Realtime stats and client list broadcasting
- ✅ CORS configured for dev/LAN testing

## Project layout
- `src/components/` – Game UI (`Game.tsx`, `Grid.tsx`, `GameStatus.tsx`, etc.)
- `src/services/socket.ts` – Socket.IO client wrapper (singleton)
- `server/server.js` – Express + Socket.IO game server with admin UI

## Quick start (single machine)

Prerequisites: Node.js 18+

1) Install dependencies
```bash
npm install
npm --prefix server install
```

2) Start the server (default: http://localhost:3001)
```bash
npm --prefix server run dev
```

3) Start the client (default: http://localhost:5173)
```bash
npm run dev
```

Open http://localhost:5173 and play.

## Play over LAN (e.g., from an iPad)

1) Find your Mac’s LAN IP (e.g., `192.168.1.23`).

2) Start the server allowing your LAN client origin (optional but recommended):
```bash
LAN_CLIENT=http://192.168.1.23:5173 npm --prefix server run dev
```

3) Start the Vite dev server so it’s reachable on LAN:
```bash
npm run dev -- --host
```

4) On your iPad, open the client at:
```
http://192.168.1.23:5173
```

The client socket URL resolves automatically to `http://<page-hostname>:3001`. If you need to override it, set `VITE_SOCKET_URL`.

## Configuration

Client (Vite):
- `VITE_SOCKET_URL` – Full Socket.IO server URL. Example: `http://192.168.1.23:3001`
  - Put it in `.env` at the project root or pass via CLI/env when running `npm run dev`.
  - If not set, the client falls back to `window.location.hostname:3001`.

Server:
- `PORT` – Defaults to `3001`
- `HOST` – Defaults to `0.0.0.0` (listens on all interfaces)
- `LAN_CLIENT` – Allowed client origin for CORS in addition to localhost (e.g., `http://192.168.1.23:5173`). In dev, CORS is permissive.

## Socket events

Client → Server:
- `setNickname(nickname)`
- `joinQueue()`
- `shipsPlaced(board)`
- `fire({ row, col })`

Server → Client:
- `clientsInfo` – Current connected clients
- `nicknameSet` – Your nickname confirmed (includes your clientId)
- `waiting` – You’re queued, waiting for opponent
- `gameStart` – Game room info, players, first player, timer
- `opponentReady` / `allPlayersReady`
- `yourTurn` / `opponentTurn`
- `fireResult` – Hit/miss and which grid to update
- `gameOver` – Result info (win/loss/timeout)
- `timerUpdate` – Remaining game time
- `opponentDisconnected`
- `serverReset`

## Available scripts
- `npm run dev` – Start Vite dev server
- `npm run build` – Type-check and build
- `npm run preview` – Preview production build
- `npm run lint` – ESLint
- `npm --prefix server run dev` – Start server with nodemon (watch)
- `npm --prefix server start` – Start server (node)

## Troubleshooting (LAN/iPad)
- Make sure both devices are on the same Wi‑Fi and not on a guest network with AP isolation.
- On macOS, allow incoming connections for Node/Vite (System Settings → Network → Firewall).
- Access the client using the Mac’s LAN IP: `http://<MAC_LAN_IP>:5173`.
- If the socket fails to connect, set `VITE_SOCKET_URL` to `http://<MAC_LAN_IP>:3001` explicitly and reload.
- Confirm the server is reachable from iPad: open `http://<MAC_LAN_IP>:3001` in Safari (you should see the admin UI).
- If you need strict CORS in dev, set `LAN_CLIENT=http://<MAC_LAN_IP>:5173` when starting the server.

## Technology stack
- React 19, TypeScript, Vite 7
- Socket.IO (client/server)
- Express, CORS

## Production build
```bash
npm run build
```
Serve the `dist` folder with any static web server and point the socket to your production server via `VITE_SOCKET_URL`.
