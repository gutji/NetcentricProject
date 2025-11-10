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
    const payload = {
        clientCount: gameState.clientCount,
        connectedClients: Array.from(gameState.connectedClients.values()).map(c => ({
            id: c.id,
            nickname: c.nickname,
            score: c.score,
            headtoheadWins: c.headtoheadWins,
            status: c.status
        })),
        activeGames: gameState.activeGames.size,
        waitingPlayers: gameState.waitingPlayers.length
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
    socket.emit('statsUpdate', {
        clientCount: gameState.clientCount,
        connectedClients: Array.from(gameState.connectedClients.values()).map(c => ({
            id: c.id,
            nickname: c.nickname,
            score: c.score,
            headtoheadWins: c.headtoheadWins,
            status: c.status
        })),
        activeGames: gameState.activeGames.size,
        waitingPlayers: gameState.waitingPlayers.length
    });

    socket.on('disconnect', () => {
        console.log(`Admin disconnected: ${socket.id}`);
    });
});

// Per-turn 10s timer. Resets every time the turn changes. If it hits 0, we auto-pass the turn.
function startTurnTimer(gameId) {
    const gameData = gameState.activeGames.get(gameId);
    if (!gameData) return;

    // Don't start timer if game is paused
    if (gameData.paused) return;

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
        lastWinnerId: null
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
    socket.on('joinQueue', () => {
        const client = gameState.connectedClients.get(socket.id);
        if (!client || !client.nickname) return;

        if (gameState.waitingPlayers.length > 0) {
            // Match with waiting player
            const waitingPlayer = gameState.waitingPlayers.shift();
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
                paused: false,
                resumeVotes: new Set(),
                mode,
                // Blitz power-ups state
                powerUpsUsed: {
                    [firstPlayer.id]: { cannons: false, scan: false, protect: false },
                    [secondPlayer.id]: { cannons: false, scan: false, protect: false }
                },
                protectNextTurn: {
                    [firstPlayer.id]: false,
                    [secondPlayer.id]: false
                }
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

            console.log(`Game ${gameId} started between ${firstPlayer.nickname} and ${secondPlayer.nickname}`);
            console.log(`${firstPlayer.nickname} goes first`);

            // Notify both players
            io.to(gameId).emit('gameStart', { 
                gameId,
                players: [
                    { id: firstPlayer.id, nickname: firstPlayer.nickname, score: firstPlayer.score, headtoheadWins: firstPlayer.headtoheadWins },
                    { id: secondPlayer.id, nickname: secondPlayer.nickname, score: secondPlayer.score, headtoheadWins: secondPlayer.headtoheadWins }
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
        if (gameData.paused) return; // no actions during pause

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
            // Protect logic: if opponent has protection for their next defense, a hit won't allow chaining
            const opponentProtected = !!(gameData.protectNextTurn && gameData.protectNextTurn[opponent.id]);

            // Blitz mode rule: on hit, the same player continues and timer resets (unless protection active)
            if (gameData.mode === 'blitz' && result === 'hit' && !opponentProtected) {
                client.socket.emit('yourTurn');
                opponent.socket.emit('opponentTurn');
                startTurnTimer(client.gameId);
            } else {
                // Switch turns after any shot (classic, miss in blitz, or protected hit)
                gameData.currentTurn = opponent.id;
                client.socket.emit('opponentTurn');
                opponent.socket.emit('yourTurn');
                // If protection was active for the defender, consume it after shooter's action completes
                if (opponentProtected && gameData.protectNextTurn) {
                    gameData.protectNextTurn[opponent.id] = false;
                }
                startTurnTimer(client.gameId);
            }
        }
    });

    // Blitz Power-Ups
    socket.on('usePowerUp', (payload) => {
        const client = gameState.connectedClients.get(socket.id);
        if (!client || !client.gameId) return;
        const gameData = gameState.activeGames.get(client.gameId);
        if (!gameData || gameData.currentTurn !== client.id) return;
        if (gameData.paused) return;

        const type = (payload && payload.type) || null;
        if (gameData.mode !== 'blitz') return; // power-ups are blitz-only
        if (!['cannons','scan','protect'].includes(type)) return;

        // Ensure usage only once per match per player
        if (!gameData.powerUpsUsed) {
            gameData.powerUpsUsed = {
                [client.id]: { cannons: false, scan: false, protect: false },
            };
        }
        if (!gameData.powerUpsUsed[client.id]) {
            gameData.powerUpsUsed[client.id] = { cannons: false, scan: false, protect: false };
        }
        if (gameData.powerUpsUsed[client.id][type]) return; // already used

        const opponent = gameData.players.find(p => p.id !== client.id);
        if (!opponent || !opponent.board) return;

        const opponentBoard = opponent.board;

        // Helper to finalize turn switching (used by scan/protect and cannons if needed)
        const endTurnToOpponent = () => {
            gameData.currentTurn = opponent.id;
            client.socket.emit('opponentTurn');
            opponent.socket.emit('yourTurn');
            startTurnTimer(client.gameId);
        };

        if (type === 'scan') {
            const row = Math.max(0, Math.min(opponentBoard.length - 1, payload?.row ?? 0));
            const col = Math.max(0, Math.min(opponentBoard[0].length - 1, payload?.col ?? 0));
            let count = 0;
            for (let r = row - 1; r <= row + 1; r++) {
                for (let c = col - 1; c <= col + 1; c++) {
                    if (r >= 0 && r < opponentBoard.length && c >= 0 && c < opponentBoard[0].length) {
                        if (opponentBoard[r][c] === 'S') count++;
                    }
                }
            }
            // Mark used
            gameData.powerUpsUsed[client.id].scan = true;
            // Send result only to requester
            client.socket.emit('scanResult', { row, col, count });
            // Using a power-up consumes the action; switch turn
            endTurnToOpponent();
            return;
        }

        if (type === 'protect') {
            // Activate protection for this player against opponent's next turn
            if (!gameData.protectNextTurn) {
                gameData.protectNextTurn = { [client.id]: false };
            }
            gameData.protectNextTurn[client.id] = true;
            gameData.powerUpsUsed[client.id].protect = true;
            // Switch turn to opponent; no board changes
            endTurnToOpponent();
            return;
        }

        if (type === 'cannons') {
            // Fire in a 2x2 area anchored at (row, col): (r,c), (r+1,c), (r,c+1), (r+1,c+1)
            const row = Math.max(0, Math.min(opponentBoard.length - 1, payload?.row ?? 0));
            const col = Math.max(0, Math.min(opponentBoard[0].length - 1, payload?.col ?? 0));
            const coords = [
                [row, col],
                [row + 1, col],
                [row, col + 1],
                [row + 1, col + 1],
            ].filter(([r, c]) => r >= 0 && r < opponentBoard.length && c >= 0 && c < opponentBoard[0].length);
            let anyHit = false;

            coords.forEach(([r, c]) => {
                const cell = opponentBoard[r][c];
                if (cell === 'H' || cell === 'M') {
                    return; // already fired here; skip
                }
                let result = 'miss';
                if (cell === 'S') {
                    result = 'hit';
                    opponentBoard[r][c] = 'H';
                    anyHit = true;
                } else {
                    opponentBoard[r][c] = 'M';
                }
                // Emit individual results so UI updates like a normal shot
                client.socket.emit('fireResult', { row: r, col: c, result, isOwnGrid: false });
                opponent.socket.emit('fireResult', { row: r, col: c, result, isOwnGrid: true });
            });

            // Check for win condition after multi-shot
            const allShipsSunk = !opponentBoard.flat().includes('S');
            gameData.powerUpsUsed[client.id].cannons = true;

            if (allShipsSunk) {
                client.score += 1;
                client.headtoheadWins[opponent.id] = (client.headtoheadWins[opponent.id] || 0) + 1;
                client.lastOpponentId = opponent.id;
                opponent.lastOpponentId = client.id;
                client.lastWinnerId = client.id;
                opponent.lastWinnerId = client.id;
                if (gameData.timer) clearInterval(gameData.timer);
                client.socket.emit('gameOver', { result: 'win' });
                opponent.socket.emit('gameOver', { result: 'loss' });
                console.log(`Game ${client.gameId} over (cannons): ${client.nickname} wins!`);
                gameData.players.forEach(p => {
                    p.status = 'lobby';
                    p.gameId = null;
                    p.playerIndex = null;
                    p.board = null;
                    p.isReady = false;
                });
                gameState.activeGames.delete(client.gameId);
                updateClientStats();
                return;
            }

            // Apply blitz chaining rule across the composite result, considering protection on defender
            const opponentProtected = !!(gameData.protectNextTurn && gameData.protectNextTurn[opponent.id]);
            if (gameData.mode === 'blitz' && anyHit && !opponentProtected) {
                client.socket.emit('yourTurn');
                opponent.socket.emit('opponentTurn');
                startTurnTimer(client.gameId);
            } else {
                gameData.currentTurn = opponent.id;
                client.socket.emit('opponentTurn');
                opponent.socket.emit('yourTurn');
                if (opponentProtected && gameData.protectNextTurn) {
                    gameData.protectNextTurn[opponent.id] = false;
                }
                startTurnTimer(client.gameId);
            }
            return;
        }
    });

    // Pause/Resume handlers
    socket.on('pauseGame', () => {
        const client = gameState.connectedClients.get(socket.id);
        if (!client || !client.gameId) return;
        const gameData = gameState.activeGames.get(client.gameId);
        if (!gameData || gameData.paused) return;
        if (gameData.timer) {
            clearInterval(gameData.timer);
            gameData.timer = null;
        }
        gameData.paused = true;
        // clear previous resume votes
        try { gameData.resumeVotes = new Set(); } catch(e) { gameData.resumeVotes = { _tmp: true }; }
        io.to(client.gameId).emit('gamePaused', { by: client.id, resumeReadyIds: [] });
        console.log(`Game ${client.gameId} paused by ${client.nickname}`);
    });

    socket.on('resumeGame', () => {
        const client = gameState.connectedClients.get(socket.id);
        if (!client || !client.gameId) return;
        const gameData = gameState.activeGames.get(client.gameId);
        if (!gameData || !gameData.paused) return;
        // track votes
        if (!(gameData.resumeVotes instanceof Set)) {
            gameData.resumeVotes = new Set();
        }
        gameData.resumeVotes.add(client.id);
        const readyIds = Array.from(gameData.resumeVotes);
        io.to(client.gameId).emit('resumeVoteUpdate', { resumeReadyIds: readyIds });

        // if both players voted, resume
        const allIds = gameData.players.map(p => p.id);
        const allReady = allIds.every(id => gameData.resumeVotes.has(id));
        if (allReady) {
            gameData.paused = false;
            // clear votes
            gameData.resumeVotes = new Set();
            io.to(client.gameId).emit('gameResumed', { by: client.id });
            const gameId = client.gameId;
            const gd = gameState.activeGames.get(gameId);
            if (!gd) return;
            if (gd.timer) {
                clearInterval(gd.timer);
                gd.timer = null;
            }
            const interval = setInterval(() => {
                const local = gameState.activeGames.get(gameId);
                if (!local || local.paused) {
                    clearInterval(interval);
                    return;
                }
                local.gameTimer -= 1;
                io.to(gameId).emit('timerUpdate', local.gameTimer);
                if (local.gameTimer <= 0) {
                    clearInterval(interval);
                    const currentPlayerId = local.currentTurn;
                    const nextPlayer = local.players.find(p => p.id !== currentPlayerId);
                    const currentPlayer = local.players.find(p => p.id === currentPlayerId);
                    if (currentPlayer && nextPlayer) {
                        local.currentTurn = nextPlayer.id;
                        currentPlayer.socket.emit('opponentTurn');
                        nextPlayer.socket.emit('yourTurn');
                    }
                    startTurnTimer(gameId);
                }
            }, 1000);
            gd.timer = interval;
            io.to(gameId).emit('timerUpdate', gd.gameTimer);
            console.log(`Game ${client.gameId} resumed after both players confirmed.`);
        }
    });

    socket.on('forfeit', () => {
        const client = gameState.connectedClients.get(socket.id);
        if (!client || !client.gameId) return;
        const gameData = gameState.activeGames.get(client.gameId);
        if (!gameData) return;
        // Clear timer
        if (gameData.timer) {
            clearInterval(gameData.timer);
            gameData.timer = null;
        }
        // Opponent wins
        const opponent = gameData.players.find(p => p.id !== client.id);
        if (opponent) {
            opponent.score += 1;
            opponent.headtoheadWins[client.id] = (opponent.headtoheadWins[client.id] || 0) + 1;
            // Record last matchup and winner for rematch preference
            opponent.lastOpponentId = client.id;
            client.lastOpponentId = opponent.id;
            opponent.lastWinnerId = opponent.id;
            client.lastWinnerId = opponent.id;
            opponent.socket.emit('gameOver', { result: 'win' });
            client.socket.emit('gameOver', { result: 'loss' });
        }
        console.log(`Game ${client.gameId} forfeit: ${client.nickname} resigned.`);
        // Clean up
        gameData.players.forEach(player => {
            player.status = 'lobby';
            player.gameId = null;
            player.playerIndex = null;
            player.board = null;
            player.isReady = false;
        });
        gameState.activeGames.delete(client.gameId);
        updateClientStats();
    });

    // In-game chat (Blitz mode only)
    socket.on('sendChatMessage', ({ message }) => {
        const client = gameState.connectedClients.get(socket.id);
        if (!client || !client.gameId) return;

        const text = (message ?? '').toString().trim();
        if (!text) return;
        if (text.length > 200) return; // basic flood control

        const gameData = gameState.activeGames.get(client.gameId);
        if (!gameData) return;
        // Only allow chat in blitz mode
        if (gameData.mode !== 'blitz') return;

        const payload = {
            id: Date.now(),
            gameId: gameData.id,
            playerId: client.id,
            playerName: client.nickname || 'Player',
            message: text,
            timestamp: new Date().toISOString(),
        };

        // Emit to both players in the same game room
        io.to(gameData.id).emit('chatMessage', payload);
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