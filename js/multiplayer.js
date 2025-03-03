// Multiplayer client functionality
let socket;
let otherPlayers = {};
let playerId;

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
    socket = io('http://localhost:3000');
    
    // Set up event handlers
    setupSocketEvents();
    
    console.log('Connecting to multiplayer server...');
}

// Set up socket event handlers
function setupSocketEvents() {
    // Handle connection
    socket.on('connect', () => {
        console.log('Connected to server with ID:', socket.id);
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
        
        // Set world seed from server
        gameState.worldSeed = data.worldSeed;
        
        // Set terrain heights from server
        gameState.terrainHeights = data.terrainHeights;
        
        // Set biome map from server
        gameState.biomeMap = data.biomeMap;
        
        // Place player at a safe location
        placePlayerSafely();
        
        // Request chunks around player
        requestInitialChunks();
        
        // Show player ID on screen
        showPlayerInfo();
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
        gameState.chunks[chunkKey] = data.data;
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
                
                // Use the improved particle system from game.js
                if (typeof createParticles === 'function') {
                    // Get the center of the tile
                    const particleX = worldX * TILE_SIZE + TILE_SIZE / 2;
                    const particleY = worldY * TILE_SIZE + TILE_SIZE / 2;
                    const particleColor = getTileColor(data.tileType);
                    
                    // Create particles with the improved system
                    createParticles(particleX, particleY, particleColor, 20);
                }
            }
        }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        showNotification('Disconnected from server');
    });
}

// Request initial chunks around player
function requestInitialChunks() {
    // Calculate player chunk
    const playerChunkX = Math.floor(gameState.player.x / (CHUNK_SIZE * TILE_SIZE));
    const playerChunkY = Math.floor(gameState.player.y / (CHUNK_SIZE * TILE_SIZE));
    
    // Request chunks in a 5x5 area around player
    for (let y = playerChunkY - 2; y <= playerChunkY + 2; y++) {
        for (let x = playerChunkX - 2; x <= playerChunkX + 2; x++) {
            requestChunk(x, y);
        }
    }
}

// Request a chunk from the server
function requestChunk(chunkX, chunkY) {
    const chunkKey = `${chunkX},${chunkY}`;
    
    // Only request if not already loaded
    if (!gameState.loadedChunks.has(chunkKey)) {
        socket.emit('requestChunk', { chunkX, chunkY });
    }
}

// Send player position to server
function sendPlayerPosition() {
    if (socket && socket.connected) {
        socket.emit('playerMove', {
            x: gameState.player.x,
            y: gameState.player.y,
            direction: gameState.player.direction
        });
    }
}

// Send block dig to server
function sendBlockDig(x, y, tileType) {
    if (socket && socket.connected) {
        socket.emit('blockDig', {
            x: x,
            y: y,
            tileType: tileType
        });
    }
}

