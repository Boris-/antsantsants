const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

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

// World save file path
const WORLD_SAVE_PATH = path.join(__dirname, 'world_save.json');

// Game state
let gameState = {
    players: {},
    chunks: {},
    worldSeed: Math.floor(Math.random() * 1000000),
    terrainHeights: [],
    biomeMap: [],
    // Add a map to track recent block updates
    recentBlockUpdates: new Map(),
    // Add world metadata
    worldMetadata: {
        createdAt: Date.now(),
        lastSaved: null,
        blockUpdates: 0
    },
    // Add day/night cycle data
    dayNightCycle: {
        time: 0, // 0-1 representing time of day (0 = midnight, 0.5 = noon)
        dayLength: 1200000, // 20 minutes in milliseconds for a full day cycle
        lastUpdate: Date.now()
    }
};

// Import world generation functions
const worldGeneration = require('./js/server/worldGeneration');

// Cleanup function for recentBlockUpdates map
function cleanupRecentBlockUpdates() {
    const now = Date.now();
    const expirationTime = 10000; // 10 seconds
    
    // Use more efficient array-based cleanup
    const keysToDelete = Array.from(gameState.recentBlockUpdates.entries())
        .filter(([_, timestamp]) => now - timestamp > expirationTime)
        .map(([key]) => key);
    
    keysToDelete.forEach(key => gameState.recentBlockUpdates.delete(key));
}

// Run cleanup every 30 seconds
setInterval(cleanupRecentBlockUpdates, 30000);

// Function to update day/night cycle and broadcast to clients
function updateDayNightCycle() {
    const now = Date.now();
    const elapsed = now - gameState.dayNightCycle.lastUpdate;
    
    // Calculate new time
    gameState.dayNightCycle.time += elapsed / gameState.dayNightCycle.dayLength;
    
    // Keep time between 0 and 1
    while (gameState.dayNightCycle.time >= 1) {
        gameState.dayNightCycle.time -= 1;
    }
    
    // Update last update time
    gameState.dayNightCycle.lastUpdate = now;
    
    // Broadcast to all clients
    io.emit('dayNightUpdate', {
        time: gameState.dayNightCycle.time,
        dayLength: gameState.dayNightCycle.dayLength
    });
}

// Initialize world
function initializeWorld() {
    // Try to load existing world first
    if (loadWorld()) {
        console.log('Loaded existing world with seed:', gameState.worldSeed);
    } else {
        console.log('Initializing new world with seed:', gameState.worldSeed);
        worldGeneration.initializeNewWorld(gameState);
        console.log('World initialized successfully');
        saveWorld();
    }
    
    // Ensure the world seed is a number
    gameState.worldSeed = Number(gameState.worldSeed);
}

// Save world state to file
function saveWorld() {
    try {
        // Create a copy of the game state without non-serializable data
        const saveData = {
            worldSeed: gameState.worldSeed,
            terrainHeights: gameState.terrainHeights,
            biomeMap: gameState.biomeMap,
            chunks: gameState.chunks,
            worldMetadata: {
                ...gameState.worldMetadata,
                lastSaved: Date.now(),
                hasUnsavedChanges: false
            },
            dayNightCycle: {
                time: gameState.dayNightCycle.time,
                dayLength: gameState.dayNightCycle.dayLength,
                lastUpdate: Date.now()
            }
        };
        
        // Write to file
        fs.writeFileSync(WORLD_SAVE_PATH, JSON.stringify(saveData));
        console.log('World saved successfully');
        return true;
    } catch (error) {
        console.error('Error saving world:', error);
        return false;
    }
}

