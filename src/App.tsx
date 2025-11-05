import { useEffect, useMemo, useState } from 'react'
import Game from './components/Game'
import GameBlitz from './components/GameBlitz'
import ModeMenu from './components/ModeMenu'
import SettingsModal, { type GameSettings } from './components/SettingsModal'
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
      {mode !== null && !inMatch && (
        <div className="mode-switcher">
          <button onClick={() => setMode(null)} aria-label="Change mode">
            Change mode
          </button>
        </div>
      )}
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
    </div>
  )
}

export default App
