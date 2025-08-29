// public/client.js (Refactored for Socket.IO)

document.addEventListener('DOMContentLoaded', () => {
    const playerGrid = document.getElementById('player-grid');
    const opponentGrid = document.getElementById('opponent-grid');
    const statusMessage = document.getElementById('status-message');
    const readyButton = document.getElementById('ready-button');
    const placementControls = document.getElementById('placement-controls');
    const GRID_SIZE = 10;
    
    // Using the same predefined board layout
    const playerBoard = [
        ['S','S','S','S','S','W','W','W','W','W'],
        ['W','W','W','W','W','W','W','W','W','W'],
        ['S','S','S','S','W','W','W','W','W','W'],
        ['W','W','W','W','W','W','W','W','W','W'],
        ['S','S','S','W','W','W','W','W','W','W'],
        ['W','W','W','W','W','W','W','W','W','W'],
        ['S','S','S','W','W','W','W','W','W','W'],
        ['W','W','W','W','W','W','W','W','W','W'],
        ['S','S','W','W','W','W','W','W','W','W'],
        ['W','W','W','W','W','W','W','W','W','W'],
    ];

    let myTurn = false;
    
    function createGrid(gridElement) {
        // ... (This function remains the same as before)
        gridElement.innerHTML = '';
        for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = Math.floor(i / GRID_SIZE);
            cell.dataset.col = i % GRID_SIZE;
            gridElement.appendChild(cell);
        }
    }

    function renderPlayerGrid() {
        // ... (This function remains the same as before)
        const cells = playerGrid.querySelectorAll('.cell');
        cells.forEach((cell, index) => {
            const row = Math.floor(index / GRID_SIZE);
            const col = index % GRID_SIZE;
            if (playerBoard[row][col] === 'S') {
                cell.classList.add('ship');
            }
        });
    }

    createGrid(playerGrid);
    createGrid(opponentGrid);
    
    // --- Socket.IO Communication ---
    const socket = io(); // Connect to the server

    socket.on('connect', () => {
        statusMessage.textContent = 'Connected! Waiting for an opponent...';
    });

    socket.on('waiting', () => {
        statusMessage.textContent = 'Waiting for an opponent to join.';
    });

    socket.on('gameStart', () => {
        statusMessage.textContent = 'Game started! Place your ships (pre-placed for now). Click Ready!';
        placementControls.style.display = 'block';
        renderPlayerGrid();
    });
    
    socket.on('opponentReady', () => {
        statusMessage.textContent = 'Opponent is ready. Your turn to get ready!';
    });

    socket.on('yourTurn', () => {
        myTurn = true;
        statusMessage.textContent = 'Your turn to fire!';
        opponentGrid.style.cursor = 'pointer';
    });

    socket.on('opponentTurn', () => {
        myTurn = false;
        statusMessage.textContent = "Opponent's turn.";
        opponentGrid.style.cursor = 'default';
    });

    socket.on('fireResult', (data) => {
        const { row, col, result, isOwnGrid } = data;
        const grid = isOwnGrid ? playerGrid : opponentGrid;
        const cell = grid.querySelector(`[data-row='${row}'][data-col='${col}']`);
        cell.classList.add(result); // 'hit' or 'miss'
    });

    socket.on('gameOver', (data) => {
        myTurn = false;
        statusMessage.textContent = data.result === 'win' ? 'You win! Congratulations!' : 'You lose! Better luck next time.';
        opponentGrid.style.cursor = 'default';
    });

    socket.on('opponentDisconnected', () => {
        myTurn = false;
        statusMessage.textContent = 'Your opponent has disconnected. You win!';
    });

    socket.on('disconnect', () => {
        statusMessage.textContent = 'Connection to server lost.';
    });

    // --- Event Listeners ---
    readyButton.addEventListener('click', () => {
        socket.emit('shipsPlaced', playerBoard);
        statusMessage.textContent = 'Waiting for opponent to be ready...';
        placementControls.style.display = 'none';
    });

    opponentGrid.addEventListener('click', (e) => {
        if (!myTurn || !e.target.classList.contains('cell')) return;

        const cell = e.target;
        if (cell.classList.contains('hit') || cell.classList.contains('miss')) {
            return;
        }
        
        const { row, col } = cell.dataset;
        socket.emit('fire', { row: parseInt(row), col: parseInt(col) });
    });
});