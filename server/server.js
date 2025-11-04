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
    waitingPlayers: { classic: [], blitz: [] },
    activeGames: new Map(),
    clientCount: 0
};

// Server routes for admin UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/stats', (req, res) => {
    const games = Array.from(gameState.activeGames.values()).map(g => ({
        id: g.id,
        mode: g.mode || 'classic',
        status: g.status,
        currentTurn: g.currentTurn,
        gameTimer: g.gameTimer,
        players: g.players.map(p => ({ id: p.id, nickname: p.nickname }))
    }));

    const connectedClients = Array.from(gameState.connectedClients.values()).map(c => {
        const gm = c.gameId ? gameState.activeGames.get(c.gameId) : null;
        const mode = gm?.mode || c.queueMode || null;
        return {
            id: c.id,
            nickname: c.nickname,
            score: c.score,
            headtoheadWins: c.headtoheadWins,
            status: c.status,
            mode
        };
    });

    res.json({
        clientCount: gameState.clientCount,
        connectedClients,
        activeGames: gameState.activeGames.size,
        waitingPlayers: (gameState.waitingPlayers.classic.length + gameState.waitingPlayers.blitz.length),
        games
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
    gameState.waitingPlayers = { classic: [], blitz: [] };
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
    const games = Array.from(gameState.activeGames.values()).map(g => ({
        id: g.id,
        mode: g.mode || 'classic',
        status: g.status,
        currentTurn: g.currentTurn,
        gameTimer: g.gameTimer,
        players: g.players.map(p => ({ id: p.id, nickname: p.nickname }))
    }));

    const payload = {
        clientCount: gameState.clientCount,
        connectedClients: Array.from(gameState.connectedClients.values()).map(c => {
            const gm = c.gameId ? gameState.activeGames.get(c.gameId) : null;
            const mode = gm?.mode || c.queueMode || null;
            return {
                id: c.id,
                nickname: c.nickname,
                score: c.score,
                headtoheadWins: c.headtoheadWins,
                status: c.status,
                mode
            };
        }),
        activeGames: gameState.activeGames.size,
        waitingPlayers: (gameState.waitingPlayers.classic.length + gameState.waitingPlayers.blitz.length),
        games
    };

    // Emit only to admin namespace so admin panels receive updates
    io.of('/admin').emit('statsUpdate', payload);

    // Also broadcast client list to all game clients so UIs update
    io.emit('clientsInfo', {
        connectedClients: Array.from(gameState.connectedClients.values()).map(c => ({
            id: c.id,
            nickname: c.nickname,
            score: c.score,
            headtoheadWins: c.headtoheadWins,
            status: c.status
        }))
    });
}

// Admin namespace: used by admin UI so it's not counted as a game client
io.of('/admin').on('connection', (socket) => {
    console.log(`Admin connected: ${socket.id}`);
    // Optionally push initial stats immediately
    const initGames = Array.from(gameState.activeGames.values()).map(g => ({
        id: g.id,
        mode: g.mode || 'classic',
        status: g.status,
        currentTurn: g.currentTurn,
        gameTimer: g.gameTimer,
        players: g.players.map(p => ({ id: p.id, nickname: p.nickname }))
    }));

    socket.emit('statsUpdate', {
        clientCount: gameState.clientCount,
        connectedClients: Array.from(gameState.connectedClients.values()).map(c => {
            const gm = c.gameId ? gameState.activeGames.get(c.gameId) : null;
            const mode = gm?.mode || c.queueMode || null;
            return {
                id: c.id,
                nickname: c.nickname,
                score: c.score,
                headtoheadWins: c.headtoheadWins,
                status: c.status,
                mode
            };
        }),
        activeGames: gameState.activeGames.size,
        waitingPlayers: (gameState.waitingPlayers.classic.length + gameState.waitingPlayers.blitz.length),
        games: initGames
    });

    socket.on('disconnect', () => {
        console.log(`Admin disconnected: ${socket.id}`);
    });
});

// Per-turn 10s timer. Resets every time the turn changes. If it hits 0, we auto-pass the turn.
function startTurnTimer(gameId) {
    const gameData = gameState.activeGames.get(gameId);
    if (!gameData) return;

    // Clear any existing timer
    if (gameData.timer) {
        clearInterval(gameData.timer);
        gameData.timer = null;
    }

    // Initialize remaining seconds for this turn
    gameData.gameTimer = 10; // reuse field to minimize client changes
    io.to(gameId).emit('timerUpdate', gameData.gameTimer);

    const interval = setInterval(() => {
        // If game got cleaned up mid-interval
        const gd = gameState.activeGames.get(gameId);
        if (!gd) {
            clearInterval(interval);
            return;
        }

        gd.gameTimer -= 1;
        io.to(gameId).emit('timerUpdate', gd.gameTimer);

        if (gd.gameTimer <= 0) {
            clearInterval(interval);

            // Time's up for current player; auto-switch turns
            const currentPlayerId = gd.currentTurn;
            const nextPlayer = gd.players.find(p => p.id !== currentPlayerId);
            const currentPlayer = gd.players.find(p => p.id === currentPlayerId);

            if (currentPlayer && nextPlayer) {
                gd.currentTurn = nextPlayer.id;
                currentPlayer.socket.emit('opponentTurn');
                nextPlayer.socket.emit('yourTurn');
            }

            // Start timer for the next player's turn
            startTurnTimer(gameId);
        }
    }, 1000);

    gameData.timer = interval;
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
        headtoheadWins: {},
        status: 'connected',
        gameId: null,
        playerIndex: null,
        board: null,
        isReady: false,
        lastOpponentId: null,
        lastWinnerId: null,
        queueMode: null
    };
    
    gameState.connectedClients.set(socket.id, clientData);
    updateClientStats();

    // Send connected clients info to new client
    socket.emit('clientsInfo', {
        connectedClients: Array.from(gameState.connectedClients.values()).map(c => ({
            id: c.id,
            nickname: c.nickname,
            score: c.score,
            headtoheadWins: c.headtoheadWins,
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
    socket.on('joinQueue', (payload) => {
        const client = gameState.connectedClients.get(socket.id);
        if (!client || !client.nickname) return;

        const mode = (payload && (payload.mode === 'blitz' || payload.mode === 'classic')) ? payload.mode : 'classic';
        client.queueMode = mode;

        const queue = gameState.waitingPlayers[mode];
        if (queue.length > 0) {
            // Match with waiting player of the same mode
            const waitingPlayer = queue.shift();
            const gameId = generateGameId();
            
            // Decide who goes first (prefer last winner if these two just played)
            const players = [client, waitingPlayer];
            let firstPlayer;
            if (
                client.lastOpponentId === waitingPlayer.id &&
                waitingPlayer.lastOpponentId === client.id
            ) {
                
                const winnerId = client.lastWinnerId || waitingPlayer.lastWinnerId;
                if (winnerId === client.id) firstPlayer = client;
                else if (winnerId === waitingPlayer.id) firstPlayer = waitingPlayer;
                console.log("Because this player won they start first: ", waitingPlayer.nickname);
            }
            if (!firstPlayer) {
                firstPlayer = getRandomPlayer(players);
            }
            const secondPlayer = players.find(p => p.id !== firstPlayer.id);
            
            // Setup game
            const gameData = {
                id: gameId,
                players: [firstPlayer, secondPlayer],
                currentTurn: firstPlayer.id,
                gameTimer: 10, // 10 seconds per turn (reused field name)
                startTime: Date.now(),
                status: 'waiting_for_ships',
                mode
            };
            
            gameState.activeGames.set(gameId, gameData);

            // Clear rematch hints so they apply only once
            client.lastOpponentId = null;
            client.lastWinnerId = null;
            waitingPlayer.lastOpponentId = null;
            waitingPlayer.lastWinnerId = null;
            
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

            console.log(`Game ${gameId} (${mode}) started between ${firstPlayer.nickname} and ${secondPlayer.nickname}`);
            console.log(`${firstPlayer.nickname} goes first`);

            // Notify both players
            io.to(gameId).emit('gameStart', { 
                gameId,
                players: [
                    { id: firstPlayer.id, nickname: firstPlayer.nickname, score: firstPlayer.score, headtoheadWins: firstPlayer.headtoheadWins },
                    { id: secondPlayer.id, nickname: secondPlayer.nickname, score: secondPlayer.score, headtoheadWins: secondPlayer.headtoheadWins }
                ],
                firstPlayer: firstPlayer.id,
                gameTimer: gameData.gameTimer,
                mode
            });

            updateClientStats();
        } else {
            // Add to waiting queue
            queue.push(client);
            client.status = 'waiting';
            socket.emit('waiting');
            console.log(`${client.nickname} is waiting for an opponent in ${mode} mode`);
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
            
            // Start the first turn timer
            startTurnTimer(client.gameId);
            
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
            client.score += 1;
            client.headtoheadWins[opponent.id] = (client.headtoheadWins[opponent.id] || 0) + 1;
            // Remember last opponent and winner for rematch
            client.lastOpponentId = opponent.id;
            opponent.lastOpponentId = client.id;
            client.lastWinnerId = client.id;
            opponent.lastWinnerId = client.id;
            
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

            // Reset per-turn timer for the next player
            startTurnTimer(client.gameId);
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
                    opponent.score += 1;
                    opponent.headtoheadWins[client.id] = (opponent.headtoheadWins[client.id] || 0) + 1; // count as H2H win
                    // Record last matchup and winner for rematch preference
                    opponent.lastOpponentId = client.id;
                    opponent.lastWinnerId = opponent.id;
                    opponent.status = 'lobby';
                    opponent.gameId = null;
                    opponent.playerIndex = null;
                    opponent.board = null;
                    opponent.isReady = false;
                }
                
                gameState.activeGames.delete(client.gameId);
            }
        }
        
    // Remove from waiting players if present (both queues, just in case)
    gameState.waitingPlayers.classic = gameState.waitingPlayers.classic.filter(p => p.id !== socket.id);
    gameState.waitingPlayers.blitz = gameState.waitingPlayers.blitz.filter(p => p.id !== socket.id);
        
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