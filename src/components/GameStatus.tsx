interface GameStatusProps {
  message: string
}

function GameStatus({ message }: GameStatusProps) {
  return (
    <p id="status-message" className="status-message">
      {message}
    </p>
  )
}

export default GameStatus
