import { useState, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import Game from './components/Game'
import './App.css'

interface GameState {
  connected: boolean
  waiting: boolean
  gameStarted: boolean
  gameId?: string
}

function App() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [gameState, setGameState] = useState<GameState>({
    connected: false,
    waiting: false,
    gameStarted: false
  })

  useEffect(() => {
    // Connect to server (adjust URL as needed)
    const newSocket = io('http://localhost:3000')
    setSocket(newSocket)

    newSocket.on('connect', () => {
      setGameState(prev => ({ ...prev, connected: true }))
    })

    newSocket.on('waiting', () => {
      setGameState(prev => ({ ...prev, waiting: true }))
    })

    newSocket.on('gameStart', (data: { gameId: string }) => {
      setGameState(prev => ({ 
        ...prev, 
        waiting: false, 
        gameStarted: true, 
        gameId: data.gameId 
      }))
    })

    newSocket.on('disconnect', () => {
      setGameState(prev => ({ ...prev, connected: false }))
    })

    return () => {
      newSocket.close()
    }
  }, [])

  if (!gameState.connected) {
    return (
      <div className="app">
        <h1>Online Battleship</h1>
        <p>Connecting to server...</p>
      </div>
    )
  }

  if (gameState.waiting) {
    return (
      <div className="app">
        <h1>Online Battleship</h1>
        <p>Waiting for an opponent to join...</p>
      </div>
    )
  }

  if (gameState.gameStarted && socket) {
    return (
      <div className="app">
        <h1>Online Battleship</h1>
        <Game socket={socket} />
      </div>
    )
  }

  return (
    <div className="app">
      <h1>Online Battleship</h1>
      <p>Getting ready...</p>
    </div>
  )
}

export default App
