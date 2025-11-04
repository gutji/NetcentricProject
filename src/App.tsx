import { useEffect, useState } from 'react'
import Game from './components/Game'
import GameBlitz from './components/GameBlitz'
import ModeMenu from './components/ModeMenu'
import './App.css'

function App() {
  const [mode, setMode] = useState<'classic' | 'blitz' | null>(() => {
    const saved = localStorage.getItem('mode') as 'classic' | 'blitz' | null
    return saved ?? null
  })
  const [inMatch, setInMatch] = useState(false)

  useEffect(() => {
    if (mode) {
      localStorage.setItem('mode', mode)
    } else {
      localStorage.removeItem('mode')
    }
  }, [mode])

  return (
    <div className="App">
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
    </div>
  )
}

export default App