// Load world state from file
function loadWorld() {
    try {
        // Check if save file exists
        if (!fs.existsSync(WORLD_SAVE_PATH)) {
            console.log('No saved world found');
            return false;
        }
        
        // Read and parse save file
        const saveData = JSON.parse(fs.readFileSync(WORLD_SAVE_PATH));
        
        // Update game state with loaded data
        gameState.worldSeed = saveData.worldSeed;
        gameState.terrainHeights = saveData.terrainHeights;
        gameState.biomeMap = saveData.biomeMap;
        gameState.chunks = saveData.chunks || {};
        
        // Update world metadata if available
        if (saveData.worldMetadata) {
            gameState.worldMetadata = {
                ...gameState.worldMetadata,
                ...saveData.worldMetadata,
                lastLoaded: Date.now()
            };
        }
        
        // Load day/night cycle if available
        if (saveData.dayNightCycle) {
            gameState.dayNightCycle = {
                ...gameState.dayNightCycle,
                ...saveData.dayNightCycle,
                lastUpdate: Date.now() // Reset lastUpdate to now
            };
        }
        
        // Initialize biomes if not loaded
        if (!gameState.biomeTypes) {
            worldGeneration.initializeBiomes(gameState);
        }
        
        console.log('World loaded successfully');
        return true;
    } catch (error) {
        console.error('Error loading world:', error);
        return false;
    }
}

// Auto-save world periodically
const AUTO_SAVE_INTERVAL = 5 * 60 * 1000; // 5 minutes
setInterval(() => {
    console.log('Auto-saving world...');
    saveWorld();
}, AUTO_SAVE_INTERVAL);