// Draw other players
function drawOtherPlayers() {
    for (const id in otherPlayers) {
        const player = otherPlayers[id];
        
        // Set default values if properties are missing
        const playerWidth = player.width || 20;
        const playerHeight = player.height || 30;
        
        // Calculate screen position
        const screenX = Math.round((player.x - gameState.camera.x) * gameState.zoom);
        const screenY = Math.round((player.y - gameState.camera.y) * gameState.zoom);
        
        // Use a consistent size based on player dimensions
        const antWidth = playerWidth * 0.9 * gameState.zoom;  // 90% of player width, scaled by zoom
        const antHeight = playerHeight * 0.9 * gameState.zoom; // 90% of player height, scaled by zoom
        
        // Calculate center position for the ant
        const centerX = screenX + playerWidth * gameState.zoom / 2;
        const centerY = screenY + playerHeight * gameState.zoom / 2;
        
        // Get player direction (default to 1 if not specified)
        const direction = player.direction || 1;
        
        // Draw ant with three body segments - using a cute color scheme with slight variation
        // Use a different color for each player based on their ID
        const playerIdSum = id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
        const hue = (playerIdSum % 360); // Use player ID to generate a unique hue
        gameState.ctx.fillStyle = `hsl(${hue}, 80%, 70%)`; // Pastel color based on player ID
        
        // 1. Draw abdomen (rear segment) - rounder oval
        const abdomenWidth = antWidth * 0.5;
        const abdomenHeight = antHeight * 0.6;
        const abdomenX = centerX + (direction === 1 ? -abdomenWidth * 0.6 : abdomenWidth * 0.6);
        
        gameState.ctx.beginPath();
        gameState.ctx.ellipse(
            abdomenX,
            centerY,
            abdomenWidth / 2,
            abdomenHeight / 2,
            0, 0, Math.PI * 2
        );
        gameState.ctx.fill();
        
        // Add a cute pattern to abdomen
        gameState.ctx.fillStyle = `hsl(${hue}, 80%, 80%)`;
        gameState.ctx.beginPath();
        gameState.ctx.ellipse(
            abdomenX,
            centerY,
            abdomenWidth / 3,
            abdomenHeight / 3,
            0, 0, Math.PI * 2
        );
        gameState.ctx.fill();
        
        // 2. Draw thorax (middle segment) - rounder oval
        const thoraxWidth = antWidth * 0.3;
        const thoraxHeight = antHeight * 0.4;
        const thoraxX = centerX + (direction === 1 ? thoraxWidth * 0.3 : -thoraxWidth * 0.3);
        
        gameState.ctx.fillStyle = `hsl(${hue}, 80%, 70%)`;
        gameState.ctx.beginPath();
        gameState.ctx.ellipse(
            thoraxX,
            centerY,
            thoraxWidth / 2,
            thoraxHeight / 2,
            0, 0, Math.PI * 2
        );
        gameState.ctx.fill();
        
        // 3. Draw head - rounder circle
        const headSize = antWidth * 0.25;
        const headX = centerX + (direction === 1 ? 
                                thoraxWidth * 0.8 : 
                                -thoraxWidth * 0.8);
        const headY = centerY;
        
        gameState.ctx.beginPath();
        gameState.ctx.arc(
            headX,
            headY,
            headSize / 2,
            0, Math.PI * 2
        );
        gameState.ctx.fill();
        
        // Draw cute eyes (larger and more expressive)
        gameState.ctx.fillStyle = "#FFFFFF";
        const eyeSize = Math.max(2, antWidth * 0.1);
        
        // Left eye
        const eyeX1 = headX + (direction === 1 ? headSize * 0.15 : -headSize * 0.15);
        const eyeY1 = headY - headSize * 0.1;
        
        gameState.ctx.beginPath();
        gameState.ctx.arc(
            eyeX1,
            eyeY1,
            eyeSize / 2,
            0, Math.PI * 2
        );
        gameState.ctx.fill();
        
        // Right eye
        const eyeX2 = headX + (direction === 1 ? headSize * 0.3 : -headSize * 0.3);
        const eyeY2 = eyeY1;
        
        gameState.ctx.beginPath();
        gameState.ctx.arc(
            eyeX2,
            eyeY2,
            eyeSize / 2,
            0, Math.PI * 2
        );
        gameState.ctx.fill();
        
        // Draw pupils (black dots in eyes)
        gameState.ctx.fillStyle = "#000000";
        
        // Left pupil
        gameState.ctx.beginPath();
        gameState.ctx.arc(
            eyeX1 + (direction === 1 ? eyeSize * 0.2 : -eyeSize * 0.2),
            eyeY1,
            eyeSize / 5,
            0, Math.PI * 2
        );
        gameState.ctx.fill();
        
        // Right pupil
        gameState.ctx.beginPath();
        gameState.ctx.arc(
            eyeX2 + (direction === 1 ? eyeSize * 0.2 : -eyeSize * 0.2),
            eyeY2,
            eyeSize / 5,
            0, Math.PI * 2
        );
        gameState.ctx.fill();
        
        // Draw cute smile
        gameState.ctx.strokeStyle = "#000000";
        gameState.ctx.lineWidth = Math.max(1, antWidth * 0.02);
        
        gameState.ctx.beginPath();
        if (direction === 1) { // Facing right
            gameState.ctx.arc(
                headX + headSize * 0.2,
                headY + headSize * 0.1,
                headSize * 0.2,
                0, Math.PI
            );
        } else { // Facing left
            gameState.ctx.arc(
                headX - headSize * 0.2,
                headY + headSize * 0.1,
                headSize * 0.2,
                0, Math.PI
            );
        }
        gameState.ctx.stroke();
        
        // Draw antennae (cuter, more curved)
        gameState.ctx.strokeStyle = `hsl(${hue}, 80%, 70%)`;
        gameState.ctx.lineWidth = Math.max(1, antWidth * 0.03);
        
        // First antenna
        const antennaBaseX = headX + (direction === 1 ? headSize * 0.2 : -headSize * 0.2);
        const antennaBaseY = headY - headSize * 0.3;
        const antennaEndX = antennaBaseX + (direction === 1 ? headSize * 0.8 : -headSize * 0.8);
        const antennaEndY = antennaBaseY - headSize * 0.7;
        
        gameState.ctx.beginPath();
        gameState.ctx.moveTo(antennaBaseX, antennaBaseY);
        gameState.ctx.bezierCurveTo(
            antennaBaseX + (direction === 1 ? headSize * 0.4 : -headSize * 0.4),
            antennaBaseY - headSize * 0.5,
            antennaEndX - (direction === 1 ? headSize * 0.2 : -headSize * 0.2),
            antennaEndY - headSize * 0.2,
            antennaEndX,
            antennaEndY
        );
        gameState.ctx.stroke();
        
        // Add cute antenna tips (small circles)
        gameState.ctx.fillStyle = `hsl(${hue}, 80%, 80%)`;
        gameState.ctx.beginPath();
        gameState.ctx.arc(
            antennaEndX,
            antennaEndY,
            Math.max(1, antWidth * 0.04),
            0, Math.PI * 2
        );
        gameState.ctx.fill();
        
        // Draw a thin "waist" connecting thorax and abdomen
        gameState.ctx.strokeStyle = `hsl(${hue}, 80%, 70%)`;
        gameState.ctx.lineWidth = Math.max(1, antWidth * 0.03);
        gameState.ctx.beginPath();
        gameState.ctx.moveTo(
            thoraxX + (direction === 1 ? -thoraxWidth / 2 : thoraxWidth / 2),
            centerY
        );
        gameState.ctx.lineTo(
            abdomenX + (direction === 1 ? abdomenWidth / 2 : -abdomenWidth / 2),
            centerY
        );
        gameState.ctx.stroke();
        
        // Draw player ID above head
        gameState.ctx.fillStyle = 'white';
        gameState.ctx.font = '12px Arial';
        gameState.ctx.textAlign = 'center';
        gameState.ctx.fillText(
            id.substring(0, 5) + '...',
            Math.round((player.x - gameState.camera.x + playerWidth / 2) * gameState.zoom),
            Math.round((player.y - gameState.camera.y - 10) * gameState.zoom)
        );
    }
}

