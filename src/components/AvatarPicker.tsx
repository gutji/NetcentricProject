import React from 'react';
import type { AvatarId } from './SettingsModal';

type Props = {
  open: boolean;
  value: AvatarId;
  onSelect: (v: AvatarId) => void;
  onClose: () => void;
};

const AVATARS: { id: AvatarId; label: string; emoji: string }[] = [
  { id: 'ship', label: 'Battleship', emoji: '🚢' },
  { id: 'anchor', label: 'Anchor', emoji: '⚓' },
  { id: 'kraken', label: 'Kraken', emoji: '🐙' },
  { id: 'shark', label: 'Shark', emoji: '🦈' },
];

const AvatarPicker: React.FC<Props> = ({ open, value, onSelect, onClose }) => {
  if (!open) return null;
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Choose your Avatar</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12 }}>
          {AVATARS.map(a => (
            <button
              key={a.id}
              onClick={() => onSelect(a.id)}
              className={`btn ${value === a.id ? 'primary' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                justifyContent: 'center',
                padding: '14px 10px',
                fontSize: 16,
              }}
            >
              <span style={{ fontSize: 24 }} aria-hidden>{a.emoji}</span>
              <span>{a.label}</span>
            </button>
          ))}
        </div>
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default AvatarPicker;
