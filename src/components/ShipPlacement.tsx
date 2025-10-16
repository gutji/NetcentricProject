import React, { useState, useCallback } from "react";
import { canPlaceShip, placeShip, removeShip } from "../utils/gameUtils";
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

  return (
    <div className="ship-placement-container">
      {" "}
      <div className="available-ships">
        {" "}
        <h4>Your Ships</h4>{" "}
        <div className="ships-list">
          {ships.map((ship) => (
            <div
              key={ship.id}
              className={`ship-draggable ${ship.orientation}`}
              draggable
              onDragStart={() => handleDragStart(ship)}
              onClick={() => handleRotate(ship.id)}
              title="Click to rotate (R)"
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
                cursor: "grab",
              }}
            />
          ))}{" "}
        </div>{" "}
      </div>
      ```
      <div className="placement-grid">
        {board.map((row, rIdx) => (
          <div key={rIdx} className="placement-row">
            {row.map((cell, cIdx) => (
              <div
                key={cIdx}
                className={`placement-cell ${cell === "S" ? "ship-cell" : ""}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(rIdx, cIdx)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ShipPlacement;