// Show player info on screen
function showPlayerInfo() {
    // Create player info element if it doesn't exist
    let playerInfo = document.getElementById('player-info');
    if (!playerInfo) {
        playerInfo = document.createElement('div');
        playerInfo.id = 'player-info';
        document.body.appendChild(playerInfo);
    }
    
    // Update player info
    playerInfo.textContent = `Your ID: ${playerId.substring(0, 5)}...`;
    playerInfo.style.position = 'absolute';
    playerInfo.style.top = '10px';
    playerInfo.style.left = '10px';
    playerInfo.style.color = 'white';
    playerInfo.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    playerInfo.style.padding = '5px';
    playerInfo.style.borderRadius = '5px';
}

// Show notification
function showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    // Style notification
    notification.style.position = 'absolute';
    notification.style.top = '50px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    notification.style.color = 'white';
    notification.style.padding = '10px';
    notification.style.borderRadius = '5px';
    notification.style.zIndex = '1000';
    
    // Add to document
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        document.body.removeChild(notification);
    }, 3000);
}

// Get tile color for particles
function getTileColor(tileType) {
    switch (tileType) {
        case TILE_TYPES.DIRT:
            return '#8B4513';
        case TILE_TYPES.STONE:
            return '#808080';
        case TILE_TYPES.GRASS:
            return '#228B22';
        case TILE_TYPES.SAND:
            return '#F0E68C';
        case TILE_TYPES.COAL:
            return '#2F4F4F';
        case TILE_TYPES.IRON:
            return '#CD853F';
        case TILE_TYPES.GOLD:
            return '#FFD700';
        case TILE_TYPES.DIAMOND:
            return '#00BFFF';
        default:
            return '#FFFFFF';
    }
}

