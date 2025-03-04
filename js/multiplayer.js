// Multiplayer client functionality
let socket = null;
let otherPlayers = {};
let playerId = null;
let isConnectedToServer = false;

// Track recently processed block updates to prevent duplicates
const recentBlockUpdates = new Map();

// Constants
const CLEANUP_INTERVAL = 30000; // 30 seconds
const BLOCK_UPDATE_COOLDOWN = 500; // 500ms
const EXPIRATION_TIME = 10000; // 10 seconds
const NOTIFICATION_DURATION = 5000; // 5 seconds

// Expose requestWorldData immediately so it's available before anything else
window.requestWorldData = function(callback) {
    console.log('Multiplayer requestWorldData called');
    if (socket && socket.connected) {
        // Create a unique event handler for this request
        const responseHandler = (data) => {
            console.log('Received world data from server');
            if (callback && typeof callback === 'function') {
                callback(data);
            }
        };
        
        // Set up the one-time response handler
        socket.once('worldData', responseHandler);
        
        // Send the request to the server
        socket.emit('requestWorldData');
    } else {
        console.warn('Cannot request world data - not connected to server');
        // Call callback with empty data if provided
        if (callback && typeof callback === 'function') {
            setTimeout(() => {
                callback({});
            }, 0);
        }
    }
};

// Log that this essential function has been defined early
console.log("IMPORTANT: requestWorldData function defined at the beginning of multiplayer.js");
console.log("requestWorldData available:", typeof window.requestWorldData === 'function');

// Constants for multiplayer
const SERVER_URL = 'http://localhost:3001';
const AUTO_CONNECT_TO_SERVER = true;
const VISIBLE_CHUNKS_RADIUS = 2;
const MAX_OTHER_PLAYERS = 10;

// Update connected players count in gameState
function updateConnectedPlayersCount() {
    if (window.gameState && typeof otherPlayers !== 'undefined') {
        // Store the count in gameState for other components to access
        window.gameState.connectedPlayersCount = Object.keys(otherPlayers).length + 1; // +1 for self
    }
}

// Cleanup function for recentBlockUpdates map
function cleanupRecentBlockUpdates() {
    const now = Date.now();
    const keysToDelete = Array.from(recentBlockUpdates.entries())
        .filter(([_, timestamp]) => now - timestamp > EXPIRATION_TIME)
        .map(([key]) => key);
    
    keysToDelete.forEach(key => recentBlockUpdates.delete(key));
}

// Run cleanup every 30 seconds
setInterval(cleanupRecentBlockUpdates, CLEANUP_INTERVAL);

// Initialize multiplayer connection
function initializeMultiplayer() {
    socket = io('http://144.91.69.122:3001/');
    setupSocketEvents();
    console.log('Connecting to multiplayer server...');
}

// Helper function to update chunk metadata
function updateChunkMetadata(chunkKey, updates) {
    if (!gameState.chunkMetadata) {
        gameState.chunkMetadata = {};
    }
    
    if (!gameState.chunkMetadata[chunkKey]) {
        gameState.chunkMetadata[chunkKey] = {};
    }
    
    Object.assign(gameState.chunkMetadata[chunkKey], {
        ...updates,
        lastUpdated: Date.now()
    });
}

// Helper function to process chunk data
function processChunkData(data) {
    const chunkKey = `${data.chunkX},${data.chunkY}`;
    
    // If server-generated or new chunk, use server's version
    if (data.serverGenerated || !gameState.chunks[chunkKey]) {
        gameState.chunks[chunkKey] = data.data;
        updateChunkMetadata(chunkKey, {
            loadedFromServer: true,
            loadedAt: Date.now()
        });
        return;
    }
    
    // For existing chunks, only update differences
    let hasChanges = false;
    const chunk = gameState.chunks[chunkKey];
    
    for (let y = 0; y < data.data.length; y++) {
        for (let x = 0; x < data.data[y].length; x++) {
            if (y === 'metadata' || x === 'metadata') continue;
            
            if (data.data[y][x] !== chunk[y][x]) {
                chunk[y][x] = data.data[y][x];
                hasChanges = true;
            }
        }
    }
    
    if (hasChanges) {
        updateChunkMetadata(chunkKey, {
            updatedFromServer: true
        });
    }
}

