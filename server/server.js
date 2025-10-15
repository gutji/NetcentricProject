// Enhanced Battleship Server with UI and all requirements

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const LAN_CLIENT = process.env.LAN_CLIENT || `http://192.168.1.50:5173`;
const isDev = process.env.NODE_ENV !== 'production';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: isDev ? '*' : [
            "http://localhost:5173", 
            "http://localhost:3000",
            LAN_CLIENT
        ],
        methods: ["GET", "POST"]
    }
});

const cors = require('cors');

app.use(cors({
    origin: isDev ? '*' : [
        "http://localhost:5173",
        "http://localhost:3000",
        LAN_CLIENT
    ],
    methods: ["GET","POST"]
}));

// Serve static files for server UI
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Game state
let gameState = {
    connectedClients: new Map(),
    waitingPlayers: [],
    activeGames: new Map(),
    clientCount: 0
};

// Server routes for admin UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/stats', (req, res) => {
    res.json({
        clientCount: gameState.clientCount,
        connectedClients: Array.from(gameState.connectedClients.values()),
        activeGames: gameState.activeGames.size,
        waitingPlayers: gameState.waitingPlayers.length
    });
});

app.post('/api/reset', (req, res) => {
    // Reset all game state
    gameState.connectedClients.forEach(client => {
        if (client.socket) {
            client.socket.emit('serverReset');
        }
    });
    
    gameState.connectedClients.clear();
    gameState.waitingPlayers = [];
    gameState.activeGames.clear();
    gameState.clientCount = 0;
    
    console.log('Server state reset by admin');
    res.json({ success: true, message: 'Server state reset successfully' });
});

