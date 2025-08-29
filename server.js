// server.js (Refactored for Socket.IO)

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let waitingPlayer = null;

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    if (waitingPlayer) {
        const gameId = `game-${socket.id}-${waitingPlayer.id}`;
        
        // Join both players to a room
        socket.join(gameId);
        waitingPlayer.join(gameId);

        // Store game info on sockets
        waitingPlayer.gameId = gameId;
        socket.gameId = gameId;
        waitingPlayer.playerIndex = 0;
        socket.playerIndex = 1;

        console.log(`Game ${gameId} started between ${waitingPlayer.id} and ${socket.id}`);

        // Notify both players that the game is starting
        io.to(gameId).emit('gameStart', { gameId });

        waitingPlayer = null;
    } else {
        waitingPlayer = socket;
        socket.emit('waiting');
        console.log(`${socket.id} is waiting for an opponent.`);
    }

    socket.on('shipsPlaced', (board) => {
        // Store the board on the socket object
        socket.board = board;
        const gameId = socket.gameId;
        const playerIndex = socket.playerIndex;
        
        console.log(`Player ${playerIndex} in game ${gameId} placed ships.`);

        // Use 'to(room).emit' to send to the opponent only
        socket.to(gameId).emit('opponentReady');

        // Check if both players are ready
        const socketsInRoom = Array.from(io.sockets.sockets.values()).filter(s => s.gameId === gameId);
        const opponent = socketsInRoom.find(s => s.id !== socket.id);

        if (opponent && opponent.board) {
            // Both are ready, start the game
            io.to(gameId).emit('allPlayersReady');
            // Player 0 starts
            socketsInRoom.find(s => s.playerIndex === 0).emit('yourTurn');
            socketsInRoom.find(s => s.playerIndex === 1).emit('opponentTurn');
        }
    });

    socket.on('fire', ({ row, col }) => {
        const gameId = socket.gameId;
        const socketsInRoom = Array.from(io.sockets.sockets.values()).filter(s => s.gameId === gameId);
        const opponent = socketsInRoom.find(s => s.id !== socket.id);

        if (!opponent || !opponent.board) return;

        const opponentBoard = opponent.board;
        const cell = opponentBoard[row][col];
        let result = 'miss';

        if (cell === 'S') {
            result = 'hit';
            opponentBoard[row][col] = 'H';
        } else {
            opponentBoard[row][col] = 'M';
        }

        // Check for win condition
        const allShipsSunk = !opponentBoard.flat().includes('S');

        // Send result to the player who fired
        socket.emit('fireResult', { row, col, result, isOwnGrid: false });
        // Send result to the opponent
        opponent.emit('fireResult', { row, col, result, isOwnGrid: true });

        if (allShipsSunk) {
            socket.emit('gameOver', { result: 'win' });
            opponent.emit('gameOver', { result: 'loss' });
        } else {
            // Switch turns
            socket.emit('opponentTurn');
            opponent.emit('yourTurn');
        }
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        if (socket === waitingPlayer) {
            waitingPlayer = null;
            console.log('Waiting player disconnected.');
        } else if (socket.gameId) {
            // Notify the other player in the room
            socket.to(socket.gameId).emit('opponentDisconnected');
            console.log(`Player in game ${socket.gameId} disconnected.`);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});