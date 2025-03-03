const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const cors = require('cors');

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Enable CORS
app.use(cors());

// Serve static files from the current directory
app.use(express.static(__dirname));

// Game state
const gameState = {
    players: {},
    chunks: {},
    worldSeed: Math.floor(Math.random() * 1000000),
    terrainHeights: [],
    biomeMap: [],
    // Add a map to track recent block updates
    recentBlockUpdates: new Map()
};

// Import world generation functions
const worldGeneration = require('./js/server/worldGeneration');

// Cleanup function for recentBlockUpdates map
function cleanupRecentBlockUpdates() {
    const now = Date.now();
    const expirationTime = 10000; // 10 seconds
    
    // Remove entries older than expirationTime
    for (const [key, timestamp] of gameState.recentBlockUpdates.entries()) {
        if (now - timestamp > expirationTime) {
            gameState.recentBlockUpdates.delete(key);
        }
    }
}

// Run cleanup every 30 seconds
setInterval(cleanupRecentBlockUpdates, 30000);

// Initialize world
function initializeWorld() {
    console.log('Initializing world with seed:', gameState.worldSeed);
    
    // Initialize biomes
    worldGeneration.initializeBiomes(gameState);
    
    // Generate biome map
    gameState.biomeMap = worldGeneration.generateBiomeMap(gameState);
    
    // Generate terrain heights
    worldGeneration.generateTerrainHeights(gameState);
    
    console.log('World initialized successfully');
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New player connected:', socket.id);
    
    // Add player to game state
    gameState.players[socket.id] = {
        id: socket.id,
        x: 0,
        y: 0,
        width: 20,
        height: 30,
        color: getRandomColor(),
        direction: 1 // 1 for right, -1 for left
    };
    
    // Send initial game state to new player
    socket.emit('initialize', {
        id: socket.id,
        players: gameState.players,
        worldSeed: gameState.worldSeed,
        terrainHeights: gameState.terrainHeights,
        biomeMap: gameState.biomeMap
    });
    
    // Broadcast new player to all other players
    socket.broadcast.emit('playerJoined', gameState.players[socket.id]);
    
    // Handle player movement
    socket.on('playerMove', (data) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].x = data.x;
            gameState.players[socket.id].y = data.y;
            gameState.players[socket.id].direction = data.direction;
            
            // Broadcast player movement to all other players
            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                x: data.x,
                y: data.y,
                direction: data.direction
            });
        }
    });
    
    // Handle block digging
    socket.on('blockDig', (data) => {
        const { x, y, tileType } = data;
        
        // Create a unique key for this block position
        const blockKey = `${x},${y}`;
        
        // Check if this block was recently updated
        const now = Date.now();
        const lastUpdate = gameState.recentBlockUpdates.get(blockKey);
        
        // Only process if it's been at least 1 second since the last update for this block
        // or if this is the first update for this block
        if (!lastUpdate || (now - lastUpdate > 1000)) {
            // Update chunk data
            const chunkX = Math.floor(x / (16 * 32)); // CHUNK_SIZE * TILE_SIZE
            const chunkY = Math.floor(y / (16 * 32));
            const chunkKey = `${chunkX},${chunkY}`;
            
            // Ensure chunk exists in server memory
            if (!gameState.chunks[chunkKey]) {
                gameState.chunks[chunkKey] = worldGeneration.generateChunk(chunkX, chunkY, gameState);
            }
            
            // Update tile in chunk
            const localX = Math.floor(x / 32) % 16; // x % CHUNK_SIZE
            const localY = Math.floor(y / 32) % 16; // y % CHUNK_SIZE
            
            if (gameState.chunks[chunkKey] && 
                gameState.chunks[chunkKey][localY] && 
                gameState.chunks[chunkKey][localY][localX] !== undefined) {
                
                // Only update if the tile is actually changing
                if (gameState.chunks[chunkKey][localY][localX] !== tileType) {
                    gameState.chunks[chunkKey][localY][localX] = tileType;
                    
                    // Record this update time
                    gameState.recentBlockUpdates.set(blockKey, now);
                    
                    // Broadcast block update to all players, including the player ID who made the change
                    io.emit('blockUpdate', { x, y, tileType, playerId: socket.id });
                }
            }
        }
    });
    
    // Handle chunk request
    socket.on('requestChunk', (data) => {
        const { chunkX, chunkY } = data;
        const chunkKey = `${chunkX},${chunkY}`;
        
        // Generate chunk if it doesn't exist
        if (!gameState.chunks[chunkKey]) {
            gameState.chunks[chunkKey] = worldGeneration.generateChunk(chunkX, chunkY, gameState);
        }
        
        // Send chunk data to requesting player
        socket.emit('chunkData', {
            chunkX,
            chunkY,
            data: gameState.chunks[chunkKey]
        });
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        
        // Remove player from game state
        delete gameState.players[socket.id];
        
        // Broadcast player left to all other players
        io.emit('playerLeft', socket.id);
    });
});

// Helper function to generate random color for players
function getRandomColor() {
    const colors = [
        '#FF5733', // Red-Orange
        '#33FF57', // Green
        '#3357FF', // Blue
        '#FF33F5', // Pink
        '#F5FF33', // Yellow
        '#33FFF5', // Cyan
        '#FF5733', // Orange
        '#C133FF', // Purple
        '#FF3333', // Red
        '#33FF33'  // Lime
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Initialize the world
initializeWorld();

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 