// Update day/night cycle every minute
const DAY_NIGHT_UPDATE_INTERVAL = 60 * 1000; // 1 minute
setInterval(() => {
    updateDayNightCycle();
}, DAY_NIGHT_UPDATE_INTERVAL);

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    // Add player to game state
    gameState.players[socket.id] = {
        id: socket.id,
        x: 0,
        y: 0,
        direction: 'right',
        inventory: {}
    };
    
    // Send initialization data to client
    socket.emit('initialize', {
        id: socket.id,
        players: gameState.players,
        worldSeed: gameState.worldSeed,
        terrainHeights: gameState.terrainHeights,
        biomeMap: gameState.biomeMap,
        dayNightCycle: {
            time: gameState.dayNightCycle.time,
            dayLength: gameState.dayNightCycle.dayLength
        }
    });
    
    // Broadcast new player to all other clients
    socket.broadcast.emit('playerJoined', gameState.players[socket.id]);
    
    // Handle player movement
    socket.on('playerMove', (data) => {
        // Update player position
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].x = data.x;
            gameState.players[socket.id].y = data.y;
            gameState.players[socket.id].direction = data.direction;
            
            // Broadcast player movement to all other clients
            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                x: data.x,
                y: data.y,
                direction: data.direction
            });
        }
    });
    
    // Handle world seed reset request
    socket.on('resetWorldSeed', (data) => {
        console.log('Received request to reset world seed');
        
        // Generate a new seed or use the provided one
        if (data && data.seed !== undefined) {
            gameState.worldSeed = Number(data.seed);
        } else {
            gameState.worldSeed = Math.floor(Math.random() * 1000000);
        }
        
        console.log('New world seed:', gameState.worldSeed);
        
        // Clear existing chunks
        gameState.chunks = {};
        
        // Reinitialize biomes
        worldGeneration.initializeBiomes(gameState);
        
        // Generate new biome map
        gameState.biomeMap = worldGeneration.generateBiomeMap(gameState);
        
        // Generate new terrain heights
        worldGeneration.generateTerrainHeights(gameState);
        
        // Save the new world
        saveWorld();
        
        // Broadcast world reset to all clients
        io.emit('worldReset', {
            worldSeed: gameState.worldSeed,
            terrainHeights: gameState.terrainHeights,
            biomeMap: gameState.biomeMap
        });
        
        console.log('World reset complete');
    });
    
    // Handle inventory updates
    socket.on('inventoryUpdate', (data) => {
        if (gameState.players[socket.id]) {
            // Update player's inventory
            gameState.players[socket.id].inventory = data.inventory;
            
            // Broadcast inventory update to all other players
            socket.broadcast.emit('playerInventoryUpdated', {
                id: socket.id,
                inventory: data.inventory
            });
        }
    });
    
    // Handle block digging
    socket.on('blockDig', (data) => {
        const { x, y, tileType, itemCollected } = data;
        
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
                
                // Mark as server-generated
                if (!gameState.chunks[chunkKey].metadata) {
                    gameState.chunks[chunkKey].metadata = {};
                }
                gameState.chunks[chunkKey].metadata.serverGenerated = true;
                gameState.chunks[chunkKey].metadata.generatedAt = Date.now();
            }
            
            // Update tile in chunk
            const localX = Math.floor(x / 32) % 16; // x % CHUNK_SIZE
            const localY = Math.floor(y / 32) % 16;
            
            if (gameState.chunks[chunkKey] && 
                gameState.chunks[chunkKey][localY] && 
                gameState.chunks[chunkKey][localY][localX] !== undefined) {
                
                // Only update if the tile is actually changing
                if (gameState.chunks[chunkKey][localY][localX] !== tileType) {
                    // Store the original tile type before changing it
                    const originalTileType = gameState.chunks[chunkKey][localY][localX];
                    
                    // Update the tile
                    gameState.chunks[chunkKey][localY][localX] = tileType;
                    
                    // Record this update time
                    gameState.recentBlockUpdates.set(blockKey, now);
                    
                    // Increment block updates counter
                    gameState.worldMetadata.blockUpdates++;
                    
                    // If an item was collected, update the player's inventory
                    if (itemCollected && gameState.players[socket.id]) {
                        // Ensure the inventory property exists
                        if (!gameState.players[socket.id].inventory) {
                            gameState.players[socket.id].inventory = {};
                        }
                        
                        // Increment the item count
                        gameState.players[socket.id].inventory[itemCollected] = 
                            (gameState.players[socket.id].inventory[itemCollected] || 0) + 1;
                    }
                    
                    // Broadcast block update to all players, including the player ID who made the change
                    io.emit('blockUpdate', { 
                        x, 
                        y, 
                        tileType, 
                        playerId: socket.id,
                        originalTileType
                    });
                    
                    // Save world after significant changes (every 100 block updates)
                    if (gameState.worldMetadata.blockUpdates % 100 === 0) {
                        saveWorld();
                    }
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
            console.log(`Generating new chunk at ${chunkX},${chunkY} with seed ${gameState.worldSeed}`);
            gameState.chunks[chunkKey] = worldGeneration.generateChunk(chunkX, chunkY, gameState);
            
            // Process ant chambers for the newly generated chunk
            worldGeneration.processAntChambers(gameState);
            
            // Mark this chunk as server-generated to ensure consistency
            if (!gameState.chunks[chunkKey].metadata) {
                gameState.chunks[chunkKey].metadata = {};
            }
            gameState.chunks[chunkKey].metadata.serverGenerated = true;
            gameState.chunks[chunkKey].metadata.generatedAt = Date.now();
        }
        
        // Send chunk data to requesting player
        socket.emit('chunkData', {
            chunkX,
            chunkY,
            data: gameState.chunks[chunkKey],
            serverGenerated: true
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
    
    // Handle chunk saving from client
    socket.on('saveChunk', (data) => {
        const { chunkX, chunkY, data: chunkData } = data;
        const chunkKey = `${chunkX},${chunkY}`;
        
        // Only update if the chunk exists
        if (gameState.chunks[chunkKey]) {
            // Preserve metadata
            const metadata = gameState.chunks[chunkKey].metadata || {};
            
            // Update chunk data
            gameState.chunks[chunkKey] = chunkData;
            
            // Restore metadata with updated timestamp
            gameState.chunks[chunkKey].metadata = {
                ...metadata,
                lastUpdated: Date.now(),
                lastUpdatedBy: socket.id
            };
            
            // Broadcast chunk update to all other players
            socket.broadcast.emit('chunkData', {
                chunkX,
                chunkY,
                data: gameState.chunks[chunkKey],
                serverGenerated: true
            });
            
            // Mark world as having unsaved changes
            gameState.worldMetadata.hasUnsavedChanges = true;
        }
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

// Initialize world before starting server
initializeWorld();

// Start server
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';  // Allow connections from all network interfaces in production
server.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Server shutting down, saving world...');
    saveWorld();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Server shutting down, saving world...');
    saveWorld();
    process.exit(0);
}); 