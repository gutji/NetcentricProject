
export type ThemePreset = 'classic' | 'ocean' | 'purple' | 'midnight' | 'blitz';

export type AvatarId = 'ship' | 'anchor' | 'kraken' | 'shark';

export interface GameSettings {
  theme: ThemePreset;
  muteMusic: boolean;
  muteSfx: boolean;
  avatar?: AvatarId; // optional for backward compatibility
}

interface SettingsModalProps {
  open: boolean;
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
  onClose: () => void;
  onShowHowToPlay?: () => void;
}

const presets: { value: ThemePreset; label: string }[] = [
  { value: 'classic', label: 'Classic (Purple)' },
  { value: 'ocean', label: 'Ocean Blue' },
  { value: 'purple', label: 'Royal Purple' },
  { value: 'midnight', label: 'Midnight' },
  { value: 'blitz', label: 'Blitz Blue' },
];

export default function SettingsModal({ open, settings, onChange, onClose, onShowHowToPlay }: SettingsModalProps) {
  if (!open) return null;
  const update = (patch: Partial<GameSettings>) => onChange({ ...settings, ...patch });

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <h2 className="modal-title">Settings</h2>

        <div className="mb-3">
          <label htmlFor="theme" className="mb-1" style={{ display: 'block' }}>Background Theme</label>
          <select
            id="theme"
            value={settings.theme}
            onChange={(e) => update({ theme: e.target.value as ThemePreset })}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8 }}
          >
            {presets.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="mb-2" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            id="muteMusic"
            type="checkbox"
            checked={settings.muteMusic}
            onChange={(e) => update({ muteMusic: e.target.checked })}
          />
          <label htmlFor="muteMusic">Mute Music</label>
        </div>

        <div className="mb-3" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            id="muteSfx"
            type="checkbox"
            checked={settings.muteSfx}
            onChange={(e) => update({ muteSfx: e.target.checked })}
          />
          <label htmlFor="muteSfx">Mute Sound Effects</label>
        </div>

        <div className="modal-actions" style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <button className="btn" onClick={() => { onShowHowToPlay?.(); }}>📚 How to Play</button>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
