// src/types/game.ts
export interface Player {
  id: string;
  nickname: string;
  score: number;
  headtoheadWins: headtoheadWins;
}

export interface headtoheadWins {
  [opponentId: string]: number;
}

export interface GameState {
  phase: 'nickname' | 'lobby' | 'waiting' | 'placing' | 'playing' | 'game-over';
  players: Player[];
  currentPlayer: string | null;
  gameId: string | null;
  myTurn: boolean;
  timer: number;
  myBoard: CellState[][];
  opponentBoard: CellState[][];
  ships: Ship[];
  isFirstPlayer: boolean;
}

export type CellState = 'W' | 'S' | 'H' | 'M'; // Water, Ship, Hit, Miss

export interface Ship {
  id: string;
  size: number;
  position: { row: number; col: number } | null;
  orientation: 'horizontal' | 'vertical';
  placed: boolean;
}

export interface GameMessage {
  type: 'info' | 'success' | 'warning' | 'error';
  text: string;
}

export interface ClientInfo {
  id: string;
  nickname: string;
  score: number;
  status: string;
  headtoheadWins?: headtoheadWins;
}

export const GRID_SIZE = 10;

export const SHIP_SIZES = [5, 4, 3, 3, 2]; // Carrier, Battleship, Cruiser, Submarine, Destroyer
