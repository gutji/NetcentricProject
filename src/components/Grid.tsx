import type { CellState } from '../types/game';
import './Grid.css'

interface GridProps {
  board: CellState[][];
  onCellClick: (row: number, col: number) => void;
  isMyGrid: boolean;
  interactive?: boolean;
}

function Grid({ board, onCellClick, isMyGrid, interactive = false }: GridProps) {
  const getCellClass = (cellState: CellState) => {
    let className = 'cell'
    
    if (isMyGrid && cellState === 'S') {
      className += ' ship'
    }
    
    if (cellState === 'H') {
      className += ' hit'
    } else if (cellState === 'M') {
      className += ' miss'
    }
    
    if (interactive && !isMyGrid && cellState !== 'H' && cellState !== 'M') {
      className += ' clickable'
    }
    
    return className
  }

  const handleCellClick = (row: number, col: number) => {
    if (interactive && !isMyGrid) {
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
