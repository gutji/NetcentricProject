// src/components/Game.tsx
import React, { useState, useEffect, useCallback } from 'react';
import type { GameState, Player, GameMessage, ClientInfo } from '../types/game';
import SocketService from '../services/socket';
import { createEmptyBoard, createInitialShips, generateRandomBoard, getBoardString } from '../utils/gameUtils';
import Grid from './Grid';
import GameStatus from './GameStatus';
import PlayerControls from './PlayerControls';
import './Game.css';

const Game: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    phase: 'nickname',
    players: [],
    currentPlayer: null,
    gameId: null,
    myTurn: false,
    timer: 300,
    myBoard: createEmptyBoard(),
    opponentBoard: createEmptyBoard(),
    ships: createInitialShips(),
    isFirstPlayer: false,
  });

  const [nickname, setNickname] = useState('');
  const [message, setMessage] = useState<GameMessage>({ type: 'info', text: 'Enter your nickname to start' });
  const [connectedClients, setConnectedClients] = useState<ClientInfo[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string>('');

  const socketService = SocketService.getInstance();

  const showMessage = useCallback((type: GameMessage['type'], text: string) => {
    setMessage({ type, text });
  }, []);

  const setNicknameHandler = useCallback(() => {
    if (nickname.trim().length < 2) {
      showMessage('error', 'Nickname must be at least 2 characters long');
      return;
    }

  socketService.connect();
    socketService.setNickname(nickname.trim());
    showMessage('info', 'Setting nickname...');
  }, [nickname, socketService, showMessage]);

  const joinGameQueue = useCallback(() => {
    socketService.joinQueue();
    showMessage('info', 'Looking for an opponent...');
    setGameState(prev => ({ ...prev, phase: 'waiting' }));
  }, [socketService, showMessage]);

  const placeShipsRandomly = useCallback(() => {
    const randomBoard = generateRandomBoard();
    setGameState(prev => ({ 
      ...prev, 
      myBoard: randomBoard,
    }));
    showMessage('success', 'Ships placed randomly! Click Ready to continue.');
  }, [showMessage]);

  const confirmShipPlacement = useCallback(() => {
    const boardString = getBoardString(gameState.myBoard);
    socketService.placeShips(boardString);
    showMessage('info', 'Waiting for opponent...');
    setGameState(prev => ({ ...prev, phase: 'waiting' }));
  }, [gameState.myBoard, socketService, showMessage]);

  const handleCellClick = useCallback((row: number, col: number, isMyGrid: boolean) => {
    if (isMyGrid || !gameState.myTurn || gameState.phase !== 'playing') return;

    const cell = gameState.opponentBoard[row][col];
    if (cell === 'H' || cell === 'M') return; // Already fired at this position

    socketService.fire(row, col);
    showMessage('info', 'Firing...');
  }, [gameState.myTurn, gameState.opponentBoard, gameState.phase, socketService, showMessage]);

  useEffect(() => {
  socketService.connect();

    // Connection events
    socketService.onConnect(() => {
      showMessage('success', 'Connected to server! Welcome to Battleship!');
    });

    socketService.onDisconnect((reason) => {
      showMessage('error', `Disconnected from server: ${reason}`);
    });

    // Client info events
    socketService.onClientsInfo((data) => {
      setConnectedClients(data.connectedClients);
    });

    socketService.onNicknameSet((data) => {
      setMyPlayerId(data.clientId);
      showMessage('success', `Welcome, ${data.nickname}!`);
      setGameState(prev => ({ ...prev, phase: 'lobby' }));
    });

    // Game flow events
    socketService.onWaiting(() => {
      showMessage('info', 'Waiting for an opponent to join...');
    });

    socketService.onGameStart((data) => {
      const players: Player[] = data.players;
      const isFirstPlayer = data.firstPlayer === myPlayerId;
      
      setGameState(prev => ({
        ...prev,
        phase: 'placing',
        players,
        gameId: data.gameId,
        currentPlayer: data.firstPlayer,
        timer: data.gameTimer,
        isFirstPlayer,
      }));

      showMessage('info', `Game found! ${isFirstPlayer ? 'You go first.' : 'Opponent goes first.'} Place your ships!`);
    });

    socketService.onOpponentReady(() => {
      showMessage('info', 'Opponent is ready! Waiting for you...');
    });

    socketService.onAllPlayersReady(() => {
      setGameState(prev => ({ ...prev, phase: 'playing' }));
      showMessage('success', 'Game started! May the best captain win!');
    });

    socketService.onYourTurn(() => {
      setGameState(prev => ({ ...prev, myTurn: true }));
      showMessage('success', 'Your turn! Click on opponent\'s grid to fire!');
    });

    socketService.onOpponentTurn(() => {
      setGameState(prev => ({ ...prev, myTurn: false }));
      showMessage('info', 'Opponent\'s turn...');
    });

    socketService.onFireResult((data) => {
      const { row, col, result, isOwnGrid } = data;
      
      setGameState(prev => ({
        ...prev,
        myBoard: isOwnGrid ? prev.myBoard.map((r, rIdx) => 
          r.map((c, cIdx) => (rIdx === row && cIdx === col) ? (result === 'hit' ? 'H' : 'M') : c)
        ) : prev.myBoard,
        opponentBoard: !isOwnGrid ? prev.opponentBoard.map((r, rIdx) => 
          r.map((c, cIdx) => (rIdx === row && cIdx === col) ? (result === 'hit' ? 'H' : 'M') : c)
        ) : prev.opponentBoard,
      }));

      if (isOwnGrid) {
        showMessage(result === 'hit' ? 'warning' : 'info', 
          result === 'hit' ? 'Enemy hit your ship!' : 'Enemy missed!');
      } else {
        showMessage(result === 'hit' ? 'success' : 'info', 
          result === 'hit' ? 'Direct hit!' : 'Miss!');
      }
    });

    socketService.onGameOver((data) => {
      setGameState(prev => ({ ...prev, phase: 'game-over', myTurn: false }));
      
      if (data.result === 'win') {
        showMessage('success', 'Congratulations! You won! 🎉');
      } else if (data.result === 'loss') {
        showMessage('error', 'You lost! Better luck next time!');
      } else if (data.result === 'timeout') {
        showMessage('warning', `Game timed out! ${data.winnerNickname} wins!`);
      }
    });

    socketService.onTimerUpdate((timer) => {
      setGameState(prev => ({ ...prev, timer }));
    });

    socketService.onOpponentDisconnected(() => {
      showMessage('warning', 'Opponent disconnected. You win by default!');
      setGameState(prev => ({ ...prev, phase: 'game-over' }));
    });

    socketService.onServerReset(() => {
      showMessage('warning', 'Server was reset. Please refresh the page.');
      // Reset to initial state
      setGameState({
        phase: 'nickname',
        players: [],
        currentPlayer: null,
        gameId: null,
        myTurn: false,
        timer: 300,
        myBoard: createEmptyBoard(),
        opponentBoard: createEmptyBoard(),
        ships: createInitialShips(),
        isFirstPlayer: false,
      });
      setNickname('');
      setMyPlayerId('');
    });

    return () => {
      socketService.removeAllListeners();
    };
  }, [myPlayerId, showMessage]);

  const renderNicknamePhase = () => (
    <div className="nickname-phase">
      <h2>🚢 Welcome to Battleship!</h2>
      <div className="nickname-input">
        <input
          type="text"
          placeholder="Enter your nickname..."
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && setNicknameHandler()}
          maxLength={20}
          autoFocus
        />
        <button onClick={setNicknameHandler} disabled={nickname.trim().length < 2}>
          Join Game
        </button>
      </div>
      
      {connectedClients.length > 0 && (
        <div className="connected-players">
          <h3>Connected Players ({connectedClients.length})</h3>
          <div className="players-list">
            {connectedClients.map(client => (
              <div key={client.id} className="player-info">
                <span className="player-nickname">{client.nickname || 'Anonymous'}</span>
                <span className="player-score">Score: {client.score}</span>
                <span className={`player-status ${client.status}`}>{client.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderLobbyPhase = () => (
    <div className="lobby-phase">
      <h2>Ready to Battle! ⚓</h2>
      <p>Welcome aboard, Captain {nickname}!</p>
      <button onClick={joinGameQueue} className="join-queue-btn">
        🎯 Find Opponent
      </button>
      
      {connectedClients.length > 0 && (
        <div className="connected-players">
          <h3>Players Online ({connectedClients.length})</h3>
          <div className="players-list">
            {connectedClients.map(client => (
              <div key={client.id} className="player-info">
                <span className="player-nickname">{client.nickname || 'Anonymous'}</span>
                <span className="player-score">Score: {client.score}</span>
                <span className={`player-status ${client.status}`}>{client.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderGamePhase = () => (
    <div className="game-phase">
      <GameStatus 
        gameState={gameState}
        message={message}
        myNickname={nickname}
      />
      
      <div className="game-boards">
        <div className="board-section">
          <h3>Your Fleet</h3>
          <Grid
            board={gameState.myBoard}
            onCellClick={(row, col) => handleCellClick(row, col, true)}
            isMyGrid={true}
            interactive={false}
          />
        </div>
        
        <div className="board-section">
          <h3>Enemy Waters</h3>
          <Grid
            board={gameState.opponentBoard}
            onCellClick={(row, col) => handleCellClick(row, col, false)}
            isMyGrid={false}
            interactive={gameState.myTurn && gameState.phase === 'playing'}
          />
        </div>
      </div>

      {gameState.phase === 'placing' && (
        <PlayerControls
          onPlaceRandomly={placeShipsRandomly}
          onConfirmPlacement={confirmShipPlacement}
          shipsPlaced={gameState.myBoard.flat().includes('S')}
        />
      )}
    </div>
  );

  return (
    <div className="game-container">
      {gameState.phase === 'nickname' && renderNicknamePhase()}
      {gameState.phase === 'lobby' && renderLobbyPhase()}
      {(gameState.phase === 'waiting' || gameState.phase === 'placing' || 
        gameState.phase === 'playing' || gameState.phase === 'game-over') && renderGamePhase()}
    </div>
  );
};

export default Game;
