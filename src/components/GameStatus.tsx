import type { GameState, GameMessage } from '../types/game';
import { formatTimer } from '../utils/gameUtils';

interface GameStatusProps {
  gameState: GameState;
  message: GameMessage;
  myNickname: string;
  onPause?: () => void;
}

function GameStatus({ gameState, message, myNickname, onPause }: GameStatusProps) {
  const getOpponentNickname = () => {
    return gameState.players.find(p => p.nickname !== myNickname)?.nickname || 'Opponent';
  };

  const getMyScore = () => {
    return gameState.players.find(p => p.nickname === myNickname)?.score || 0;
  };

  const getOpponentScore = () => {
    return gameState.players.find(p => p.nickname !== myNickname)?.score || 0;
  };

  return (
    <div className="game-status">
      <div className="status-message">
        <span className={`message ${message.type}`}>{message.text}</span>
      </div>
      
      {gameState.players.length > 0 && (
        <div className="game-info">
          <div className="players-info">
            <div className="player-card my-player">
              <span className="player-name">⚓ {myNickname}</span>
              <span className="player-score">Score: {getMyScore()}</span>
            </div>
            <div className="vs">VS</div>
            <div className="player-card opponent-player">
              <span className="player-name">🏴‍☠️ {getOpponentNickname()}</span>
              <span className="player-score">Score: {getOpponentScore()}</span>
            </div>
          </div>
          
          {gameState.phase === 'playing' && (
            <div className="game-timer">
              <span className="timer-label">⏱️ Turn Time Left:</span>
              <span className="timer-value">{formatTimer(gameState.timer)}</span>
            </div>
          )}
          
          {gameState.phase === 'playing' && (
            <div className="turn-indicator">
              {gameState.myTurn ? (
                <span className="my-turn">🎯 Your Turn!</span>
              ) : (
                <span className="opponent-turn">⏳ Opponent's Turn</span>
              )}
            </div>
          )}

          {gameState.phase === 'playing' && !gameState.paused && (
            <div className="controls" style={{ marginTop: '10px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button className="btn" onClick={onPause}>
                ⏸️ Pause
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default GameStatus;
