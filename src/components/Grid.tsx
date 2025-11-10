import type { CellState } from '../types/game';
import './Grid.css'

interface GridProps {
  board: CellState[][];
  onCellClick: (row: number, col: number) => void;
  isMyGrid: boolean;
  interactive?: boolean;
  highlightCells?: string[];
  onCellHover?: (row: number, col: number) => void;
  onHoverEnd?: () => void;
}

function Grid({ board, onCellClick, isMyGrid, interactive = false, highlightCells = [], onCellHover, onHoverEnd }: GridProps) {
  const highlightSet = new Set(highlightCells);
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
    <div className="grid" onMouseLeave={() => onHoverEnd && onHoverEnd()}>
      {board.map((row, rowIndex) =>
        row.map((cell, colIndex) => (
          <div
            key={`${rowIndex}-${colIndex}`}
            className={getCellClass(cell) + (highlightSet.has(`${rowIndex},${colIndex}`) ? ' scan-highlight' : '')}
            onClick={() => handleCellClick(rowIndex, colIndex)}
            onMouseEnter={() => onCellHover && onCellHover(rowIndex, colIndex)}
            data-row={rowIndex}
            data-col={colIndex}
          />
        ))
      )}
    </div>
  )
}

export default Grid
