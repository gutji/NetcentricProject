# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

# React Battleship Game

A real-time multiplayer Battleship game built with React, TypeScript, Vite, and Socket.IO.

## Features

- **Real-time multiplayer gameplay** using Socket.IO
- **Modern React architecture** with TypeScript
- **Component-based design** for maintainable code
- **Responsive UI** that works on desktop and mobile
- **Fast development** with Vite hot module replacement

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
