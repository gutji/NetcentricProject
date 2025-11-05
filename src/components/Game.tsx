// src/components/Game.tsx
import React, { useState, useEffect, useCallback } from "react";
import type { GameState, Player, GameMessage, ClientInfo } from "../types/game";
import SocketService from "../services/socket";
import {
  createEmptyBoard,
  createInitialShips,
  getBoardString,
} from "../utils/gameUtils";
import Grid from "./Grid";
import GameStatus from "./GameStatus";
import PlayerControls from "./PlayerControls";
import "./Game.css";
import ShipPlacement from "./ShipPlacement";

type GameProps = { mode?: 'classic' | 'blitz'; onInMatchChange?: (inMatch: boolean) => void };

const Game: React.FC<GameProps> = ({ mode = 'classic', onInMatchChange }) => {
  const [gameState, setGameState] = useState<GameState>({
    phase: "nickname",
    players: [],
    currentPlayer: null,
    gameId: null,
    myTurn: false,
    timer: 10,
    myBoard: createEmptyBoard(),
    opponentBoard: createEmptyBoard(),
    ships: createInitialShips(),
    isFirstPlayer: false,
  });

  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState<GameMessage>({
    type: "info",
    text: "Enter your nickname to start",
  });
  const [connectedClients, setConnectedClients] = useState<ClientInfo[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string>("");
  const [showGameOverModal, setShowGameOverModal] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<
    "win" | "loss" | "timeout" | null
  >(null);
  const [resumeReadyIds, setResumeReadyIds] = useState<string[]>([]);
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);

  const socketService = SocketService.getInstance();

  const showMessage = useCallback((type: GameMessage["type"], text: string) => {
    setMessage({ type, text });
  }, []);

  const setNicknameHandler = useCallback(() => {
    if (nickname.trim().length < 2) {
      showMessage("error", "Nickname must be at least 2 characters long");
      return;
    }

    socketService.connect();
    socketService.setNickname(nickname.trim());
    showMessage("info", "Setting nickname...");
  }, [nickname, socketService, showMessage]);

  const joinGameQueue = useCallback(() => {
    socketService.joinQueue(mode);
    showMessage("info", "Looking for an opponent...");
    setGameState((prev) => ({ ...prev, phase: "waiting" }));
  }, [socketService, showMessage, mode]);

  const confirmShipPlacement = useCallback(() => {
    const boardString = getBoardString(gameState.myBoard);
    socketService.placeShips(boardString);
    showMessage("info", "Waiting for opponent...");
    setGameState((prev) => ({ ...prev, phase: "waiting" }));
  }, [gameState.myBoard, socketService, showMessage]);

  const handleCellClick = useCallback(
    (row: number, col: number, isMyGrid: boolean) => {
      if (isMyGrid || !gameState.myTurn || gameState.phase !== "playing")
        return;

      const cell = gameState.opponentBoard[row][col];
      if (cell === "H" || cell === "M") return; // Already fired at this position

      socketService.fire(row, col);
      showMessage("info", "Firing...");
    },
    [
      gameState.myTurn,
      gameState.opponentBoard,
      gameState.phase,
      socketService,
      showMessage,
    ]
  );

  // Helpers to compute current opponent and H2H wins
  const getPlayersPair = useCallback(() => {
    if (!myPlayerId || gameState.players.length < 2)
      return { me: null as Player | null, opp: null as Player | null };
    const me = gameState.players.find((p) => p.id === myPlayerId) || null;
    const opp = gameState.players.find((p) => p.id !== myPlayerId) || null;
    return { me, opp };
  }, [myPlayerId, gameState.players]);

  const getHeadToHead = useCallback(() => {
    const { me, opp } = getPlayersPair();
    if (!me || !opp) return { myWins: 0, oppWins: 0 };

    const meClient = connectedClients.find((c) => c.id === me.id);
    const oppClient = connectedClients.find((c) => c.id === opp.id);

    const myWins =
      meClient?.headtoheadWins?.[opp.id] ?? me.headtoheadWins?.[opp.id] ?? 0;
    const oppWins =
      oppClient?.headtoheadWins?.[me.id] ?? opp.headtoheadWins?.[me.id] ?? 0;

    return { myWins, oppWins };
  }, [connectedClients, getPlayersPair]);

  useEffect(() => {
    // Inform parent whether we're currently in a match (placing or playing)
    const inMatch = gameState.phase === 'placing' || gameState.phase === 'playing';
    onInMatchChange && onInMatchChange(inMatch);
  }, [gameState.phase, onInMatchChange]);

  useEffect(() => {
    socketService.connect();

    // Connection events
    socketService.onConnect(() => {
      showMessage("success", "Connected to server! Welcome to Battleship!");
    });

    socketService.onDisconnect((reason) => {
      showMessage("error", `Disconnected from server: ${reason}`);
    });

    // Client info events
    socketService.onClientsInfo((data) => {
      setConnectedClients(data.connectedClients);
    });

    socketService.onNicknameSet((data) => {
      setMyPlayerId(data.clientId);
      showMessage("success", `Welcome, ${data.nickname}!`);
      setGameState((prev) => ({ ...prev, phase: "lobby" }));
    });

    // Game flow events
    socketService.onWaiting(() => {
      showMessage("info", "Waiting for an opponent to join...");
    });

    socketService.onGameStart((data) => {
      const players: Player[] = data.players;
      const isFirstPlayer = data.firstPlayer === myPlayerId;

      setGameState((prev) => ({
        ...prev,
        phase: "placing",
        players,
        gameId: data.gameId,
        currentPlayer: data.firstPlayer,
        timer: 10,
        isFirstPlayer,
      }));

      showMessage(
        "info",
        `Game found! ${
          isFirstPlayer ? "You go first." : "Opponent goes first."
        } Place your ships!`
      );
    });

    socketService.onOpponentReady(() => {
      showMessage("info", "Opponent is ready! Waiting for you...");
    });

    socketService.onAllPlayersReady(() => {
      setGameState((prev) => ({ ...prev, phase: "playing" }));
      showMessage("success", "Game started! May the best captain win!");
    });

    socketService.onYourTurn(() => {
      setGameState((prev) => ({ ...prev, myTurn: true }));
      showMessage("success", "Your turn! Click on opponent's grid to fire!");
    });

    socketService.onOpponentTurn(() => {
      setGameState((prev) => ({ ...prev, myTurn: false }));
      showMessage("info", "Opponent's turn...");
    });

    socketService.onFireResult((data) => {
      const { row, col, result, isOwnGrid } = data;

      setGameState((prev) => ({
        ...prev,
        myBoard: isOwnGrid
          ? prev.myBoard.map((r, rIdx) =>
              r.map((c, cIdx) =>
                rIdx === row && cIdx === col
                  ? result === "hit"
                    ? "H"
                    : "M"
                  : c
              )
            )
          : prev.myBoard,
        opponentBoard: !isOwnGrid
          ? prev.opponentBoard.map((r, rIdx) =>
              r.map((c, cIdx) =>
                rIdx === row && cIdx === col
                  ? result === "hit"
                    ? "H"
                    : "M"
                  : c
              )
            )
          : prev.opponentBoard,
      }));

      if (isOwnGrid) {
        showMessage(
          result === "hit" ? "warning" : "info",
          result === "hit" ? "Enemy hit your ship!" : "Enemy missed!"
        );
      } else {
        showMessage(
          result === "hit" ? "success" : "info",
          result === "hit" ? "Direct hit!" : "Miss!"
        );
      }
    });

    socketService.onGameOver((data) => {
      setGameState((prev) => ({ ...prev, phase: "game-over", myTurn: false }));
      const res = data.result as "win" | "loss" | "timeout";
      setLastResult(res);
      setShowGameOverModal(true);

      if (data.result === "win") {
        showMessage("success", "Congratulations! You won! 🎉");
      } else if (data.result === "loss") {
        showMessage("error", "You lost! Better luck next time!");
      } else if (data.result === "timeout") {
        showMessage("warning", `Game timed out! ${data.winnerNickname} wins!`);
      }
    });

    socketService.onTimerUpdate((timer) => {
      setGameState((prev) => ({ ...prev, timer }));
    });

    socketService.onGamePaused(({ by }) => {
      setGameState((prev) => ({ ...prev, paused: true }));
      const who = by === myPlayerId ? 'You paused the game.' : 'Opponent paused the game.';
      showMessage('warning', `${who} Game is paused.`);
      setResumeReadyIds([]);
    });

    socketService.onGameResumed(({ by }) => {
      setGameState((prev) => ({ ...prev, paused: false }));
      const who = by === myPlayerId ? 'You resumed the game.' : 'Opponent resumed the game.';
      showMessage('success', `${who}`);
      setResumeReadyIds([]);
    });

    socketService.onResumeVoteUpdate(({ resumeReadyIds }) => {
      setResumeReadyIds(resumeReadyIds || []);
    });

    socketService.onOpponentDisconnected(() => {
      showMessage("warning", "Opponent disconnected. You win by default!");
      setGameState((prev) => ({ ...prev, phase: "game-over" }));
    });

    socketService.onServerReset(() => {
      showMessage("warning", "Server was reset. Please refresh the page.");
      // Reset to initial state
      setGameState({
        phase: "nickname",
        players: [],
        currentPlayer: null,
        gameId: null,
        myTurn: false,
        timer: 10,
        myBoard: createEmptyBoard(),
        opponentBoard: createEmptyBoard(),
        ships: createInitialShips(),
        isFirstPlayer: false,
      });
      setNickname("");
      setMyPlayerId("");
    });

    return () => {
      socketService.removeAllListeners();
    };
  }, [myPlayerId, showMessage, socketService]);

  const renderHowToPlayModal = () => (
    <div className="modal-overlay" onClick={() => setShowHowToPlay(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>📚 How to Play Battleship</h2>
        <div className="how-to-play-content">
          <h3>🎯 Objective</h3>
          <p>Be the first to sink all of your opponent's ships!</p>
          
          <h3>📋 Game Setup</h3>
          <p>• Place your ships on the grid by dragging or clicking</p>
          <p>• Ships cannot overlap or touch each other</p>
          <p>• Ships can be placed horizontally or vertically</p>
          
          <h3>⚓ Fleet Composition</h3>
          <p>• Carrier (5 squares) - 1 ship</p>
          <p>• Battleship (4 squares) - 1 ship</p>
          <p>• Cruiser (3 squares) - 1 ship</p>
          <p>• Submarine (3 squares) - 1 ship</p>
          <p>• Destroyer (2 squares) - 1 ship</p>
          
          <h3>🎮 Gameplay</h3>
          <p>• Take turns firing at your opponent's grid</p>
          <p>• Click on a square in the "Enemy Waters" grid to fire</p>
          <p>• Red squares indicate hits, blue squares indicate misses</p>
          <p>• Green squares show your own ships</p>
          
          <h3>🏆 Winning</h3>
          <p>• Sink all enemy ships to win!</p>
          <p>• A ship is sunk when all its squares are hit</p>
          
          <h3>⏸️ Game Controls</h3>
          <p>• Use the Pause button during gameplay to pause</p>
          <p>• Both players must agree to resume</p>
        </div>
        <button className="close-button" onClick={() => setShowHowToPlay(false)}>
          Close
        </button>
      </div>
    </div>
  );

  const renderNicknamePhase = () => (
    <div className="nickname-phase">
      <h2>🚢 Welcome to Battleship!</h2>
      <div className="nickname-input">
        <input
          type="text"
          placeholder="Enter your nickname..."
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && setNicknameHandler()}
          maxLength={20}
          autoFocus
        />
        <button
          onClick={setNicknameHandler}
          disabled={nickname.trim().length < 2}
        >
          Join Game
        </button>
      </div>

      {connectedClients.length > 0 && (
        <div className="connected-players">
          <h3>Connected Players ({connectedClients.length})</h3>
          <div className="players-list">
            {connectedClients.map((client) => (
              <div key={client.id} className="player-info">
                <span className="player-nickname">
                  {client.nickname || "Anonymous"}
                </span>
                <span className="player-score">Score: {client.score}</span>
                <span className={`player-status ${client.status}`}>
                  {client.status}
                </span>
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
            {connectedClients.map((client) => (
              <div key={client.id} className="player-info">
                <span className="player-nickname">
                  {client.nickname || "Anonymous"}
                </span>
                <span className="player-score">Score: {client.score}</span>
                <span className={`player-status ${client.status}`}>
                  {client.status}
                </span>
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
        onPause={() => socketService.pauseGame()}
      />

      {/* Head-to-Head banner during game */}
      {gameState.players.length === 2 &&
        (() => {
          const { me, opp } = getPlayersPair();
          if (!me || !opp) return null;
          const { myWins, oppWins } = getHeadToHead();
          return (
            <div className="h2h-banner">
              <span className="h2h-title">Head-to-Head</span>
              <span className="h2h-item my">
                You: <strong>{myWins}</strong>
              </span>
              <span className="vs">vs</span>
              <span className="h2h-item opp">
                {opp.nickname || "Opponent"}: <strong>{oppWins}</strong>
              </span>
            </div>
          );
        })()}

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
            interactive={gameState.myTurn && gameState.phase === "playing"}
          />
        </div>
      </div>

      {gameState.phase === "placing" && (
        <>
          <ShipPlacement
            board={gameState.myBoard}
            ships={gameState.ships}
            onBoardChange={(newBoard) =>
              setGameState((prev) => ({ ...prev, myBoard: newBoard }))
            }
            onShipsChange={(newShips) =>
              setGameState((prev) => ({ ...prev, ships: newShips }))
            }
          />

          <PlayerControls
            onConfirmPlacement={confirmShipPlacement}
            shipsPlaced={gameState.ships.every((s) => s.placed)}
          />
        </>
      )}
    </div>
  );

  const handleRematch = useCallback(() => {
    // Reset local boards and ships and rejoin queue
    setGameState((prev) => ({
      ...prev,
      phase: "waiting",
      myTurn: false,
      timer: 10,
      myBoard: createEmptyBoard(),
      opponentBoard: createEmptyBoard(),
      ships: createInitialShips(),
      paused: false,
    }));
    setShowGameOverModal(false);
    showMessage("info", "Searching for a rematch...");
    socketService.joinQueue(mode);
  }, [socketService, showMessage, mode]);

  const handleReturnHome = useCallback(() => {
    setGameState((prev) => ({
      ...prev,
      phase: "lobby",
      myTurn: false,
      timer: 10,
      myBoard: createEmptyBoard(),
      opponentBoard: createEmptyBoard(),
      ships: createInitialShips(),
    }));
    setShowGameOverModal(false);
    showMessage("info", "Returned to lobby.");
  }, [showMessage]);

  return (
    <div className="game-container">
      {/* How to Play button - always visible at top left */}
      <button 
        className="how-to-play-btn-fixed"
        onClick={() => setShowHowToPlay(true)}
        title="How to Play"
      >
        📚 How to Play
      </button>

      {gameState.phase === "nickname" && renderNicknamePhase()}
      {gameState.phase === "lobby" && renderLobbyPhase()}
      {(gameState.phase === "waiting" ||
        gameState.phase === "placing" ||
        gameState.phase === "playing" ||
        gameState.phase === "game-over") &&
        renderGamePhase()}

      {/* How to Play Modal */}
      {showHowToPlay && renderHowToPlayModal()}

      {/* Game Over Modal */}
      {showGameOverModal &&
        (() => {
          const { me, opp } = getPlayersPair();
          const { myWins, oppWins } = getHeadToHead();
          const title =
            lastResult === "win"
              ? "You Won! 🎉"
              : lastResult === "loss"
              ? "You Lost"
              : "Time Out";
          return (
            <div className="modal-overlay">
              <div className="modal">
                <h2 className="modal-title">{title}</h2>
                {me && opp && (
                  <div className="modal-h2h">
                    <div className="h2h-row">
                      <span className="me-name">You</span>
                      <span className="score">{myWins}</span>
                      <span className="vs">:</span>
                      <span className="score">{oppWins}</span>
                      <span className="opp-name">
                        {opp.nickname || "Opponent"}
                      </span>
                    </div>
                    <div className="h2h-note">Head-to-head record</div>
                  </div>
                )}
                <div className="modal-actions">
                  <button className="btn primary" onClick={handleRematch}>
                    🔁 Rematch
                  </button>
                  <button className="btn" onClick={handleReturnHome}>
                    🏠 Return Home
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Pause Modal */}
      {gameState.phase === 'playing' && gameState.paused && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="modal-title">Game Paused</h2>
            <p className="mb-3">Both players must press Resume to continue.</p>
            <div className="mb-3 text-center">
              <strong>Resume confirmations:</strong> {resumeReadyIds.length}/2
            </div>
            <div className="modal-actions">
              <button
                className="btn primary"
                onClick={() => socketService.resumeGame()}
                disabled={resumeReadyIds.includes(myPlayerId)}
              >
                {resumeReadyIds.includes(myPlayerId) ? 'Waiting for opponent…' : '▶️ Resume'}
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  if (confirm('Are you sure you want to forfeit this game?')) {
                    socketService.forfeit();
                  }
                }}
              >
                🏳️ Forfeit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Game;
