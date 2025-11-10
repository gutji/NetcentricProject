# 🚢 Battleship Game - React & Node.js

A real-time multiplayer Battleship game built with React, TypeScript, Node.js, Express, and Socket.IO. This implementation includes all the features specified in the requirements.

## ✨ Features Implemented

### Client Features
- ✅ **Nickname Entry**: Players can enter a nickname when the game starts
- ✅ **Welcome Message**: Welcome message appears on game start
- ✅ **Player Info Display**: Nickname and score are displayed
- ✅ **Ship Placement UI**: Grid interface with automatic ship placement
- ✅ **Hidden Ship Positions**: Players cannot see each other's ship positions
- ✅ **Game Timer**: Countdown timer (5 minutes per game)
- ✅ **Hit/Miss Indicators**: Visual feedback for attack results
- ✅ **Score System**: Points awarded when ships are destroyed
- ✅ **Connected Clients Info**: View other connected players
- ✅ **Predefined Server Connection**: Server IP and port are hardcoded

### Server Features
- ✅ **Admin UI**: Server interface showing concurrent clients
- ✅ **Reset Functionality**: Button to reset all game state and scores
- ✅ **Random First Player**: Server randomly selects who goes first
- ✅ **Client Management**: Track and display connected clients
- ✅ **Real-time Updates**: Live statistics and game state

## Architecture

### Frontend (React + TypeScript)
- **App.tsx** - Main application component handling connection states
- **Game.tsx** - Core game logic and state management
- **Grid.tsx** - Reusable grid component for both player and opponent boards
- **GameStatus.tsx** - Status message display component
- **PlayerControls.tsx** - Ship placement and ready controls

### Backend Requirements
This frontend connects to a Socket.IO server. You'll need a backend server running on `http://localhost:3000` with the following events:

- `connect` - Player connection
- `waiting` - Waiting for opponent
- `gameStart` - Game begins
- `shipsPlaced` - Player ready with ship placement
- `fire` - Player attacks coordinates
- `fireResult` - Hit/miss results
- `yourTurn`/`opponentTurn` - Turn management
- `gameOver` - Game completion
- `opponentDisconnected` - Opponent leaves

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:5173`

### Backend Setup
You'll need to run a compatible Socket.IO server on port 3000. See the original Node.js server implementation for reference.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Game Rules

1. **Ship Placement**: Ships are pre-placed in a fixed pattern
2. **Turn-based Combat**: Players alternate firing at opponent's grid
3. **Hit/Miss Feedback**: Visual indicators for successful hits and misses
4. **Win Condition**: Sink all opponent ships to win

## Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Socket.IO Client** - Real-time communication
- **CSS** - Component styling

## Development

The project uses modern React patterns:
- Function components with hooks
- TypeScript for type safety
- Clean component separation
- Responsive CSS Grid layout

## Deployment

Build the project for production:
```bash
npm run build
```

The `dist` folder contains the production-ready files that can be served by any static web server.

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
