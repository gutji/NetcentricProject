# 🚢 Battleship (Classic & Blitz) – React + TypeScript + Node + Socket.IO

Real‑time multiplayer Battleship with two modes (Classic & Blitz), power‑ups, pause/resume, head‑to‑head tracking, an admin dashboard, and mobile‑friendly ship placement. Frontend runs on Vite/React; backend is an Express + Socket.IO server with a lightweight admin UI.

## 🌟 Feature Highlights

### Core Gameplay
- Classic turn‑based Battleship: alternate shots, 10s turn timer (auto passes when it hits 0).
- Blitz mode: hit chaining (keep the turn on a hit), plus one‑time power‑ups per player.
- Ship placement with touch support (tap to select/place; dedicated rotate button).
- Hidden ships; real‑time hit/miss feedback with sound effects.
- Automatic win detection & game over modal (includes head‑to‑head record vs opponent).
- Rematch flow prefers last winner to start first when same pair meet again.

### Blitz Power‑Ups (once per player per match)
| Power‑Up | Action | Effect | Consumes Turn | Special |
|----------|--------|--------|---------------|---------|
| Cannons  | 2x2 multi-shot | Fires at 4 cells; can win immediately | Yes | Chaining applies if any hit & defender not protected |
| Scan     | 3x3 intel | Returns count of ship segments (no reveal) | Yes | Shows temporary overlay & pill |
| Protect  | Defense | Prevents Blitz hit chaining once | Yes | Consumed after opponent’s next completed action |

Rule: One action per turn (normal shot OR one power‑up). Server enforces all constraints.

### Competitive & Session
- Head‑to‑head win counts per opponent (stored & displayed).
- Score tracking (wins increment your score; forfeit/disconnect awards opponent a win).
- Automatic nickname persistence (localStorage) across mode switches.

### UX & Interface
- Collapsible in‑match chat (Blitz only) with unread badge when closed.
- Pause modal with dual resume confirmation (both must press Resume).
- Settings modal (themes, avatar, mute, how‑to‑play).
- Mode badge + lobby/waiting mode indicators.
- Scan overlay + hover previews (2x2 for Cannons, 3x3 for Scan) for precise targeting.

### Admin & Server Ops
- Admin dashboard (served from the server root) showing live stats (active games, players, modes).
- `POST /api/reset` resets entire server state and notifies clients.
- Real‑time stats diff pushed to admin namespace (`/admin`).

## 🧱 Architecture Overview

```
frontend (Vite, React, TS)            backend (Express + Socket.IO)
┌──────────────────────────┐         ┌────────────────────────────┐
│ App.tsx                  │  HTTP   │ server.js                  │
│  ├─ ModeMenu             │ <-----> │  REST: /api/stats /api/reset│
│  ├─ Game (classic/blitz) │         │  Socket events (room/game) │
│  └─ Settings / Chat etc. │         │  Admin namespace (/admin)  │
└──────────────────────────┘         └────────────────────────────┘
```

### Key Frontend Components
- `App.tsx`: Mode selection, global settings, nickname persistence.
- `Game.tsx`: Phases, boards, power‑ups, turn logic, overlays, pause/rematch.
- `Grid.tsx`: Board rendering + hover highlighting.
- `ShipPlacement.tsx`: Interactive placement (desktop + touch).
- `GameStatus.tsx`: Timer, player scores, whose turn, pause control.
- `Chat.tsx`: Collapsible Blitz chat widget.
- `SettingsModal.tsx` / `HowToPlayModal.tsx`: Preferences & help.

### Backend Game Data (per game)
- `players[]`: two client objects with boards & sockets.
- `currentTurn`: player id whose turn it is.
- `gameTimer`: remaining seconds (10 → 0 loops).
- `powerUpsUsed[playerId]`: usage flags.
- `protectNextTurn[playerId]`: protection against hit chaining.
- `paused`, `resumeVotes`, `mode`.

## 🔌 Socket Event Summary

Client → Server:
- `setNickname(nickname)`
- `joinQueue({ mode })`
- `shipsPlaced(board)`
- `fire({ row, col })`
- `usePowerUp({ type, row?, col? })`
- `pauseGame()` / `resumeGame()` / `forfeit()`
- `sendChatMessage({ message })` (Blitz only)

