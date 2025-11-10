import React, { useState, useCallback } from "react";
import { canPlaceShip, placeShip, removeShip, getShipAtPosition } from "../utils/gameUtils";
import type { CellState, Ship } from "../types/game";
import "./ShipPlacement.css";

interface ShipPlacementProps {
  board: CellState[][];
  ships: Ship[];
  onBoardChange: (board: CellState[][]) => void;
  onShipsChange: (ships: Ship[]) => void;
}

const ShipPlacement: React.FC<ShipPlacementProps> = ({
  board,
  ships,
  onBoardChange,
  onShipsChange,
}) => {
  const [selectedShip, setSelectedShip] = useState<Ship | null>(null);

  // Rotate ship before dragging (R key)
  const handleRotate = useCallback(
    (shipId: string) => {
      onShipsChange(
        ships.map((s) =>
          s.id === shipId
            ? {
                ...s,
                orientation:
                  s.orientation === "horizontal" ? "vertical" : "horizontal",
              }
            : s
        )
      );
    },
    [ships, onShipsChange]
  );

  // Drag start handler
  const handleDragStart = (ship: Ship) => {
    setSelectedShip(ship);
  };

  // Select a ship (tap or click)
  const handleSelectShip = (ship: Ship) => {
    setSelectedShip(ship);
  };

  // Drag start from a placed cell on the board
  const handleCellDragStart = (row: number, col: number) => {
    const ship = getShipAtPosition(ships, row, col);
    if (ship) {
      setSelectedShip(ship);
    }
  };

  // Touch drop handler via pointer (tap to place)
  const handleCellTapOrClick = (row: number, col: number, cell: CellState) => {
    // If tapping/clicking on a placed ship, pick it up
    if (cell === 'S' && !selectedShip) {
      handleCellDragStart(row, col);
      return;
    }
    if (selectedShip) {
      handleDrop(row, col);
    }
  };

  // Drop handler for board cells
  const handleDrop = (row: number, col: number) => {
    if (!selectedShip) return;
    let newBoard = [...board];

    // Remove ship if already placed
    if (selectedShip.placed && selectedShip.position) {
      newBoard = removeShip(newBoard, selectedShip);
    }

    // Try placing new position
    if (
      canPlaceShip(newBoard, selectedShip, row, col, selectedShip.orientation)
    ) {
      const updatedBoard = placeShip(
        newBoard,
        selectedShip,
        row,
        col,
        selectedShip.orientation
      );
      const updatedShips = ships.map((s) =>
        s.id === selectedShip.id
          ? { ...s, placed: true, position: { row, col } }
          : s
      );

      onBoardChange(updatedBoard);
      onShipsChange(updatedShips);
    } else {
      alert("Invalid placement — try another spot!");
    }

    setSelectedShip(null);
  };

  // Drop handler for inventory area (return ship to inventory)
  const handleInventoryDrop = () => {
    if (!selectedShip) return;

    let newBoard = [...board];

    // If ship is on the board, remove it
    if (selectedShip.placed && selectedShip.position) {
      newBoard = removeShip(newBoard, selectedShip);
    }

    const updatedShips = ships.map((s) =>
      s.id === selectedShip.id
        ? { ...s, placed: false, position: null }
        : s
    );

    onBoardChange(newBoard);
    onShipsChange(updatedShips);
    setSelectedShip(null);
  };

  return (
    <div className="ship-placement-container">
      <div
        className="available-ships"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleInventoryDrop}
      >
        <h4>Your Ships</h4>
        <div className="ships-list">
          {ships.map((ship) => (
            <div key={ship.id} className="ship-item">
              <div
                className={`ship-draggable ${ship.orientation}`}
                draggable
                onDragStart={() => handleDragStart(ship)}
                onClick={() => handleSelectShip(ship)}
                title="Tap/Click to select; use ↻ to rotate"
                style={{
                  width:
                    ship.orientation === "horizontal"
                      ? `${ship.size * 35}px`
                      : "35px",
                  height:
                    ship.orientation === "vertical"
                      ? `${ship.size * 35}px`
                      : "35px",
                  opacity: ship.placed ? 0.5 : 1,
                  cursor: "pointer",
                }}
              />
              <button
                type="button"
                className="rotate-btn"
                onClick={() => handleRotate(ship.id)}
                aria-label="Rotate ship"
                title="Rotate ship"
              >
                ↻
              </button>
            </div>
          ))}
        </div>{" "}
      </div>
      <div className="placement-grid">
        {board.map((row, rIdx) => (
          <div key={rIdx} className="placement-row">
            {row.map((cell, cIdx) => (
              <div
                key={cIdx}
                className={`placement-cell ${cell === "S" ? "ship-cell" : ""}`}
                draggable={cell === "S"}
                onDragOver={(e) => e.preventDefault()}
                onDragStart={() => handleCellDragStart(rIdx, cIdx)}
                onDrop={() => handleDrop(rIdx, cIdx)}
                onClick={() => handleCellTapOrClick(rIdx, cIdx, cell)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ShipPlacement;
