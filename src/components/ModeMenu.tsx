import React from 'react';
import './Game.css';

interface ModeMenuProps {
  onSelect: (mode: 'classic' | 'blitz') => void;
}

const ModeMenu: React.FC<ModeMenuProps> = ({ onSelect }) => {
  return (
    <div className="lobby-phase" style={{ maxWidth: 720 }}>
      <h2>Choose Game Mode</h2>
      <p>Select how you want to play.</p>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="join-queue-btn" onClick={() => onSelect('classic')}>
          ⚓ Classic Mode
        </button>
        <button className="join-queue-btn" onClick={() => onSelect('blitz')}>
          ⚡ Blitz Mode
        </button>
      </div>
    </div>
  );
};

export default ModeMenu;
