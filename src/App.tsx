import { useEffect, useMemo, useState } from 'react'
import Game from './components/Game'
import GameBlitz from './components/GameBlitz'
import ModeMenu from './components/ModeMenu'
import SettingsModal, { type GameSettings, type AvatarId } from './components/SettingsModal'
import AvatarPicker from './components/AvatarPicker'
import HowToPlayModal from './components/HowToPlayModal'
import { loadSettings, saveSettings, themeClass } from './services/settings'
import './App.css'

function App() {
  const [mode, setMode] = useState<'classic' | 'blitz' | null>(() => {
    const saved = localStorage.getItem('mode') as 'classic' | 'blitz' | null
    return saved ?? null
  })
  const [inMatch, setInMatch] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings())
  const [showHowTo, setShowHowTo] = useState(false)
  const [showAvatar, setShowAvatar] = useState(false)
  const [displayName, setDisplayName] = useState<string>(() => localStorage.getItem('nickname') || 'Player')

  useEffect(() => {
    if (mode) {
      localStorage.setItem('mode', mode)
    } else {
      localStorage.removeItem('mode')
    }
  }, [mode])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  // React to nickname changes coming from Game when server accepts nickname
  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const anyEvt = e as CustomEvent<string>
        if (anyEvt?.detail) setDisplayName(anyEvt.detail)
        else setDisplayName(localStorage.getItem('nickname') || 'Player')
      } catch {
        setDisplayName(localStorage.getItem('nickname') || 'Player')
      }
    }
    window.addEventListener('nicknameChanged', handler)
    return () => window.removeEventListener('nicknameChanged', handler)
  }, [])

  const appClassName = useMemo(() => {
    const classes = ['App', themeClass(settings.theme)]
    return classes.join(' ')
  }, [settings.theme])

  return (
    <div className={appClassName}>
      <div className="settings-button">
        <button onClick={() => setShowSettings(true)} aria-label="Open settings">⚙️ Settings</button>
      </div>
      {mode && (
        <div className="mode-badge" aria-live="polite">
          {mode === 'blitz' ? 'Blitz Mode' : 'Classic Mode'}
        </div>
      )}
      {/* Profile and mode switcher (top-right area) */}
      <div className="top-right-controls">
        {mode !== null && !inMatch && (
          <div className="mode-switcher">
            <button onClick={() => setMode(null)} aria-label="Change mode">
              Change mode
            </button>
          </div>
        )}
        <div className="profile-button">
          <button onClick={() => setShowAvatar(true)} aria-label="Open profile">
            <span className="avatar-circle" aria-hidden>
              {settings.avatar === 'anchor' ? '⚓' : settings.avatar === 'kraken' ? '🐙' : settings.avatar === 'shark' ? '🦈' : '🚢'}
            </span>
            <span className="avatar-name">{displayName}</span>
          </button>
        </div>
      </div>
      {mode === null && <ModeMenu onSelect={setMode} />}
      {mode === 'classic' && <Game mode="classic" onInMatchChange={setInMatch} />}
      {mode === 'blitz' && <GameBlitz onInMatchChange={setInMatch} />}

      <SettingsModal
        open={showSettings}
        settings={settings}
        onChange={setSettings}
        onClose={() => setShowSettings(false)}
        onShowHowToPlay={() => { setShowSettings(false); setShowHowTo(true); }}
      />

      <HowToPlayModal open={showHowTo} onClose={() => setShowHowTo(false)} />

      <AvatarPicker
        open={showAvatar}
        value={(settings.avatar as AvatarId) || 'ship'}
        onSelect={(v) => { setSettings(s => ({ ...s, avatar: v })); setShowAvatar(false); }}
        onClose={() => setShowAvatar(false)}
      />
    </div>
  )
}

export default App
