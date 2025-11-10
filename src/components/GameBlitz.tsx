// src/components/GameBlitz.tsx
// Blitz mode: shares core gameplay, but labelled distinctly. Server still enforces per-turn timer.
import React from 'react';
import Game from './Game';

// For now, reuse the existing Game component behavior.
// If you want divergent rules later (e.g., different ship sizes or per-turn rules),
// we can fork this into a separate implementation.

type Props = { onInMatchChange?: (inMatch: boolean) => void };

const GameBlitz: React.FC<Props> = ({ onInMatchChange }) => {
  return <Game mode="blitz" onInMatchChange={onInMatchChange} />;
};

export default GameBlitz;