// Create digging particles
function createDiggingParticles(x, y, color) {
    // Create 10 particles
    for (let i = 0; i < 10; i++) {
        const particle = {
            x: x,
            y: y,
            velocityX: (Math.random() - 0.5) * 5,
            velocityY: (Math.random() - 0.5) * 5,
            size: 2 + Math.random() * 3,
            color: color,
            expireTime: Date.now() + 1000 + Math.random() * 500
        };
        
        gameState.particles.push(particle);
    }
}

// Draw other players directly in world coordinates (used when ctx is already transformed)
function drawOtherPlayersDirect() {
    for (const id in otherPlayers) {
        const player = otherPlayers[id];
        
        // Set default values if properties are missing
        const playerWidth = player.width || 20;
        const playerHeight = player.height || 30;
        
        // Use the player's actual world coordinates
        const playerX = player.x;
        const playerY = player.y;
        
        // Use a consistent size based on player dimensions
        const antWidth = playerWidth * 0.9;  // 90% of player width
        const antHeight = playerHeight * 0.9; // 90% of player height
        
        // Calculate center position for the ant
        const centerX = playerX + playerWidth / 2;
        const centerY = playerY + playerHeight / 2;
        
        // Get player direction (default to 1 if not specified)
        const direction = player.direction || 1;
        
        // Draw ant with three body segments - using a cute color scheme with slight variation
        // Use a different color for each player based on their ID
        const playerIdSum = id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
        const hue = (playerIdSum % 360); // Use player ID to generate a unique hue
        gameState.ctx.fillStyle = `hsl(${hue}, 80%, 70%)`; // Pastel color based on player ID
        
        // 1. Draw abdomen (rear segment) - rounder oval
        const abdomenWidth = antWidth * 0.5;
        const abdomenHeight = antHeight * 0.6;
        const abdomenX = centerX + (direction === 1 ? -abdomenWidth * 0.6 : abdomenWidth * 0.6);
        
        gameState.ctx.beginPath();
        gameState.ctx.ellipse(
            abdomenX,
            centerY,
            abdomenWidth / 2,
            abdomenHeight / 2,
            0, 0, Math.PI * 2
        );
        gameState.ctx.fill();
        
        // Add a cute pattern to abdomen
        gameState.ctx.fillStyle = `hsl(${hue}, 80%, 80%)`;
        gameState.ctx.beginPath();
        gameState.ctx.ellipse(
            abdomenX,
            centerY,
            abdomenWidth / 3,
            abdomenHeight / 3,
            0, 0, Math.PI * 2
        );
        gameState.ctx.fill();
        
        // 2. Draw thorax (middle segment) - rounder oval
        const thoraxWidth = antWidth * 0.3;
        const thoraxHeight = antHeight * 0.4;
        const thoraxX = centerX + (direction === 1 ? thoraxWidth * 0.3 : -thoraxWidth * 0.3);
        
        gameState.ctx.fillStyle = `hsl(${hue}, 80%, 70%)`;
        gameState.ctx.beginPath();
        gameState.ctx.ellipse(
            thoraxX,
            centerY,
            thoraxWidth / 2,
            thoraxHeight / 2,
            0, 0, Math.PI * 2
        );
        gameState.ctx.fill();
        
        // 3. Draw head - rounder circle
        const headSize = antWidth * 0.25;
        const headX = centerX + (direction === 1 ? 
                                thoraxWidth * 0.8 : 
                                -thoraxWidth * 0.8);
        const headY = centerY;
        
        gameState.ctx.beginPath();
        gameState.ctx.arc(
            headX,
            headY,
            headSize / 2,
            0, Math.PI * 2
        );
        gameState.ctx.fill();
        
        // Draw cute eyes (larger and more expressive)
        gameState.ctx.fillStyle = "#FFFFFF";
        const eyeSize = Math.max(2, antWidth * 0.1);
        
        // Left eye
        const eyeX1 = headX + (direction === 1 ? headSize * 0.15 : -headSize * 0.15);
        const eyeY1 = headY - headSize * 0.1;
        
        gameState.ctx.beginPath();
        gameState.ctx.arc(
            eyeX1,
            eyeY1,
            eyeSize / 2,
            0, Math.PI * 2
        );
        gameState.ctx.fill();
        
        // Right eye
        const eyeX2 = headX + (direction === 1 ? headSize * 0.3 : -headSize * 0.3);
        const eyeY2 = eyeY1;
        
        gameState.ctx.beginPath();
        gameState.ctx.arc(
            eyeX2,
            eyeY2,
            eyeSize / 2,
            0, Math.PI * 2
        );
        gameState.ctx.fill();
        
        // Draw pupils (black dots in eyes)
        gameState.ctx.fillStyle = "#000000";
        
        // Left pupil
        gameState.ctx.beginPath();
        gameState.ctx.arc(
            eyeX1 + (direction === 1 ? eyeSize * 0.2 : -eyeSize * 0.2),
            eyeY1,
            eyeSize / 5,
            0, Math.PI * 2
        );
        gameState.ctx.fill();
        
        // Right pupil
        gameState.ctx.beginPath();
        gameState.ctx.arc(
            eyeX2 + (direction === 1 ? eyeSize * 0.2 : -eyeSize * 0.2),
            eyeY2,
            eyeSize / 5,
            0, Math.PI * 2
        );
        gameState.ctx.fill();
        
        // Draw cute smile
        gameState.ctx.strokeStyle = "#000000";
        gameState.ctx.lineWidth = Math.max(1, antWidth * 0.02);
        
        gameState.ctx.beginPath();
        if (direction === 1) { // Facing right
            gameState.ctx.arc(
                headX + headSize * 0.2,
                headY + headSize * 0.1,
                headSize * 0.2,
                0, Math.PI
            );
        } else { // Facing left
            gameState.ctx.arc(
                headX - headSize * 0.2,
                headY + headSize * 0.1,
                headSize * 0.2,
                0, Math.PI
            );
        }
        gameState.ctx.stroke();
        
        // Draw antennae (cuter, more curved)
        gameState.ctx.strokeStyle = `hsl(${hue}, 80%, 70%)`;
        gameState.ctx.lineWidth = Math.max(1, antWidth * 0.03);
        
        // First antenna
        const antennaBaseX = headX + (direction === 1 ? headSize * 0.2 : -headSize * 0.2);
        const antennaBaseY = headY - headSize * 0.3;
        const antennaEndX = antennaBaseX + (direction === 1 ? headSize * 0.8 : -headSize * 0.8);
        const antennaEndY = antennaBaseY - headSize * 0.7;
        
        gameState.ctx.beginPath();
        gameState.ctx.moveTo(antennaBaseX, antennaBaseY);
        gameState.ctx.bezierCurveTo(
            antennaBaseX + (direction === 1 ? headSize * 0.4 : -headSize * 0.4),
            antennaBaseY - headSize * 0.5,
            antennaEndX - (direction === 1 ? headSize * 0.2 : -headSize * 0.2),
            antennaEndY - headSize * 0.2,
            antennaEndX,
            antennaEndY
        );
        gameState.ctx.stroke();
        
        // Add cute antenna tips (small circles)
        gameState.ctx.fillStyle = `hsl(${hue}, 80%, 80%)`;
        gameState.ctx.beginPath();
        gameState.ctx.arc(
            antennaEndX,
            antennaEndY,
            Math.max(1, antWidth * 0.04),
            0, Math.PI * 2
        );
        gameState.ctx.fill();
        
        // Draw a thin "waist" connecting thorax and abdomen
        gameState.ctx.strokeStyle = `hsl(${hue}, 80%, 70%)`;
        gameState.ctx.lineWidth = Math.max(1, antWidth * 0.03);
        gameState.ctx.beginPath();
        gameState.ctx.moveTo(
            thoraxX + (direction === 1 ? -thoraxWidth / 2 : thoraxWidth / 2),
            centerY
        );
        gameState.ctx.lineTo(
            abdomenX + (direction === 1 ? abdomenWidth / 2 : -abdomenWidth / 2),
            centerY
        );
        gameState.ctx.stroke();
        
        // Draw player ID above head (in world coordinates)
        gameState.ctx.fillStyle = 'white';
        gameState.ctx.font = '12px Arial';
        gameState.ctx.textAlign = 'center';
        gameState.ctx.fillText(
            id.substring(0, 5) + '...',
            playerX + playerWidth / 2,
            playerY - 10
        );
    }
}

// Export functions for use in other modules
window.drawOtherPlayers = drawOtherPlayers;
window.drawOtherPlayersDirect = drawOtherPlayersDirect;
window.requestChunk = requestChunk;
window.sendBlockDig = sendBlockDig; 