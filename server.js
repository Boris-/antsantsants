const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { createNoise2D } = require('simplex-noise');
const crypto = require('crypto');

// Track server start time
const serverStartTime = Date.now();

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

// Basic authentication middleware for admin panel
const adminAuth = (req, res, next) => {
    // Parse login and password from headers
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');
    
    // Create a hash of the expected password
    // The password hash below corresponds to "ANTant22!"
    const ADMIN_PASSWORD_HASH = '4c6ec96777ecc53d26da45e0258385e2b3ad20349e7e1e2312b9cf44aa6a49e3';
    
    // Hash the provided password for comparison
    const hashProvided = crypto.createHash('sha256').update(password || '').digest('hex');
    
    // Verify password only (no username required)
    if (password && hashProvided === ADMIN_PASSWORD_HASH) {
        return next();
    }
    
    // Authentication failed
    res.set('WWW-Authenticate', 'Basic realm="Admin Panel"');
    res.status(401).send('Authentication required');
};

// Serve static files from the current directory
app.use(express.static(__dirname));

// Admin panel route with authentication
app.get('/admin', adminAuth, (req, res) => {
    fs.readFile(path.join(__dirname, 'admin.html'), 'utf8', (err, content) => {
        if (err) {
            console.error('Error reading admin template:', err);
            return res.status(500).send('Server Error');
        }
        res.send(content);
    });
});

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
    
    // Initialize player
    gameState.players[socket.id] = {
        id: socket.id,
        x: 0,
        y: 0,
        color: getRandomColor(),
        direction: 'right',
        score: 0,
        inventory: {}, // Ensure inventory is initialized
        health: 100,
        lastSeen: Date.now(),
        active: true,
        joinedAt: Date.now(),
        username: `Player-${socket.id.substr(0, 4)}`
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
    
    // Handle player position update
    socket.on('playerMove', (data) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].x = data.x;
            gameState.players[socket.id].y = data.y;
            gameState.players[socket.id].direction = data.direction;
            gameState.players[socket.id].lastSeen = Date.now();
            gameState.players[socket.id].active = true;
            
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
    
    // Handle inventory update
    socket.on('updateInventory', (data) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].inventory = data.inventory || {};
            gameState.players[socket.id].lastSeen = Date.now();
        }
    });
    
    // Handle score update
    socket.on('updateScore', (data) => {
        if (gameState.players[socket.id] && typeof data.score === 'number') {
            gameState.players[socket.id].score = data.score;
            gameState.players[socket.id].lastSeen = Date.now();
        }
    });
    
    // Handle health update
    socket.on('updateHealth', (data) => {
        if (gameState.players[socket.id] && typeof data.health === 'number') {
            gameState.players[socket.id].health = data.health;
            gameState.players[socket.id].lastSeen = Date.now();
        }
    });
    
    // Handle username update
    socket.on('updateUsername', (data) => {
        if (gameState.players[socket.id] && data.username) {
            // Sanitize the username - remove any potentially dangerous characters
            const sanitizedUsername = data.username.replace(/[^\w\s-]/gi, '').substring(0, 20);
            gameState.players[socket.id].username = sanitizedUsername || `Player-${socket.id.substr(0, 4)}`;
            gameState.players[socket.id].lastSeen = Date.now();
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
        
        // Record last position and time before removing player
        const disconnectedPlayer = gameState.players[socket.id];
        if (disconnectedPlayer) {
            // Notify other clients about the disconnection
            socket.broadcast.emit('playerLeft', {
                id: socket.id,
                x: disconnectedPlayer.x,
                y: disconnectedPlayer.y
            });
        }
        
        // Remove the player from game state
        delete gameState.players[socket.id];
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

    // Handle world data request (admin)
    socket.on('getWorldData', () => {
        console.log('Admin requested world data');
        socket.emit('worldData', {
            worldSeed: gameState.worldSeed,
            chunks: gameState.chunks,
            worldMetadata: gameState.worldMetadata,
            dayNightCycle: gameState.dayNightCycle
        });
    });

    // Handle player list request (admin)
    socket.on('getPlayerList', () => {
        console.log('Admin requested player list');
        
        // Update active status for all players
        const now = Date.now();
        let activePlayerCount = 0;
        
        // Process each player to update their status and count active players
        Object.keys(gameState.players).forEach(playerId => {
            const player = gameState.players[playerId];
            
            // Mark player as inactive if not seen in the last 10 seconds
            if (now - (player.lastSeen || 0) > 10000) {
                player.active = false;
            } else {
                player.active = true;
                activePlayerCount++;
            }
            
            // Calculate session duration
            player.sessionDuration = now - (player.joinedAt || now);
        });
        
        // Send enhanced player data to admin
        socket.emit('playerList', {
            players: gameState.players,
            totalPlayers: Object.keys(gameState.players).length,
            activePlayers: activePlayerCount,
            serverStartTime: gameState.worldMetadata.createdAt
        });
    });

    // Handle world map request (admin)
    socket.on('getWorldMap', () => {
        console.log('Admin requested world map');
        
        // Create a simplified terrain representation for the map
        const mapSize = 100; // 100x100 grid
        const terrainMap = generateSimplifiedTerrainMap(mapSize);
        
        socket.emit('worldMapData', {
            terrain: terrainMap,
            players: gameState.players,
            scale: 10 // Scale factor for player positions
        });
    });

    // Handle world save request (admin)
    socket.on('saveWorld', () => {
        console.log('Admin requested world save');
        saveWorld();
        socket.emit('worldSaved');
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

// Generate a simplified terrain map for admin view
function generateSimplifiedTerrainMap(size) {
    const map = [];
    const seed = gameState.worldSeed;
    const noise2D = createNoise2D(() => seed / 1000000);
    
    for (let y = 0; y < size; y++) {
        const row = [];
        for (let x = 0; x < size; x++) {
            // Map coordinates to world coordinates
            const worldX = (x - size/2) * 10;
            const worldY = (y - size/2) * 10;
            
            // Generate terrain type based on noise
            const elevation = (noise2D(worldX * 0.01, worldY * 0.01) + 1) / 2;
            const moisture = (noise2D(worldX * 0.02 + 500, worldY * 0.02 + 500) + 1) / 2;
            
            // Determine terrain type
            let terrainType;
            if (elevation < 0.3) {
                terrainType = 0; // Water
            } else if (elevation < 0.4) {
                terrainType = 1; // Sand
            } else if (elevation < 0.7) {
                if (moisture < 0.4) {
                    terrainType = 2; // Grass
                } else {
                    terrainType = 3; // Forest
                }
            } else if (elevation < 0.85) {
                terrainType = 4; // Mountain
            } else {
                terrainType = 5; // Snow
            }
            
            row.push(terrainType);
        }
        map.push(row);
    }
    
    return map;
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