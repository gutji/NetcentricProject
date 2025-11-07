// src/components/Game.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
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
import Chat from "./Chat";
import "./Chat.css";
import ShipPlacement from "./ShipPlacement";
import { playHit, playMiss } from "../services/sound";

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
    ships: createInitialShips(mode),
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
  const [activePower, setActivePower] = useState<null | 'cannons' | 'scan'>(null);
  const [scanOverlay, setScanOverlay] = useState<{ cells: string[]; count: number } | null>(null);
  const scanTimeoutRef = useRef<number | null>(null);
  const [hoverCells, setHoverCells] = useState<string[]>([]);
  // 'How to Play' is now shown from Settings at App level.

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

  // Auto-login: if a nickname exists in localStorage, reuse it so switching modes doesn't require re-entering
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nickname');
      if (saved && saved.trim().length >= 2) {
        setNickname(saved);
        // Connect and set nickname immediately so we bypass the nickname screen on remounts
        socketService.connect();
        socketService.setNickname(saved.trim());
        showMessage('info', `Welcome back, ${saved}!`);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      // Use active power if armed
      if (activePower === 'cannons') {
        socketService.usePowerUp('cannons', { row, col });
        setActivePower(null);
        setGameState(prev => ({
          ...prev,
          powerUpsUsed: { ...(prev.powerUpsUsed || { cannons: false, scan: false, protect: false }), cannons: true }
        }));
        showMessage('info', 'Cannons fired in a 2x2 area!');
        return;
      }
      if (activePower === 'scan') {
        socketService.usePowerUp('scan', { row, col });
        setActivePower(null);
        setGameState(prev => ({
          ...prev,
          powerUpsUsed: { ...(prev.powerUpsUsed || { cannons: false, scan: false, protect: false }), scan: true }
        }));
        return;
      }

      // Default: normal shot
      socketService.fire(row, col);
      showMessage("info", "Firing...");
    },
    [
      gameState.myTurn,
      gameState.opponentBoard,
      gameState.phase,
      socketService,
      showMessage,
      activePower,
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
      try { localStorage.setItem('nickname', data.nickname); window.dispatchEvent(new CustomEvent('nicknameChanged', { detail: data.nickname })); } catch {}
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

      // Play result SFX (hit or miss) after result arrives
      try {
        if (result === 'hit') playHit();
        else playMiss();
      } catch {}
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
        ships: createInitialShips(mode),
        isFirstPlayer: false,
      });
      setNickname("");
      setMyPlayerId("");
    });

    // Power-up: Scan result with highlight overlay
    const onScan = ({ row, col, count }: { row: number; col: number; count: number }) => {
      showMessage('info', `Scan result: ${count} ship segment${count === 1 ? '' : 's'} in the 3x3 area.`);
      setActivePower(null);
      const maxR = gameState.opponentBoard.length;
      const maxC = gameState.opponentBoard[0]?.length ?? 0;
      const cells: string[] = [];
      for (let r = row - 1; r <= row + 1; r++) {
        for (let c = col - 1; c <= col + 1; c++) {
          if (r >= 0 && r < maxR && c >= 0 && c < maxC) {
            cells.push(`${r},${c}`);
          }
        }
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      setScanOverlay({ cells, count });
      scanTimeoutRef.current = window.setTimeout(() => {
        setScanOverlay(null);
        scanTimeoutRef.current = null;
      }, 2500);
    };
    socketService.onScanResult(onScan);

    return () => {
      socketService.removeAllListeners();
    };
  }, [myPlayerId, showMessage, socketService]);

  // Removed local How-to-Play modal; now opened from Settings in App.

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
      <div className="lobby-mode" aria-live="polite">
        <span className="mode-pill">{mode === 'blitz' ? 'Blitz' : 'Classic'}</span>
        <span className="mode-desc"> You are queued to play in {mode === 'blitz' ? 'Blitz' : 'Classic'} mode.</span>
      </div>
      <button onClick={joinGameQueue} className="join-queue-btn">
        🎯 Find Opponent ({mode === 'blitz' ? 'Blitz' : 'Classic'})
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
            highlightCells={[...(scanOverlay?.cells || []), ...hoverCells]}
            onCellHover={(row, col) => {
              if (!activePower) {
                setHoverCells([]);
                return;
              }
              const maxR = gameState.opponentBoard.length;
              const maxC = gameState.opponentBoard[0]?.length ?? 0;
              const list: string[] = [];
              if (activePower === 'scan') {
                for (let r = row - 1; r <= row + 1; r++) {
                  for (let c = col - 1; c <= col + 1; c++) {
                    if (r >= 0 && r < maxR && c >= 0 && c < maxC) list.push(`${r},${c}`);
                  }
                }
              } else if (activePower === 'cannons') {
                const coords = [
                  [row, col],
                  [row + 1, col],
                  [row, col + 1],
                  [row + 1, col + 1],
                ];
                coords.forEach(([r, c]) => {
                  if (r >= 0 && r < maxR && c >= 0 && c < maxC) list.push(`${r},${c}`);
                });
              }
              setHoverCells(list);
            }}
            onHoverEnd={() => setHoverCells([])}
          />
          {scanOverlay && (
            <div className="scan-result-pill">Scan: {scanOverlay.count} segment{scanOverlay.count === 1 ? '' : 's'}</div>
          )}
        </div>
      </div>

      {/* Blitz Power-Ups Bar */}
      {mode === 'blitz' && gameState.phase === 'playing' && (
        <div className="powerups-bar">
          <div className="powerups-title">Power-Ups</div>
          <div className="powerups-controls">
            <button
              className={`pu-btn ${activePower === 'cannons' ? 'active' : ''}`}
              disabled={!gameState.myTurn || gameState.paused || gameState.powerUpsUsed?.cannons}
              onClick={() => {
                if (gameState.powerUpsUsed?.cannons) return;
                setActivePower(activePower === 'cannons' ? null : 'cannons');
                if (activePower !== 'cannons') {
                  showMessage('info', 'Cannons ready: click a target cell on Enemy Waters to fire a 2x2 area.');
                }
              }}
            >
              🧨 Cannons {gameState.powerUpsUsed?.cannons ? '✓' : ''}
            </button>

            <button
              className={`pu-btn ${activePower === 'scan' ? 'active' : ''}`}
              disabled={!gameState.myTurn || gameState.paused || gameState.powerUpsUsed?.scan}
              onClick={() => {
                if (gameState.powerUpsUsed?.scan) return;
                setActivePower(activePower === 'scan' ? null : 'scan');
                if (activePower !== 'scan') {
                  showMessage('info', 'Scan armed: click a target cell on Enemy Waters to scan 3x3.');
                }
              }}
            >
              🔎 Scan {gameState.powerUpsUsed?.scan ? '✓' : ''}
            </button>

            <button
              className="pu-btn"
              disabled={!gameState.myTurn || gameState.paused || gameState.powerUpsUsed?.protect}
              onClick={() => {
                socketService.usePowerUp('protect');
                setGameState(prev => ({
                  ...prev,
                  powerUpsUsed: { ...(prev.powerUpsUsed || { cannons: false, scan: false, protect: false }), protect: true }
                }));
                showMessage('success', "Protect activated: opponent's next hit won't chain.");
              }}
            >
              🛡️ Protect {gameState.powerUpsUsed?.protect ? '✓' : ''}
            </button>

            {activePower && (
              <button className="pu-btn ghost" onClick={() => setActivePower(null)}>Cancel</button>
            )}
          </div>
          <div className="powerups-hint">
            One action per turn: shoot or one power-up.
          </div>
        </div>
      )}

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
      ships: createInitialShips(mode),
      paused: false,
      powerUpsUsed: { cannons: false, scan: false, protect: false },
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
      ships: createInitialShips(mode),
      powerUpsUsed: { cannons: false, scan: false, protect: false },
    }));
    setShowGameOverModal(false);
    showMessage("info", "Returned to lobby.");
  }, [showMessage]);

  return (
    <div className="game-container">
      {/* How to Play entry moved into Settings modal. */}

      {gameState.phase === "nickname" && renderNicknamePhase()}
      {gameState.phase === "lobby" && renderLobbyPhase()}
      {(gameState.phase === "waiting" ||
        gameState.phase === "placing" ||
        gameState.phase === "playing" ||
        gameState.phase === "game-over") &&
        renderGamePhase()}

      {/* How to Play modal is rendered at App level. */}

      {/* Blitz-only chat: visible during gameplay */}
      {mode === 'blitz' && gameState.phase === 'playing' && gameState.gameId && (
        <Chat gameId={gameState.gameId} myPlayerId={myPlayerId} />
      )}

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

      {/* Waiting room banner with mode indicator */}
      {gameState.phase === 'waiting' && (
        <div className="waiting-banner" role="status" aria-live="polite">
          <span className="mode-pill">{mode === 'blitz' ? 'Blitz' : 'Classic'}</span>
          <span className="waiting-text"> Matching… Looking for an opponent in {mode === 'blitz' ? 'Blitz' : 'Classic'} mode.</span>
        </div>
      )}
    </div>
  );
};

export default Game;