Server → Client (selected):
- `nicknameSet`, `clientsInfo`
- `waiting`, `gameStart`, `opponentReady`, `allPlayersReady`
- `yourTurn`, `opponentTurn`, `timerUpdate`
- `fireResult({ row, col, result, isOwnGrid })`
- `scanResult({ row, col, count })`
- `gamePaused`, `resumeVoteUpdate`, `gameResumed`
- `gameOver({ result })`, `opponentDisconnected`, `serverReset`
- `chatMessage`

## 🕹️ Game Flow
1. Nickname (auto‑restored if previously set) → Lobby.
2. Join queue (mode specific). If a peer waits, a game starts (first turn selected—recent winner preferred if rematch pair).
3. Both place ships → Playing begins; timer starts for first player.
4. Turns: Classic alternates; Blitz may chain on hits (unless Protect active). Timer auto passes on expiry.
5. Power‑ups: Use once; server validates; some switch turn immediately.
6. Win: All opponent ship segments hit → game over modal & stats update.
7. Rematch or return lobby resets local state appropriately.

## 🧪 Local Development

Clone and install:
```bash
git clone <repo-url>
cd NetcentricProject
npm install
cd server && npm install && cd ..
```

Run both:
```bash
# Frontend (root)
npm run dev

# Backend (in /server, separate terminal)
npm run dev
```

Defaults:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001 (Socket.IO + admin UI)

Set the frontend to use the local server automatically (it resolves host:3001). To override, export `VITE_SOCKET_URL`.

## 🌍 Deployment Strategy

Because Socket.IO with long‑lived WebSockets isn’t ideal on serverless edge runtimes, deploy as two services:
1. **Backend**: Render / Railway / Fly.io (Node process). Set env:
   - `NODE_ENV=production`
   - `LAN_CLIENT=https://your-frontend-domain`
2. **Frontend**: Vercel (static build via `npm run build`). Set env:
   - `VITE_SOCKET_URL=https://your-backend-domain`

Build frontend:
```bash
npm run build
```
Output in `dist/` is static deployable.

## 🔐 Environment Variables
| Variable | Where | Purpose |
|----------|-------|---------|
| VITE_SOCKET_URL | Frontend | Override auto host:3001 for Socket.IO endpoint |
| LAN_CLIENT | Backend | Allowed origin for CORS in production |
| PORT | Backend | Listening port (platform provided) |

## 🧠 Blitz Power‑Up Logic (Server Enforcement)
- Validate: mode === 'blitz', player turn, not paused, not already used.
- `scan`: count 'S' in bounded 3x3 → emit result only to requester → turn passes.
- `protect`: set defender’s `protectNextTurn` → turn passes.
- `cannons`: 2x2 multi-shot → emit each cell’s `fireResult`; if any hit & defender not protected → chaining keeps turn; else turn passes (consuming protection if active).
- Protection consumption: cleared after a defended action completes when it blocked chaining.

## 🛠 Scripts
| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server (frontend) |
| `npm run build` | TypeScript build + Vite production bundle |
| `npm run preview` | Preview built frontend |
| `npm run lint` | ESLint code quality |
| `npm run dev` (server/) | Nodemon backend hot reload |
| `npm start` (server/) | Production start backend |

## 📁 Project Layout
```
root/
  src/                # React source
  server/             # Express + Socket.IO server
  public/             # Frontend static assets
  dist/               # Build output (after npm run build)
```

## 🚨 Troubleshooting
- Import errors (e.g., missing `GameBlitz.tsx`): Ensure component exists or switch to using `<Game mode="blitz" />` directly.
- CORS issues: Confirm `LAN_CLIENT` matches deployed frontend origin exactly (including protocol).
- Socket not connecting on mobile LAN: Set `VITE_SOCKET_URL` explicitly to the backend’s IP:PORT.
- Stuck on “Setting nickname…”: Backend not reachable; check server log and env URL.

## 🧩 Possible Next Enhancements
- Spectator mode.
- Persistence (DB) for long‑term H2H stats.
- Ranked matchmaking / ELO.
- Multi‑ship placement randomization or manual drag rotate on desktop.
- Replay log or analytics view.

## 📄 License
Add a license file (e.g., MIT) if distributing publicly.

---
Enjoy sinking ships! Contributions and feature ideas are welcome.