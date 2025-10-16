interface PlayerControlsProps {
  onConfirmPlacement: () => void;
  shipsPlaced: boolean;
}

function PlayerControls({
  onConfirmPlacement,
  shipsPlaced,
}: PlayerControlsProps) {
  return (
    <div className="placement-controls">
      <div className="ship-placement">
        <h3>🚢 Ship Placement</h3>
        <p>Place your fleet strategically to defend against enemy attacks!</p>

        <div className="placement-buttons">
          <button
            onClick={onConfirmPlacement}
            className="ready-btn"
            disabled={!shipsPlaced}
          >
            ⚓ Ready for Battle!
          </button>
        </div>

        {!shipsPlaced && (
          <p className="hint">
            Click "Random Placement" to position your ships automatically.
          </p>
        )}

        {shipsPlaced && (
          <p className="hint">
            Ships placed! Click "Ready for Battle" when you're satisfied with
            the placement.
          </p>
        )}
      </div>
    </div>
  );
}

export default PlayerControls;
