interface PlayerControlsProps {
  onReady: () => void
}

function PlayerControls({ onReady }: PlayerControlsProps) {
  return (
    <div id="placement-controls" className="placement-controls">
      <p>Your ships have been placed. Click ready when you are happy.</p>
      <button id="ready-button" onClick={onReady}>
        Ready!
      </button>
    </div>
  )
}

export default PlayerControls