// Helper function to process block updates
function processBlockUpdate(data) {
    const blockKey = `${data.x},${data.y}`;
    const now = Date.now();
    const lastUpdate = recentBlockUpdates.get(blockKey);
    
    // Skip if update is too recent
    if (lastUpdate && (now - lastUpdate <= BLOCK_UPDATE_COOLDOWN)) {
        return;
    }
    
    recentBlockUpdates.set(blockKey, now);
    
    const worldX = Math.floor(data.x / TILE_SIZE);
    const worldY = Math.floor(data.y / TILE_SIZE);
    
    // Update tile
    setTile(worldX, worldY, data.tileType, false);
    
    // Create particles for other players' actions
    if (data.playerId !== socket.id && 
        data.originalTileType !== undefined && 
        data.originalTileType !== TILE_TYPES.AIR &&
        typeof createParticles === 'function') {
        
        const particleX = worldX * TILE_SIZE + TILE_SIZE / 2;
        const particleY = worldY * TILE_SIZE + TILE_SIZE / 2;
        const particleColor = getTileColor(data.originalTileType);
        createParticles(particleX, particleY, particleColor, 20);
    }
}

// Set up socket event handlers
function setupSocketEvents() {
    if (!socket) {
        console.error('Socket not initialized');
        return;
    }
    
    // Connection established
    socket.on('connect', () => {
        console.log('Connected to server with ID:', socket.id);
        isConnectedToServer = true;
        playerId = socket.id;
        
        // Request world data
        requestWorldData();
        
        // Update player count
        updateConnectedPlayersCount();
        
        showNotification('Connected to server');
    });
    
    socket.on('initialize', (data) => {
        console.log('Received initialization data');
        
        otherPlayers = { ...data.players };
        delete otherPlayers[playerId];
        
        // Initialize day/night cycle
        if (data.dayNightCycle) {
            gameState.dayNightCycle = data.dayNightCycle;
            gameState.dayNightCycle.lastUpdate = Date.now();
        }
        
        // Initialize world seed if provided
        if (data.worldSeed) {
            gameState.worldSeed = data.worldSeed;
            console.log('Using server-provided world seed:', gameState.worldSeed);
        }
        
        // Update player count after receiving initial data
        updateConnectedPlayersCount();
        
        console.log('Multiplayer initialized with', Object.keys(otherPlayers).length, 'other players');
        showNotification('Connected to persistent world');
    });
    
    socket.on('playerJoined', (playerData) => {
        if (playerData.id !== playerId) {
            // Add the new player to our tracking
            otherPlayers[playerData.id] = playerData;
            
            console.log(`Player joined: ${playerData.id}`);
            showNotification('Player joined');
            
            // Update player count
            updateConnectedPlayersCount();
        }
    });
    
    socket.on('playerMoved', (data) => {
        if (otherPlayers[data.id]) {
            Object.assign(otherPlayers[data.id], {
                x: data.x,
                y: data.y,
                direction: data.direction
            });
        }
    });
    
    socket.on('playerLeft', (playerId) => {
        if (otherPlayers[playerId]) {
            delete otherPlayers[playerId];
            console.log(`Player left: ${playerId}`);
            showNotification('Player left');
            
            // Update player count
            updateConnectedPlayersCount();
        }
    });
    
    socket.on('chunkData', processChunkData);
    socket.on('blockUpdate', processBlockUpdate);
    
    socket.on('playerInventoryUpdated', (data) => {
        if (otherPlayers[data.id]) {
            otherPlayers[data.id].inventory = data.inventory;
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        isConnectedToServer = false;
        showNotification('Disconnected from server');
    });
    
    socket.on('worldReset', (data) => {
        gameState.worldSeed = Number(data.worldSeed);
        gameState.terrainHeights = data.terrainHeights;
        gameState.biomeMap = data.biomeMap;
        gameState.chunks = {};
        gameState.loadedChunks.clear();
        
        if (!gameState.biomeTypes) {
            initializeBiomes();
        }
        
        showNotification('World has been reset');
        requestInitialChunks();
    });
    
    // Handle day/night cycle updates
    socket.on('dayNightUpdate', (data) => {
        // Use the consolidated sync function from gameState.js
        if (typeof window.syncDayNightCycleWithServer === 'function') {
            window.syncDayNightCycleWithServer(data);
        } else {
            console.error('Day/night sync function not found');
            
            // Fallback implementation if sync function is not available
            if (!gameState.dayNightCycle) {
                gameState.dayNightCycle = {
                    enabled: true,
                    lastUpdate: Date.now()
                };
            }
            
            // Update the day/night cycle data
            gameState.dayNightCycle.time = data.time;
            gameState.dayNightCycle.dayLength = data.dayLength;
            gameState.dayNightCycle.lastUpdate = Date.now();
            gameState.dayNightCycle.enabled = true;
            
            // Log day/night update for debugging
            console.log('Day/Night cycle updated:', gameState.dayNightCycle);
        }
    });

    socket.on('playerUpdate', (playerData) => {
        // Don't update our own player
        if (playerData.id === playerId) return;
        
        // Store player data
        otherPlayers[playerData.id] = {
            ...otherPlayers[playerData.id],
            ...playerData,
            lastUpdate: Date.now()
        };
        
        // Update the player count in case this is a new player
        updateConnectedPlayersCount();
    });
}

// Function to start regular updates of player info
function startPlayerInfoUpdates() {
    // Update player info immediately
    showPlayerInfo();
    
    // Then update every second
    setInterval(showPlayerInfo, 1000);
}

// Request initial chunks around player
function requestInitialChunks() {
    // Calculate player chunk
    const playerChunkX = Math.floor(gameState.player.x / TILE_SIZE / CHUNK_SIZE);
    const playerChunkY = Math.floor(gameState.player.y / TILE_SIZE / CHUNK_SIZE);
    
    console.log(`Requesting initial chunks around player at chunk ${playerChunkX},${playerChunkY}`);
    
    // Request chunks in a radius around the player
    for (let y = playerChunkY - VISIBLE_CHUNKS_RADIUS; y <= playerChunkY + VISIBLE_CHUNKS_RADIUS; y++) {
        for (let x = playerChunkX - VISIBLE_CHUNKS_RADIUS; x <= playerChunkX + VISIBLE_CHUNKS_RADIUS; x++) {
            // Skip if out of world bounds
            if (x < 0 || y < 0 || x >= Math.ceil(WORLD_WIDTH / CHUNK_SIZE) || y >= Math.ceil(WORLD_HEIGHT / CHUNK_SIZE)) {
                continue;
            }
            
            // Request chunk
            requestChunk(x, y);
        }
    }
}

// Request a chunk from the server
function requestChunk(chunkX, chunkY) {
    if (!isConnectedToServer) return;
    
    const chunkKey = `${chunkX},${chunkY}`;
    
    // Only request if not already loaded
    if (!gameState.loadedChunks.has(chunkKey)) {
        socket.emit('requestChunk', { chunkX, chunkY });
        
        // Mark as requested to prevent duplicate requests
        gameState.loadedChunks.add(chunkKey);
    }
}

// Send player position to server
function sendPlayerPosition() {
    if (!isConnectedToServer) return;
    
    if (socket && socket.connected) {
        socket.emit('playerMove', {
            x: gameState.player.x,
            y: gameState.player.y,
            direction: gameState.player.facingRight ? 1 : -1
        });
        
        // Update timestamp of last position update
        gameState.lastPositionUpdate = Date.now();
    }
}

// Send inventory update to server
function sendInventoryUpdate() {
    if (!isConnectedToServer) return;
    
    if (socket && socket.connected && gameState.player && gameState.player.inventory) {
        socket.emit('inventoryUpdate', {
            inventory: gameState.player.inventory
        });
    }
}

// Send block dig to server
function sendBlockDig(x, y, tileType) {
    if (!isConnectedToServer) {
        console.warn("Not connected to server, can't send block dig");
        return;
    }
    
    if (socket && socket.connected) {
        console.log(`Multiplayer: Sending block dig to server at (${x}, ${y}), tile type: ${tileType}`);
        
        // Get the original tile type at this position
        const originalTileType = getMultiplayerTile(x, y);
        
        // Convert tile type to inventory item name
        let itemCollected = null;
        
        switch (originalTileType) {
            case TILE_TYPES.DIRT:
                itemCollected = 'dirt';
                break;
            case TILE_TYPES.STONE:
                itemCollected = 'stone';
                break;
            case TILE_TYPES.GRASS:
                itemCollected = 'grass';
                break;
            case TILE_TYPES.SAND:
                itemCollected = 'sand';
                break;
            case TILE_TYPES.COAL:
                itemCollected = 'coal';
                break;
            case TILE_TYPES.IRON:
                itemCollected = 'iron';
                break;
            case TILE_TYPES.GOLD:
                itemCollected = 'gold';
                break;
            case TILE_TYPES.DIAMOND:
                itemCollected = 'diamond';
                break;
            default:
                itemCollected = null;
        }
        
        // Send block dig to server with tile coordinates
        socket.emit('blockDig', {
            x: x * TILE_SIZE, // Convert tile coordinates to world coordinates for server
            y: y * TILE_SIZE, // Convert tile coordinates to world coordinates for server
            tileType: tileType,
            itemCollected: itemCollected,
            originalTileType: originalTileType
        });
    } else {
        console.warn("Socket not connected, can't send block dig");
    }
}

// Helper function to get a tile at specific world coordinates
function getMultiplayerTile(x, y) {
    // Use the game.js getTile function if available
    if (typeof window.getTile === 'function') {
        return window.getTile(x, y);
    }
    
    // Fallback implementation if game.js getTile is not available
    if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) {
        return TILE_TYPES.BEDROCK; // Out of bounds is bedrock
    }
    
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkY = Math.floor(y / CHUNK_SIZE);
    const chunkKey = `${chunkX},${chunkY}`;
    
    // Check if chunk exists
    if (!gameState.chunks[chunkKey]) {
        return TILE_TYPES.AIR; // Default to air if chunk doesn't exist
    }
    
    // Get local coordinates within chunk
    const localX = x % CHUNK_SIZE;
    const localY = y % CHUNK_SIZE;
    
    // Return tile type
    return gameState.chunks[chunkKey][localY][localX];
}

