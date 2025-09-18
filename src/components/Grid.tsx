import './Grid.css'

type CellState = 'S' | 'W' | 'H' | 'M'
type GameBoard = CellState[][]

interface GridProps {
  board: GameBoard
  isPlayerGrid: boolean
  onCellClick: (row: number, col: number) => void
  clickable?: boolean
}

function Grid({ board, isPlayerGrid, onCellClick, clickable = false }: GridProps) {
  const getCellClass = (cellState: CellState) => {
    let className = 'cell'
    
    if (isPlayerGrid && cellState === 'S') {
      className += ' ship'
    }
    
    if (cellState === 'H') {
      className += ' hit'
    } else if (cellState === 'M') {
      className += ' miss'
    }
    
    if (clickable && !isPlayerGrid && cellState !== 'H' && cellState !== 'M') {
      className += ' clickable'
    }
    
    return className
  }

  const handleCellClick = (row: number, col: number) => {
    if (clickable && !isPlayerGrid) {
      onCellClick(row, col)
    }
  }

  return (
    <div className="grid">
      {board.map((row, rowIndex) =>
        row.map((cell, colIndex) => (
          <div
            key={`${rowIndex}-${colIndex}`}
            className={getCellClass(cell)}
            onClick={() => handleCellClick(rowIndex, colIndex)}
            data-row={rowIndex}
            data-col={colIndex}
          />
        ))
      )}
    </div>
  )
}

export default Grid
