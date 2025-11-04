// src/services/socket.ts
import { io, Socket } from 'socket.io-client';

// Server configuration
// Prefer VITE_SOCKET_URL, else default to current page hostname on port 3001
const resolveServerUrl = (): string => {
  const envUrl = (import.meta as any)?.env?.VITE_SOCKET_URL as string | undefined;
  if (envUrl) return envUrl;
  const isBrowser = typeof window !== 'undefined' && !!window.location;
  const protocol = isBrowser ? window.location.protocol : 'http:';
  const host = isBrowser ? window.location.hostname : 'localhost';
  return `${protocol}//${host}:3001`;
};

class SocketService {
  private socket: Socket | null = null;
  private static instance: SocketService;

  private constructor() {}

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  connect(): Socket {
    if (this.socket) {
      return this.socket;
    }

  // Use resolved server URL so devices on LAN can connect
  this.socket = io(resolveServerUrl(), {
      transports: ['websocket'],
      withCredentials: false,
    });

    this.socket.on('connect', () => {
      console.log('Connected to server:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  // Game-specific methods
  setNickname(nickname: string): void {
    this.socket?.emit('setNickname', nickname);
  }

  joinQueue(): void {
    this.socket?.emit('joinQueue');
  }

  placeShips(board: string[][]): void {
    this.socket?.emit('shipsPlaced', board);
  }

  fire(row: number, col: number): void {
    this.socket?.emit('fire', { row, col });
  }

  // Event listeners
  onConnect(callback: () => void): void {
    this.socket?.on('connect', callback);
  }

  onDisconnect(callback: (reason: string) => void): void {
    this.socket?.on('disconnect', callback);
  }

  onClientsInfo(callback: (data: any) => void): void {
    this.socket?.on('clientsInfo', callback);
  }

  onNicknameSet(callback: (data: any) => void): void {
    this.socket?.on('nicknameSet', callback);
  }

  onWaiting(callback: () => void): void {
    this.socket?.on('waiting', callback);
  }

  onGameStart(callback: (data: any) => void): void {
    this.socket?.on('gameStart', callback);
  }

  onOpponentReady(callback: () => void): void {
    this.socket?.on('opponentReady', callback);
  }

  onAllPlayersReady(callback: () => void): void {
    this.socket?.on('allPlayersReady', callback);
  }

  onYourTurn(callback: () => void): void {
    this.socket?.on('yourTurn', callback);
  }

  onOpponentTurn(callback: () => void): void {
    this.socket?.on('opponentTurn', callback);
  }

  onFireResult(callback: (data: any) => void): void {
    this.socket?.on('fireResult', callback);
  }

  onGameOver(callback: (data: any) => void): void {
    this.socket?.on('gameOver', callback);
  }

  onTimerUpdate(callback: (timer: number) => void): void {
    this.socket?.on('timerUpdate', callback);
  }

  onOpponentDisconnected(callback: () => void): void {
    this.socket?.on('opponentDisconnected', callback);
  }

  onServerReset(callback: () => void): void {
    this.socket?.on('serverReset', callback);
  }

  // Cleanup method
  removeAllListeners(): void {
    this.socket?.removeAllListeners();
  }
}

export default SocketService;