// Draw other players
function drawOtherPlayers() {
    // Skip if no canvas context
    if (!gameState.ctx) return;
    
    // Save current context state
    gameState.ctx.save();
    
    // Apply camera transformation
    gameState.ctx.translate(-gameState.camera.x * gameState.zoom, -gameState.camera.y * gameState.zoom);
    gameState.ctx.scale(gameState.zoom, gameState.zoom);
    
    // Draw each player
    for (const id in otherPlayers) {
        const player = otherPlayers[id];
        
        // Skip if player has no position
        if (player.x === undefined || player.y === undefined) continue;
        
        // Draw player body (simple rectangle for now)
        gameState.ctx.fillStyle = player.color || '#FF0000';
        gameState.ctx.fillRect(player.x, player.y, player.width || 20, player.height || 30);
        
        // Draw player direction indicator
        gameState.ctx.fillStyle = '#000000';
        if (player.direction > 0) {
            // Facing right
            gameState.ctx.fillRect(player.x + (player.width || 20) - 5, player.y + 5, 5, 5);
        } else {
            // Facing left
            gameState.ctx.fillRect(player.x, player.y + 5, 5, 5);
        }
        
        // Draw player ID above
        gameState.ctx.fillStyle = '#FFFFFF';
        gameState.ctx.font = '12px Arial';
        gameState.ctx.textAlign = 'center';
        gameState.ctx.fillText(player.id.substring(0, 5) + '...', player.x + (player.width || 20) / 2, player.y - 5);
    }
    
    // Restore context state
    gameState.ctx.restore();
}

