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
  phase: "nickname" | "lobby" | "waiting" | "placing" | "playing" | "game-over";
  players: Player[];
  currentPlayer: string | null;
  gameId: string | null;
  myTurn: boolean;
  timer: number;
  myBoard: CellState[][];
  opponentBoard: CellState[][];
  ships: Ship[];
  isFirstPlayer: boolean;
  paused?: boolean;
  // Blitz power-ups usage tracking (client-side convenience)
  powerUpsUsed?: {
    cannons: boolean;
    scan: boolean;
    protect: boolean;
  };
}

export type CellState = "W" | "S" | "H" | "M"; // Water, Ship, Hit, Miss

export interface Ship {
  id: string;
  size: number;
  position: { row: number; col: number } | null;
  orientation: "horizontal" | "vertical";
  placed: boolean;
}

export interface GameMessage {
  type: "info" | "success" | "warning" | "error";
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

export const SHIP_SIZES = [4, 4, 4, 4]; // Carrier, Battleship, Cruiser, Submarine, Destroyer

// Chat
export interface ChatMessage {
  id: number;
  gameId: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: string; // ISO
}
