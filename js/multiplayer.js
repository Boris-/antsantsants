// Multiplayer client functionality
let socket;
let otherPlayers = {};
let playerId;
let isConnectedToServer = false;

// Track recently processed block updates to prevent duplicates
const recentBlockUpdates = new Map();

// Cleanup function for recentBlockUpdates map
function cleanupRecentBlockUpdates() {
    const now = Date.now();
    const expirationTime = 10000; // 10 seconds
    
    // Remove entries older than expirationTime
    for (const [key, timestamp] of recentBlockUpdates.entries()) {
        if (now - timestamp > expirationTime) {
            recentBlockUpdates.delete(key);
        }
    }
}

// Run cleanup every 30 seconds
setInterval(cleanupRecentBlockUpdates, 30000);

// Initialize multiplayer connection
function initializeMultiplayer() {
    // Connect to the server
    socket = io('http://localhost:3001');
    
    // Set up event handlers
    setupSocketEvents();
    
    console.log('Connecting to multiplayer server...');
}

// Set up socket event handlers
function setupSocketEvents() {
    // Handle connection
    socket.on('connect', () => {
        console.log('Connected to server with ID:', socket.id);
        isConnectedToServer = true;
    });
    
    // Handle initialization data from server
    socket.on('initialize', (data) => {
        console.log('Received initialization data from server');
        console.log('Player ID:', data.id);
        console.log('Other players:', data.players);
        
        // Store player ID
        playerId = data.id;
        
        // Store other players
        otherPlayers = data.players;
        
        // Remove self from other players
        delete otherPlayers[playerId];
        
        console.log('Other players after removing self:', otherPlayers);
        
        // Set world seed from server (ensure it's a number)
        gameState.worldSeed = Number(data.worldSeed);
        console.log('World seed received from server:', gameState.worldSeed, 'Type:', typeof gameState.worldSeed);
        
        // Set terrain heights from server
        gameState.terrainHeights = data.terrainHeights;
        
        // Set biome map from server
        gameState.biomeMap = data.biomeMap;
        
        // Initialize biomes if needed
        if (!gameState.biomeTypes) {
            initializeBiomes();
        }
        
        // Place player at a safe location
        placePlayerSafely();
        
        // Request chunks around player
        requestInitialChunks();
        
        // Show player ID on screen
        showPlayerInfo();
        
        // Show notification
        showNotification('Connected to persistent world');
    });
    
    // Handle new player joining
    socket.on('playerJoined', (player) => {
        console.log('New player joined:', player.id);
        console.log('Player data:', player);
        
        // Add new player to other players
        otherPlayers[player.id] = player;
        
        console.log('Updated other players:', otherPlayers);
        
        // Show notification
        showNotification(`Player ${player.id.substring(0, 5)}... joined`);
    });
    
    // Handle player movement
    socket.on('playerMoved', (data) => {
        // Update other player position
        if (otherPlayers[data.id]) {
            otherPlayers[data.id].x = data.x;
            otherPlayers[data.id].y = data.y;
            otherPlayers[data.id].direction = data.direction;
        }
    });
    
    // Handle player leaving
    socket.on('playerLeft', (playerId) => {
        console.log('Player left:', playerId);
        
        // Remove player from other players
        delete otherPlayers[playerId];
        
        // Show notification
        showNotification(`Player ${playerId.substring(0, 5)}... left`);
    });
    
    // Handle chunk data from server
    socket.on('chunkData', (data) => {
        // Store chunk data
        const chunkKey = `${data.chunkX},${data.chunkY}`;
        
        // If this is a server-generated chunk or we don't have this chunk yet, use the server's version
        if (data.serverGenerated || !gameState.chunks[chunkKey]) {
            gameState.chunks[chunkKey] = data.data;
            
            // Mark this chunk as loaded from server
            if (!gameState.chunkMetadata) {
                gameState.chunkMetadata = {};
            }
            
            if (!gameState.chunkMetadata[chunkKey]) {
                gameState.chunkMetadata[chunkKey] = {};
            }
            
            gameState.chunkMetadata[chunkKey].loadedFromServer = true;
            gameState.chunkMetadata[chunkKey].loadedAt = Date.now();
        } else {
            // For chunks we already have, only update if there are differences
            // This helps with chunks that were modified locally before server data arrived
            let hasChanges = false;
            
            // Check for differences and update only if needed
            for (let y = 0; y < data.data.length; y++) {
                for (let x = 0; x < data.data[y].length; x++) {
                    // Skip metadata
                    if (y === 'metadata' || x === 'metadata') continue;
                    
                    // If server data differs from client data, update it
                    if (data.data[y][x] !== gameState.chunks[chunkKey][y][x]) {
                        gameState.chunks[chunkKey][y][x] = data.data[y][x];
                        hasChanges = true;
                    }
                }
            }
            
            // If we made changes, mark the chunk as updated
            if (hasChanges) {
                if (!gameState.chunkMetadata) {
                    gameState.chunkMetadata = {};
                }
                
                if (!gameState.chunkMetadata[chunkKey]) {
                    gameState.chunkMetadata[chunkKey] = {};
                }
                
                gameState.chunkMetadata[chunkKey].updatedFromServer = true;
                gameState.chunkMetadata[chunkKey].lastUpdated = Date.now();
            }
        }
        
        gameState.loadedChunks.add(chunkKey);
    });
    
    // Handle block updates from other players
    socket.on('blockUpdate', (data) => {
        // Create a unique key for this block position
        const blockKey = `${data.x},${data.y}`;
        
        // Check if we've recently processed an update for this block
        const now = Date.now();
        const lastUpdate = recentBlockUpdates.get(blockKey);
        
        // Only process if it's been at least 500ms since the last update for this block
        // or if this is the first update for this block
        if (!lastUpdate || (now - lastUpdate > 500)) {
            // Record this update time
            recentBlockUpdates.set(blockKey, now);
            
            // Update block in world
            const worldX = Math.floor(data.x / TILE_SIZE);
            const worldY = Math.floor(data.y / TILE_SIZE);
            
            // Check if this update originated from the current player
            if (data.playerId === socket.id) {
                // Just update the tile without creating particles again
                setTile(worldX, worldY, data.tileType, false); // Pass false to prevent sending update back to server
            } else {
                // Update tile and create particles for other players' actions
                setTile(worldX, worldY, data.tileType, false);
                
                // If we have the original tile type, add it to the player's inventory
                if (data.originalTileType !== undefined && data.originalTileType !== TILE_TYPES.AIR) {
                    // Use the improved particle system from game.js
                    if (typeof createParticles === 'function') {
                        // Get the center of the tile
                        const particleX = worldX * TILE_SIZE + TILE_SIZE / 2;
                        const particleY = worldY * TILE_SIZE + TILE_SIZE / 2;
                        const particleColor = getTileColor(data.originalTileType);
                        
                        // Create particles with the improved system
                        createParticles(particleX, particleY, particleColor, 20);
                    }
                }
            }
        }
    });
    
    // Handle player inventory updates
    socket.on('playerInventoryUpdated', (data) => {
        // Update other player's inventory
        if (otherPlayers[data.id]) {
            otherPlayers[data.id].inventory = data.inventory;
        }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        isConnectedToServer = false;
        showNotification('Disconnected from server');
    });
    
    // Start regular updates of player info
    startPlayerInfoUpdates();
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

// Initialize multiplayer when the page loads
window.addEventListener('load', () => {
    console.log("Initializing multiplayer...");
    // Initialize multiplayer after a short delay to allow the game to initialize first
    setTimeout(initializeMultiplayer, 1000);
});

// Export functions for use in other modules
window.requestChunk = requestChunk;
window.sendBlockDig = sendBlockDig;

// Log that the functions have been exported
console.log("Multiplayer functions exported to window object"); 