// Utility functions
function generateGameId() {
    return `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getRandomPlayer(players) {
    return players[Math.floor(Math.random() * players.length)];
}

function updateClientStats() {
    // Broadcast updated stats to admin interface
    io.emit('statsUpdate', {
        clientCount: gameState.clientCount,
        connectedClients: Array.from(gameState.connectedClients.values()).map(c => ({
            id: c.id,
            nickname: c.nickname,
            score: c.score,
            status: c.status
        })),
        activeGames: gameState.activeGames.size,
        waitingPlayers: gameState.waitingPlayers.length
    });

    // Also broadcast client list to all game clients so UIs update
    io.emit('clientsInfo', {
        connectedClients: Array.from(gameState.connectedClients.values()).map(c => ({
            id: c.id,
            nickname: c.nickname,
            score: c.score,
            status: c.status
        }))
    });
}

function startGameTimer(gameId) {
    const gameData = gameState.activeGames.get(gameId);
    if (!gameData) return;

    const timer = setInterval(() => {
        gameData.gameTimer--;
        io.to(gameId).emit('timerUpdate', gameData.gameTimer);
        
        if (gameData.gameTimer <= 0) {
            clearInterval(timer);
            // Handle game timeout - random winner
            const randomWinner = getRandomPlayer(gameData.players);
            const loser = gameData.players.find(p => p.id !== randomWinner.id);
            
            randomWinner.score += 10;
            
            io.to(gameId).emit('gameOver', {
                result: 'timeout',
                winner: randomWinner.id,
                winnerNickname: randomWinner.nickname
            });
            
            // Clean up game
            gameData.players.forEach(player => {
                player.status = 'lobby';
                player.gameId = null;
                player.playerIndex = null;
                player.board = null;
                player.isReady = false;
            });
            
            gameState.activeGames.delete(gameId);
            updateClientStats();
        }
    }, 1000);
    
    gameData.timer = timer;
}

function startTurnTimer(game, playerSocket) {
  let timer = 10;
  clearInterval(game.turnTimerInterval);

  // Emit timer update every second
  game.turnTimerInterval = setInterval(() => {
    timer--;
    playerSocket.emit('turnTimerUpdate', timer);

    if (timer <= 0) {
      clearInterval(game.turnTimerInterval);
      // Skip turn if no action
      playerSocket.emit('turnSkipped');
      game.skipPlayerTurn(); // Implement this to switch turns in your game logic
    }
  }, 1000);

  // Initial timer emit
  playerSocket.emit('turnTimerUpdate', timer);
}

// When a player's turn starts
function onPlayerTurn(game, playerSocket) {
  startTurnTimer(game, playerSocket);
  playerSocket.emit('yourTurn');
}

// When player fires, clear timer
function onPlayerFire(game, playerSocket) {
  clearInterval(game.turnTimerInterval);
}

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    gameState.clientCount++;
    
    // Initialize client data
    const clientData = {
        id: socket.id,
        socket: socket,
        nickname: '',
        score: 0,
        status: 'connected',
        gameId: null,
        playerIndex: null,
        board: null,
        isReady: false
    };
    
    gameState.connectedClients.set(socket.id, clientData);
    updateClientStats();

    // Send connected clients info to new client
    socket.emit('clientsInfo', {
        connectedClients: Array.from(gameState.connectedClients.values()).map(c => ({
            id: c.id,
            nickname: c.nickname,
            score: c.score,
            status: c.status
        }))
    });

    // Handle nickname setting
    socket.on('setNickname', (nickname) => {
        const client = gameState.connectedClients.get(socket.id);
        if (client) {
            client.nickname = nickname;
            client.status = 'lobby';
            console.log(`Client ${socket.id} set nickname: ${nickname}`);
            socket.emit('nicknameSet', { nickname, clientId: socket.id });
            updateClientStats();
        }
    });

    // Handle joining game queue
    socket.on('joinQueue', () => {
        const client = gameState.connectedClients.get(socket.id);
        if (!client || !client.nickname) return;

        if (gameState.waitingPlayers.length > 0) {
            // Match with waiting player
            const waitingPlayer = gameState.waitingPlayers.shift();
            const gameId = generateGameId();
            
            // Randomly decide who goes first
            const players = [client, waitingPlayer];
            const firstPlayer = getRandomPlayer(players);
            const secondPlayer = players.find(p => p.id !== firstPlayer.id);
            
            // Setup game
            const gameData = {
                id: gameId,
                players: [firstPlayer, secondPlayer],
                currentTurn: firstPlayer.id,
                gameTimer: 300, // 5 minutes
                startTime: Date.now(),
                status: 'waiting_for_ships'
            };
            
            gameState.activeGames.set(gameId, gameData);
            
            // Join both players to game room
            socket.join(gameId);
            waitingPlayer.socket.join(gameId);
            
            // Update client data
            firstPlayer.gameId = gameId;
            firstPlayer.playerIndex = 0;
            firstPlayer.status = 'in_game';
            
            secondPlayer.gameId = gameId;
            secondPlayer.playerIndex = 1;
            secondPlayer.status = 'in_game';

            console.log(`Game ${gameId} started between ${firstPlayer.nickname} and ${secondPlayer.nickname}`);
            console.log(`${firstPlayer.nickname} goes first`);

            // Notify both players
            io.to(gameId).emit('gameStart', { 
                gameId,
                players: [
                    { id: firstPlayer.id, nickname: firstPlayer.nickname, score: firstPlayer.score },
                    { id: secondPlayer.id, nickname: secondPlayer.nickname, score: secondPlayer.score }
                ],
                firstPlayer: firstPlayer.id,
                gameTimer: gameData.gameTimer
            });

            updateClientStats();
        } else {
            // Add to waiting queue
            gameState.waitingPlayers.push(client);
            client.status = 'waiting';
            socket.emit('waiting');
            console.log(`${client.nickname} is waiting for an opponent`);
            updateClientStats();
        }
    });

    socket.on('shipsPlaced', (board) => {
        const client = gameState.connectedClients.get(socket.id);
        if (!client || !client.gameId) return;

        client.board = board;
        client.isReady = true;
        const gameData = gameState.activeGames.get(client.gameId);
        
        console.log(`${client.nickname} placed ships in game ${client.gameId}`);

        // Notify opponent that this player is ready
        socket.to(client.gameId).emit('opponentReady');

        // Check if both players are ready
        const allPlayersReady = gameData.players.every(p => p.isReady);
        
        if (allPlayersReady) {
            gameData.status = 'active';
            console.log(`Game ${client.gameId} is now active`);
            
            // Start the game timer
            startGameTimer(client.gameId);
            
            // Notify players game is starting
            io.to(client.gameId).emit('allPlayersReady');
            
            // Set first player's turn
            const firstPlayer = gameData.players.find(p => p.id === gameData.currentTurn);
            const secondPlayer = gameData.players.find(p => p.id !== gameData.currentTurn);
            
            firstPlayer.socket.emit('yourTurn');
            secondPlayer.socket.emit('opponentTurn');
            
            updateClientStats();
        }
    });

    socket.on('fire', ({ row, col }) => {
        const client = gameState.connectedClients.get(socket.id);
        if (!client || !client.gameId) return;

        const gameData = gameState.activeGames.get(client.gameId);
        if (!gameData || gameData.currentTurn !== client.id) return;

        const opponent = gameData.players.find(p => p.id !== client.id);
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

        console.log(`${client.nickname} fired at (${row},${col}): ${result}`);

        // Check for win condition
        const allShipsSunk = !opponentBoard.flat().includes('S');

        // Send result to both players
        client.socket.emit('fireResult', { row, col, result, isOwnGrid: false });
        opponent.socket.emit('fireResult', { row, col, result, isOwnGrid: true });

        if (allShipsSunk) {
            // Game over - current player wins
            client.score += 10;
            
            // Clear the timer
            if (gameData.timer) {
                clearInterval(gameData.timer);
            }
            
            client.socket.emit('gameOver', { result: 'win' });
            opponent.socket.emit('gameOver', { result: 'loss' });
            
            console.log(`Game ${client.gameId} over: ${client.nickname} wins!`);
            
            // Clean up game
            gameData.players.forEach(player => {
                player.status = 'lobby';
                player.gameId = null;
                player.playerIndex = null;
                player.board = null;
                player.isReady = false;
            });
            
            gameState.activeGames.delete(client.gameId);
            updateClientStats();
        } else {
            // Switch turns
            gameData.currentTurn = opponent.id;
            client.socket.emit('opponentTurn');
            opponent.socket.emit('yourTurn');
        }
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        
        const client = gameState.connectedClients.get(socket.id);
        if (!client) return;

        // Handle game cleanup
        if (client.gameId) {
            const gameData = gameState.activeGames.get(client.gameId);
            if (gameData) {
                // Clear timer if exists
                if (gameData.timer) {
                    clearInterval(gameData.timer);
                }
                
                // Notify opponent
                socket.to(client.gameId).emit('opponentDisconnected');
                
                // Award points to remaining player
                const opponent = gameData.players.find(p => p.id !== client.id);
                if (opponent) {
                    opponent.score += 5; // Points for opponent disconnect
                    opponent.status = 'lobby';
                    opponent.gameId = null;
                    opponent.playerIndex = null;
                    opponent.board = null;
                    opponent.isReady = false;
                }
                
                gameState.activeGames.delete(client.gameId);
            }
        }
        
        // Remove from waiting players if present
        gameState.waitingPlayers = gameState.waitingPlayers.filter(p => p.id !== socket.id);
        
        // Remove from connected clients
        gameState.connectedClients.delete(socket.id);
        gameState.clientCount--;
        
        updateClientStats();
    });
});

const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 3001;

server.listen(PORT, HOST, () => {
  console.log(`Enhanced Battleship Server running on http://${HOST}:${PORT}`);
  console.log(`Admin interface: http://${HOST}:${PORT}`);
});