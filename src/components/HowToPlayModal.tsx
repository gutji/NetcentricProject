type Props = { open: boolean; onClose: () => void };

export default function HowToPlayModal({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>📚 How to Play Battleship</h2>
        <div className="how-to-play-content">
          <h3>🎯 Objective</h3>
          <p>Be the first to sink all of your opponent's ships!</p>

          <h3>📋 Game Setup</h3>
          <p>• Place your ships on the grid by dragging or clicking</p>
          <p>• Ships cannot overlap or touch each other</p>
          <p>• Ships can be placed horizontally or vertically</p>

          <h3>⚓ Fleet Composition</h3>
          <p>• Carrier (5 squares) - 1 ship</p>
          <p>• Battleship (4 squares) - 1 ship</p>
          <p>• Cruiser (3 squares) - 1 ship</p>
          <p>• Submarine (3 squares) - 1 ship</p>
          <p>• Destroyer (2 squares) - 1 ship</p>

          <h3>🎮 Gameplay</h3>
          <p>• Take turns firing at your opponent's grid</p>
          <p>• Click on a square in the "Enemy Waters" grid to fire</p>
          <p>• Red squares indicate hits, blue squares indicate misses</p>
          <p>• Green squares show your own ships</p>

          <h3>🏆 Winning</h3>
          <p>• Sink all enemy ships to win!</p>
          <p>• A ship is sunk when all its squares are hit</p>

          <h3>⏸️ Game Controls</h3>
          <p>• Use the Pause button during gameplay to pause</p>
          <p>• Both players must agree to resume</p>
        </div>
        <button className="close-button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
