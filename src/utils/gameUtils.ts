// src/utils/gameUtils.ts
import type { CellState, Ship } from "../types/game";
import { GRID_SIZE, SHIP_SIZES } from "../types/game";

export function createEmptyBoard(): CellState[][] {
  return Array(GRID_SIZE)
    .fill(null)
    .map(() => Array(GRID_SIZE).fill("W"));
}

// Return ship sizes for the given mode. Defaults to classic sizes.
function getShipSizesForMode(mode?: 'classic' | 'blitz'): number[] {
  if (mode === 'blitz') {
    // Blitz composition: Carrier 5, Battleship 4, Cruiser 3, Submarine 3, Destroyer 2
    return [5, 4, 3, 3, 2];
  }
  return SHIP_SIZES;
}

export function createInitialShips(mode?: 'classic' | 'blitz'): Ship[] {
  return getShipSizesForMode(mode).map((size, index) => ({
    id: `ship-${index}`,
    size,
    position: null,
    orientation: "horizontal",
    placed: false,
  }));
}

export function canPlaceShip(
  board: CellState[][],
  ship: Ship,
  row: number,
  col: number,
  orientation: "horizontal" | "vertical"
): boolean {
  const { size } = ship;

  // Check if ship fits within grid boundaries
  if (orientation === "horizontal") {
    if (col + size > GRID_SIZE) return false;
  } else {
    if (row + size > GRID_SIZE) return false;
  }

  // Check that all target cells are water (no overlapping)
  for (let i = 0; i < size; i++) {
    const currentRow = orientation === "horizontal" ? row : row + i;
    const currentCol = orientation === "horizontal" ? col + i : col;

    if (board[currentRow][currentCol] !== "W") return false;
  }

  return true;
}

export function placeShip(
  board: CellState[][],
  ship: Ship,
  row: number,
  col: number,
  orientation: "horizontal" | "vertical"
): CellState[][] {
  if (!canPlaceShip(board, ship, row, col, orientation)) {
    return board;
  }

  const newBoard = board.map((row) => [...row]);
  const { size } = ship;

  for (let i = 0; i < size; i++) {
    const currentRow = orientation === "horizontal" ? row : row + i;
    const currentCol = orientation === "horizontal" ? col + i : col;
    newBoard[currentRow][currentCol] = "S";
  }

  return newBoard;
}

export function removeShip(board: CellState[][], ship: Ship): CellState[][] {
  if (!ship.position) return board;

  const newBoard = board.map((row) => [...row]);
  const { size, orientation } = ship;
  const { row, col } = ship.position;

  for (let i = 0; i < size; i++) {
    const currentRow = orientation === "horizontal" ? row : row + i;
    const currentCol = orientation === "horizontal" ? col + i : col;
    newBoard[currentRow][currentCol] = "W";
  }

  return newBoard;
}

export function generateRandomBoard(mode?: 'classic' | 'blitz'): CellState[][] {
  let board = createEmptyBoard();
  const ships = createInitialShips(mode);

  for (const ship of ships) {
    let placed = false;
    let attempts = 0;
    const maxAttempts = 100;

    while (!placed && attempts < maxAttempts) {
      const row = Math.floor(Math.random() * GRID_SIZE);
      const col = Math.floor(Math.random() * GRID_SIZE);
      const orientation = Math.random() < 0.5 ? "horizontal" : "vertical";

      if (canPlaceShip(board, ship, row, col, orientation)) {
        board = placeShip(board, ship, row, col, orientation);
        ship.position = { row, col };
        ship.orientation = orientation;
        ship.placed = true;
        placed = true;
      }
      attempts++;
    }

    if (!placed) {
      console.warn(`Failed to place ship of size ${ship.size}`);
    }
  }

  return board;
}

export function formatTimer(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function getBoardString(board: CellState[][]): string[][] {
  return board.map((row) => row.map((cell) => cell));
}

export function isGameWon(board: CellState[][]): boolean {
  return !board.flat().includes("S");
}

export function getShipAtPosition(
  ships: Ship[],
  row: number,
  col: number
): Ship | null {
  return (
    ships.find((ship) => {
      if (!ship.position || !ship.placed) return false;

      const { row: shipRow, col: shipCol } = ship.position;
      const { size, orientation } = ship;

      for (let i = 0; i < size; i++) {
        const currentRow = orientation === "horizontal" ? shipRow : shipRow + i;
        const currentCol = orientation === "horizontal" ? shipCol + i : shipCol;

        if (currentRow === row && currentCol === col) {
          return true;
        }
      }

      return false;
    }) || null
  );
}