// Show player info on screen
function showPlayerInfo() {
    const playerInfoElement = document.getElementById('player-info');
    
    if (!playerInfoElement) {
        // Create player info element if it doesn't exist
        const playerInfo = document.createElement('div');
        playerInfo.id = 'player-info';
        playerInfo.className = 'game-info';
        document.getElementById('ui').appendChild(playerInfo);
    }
    
    // Update player info
    const playerInfo = document.getElementById('player-info');
    
    if (playerInfo) {
        // Count connected players
        const playerCount = Object.keys(otherPlayers).length + 1; // +1 for self
        
        playerInfo.innerHTML = `
            <div>Player ID: ${playerId ? playerId.substring(0, 5) + '...' : 'Not connected'}</div>
            <div>Players Online: ${playerCount}</div>
            <div>Connection: ${socket && socket.connected ? 'Connected' : 'Disconnected'}</div>
        `;
    }
}

// Show notification
function showNotification(message) {
    // Create notification element if it doesn't exist
    let notificationElement = document.getElementById('notification');
    
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'notification';
        document.body.appendChild(notificationElement);
        
        // Add CSS for notifications
        const style = document.createElement('style');
        style.textContent = `
            #notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background-color: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                z-index: 1000;
                transition: opacity 0.5s;
                opacity: 0;
            }
            
            #notification.show {
                opacity: 1;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Set message
    notificationElement.textContent = message;
    
    // Show notification
    notificationElement.classList.add('show');
    
    // Hide after 3 seconds
    setTimeout(() => {
        notificationElement.classList.remove('show');
    }, 3000);
}

// Get tile color for particles
function getTileColor(tileType) {
    switch (tileType) {
        case TILE_TYPES.DIRT:
            return '#8B4513'; // Brown
        case TILE_TYPES.STONE:
            return '#808080'; // Gray
        case TILE_TYPES.GRASS:
            return '#7CFC00'; // Green
        case TILE_TYPES.SAND:
            return '#F0E68C'; // Khaki
        case TILE_TYPES.ORE:
            return '#A0A0A0'; // Light gray
        case TILE_TYPES.COAL:
            return '#303030'; // Dark gray
        case TILE_TYPES.IRON:
            return '#C0C0C0'; // Silver
        case TILE_TYPES.GOLD:
            return '#FFD700'; // Gold
        case TILE_TYPES.DIAMOND:
            return '#00FFFF'; // Cyan
        default:
            return '#FFFFFF'; // White
    }
}

// Create digging particles
function createDiggingParticles(x, y, color) {
    // Create particles at the given position
    for (let i = 0; i < 10; i++) {
        const particle = {
            x: x,
            y: y,
            velocityX: (Math.random() - 0.5) * 2,
            velocityY: (Math.random() - 0.5) * 2,
            size: 2 + Math.random() * 3,
            color: color,
            life: 30 + Math.random() * 30
        };
        
        gameState.particles.push(particle);
    }
}

// Draw other players directly (for WebGL rendering)
function drawOtherPlayersDirect() {
    // Skip if no WebGL renderer
    if (!gameState.renderer) return;
    
    // Clear existing other player sprites
    if (!gameState.otherPlayerSprites) {
        gameState.otherPlayerSprites = {};
    }
    
    // Draw each player
    for (const id in otherPlayers) {
        const player = otherPlayers[id];
        
        // Skip if player has no position
        if (player.x === undefined || player.y === undefined) continue;
        
        // Create sprite if it doesn't exist
        if (!gameState.otherPlayerSprites[id]) {
            const sprite = new PIXI.Graphics();
            sprite.beginFill(parseInt(player.color.replace('#', '0x')) || 0xFF0000);
            sprite.drawRect(0, 0, player.width || 20, player.height || 30);
            sprite.endFill();
            
            // Add direction indicator
            sprite.beginFill(0x000000);
            if (player.direction > 0) {
                // Facing right
                sprite.drawRect((player.width || 20) - 5, 5, 5, 5);
            } else {
                // Facing left
                sprite.drawRect(0, 5, 5, 5);
            }
            sprite.endFill();
            
            // Add to stage
            gameState.stage.addChild(sprite);
            
            // Store sprite
            gameState.otherPlayerSprites[id] = sprite;
        }
        
        // Update sprite position
        const sprite = gameState.otherPlayerSprites[id];
        sprite.x = player.x;
        sprite.y = player.y;
        
        // Update direction indicator
        sprite.clear();
        sprite.beginFill(parseInt(player.color.replace('#', '0x')) || 0xFF0000);
        sprite.drawRect(0, 0, player.width || 20, player.height || 30);
        sprite.endFill();
        
        sprite.beginFill(0x000000);
        if (player.direction > 0) {
            // Facing right
            sprite.drawRect((player.width || 20) - 5, 5, 5, 5);
        } else {
            // Facing left
            sprite.drawRect(0, 5, 5, 5);
        }
        sprite.endFill();
        
        // Add player ID text
        if (!sprite.text) {
            const text = new PIXI.Text(player.id.substring(0, 5) + '...', {
                fontFamily: 'Arial',
                fontSize: 12,
                fill: 0xFFFFFF,
                align: 'center'
            });
            text.anchor.set(0.5, 1);
            text.x = (player.width || 20) / 2;
            text.y = -5;
            
            sprite.addChild(text);
            sprite.text = text;
        }
    }
    
    // Remove sprites for disconnected players
    for (const id in gameState.otherPlayerSprites) {
        if (!otherPlayers[id]) {
            // Remove from stage
            gameState.stage.removeChild(gameState.otherPlayerSprites[id]);
            
            // Delete sprite
            delete gameState.otherPlayerSprites[id];
        }
    }
}

// Wait for the game.js to fully load before initializing multiplayer
function ensureDependencies() {
    // Check if essential functions from game.js are available
    if (typeof window.getTile !== 'function' || typeof window.setTile !== 'function') {
        console.warn("Waiting for game.js functions to be available...");
        setTimeout(ensureDependencies, 100);
        return;
    }
    
    console.log("All dependencies loaded, initializing multiplayer");
    
    // Set up socket events
    setupSocketEvents();
    
    // Initialize multiplayer if auto-connect is enabled
    if (AUTO_CONNECT_TO_SERVER) {
        setTimeout(() => {
            initializeMultiplayer();
        }, 500);
    }
}

// Start the dependency check when the script loads
window.addEventListener('load', () => {
    console.log("Multiplayer script loaded, checking dependencies");
    setTimeout(ensureDependencies, 500); // Give game.js time to initialize
});

// Expose multiplayer functions to window
window.requestChunk = requestChunk;
window.sendBlockDig = sendBlockDig;
window.requestWorldData = requestWorldData;

// Expose reference to socket for other modules
window.getMultiplayerSocket = () => socket;

// Expose player status check
window.isMultiplayer = () => isConnectedToServer;

// Add logging to confirm function availability
console.log("Multiplayer functions exported to window:");
console.log("- requestChunk:", typeof window.requestChunk === 'function');
console.log("- sendBlockDig:", typeof window.sendBlockDig === 'function');
console.log("- requestWorldData:", typeof window.requestWorldData === 'function');

// Function to request world seed reset
function resetWorldSeed(seed) {
    if (!socket || !socket.connected) {
        console.warn('Cannot reset world seed - not connected to server');
        return;
    }
    
    socket.emit('resetWorldSeed', { seed });
    
    console.log('Sent request to reset world seed' + (seed !== undefined ? ` to ${seed}` : ''));
} 