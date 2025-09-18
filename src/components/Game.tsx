import { useState, useEffect } from 'react'
import { Socket } from 'socket.io-client'
import Grid from './Grid'
import GameStatus from './GameStatus'
import PlayerControls from './PlayerControls'
import './Game.css'

type CellState = 'S' | 'W' | 'H' | 'M'
type GameBoard = CellState[][]

interface GameProps {
  socket: Socket
}

interface FireResult {
  row: number
  col: number
  result: 'hit' | 'miss'
  isOwnGrid: boolean
}

interface GameOverData {
  result: 'win' | 'loss'
}

const INITIAL_BOARD: GameBoard = [
  ['S','S','S','S','S','W','W','W','W','W'],
  ['W','W','W','W','W','W','W','W','W','W'],
  ['S','S','S','S','W','W','W','W','W','W'],
  ['W','W','W','W','W','W','W','W','W','W'],
  ['S','S','S','W','W','W','W','W','W','W'],
  ['W','W','W','W','W','W','W','W','W','W'],
  ['S','S','S','W','W','W','W','W','W','W'],
  ['W','W','W','W','W','W','W','W','W','W'],
  ['S','S','W','W','W','W','W','W','W','W'],
  ['W','W','W','W','W','W','W','W','W','W'],
]

function Game({ socket }: GameProps) {
  const [playerBoard, setPlayerBoard] = useState<GameBoard>(INITIAL_BOARD)
  const [opponentBoard, setOpponentBoard] = useState<GameBoard>(
    Array(10).fill(null).map(() => Array(10).fill('W'))
  )
  const [myTurn, setMyTurn] = useState(false)
  const [gamePhase, setGamePhase] = useState<'setup' | 'playing' | 'finished'>('setup')
  const [statusMessage, setStatusMessage] = useState('Game started! Click Ready when you\'re ready.')
  const [showPlacementControls, setShowPlacementControls] = useState(true)

  useEffect(() => {
    socket.on('opponentReady', () => {
      setStatusMessage('Opponent is ready. Your turn to get ready!')
    })

    socket.on('yourTurn', () => {
      setMyTurn(true)
      setGamePhase('playing')
      setStatusMessage('Your turn to fire!')
    })

    socket.on('opponentTurn', () => {
      setMyTurn(false)
      setGamePhase('playing')
      setStatusMessage("Opponent's turn.")
    })

    socket.on('fireResult', (data: FireResult) => {
      const { row, col, result, isOwnGrid } = data
      
      if (isOwnGrid) {
        // Update our own board
        setPlayerBoard(prev => {
          const newBoard = [...prev]
          newBoard[row] = [...newBoard[row]]
          newBoard[row][col] = result === 'hit' ? 'H' : 'M'
          return newBoard
        })
      } else {
        // Update opponent's board
        setOpponentBoard(prev => {
          const newBoard = [...prev]
          newBoard[row] = [...newBoard[row]]
          newBoard[row][col] = result === 'hit' ? 'H' : 'M'
          return newBoard
        })
      }
    })

    socket.on('gameOver', (data: GameOverData) => {
      setMyTurn(false)
      setGamePhase('finished')
      setStatusMessage(data.result === 'win' ? 'You win! Congratulations!' : 'You lose! Better luck next time.')
    })

    socket.on('opponentDisconnected', () => {
      setMyTurn(false)
      setGamePhase('finished')
      setStatusMessage('Your opponent has disconnected. You win!')
    })

    return () => {
      socket.off('opponentReady')
      socket.off('yourTurn')
      socket.off('opponentTurn')
      socket.off('fireResult')
      socket.off('gameOver')
      socket.off('opponentDisconnected')
    }
  }, [socket])

  const handleReady = () => {
    socket.emit('shipsPlaced', playerBoard)
    setStatusMessage('Waiting for opponent to be ready...')
    setShowPlacementControls(false)
  }

  const handleCellClick = (row: number, col: number) => {
    if (!myTurn || gamePhase !== 'playing') return
    if (opponentBoard[row][col] === 'H' || opponentBoard[row][col] === 'M') return

    socket.emit('fire', { row, col })
  }

  return (
    <div className="game">
      <GameStatus message={statusMessage} />
      
      <div className="game-container">
        <div className="grid-container">
          <h2>Your Grid</h2>
          <Grid 
            board={playerBoard} 
            isPlayerGrid={true}
            onCellClick={() => {}} // Player grid is not clickable
          />
        </div>
        
        <div className="grid-container">
          <h2>Opponent's Grid</h2>
          <Grid 
            board={opponentBoard} 
            isPlayerGrid={false}
            onCellClick={handleCellClick}
            clickable={myTurn && gamePhase === 'playing'}
          />
        </div>
      </div>

      {showPlacementControls && (
        <PlayerControls onReady={handleReady} />
      )}
    </div>
  )
}

export default Game
