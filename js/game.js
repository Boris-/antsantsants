// Game logic module

// Reference to multiplayer functions - using different variable names to avoid conflicts
let _requestChunk = () => {}; // Default empty function
let _sendBlockDig = () => {}; // Default empty function

// Track recently dug blocks to prevent duplicate particle creation
const recentlyDugBlocks = new Map();

// Cleanup function for recentlyDugBlocks map
function cleanupRecentlyDugBlocks() {
    const now = Date.now();
    const expirationTime = 10000; // 10 seconds
    
    // Remove entries older than expirationTime
    for (const [key, timestamp] of recentlyDugBlocks.entries()) {
        if (now - timestamp > expirationTime) {
            recentlyDugBlocks.delete(key);
        }
    }
}

// Run cleanup every 30 seconds
setInterval(cleanupRecentlyDugBlocks, 30000);

// Set up references to multiplayer functions
function setupMultiplayerReferences() {
    console.log("Setting up multiplayer references...");
    
    // Check if multiplayer functions exist
    if (typeof window.requestChunk === 'function') {
        console.log("Found requestChunk function");
        _requestChunk = window.requestChunk;
    } else {
        console.warn("requestChunk function not found");
    }
    
    if (typeof window.sendBlockDig === 'function') {
        console.log("Found sendBlockDig function");
        _sendBlockDig = window.sendBlockDig;
    } else {
        console.warn("sendBlockDig function not found");
    }
}

// Call setup when the script loads
window.addEventListener('load', setupMultiplayerReferences);

// Helper function to get a chunk by coordinates
function getChunk(chunkX, chunkY) {
    const chunkKey = `${chunkX},${chunkY}`;
    return gameState.chunks[chunkKey] || null;
}

// Main game loop
function gameLoop(timestamp) {
    // Calculate delta time
    const deltaTime = timestamp - gameState.lastFrameTime;
    gameState.lastFrameTime = timestamp;
    
    // Calculate FPS
    if (deltaTime > 0) {
        // Use a moving average for smoother FPS display
        const fps = 1000 / deltaTime;
        if (!gameState.fps) {
            gameState.fps = fps;
        } else {
            // Smooth the FPS value (80% previous, 20% current)
            gameState.fps = gameState.fps * 0.8 + fps * 0.2;
        }
    }
    
    // Update game state
    updateGame(deltaTime);
    
    // Render game
    renderGameInternal();
    
    // Request next frame
    requestAnimationFrame(gameLoop);
}

// Update game state
function updateGame(deltaTime) {
    // Update player size to match a smaller hitbox (60% of a tile for width, 50% for height)
    gameState.player.width = TILE_SIZE * 0.6;
    gameState.player.height = TILE_SIZE * 0.5;
    
    // Set appropriate digging range for the small ant
    gameState.player.digRange = TILE_SIZE * 3;
    
    // Set appropriate movement speed for the small ant
    gameState.player.speed = 2;
    
    // Update player movement
    handlePlayerMovement();
    
    // Handle digging
    handleDigging();
    
    // Update camera
    updateCamera();
    
    // Update particles
    updateParticles(deltaTime);
    
    // Send player position to server (for multiplayer)
    if (socket && socket.connected && gameState.lastPositionUpdate + 50 < Date.now()) {
        sendPlayerPosition();
        gameState.lastPositionUpdate = Date.now();
    }
    
    // Request new chunks if needed
    checkAndRequestChunks();
}

// Update camera
function updateCamera() {
    // Calculate center of the screen
    const centerX = gameState.canvas.width / 2;
    const centerY = gameState.canvas.height / 2;
    
    // Set camera target to follow player
    gameState.camera.targetX = gameState.player.x + (gameState.player.width / 2) - (centerX / gameState.zoom);
    gameState.camera.targetY = gameState.player.y + (gameState.player.height / 2) - (centerY / gameState.zoom);
    
    // Smoothly move camera towards target
    gameState.camera.x += (gameState.camera.targetX - gameState.camera.x) * 0.1;
    gameState.camera.y += (gameState.camera.targetY - gameState.camera.y) * 0.1;
}

// Update UI elements
function updateUI() {
    // Make sure gameState exists
    if (!window.gameState) {
        console.error("Game state not initialized in updateUI!");
        return;
    }
    
    // Call the specific UI update functions directly to avoid circular references
    if (typeof window.updateHealthDisplay === 'function') {
        window.updateHealthDisplay();
    }
    if (typeof window.updateScoreDisplay === 'function') {
        window.updateScoreDisplay();
    }
    if (typeof window.updateInventoryDisplay === 'function') {
        window.updateInventoryDisplay();
    }
    if (typeof window.updateBiomeDisplay === 'function') {
        window.updateBiomeDisplay();
    }
    if (typeof window.updateDebugInfo === 'function') {
        window.updateDebugInfo();
    }
}

// Check if we should auto-save
function checkAutoSave() {
    const currentTime = Date.now();
    if (gameState.hasUnsavedChanges && currentTime - gameState.lastSaveTime > AUTO_SAVE_INTERVAL) {
        saveGame();
        showNotification('Game auto-saved');
    }
}

// Add save button to UI
function addSaveButton() {
    const saveButton = document.createElement('button');
    saveButton.id = 'save-game';
    saveButton.textContent = 'Save Game';
    saveButton.addEventListener('click', () => {
        if (saveGame()) {
            saveButton.textContent = 'Game Saved!';
            setTimeout(() => {
                saveButton.textContent = 'Save Game';
            }, 2000);
        } else {
            saveButton.textContent = 'Save Failed!';
            setTimeout(() => {
                saveButton.textContent = 'Save Game';
            }, 2000);
        }
    });
    
    document.getElementById('ui').appendChild(saveButton);
}

// Initialize game when window loads
window.addEventListener('load', () => {
    initializeGameState();
    addSaveButton();
    gameLoop(0);
    
    // Hide tutorial after 10 seconds
    setTimeout(() => {
        const tutorial = document.getElementById('tutorial');
        if (tutorial) {
            tutorial.style.opacity = '0';
            tutorial.style.transition = 'opacity 1s';
        }
    }, 10000);
});

// Check if a tile is solid (cannot be passed through)
function isSolid(tileType) {
    return tileType !== TILE_TYPES.AIR && 
           tileType !== TILE_TYPES.LEAVES &&
           tileType !== TILE_TYPES.FLOWER &&
           tileType !== TILE_TYPES.TALL_GRASS &&
           tileType !== TILE_TYPES.MUSHROOM;
}

// Check if a tile can be dug
function isDiggable(tileType) {
    return tileType !== TILE_TYPES.AIR && 
           tileType !== TILE_TYPES.BEDROCK;
}

// Check if a tile is collectible
function isCollectible(tileType) {
    return tileType === TILE_TYPES.COAL ||
           tileType === TILE_TYPES.IRON ||
           tileType === TILE_TYPES.GOLD ||
           tileType === TILE_TYPES.DIAMOND ||
           tileType === TILE_TYPES.WOOD ||
           tileType === TILE_TYPES.LEAVES ||
           tileType === TILE_TYPES.FLOWER ||
           tileType === TILE_TYPES.MUSHROOM;
}

// Get score value for a tile type
function getScoreValue(tileType) {
    switch (tileType) {
        case TILE_TYPES.COAL: return 1;
        case TILE_TYPES.IRON: return 3;
        case TILE_TYPES.GOLD: return 5;
        case TILE_TYPES.DIAMOND: return 10;
        case TILE_TYPES.WOOD: return 1;
        case TILE_TYPES.LEAVES: return 1;
        case TILE_TYPES.FLOWER: return 2;
        case TILE_TYPES.MUSHROOM: return 3;
        default: return 0;
    }
}

// Get display name for a tile type
function getTileName(tileType) {
    switch (tileType) {
        case TILE_TYPES.AIR: return "Air";
        case TILE_TYPES.DIRT: return "Dirt";
        case TILE_TYPES.GRASS: return "Grass";
        case TILE_TYPES.STONE: return "Stone";
        case TILE_TYPES.BEDROCK: return "Bedrock";
        case TILE_TYPES.COAL: return "Coal";
        case TILE_TYPES.IRON: return "Iron";
        case TILE_TYPES.GOLD: return "Gold";
        case TILE_TYPES.DIAMOND: return "Diamond";
        case TILE_TYPES.SAND: return "Sand";
        case TILE_TYPES.WOOD: return "Wood";
        case TILE_TYPES.LEAVES: return "Leaves";
        case TILE_TYPES.BUSH: return "Bush";
        case TILE_TYPES.FLOWER: return "Flower";
        case TILE_TYPES.TALL_GRASS: return "Tall Grass";
        case TILE_TYPES.CACTUS: return "Cactus";
        case TILE_TYPES.SNOW: return "Snow";
        case TILE_TYPES.MUSHROOM: return "Mushroom";
        case TILE_TYPES.WATER: return "Water";
        default: return "Unknown";
    }
}

// Handle player movement
function handlePlayerMovement() {
    // Reset movement
    let moveX = 0;
    let moveY = 0;
    
    // Check keyboard input
    if (gameState.keys.ArrowUp || gameState.keys.w || gameState.keys.W) {
        moveY = -1;
    }
    if (gameState.keys.ArrowDown || gameState.keys.s || gameState.keys.S) {
        moveY = 1;
    }
    if (gameState.keys.ArrowLeft || gameState.keys.a || gameState.keys.A) {
        moveX = -1;
        gameState.player.direction = -1; // Face left
    }
    if (gameState.keys.ArrowRight || gameState.keys.d || gameState.keys.D) {
        moveX = 1;
        gameState.player.direction = 1; // Face right
    }
    
    // Normalize diagonal movement
    if (moveX !== 0 && moveY !== 0) {
        moveX *= 0.7071; // 1/sqrt(2)
        moveY *= 0.7071;
    }
    
    // Apply movement speed
    moveX *= gameState.player.speed;
    moveY *= gameState.player.speed;
    
    // Try to move horizontally
    if (moveX !== 0) {
        const newX = gameState.player.x + moveX;
        
        // Check for collision
        if (!checkCollision(newX, gameState.player.y)) {
            gameState.player.x = newX;
        }
    }
    
    // Try to move vertically
    if (moveY !== 0) {
        const newY = gameState.player.y + moveY;
        
        // Check for collision
        if (!checkCollision(gameState.player.x, newY)) {
            gameState.player.y = newY;
        }
    }
    
    // Update player direction for multiplayer
    if (gameState.player.velocityX > 0) {
        gameState.player.direction = 1;
    } else if (gameState.player.velocityX < 0) {
        gameState.player.direction = -1;
    }
}

// Check for collision at the specified position
function checkCollision(x, y) {
    // Calculate player bounds with a larger margin to make hitbox smaller
    const margin = TILE_SIZE * 0.15; // 15% margin (increased from 10%)
    const playerLeft = x + margin;
    const playerRight = x + gameState.player.width - margin;
    const playerTop = y + margin;
    const playerBottom = y + gameState.player.height - margin;
    
    // Convert to tile coordinates
    const tileLeft = Math.floor(playerLeft / TILE_SIZE);
    const tileRight = Math.floor((playerRight - 1) / TILE_SIZE);
    const tileTop = Math.floor(playerTop / TILE_SIZE);
    const tileBottom = Math.floor((playerBottom - 1) / TILE_SIZE);
    
    // Check each tile the player overlaps
    for (let tileY = tileTop; tileY <= tileBottom; tileY++) {
        for (let tileX = tileLeft; tileX <= tileRight; tileX++) {
            // Get chunk coordinates
            const chunkX = Math.floor(tileX / CHUNK_SIZE);
            const chunkY = Math.floor(tileY / CHUNK_SIZE);
            
            // Get local coordinates within chunk
            const localX = ((tileX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            const localY = ((tileY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            
            // Get chunk
            const chunk = getChunk(chunkX, chunkY);
            
            // Check if tile is solid
            if (chunk && isSolid(chunk[localY][localX])) {
                return true; // Collision detected
            }
        }
    }
    
    return false; // No collision
}

// Handle digging
function handleDigging() {
    // Check if mouse is down
    if (gameState.mouseDown) {
        console.log("Mouse is down, attempting to dig");
        
        // Calculate mouse position in world coordinates
        const mouseWorldX = Math.floor((gameState.mouseX / gameState.zoom) + gameState.camera.x);
        const mouseWorldY = Math.floor((gameState.mouseY / gameState.zoom) + gameState.camera.y);
        
        console.log(`Mouse world coordinates: (${mouseWorldX}, ${mouseWorldY})`);
        
        // Calculate tile coordinates
        const tileX = Math.floor(mouseWorldX / TILE_SIZE);
        const tileY = Math.floor(mouseWorldY / TILE_SIZE);
        
        console.log(`Tile coordinates: (${tileX}, ${tileY})`);
        
        // Calculate distance from player to mouse
        const playerCenterX = gameState.player.x + gameState.player.width / 2;
        const playerCenterY = gameState.player.y + gameState.player.height / 2;
        const distance = Math.sqrt(
            Math.pow(playerCenterX - mouseWorldX, 2) + 
            Math.pow(playerCenterY - mouseWorldY, 2)
        );
        
        console.log(`Player center: (${playerCenterX}, ${playerCenterY}), Distance to mouse: ${distance}, Dig range: ${gameState.player.digRange}`);
        
        // Check if mouse is within digging range
        if (distance <= gameState.player.digRange) {
            console.log("Mouse is within digging range");
            
            // Get current tile type
            const currentTile = getTile(tileX, tileY);
            
            // Debug output
            console.log(`Attempting to dig at (${tileX}, ${tileY}), tile type: ${currentTile}, diggable: ${isDiggable(currentTile)}`);
            
            // Check if tile is diggable
            if (isDiggable(currentTile)) {
                console.log(`Tile is diggable: ${currentTile}`);
                
                // Create a unique key for this block position
                const blockKey = `${tileX},${tileY}`;
                
                // Check if we've recently dug this block
                const now = Date.now();
                const lastDug = recentlyDugBlocks.get(blockKey);
                
                console.log(`Last dug time: ${lastDug}, Current time: ${now}, Difference: ${lastDug ? now - lastDug : 'first dig'}`);
                
                // Only dig if it's been at least 500ms since the last dig for this block
                // or if this is the first dig for this block
                if (!lastDug || (now - lastDug > 500)) {
                    console.log(`Digging block at (${tileX}, ${tileY}), tile type: ${currentTile}`);
                    
                    // Record this dig time
                    recentlyDugBlocks.set(blockKey, now);
                    
                    // Create particles at the center of the tile
                    const particleX = tileX * TILE_SIZE + TILE_SIZE / 2;
                    const particleY = tileY * TILE_SIZE + TILE_SIZE / 2;
                    const particleColor = getTileColor(currentTile);
                    
                    // Create particles
                    createParticles(particleX, particleY, particleColor, 20);
                    
                    // Check if tile is collectible
                    if (isCollectible(currentTile)) {
                        console.log(`Tile is collectible: ${currentTile}`);
                        
                        // Add to inventory
                        switch (currentTile) {
                            case TILE_TYPES.COAL:
                                gameState.player.inventory.coal++;
                                break;
                            case TILE_TYPES.IRON:
                                gameState.player.inventory.iron++;
                                break;
                            case TILE_TYPES.GOLD:
                                gameState.player.inventory.gold++;
                                break;
                            case TILE_TYPES.DIAMOND:
                                gameState.player.inventory.diamond++;
                                break;
                            case TILE_TYPES.DIRT:
                                gameState.player.inventory.dirt++;
                                break;
                            case TILE_TYPES.STONE:
                                gameState.player.inventory.stone++;
                                break;
                        }
                        
                        // Update inventory display
                        if (typeof window.updateInventoryDisplay === 'function') {
                            window.updateInventoryDisplay();
                        }
                        
                        // Add score
                        gameState.score += getScoreValue(currentTile);
                        
                        // Update score display
                        if (typeof window.updateScoreDisplay === 'function') {
                            window.updateScoreDisplay();
                        }
                    }
                    
                    // Send block dig to server if multiplayer is enabled
                    if (typeof _sendBlockDig === 'function') {
                        console.log(`Sending block dig to server: (${tileX}, ${tileY}), tile type: ${TILE_TYPES.AIR}`);
                        _sendBlockDig(tileX, tileY, TILE_TYPES.AIR);
                    } else {
                        console.log(`No _sendBlockDig function available, updating tile locally`);
                        // If not in multiplayer mode, update the tile locally
                        setTile(tileX, tileY, TILE_TYPES.AIR);
                    }
                } else {
                    console.log(`Too soon to dig this block again, need to wait ${500 - (now - lastDug)}ms more`);
                }
            } else {
                console.log(`Tile is not diggable: ${currentTile}`);
            }
        } else {
            console.log(`Mouse is too far from player (${distance} > ${gameState.player.digRange})`);
        }
    } else {
        console.log("Mouse is not down, not attempting to dig");
    }
}

// Create particles
function createParticles(x, y, color, count) {
    if (!gameState.particles) {
        gameState.particles = [];
    }
    
    // Create more particles for a better effect
    count = count || 20;
    
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 5; // Faster particles
        
        gameState.particles.push({
            x: x,
            y: y,
            velocityX: Math.cos(angle) * speed,
            velocityY: Math.sin(angle) * speed - 2, // Initial upward boost
            color: color,
            size: 2 + Math.random() * 3,
            expireTime: Date.now() + 300 + Math.random() * 500, // Shorter lifetime for faster animation
            gravity: 0.2 + Math.random() * 0.1, // Variable gravity for more natural movement
            createdAt: Date.now()
        });
    }
}

// Get tile color for particles
function getTileColor(tileType) {
    switch (tileType) {
        case TILE_TYPES.DIRT: return "#8B4513";
        case TILE_TYPES.GRASS: return "#228B22";
        case TILE_TYPES.STONE: return "#808080";
        case TILE_TYPES.COAL: return "#2F4F4F";
        case TILE_TYPES.IRON: return "#CD853F";
        case TILE_TYPES.GOLD: return "#FFD700";
        case TILE_TYPES.DIAMOND: return "#00FFFF";
        case TILE_TYPES.SAND: return "#F4A460";
        case TILE_TYPES.WOOD: return "#8B4513";
        case TILE_TYPES.LEAVES: return "#006400";
        case TILE_TYPES.BUSH: return "#228B22";
        case TILE_TYPES.FLOWER: return "#FF69B4";
        case TILE_TYPES.TALL_GRASS: return "#32CD32";
        case TILE_TYPES.CACTUS: return "#2E8B57";
        case TILE_TYPES.SNOW: return "#FFFAFA";
        case TILE_TYPES.MUSHROOM: return "#FF4500";
        case TILE_TYPES.WATER: return "#1E90FF";
        default: return "#FFFFFF";
    }
}

// Draw player
function drawAnt() {
    // Calculate screen position
    const screenX = Math.round((gameState.player.x - gameState.camera.x) * gameState.zoom);
    const screenY = Math.round((gameState.player.y - gameState.camera.y) * gameState.zoom);
    
    // Use a consistent size based on player dimensions
    const antWidth = gameState.player.width * 0.9 * gameState.zoom;  // 90% of player width, scaled by zoom
    const antHeight = gameState.player.height * 0.9 * gameState.zoom; // 90% of player height, scaled by zoom
    
    // Center the ant in its hitbox
    const offsetX = (gameState.player.width * gameState.zoom - antWidth) / 2;
    const offsetY = (gameState.player.height * gameState.zoom - antHeight) / 2;
    
    // Calculate center position for the ant
    const centerX = screenX + gameState.player.width * gameState.zoom / 2;
    const centerY = screenY + gameState.player.height * gameState.zoom / 2;
    
    // Draw ant with three body segments - using a cuter color scheme
    gameState.ctx.fillStyle = "#FF6B6B"; // Cute pinkish-red for ant body
    
    // 1. Draw abdomen (rear segment) - rounder oval
    const abdomenWidth = antWidth * 0.5;
    const abdomenHeight = antHeight * 0.6;
    const abdomenX = centerX + (gameState.player.direction === 1 ? -abdomenWidth * 0.6 : abdomenWidth * 0.6);
    
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
    gameState.ctx.fillStyle = "#FF8C8C";
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
    const thoraxX = centerX + (gameState.player.direction === 1 ? thoraxWidth * 0.3 : -thoraxWidth * 0.3);
    
    gameState.ctx.fillStyle = "#FF6B6B";
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
    const headX = centerX + (gameState.player.direction === 1 ? 
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
    const eyeX1 = headX + (gameState.player.direction === 1 ? headSize * 0.15 : -headSize * 0.15);
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
    const eyeX2 = headX + (gameState.player.direction === 1 ? headSize * 0.3 : -headSize * 0.3);
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
        eyeX1 + (gameState.player.direction === 1 ? eyeSize * 0.2 : -eyeSize * 0.2),
        eyeY1,
        eyeSize / 5,
        0, Math.PI * 2
    );
    gameState.ctx.fill();
    
    // Right pupil
    gameState.ctx.beginPath();
    gameState.ctx.arc(
        eyeX2 + (gameState.player.direction === 1 ? eyeSize * 0.2 : -eyeSize * 0.2),
        eyeY2,
        eyeSize / 5,
        0, Math.PI * 2
    );
    gameState.ctx.fill();
    
    // Draw cute smile
    gameState.ctx.strokeStyle = "#000000";
    gameState.ctx.lineWidth = Math.max(1, antWidth * 0.02);
    
    gameState.ctx.beginPath();
    if (gameState.player.direction === 1) { // Facing right
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
    gameState.ctx.strokeStyle = "#FF6B6B";
    gameState.ctx.lineWidth = Math.max(1, antWidth * 0.03);
    
    // First antenna
    const antennaBaseX = headX + (gameState.player.direction === 1 ? headSize * 0.2 : -headSize * 0.2);
    const antennaBaseY = headY - headSize * 0.3;
    const antennaEndX = antennaBaseX + (gameState.player.direction === 1 ? headSize * 0.8 : -headSize * 0.8);
    const antennaEndY = antennaBaseY - headSize * 0.7;
    
    gameState.ctx.beginPath();
    gameState.ctx.moveTo(antennaBaseX, antennaBaseY);
    gameState.ctx.bezierCurveTo(
        antennaBaseX + (gameState.player.direction === 1 ? headSize * 0.4 : -headSize * 0.4),
        antennaBaseY - headSize * 0.5,
        antennaEndX - (gameState.player.direction === 1 ? headSize * 0.2 : -headSize * 0.2),
        antennaEndY - headSize * 0.2,
        antennaEndX,
        antennaEndY
    );
    gameState.ctx.stroke();
    
    // Add cute antenna tips (small circles)
    gameState.ctx.fillStyle = "#FF8C8C";
    gameState.ctx.beginPath();
    gameState.ctx.arc(
        antennaEndX,
        antennaEndY,
        Math.max(1, antWidth * 0.04),
        0, Math.PI * 2
    );
    gameState.ctx.fill();
    
    // Second antenna
    const antenna2BaseX = headX + (gameState.player.direction === 1 ? headSize * 0.4 : -headSize * 0.4);
    const antenna2BaseY = antennaBaseY;
    const antenna2EndX = antenna2BaseX + (gameState.player.direction === 1 ? headSize * 0.8 : -headSize * 0.8);
    const antenna2EndY = antennaEndY - headSize * 0.2;
    
    gameState.ctx.strokeStyle = "#FF6B6B";
    gameState.ctx.beginPath();
    gameState.ctx.moveTo(antenna2BaseX, antenna2BaseY);
    gameState.ctx.bezierCurveTo(
        antenna2BaseX + (gameState.player.direction === 1 ? headSize * 0.4 : -headSize * 0.4),
        antenna2BaseY - headSize * 0.5,
        antenna2EndX - (gameState.player.direction === 1 ? headSize * 0.2 : -headSize * 0.2),
        antenna2EndY - headSize * 0.2,
        antenna2EndX,
        antenna2EndY
    );
    gameState.ctx.stroke();
    
    // Add cute antenna tips (small circles)
    gameState.ctx.fillStyle = "#FF8C8C";
    gameState.ctx.beginPath();
    gameState.ctx.arc(
        antenna2EndX,
        antenna2EndY,
        Math.max(1, antWidth * 0.04),
        0, Math.PI * 2
    );
    gameState.ctx.fill();
    
    // Draw legs (cuter, more rounded)
    gameState.ctx.strokeStyle = "#FF6B6B";
    gameState.ctx.lineWidth = Math.max(1, antWidth * 0.04);
    
    // Draw 3 legs on each side of the thorax
    for (let i = 0; i < 3; i++) {
        const legOffsetY = thoraxHeight * (-0.3 + i * 0.3);
        const legLength = antWidth * 0.4;
        
        // Left leg
        gameState.ctx.beginPath();
        gameState.ctx.moveTo(
            thoraxX - thoraxWidth / 2,
            centerY + legOffsetY
        );
        
        // Middle joint of leg with curve
        const leftMidX = thoraxX - thoraxWidth / 2 - legLength * 0.4;
        const leftMidY = centerY + legOffsetY - legLength * 0.2;
        
        // End point of leg
        const leftEndX = leftMidX - legLength * 0.4;
        const leftEndY = leftMidY + legLength * 0.4;
        
        // Draw curved leg
        gameState.ctx.bezierCurveTo(
            thoraxX - thoraxWidth / 2 - legLength * 0.2,
            centerY + legOffsetY - legLength * 0.1,
            leftMidX + legLength * 0.1,
            leftMidY - legLength * 0.1,
            leftMidX,
            leftMidY
        );
        
        gameState.ctx.bezierCurveTo(
            leftMidX - legLength * 0.1,
            leftMidY + legLength * 0.1,
            leftEndX + legLength * 0.1,
            leftEndY - legLength * 0.1,
            leftEndX,
            leftEndY
        );
        
        gameState.ctx.stroke();
        
        // Right leg
        gameState.ctx.beginPath();
        gameState.ctx.moveTo(
            thoraxX + thoraxWidth / 2,
            centerY + legOffsetY
        );
        
        // Middle joint of leg
        const rightMidX = thoraxX + thoraxWidth / 2 + legLength * 0.4;
        const rightMidY = centerY + legOffsetY - legLength * 0.2;
        
        // End point of leg
        const rightEndX = rightMidX + legLength * 0.4;
        const rightEndY = rightMidY + legLength * 0.4;
        
        // Draw curved leg
        gameState.ctx.bezierCurveTo(
            thoraxX + thoraxWidth / 2 + legLength * 0.2,
            centerY + legOffsetY - legLength * 0.1,
            rightMidX - legLength * 0.1,
            rightMidY - legLength * 0.1,
            rightMidX,
            rightMidY
        );
        
        gameState.ctx.bezierCurveTo(
            rightMidX + legLength * 0.1,
            rightMidY + legLength * 0.1,
            rightEndX - legLength * 0.1,
            rightEndY - legLength * 0.1,
            rightEndX,
            rightEndY
        );
        
        gameState.ctx.stroke();
    }
    
    // Draw a thin "waist" connecting thorax and abdomen
    gameState.ctx.strokeStyle = "#FF6B6B";
    gameState.ctx.lineWidth = Math.max(1, antWidth * 0.03);
    gameState.ctx.beginPath();
    gameState.ctx.moveTo(
        thoraxX + (gameState.player.direction === 1 ? -thoraxWidth / 2 : thoraxWidth / 2),
        centerY
    );
    gameState.ctx.lineTo(
        abdomenX + (gameState.player.direction === 1 ? abdomenWidth / 2 : -abdomenWidth / 2),
        centerY
    );
    gameState.ctx.stroke();
}

// Draw UI
function drawUI() {
    // UI is now handled by DOM elements in ui.js
    // This function is kept for compatibility but doesn't need to draw anything
}

// Get biome at x coordinate
function getBiomeAt(x) {
    if (!gameState.biomeMap) return BIOME_TYPES.PLAINS;
    
    return gameState.biomeMap[x] ? gameState.biomeMap[x].biomeType : BIOME_TYPES.PLAINS;
}

// Render game (game.js version)
function renderGameInternal() {
    // Clear canvas
    gameState.ctx.clearRect(0, 0, gameState.canvas.width, gameState.canvas.height);
    
    // Draw world
    drawWorld();
    
    // Draw other players (for multiplayer)
    if (socket && socket.connected) {
        drawOtherPlayers();
    }
    
    // Draw player
    drawPlayer();
    
    // Draw particles
    drawParticles();
    
    // Draw UI
    drawUI();
}

// Draw ant directly in world coordinates (without additional zoom calculations)
function drawAntDirect() {
    // Use the player's actual world coordinates
    const playerX = gameState.player.x;
    const playerY = gameState.player.y;
    
    // Use a consistent size based on player dimensions
    const antWidth = gameState.player.width * 0.9;  // 90% of player width
    const antHeight = gameState.player.height * 0.9; // 90% of player height
    
    // Calculate center position for the ant
    const centerX = playerX + gameState.player.width / 2;
    const centerY = playerY + gameState.player.height / 2;
    
    // Draw ant with three body segments - using a cuter color scheme
    gameState.ctx.fillStyle = "#FF6B6B"; // Cute pinkish-red for ant body
    
    // 1. Draw abdomen (rear segment) - rounder oval
    const abdomenWidth = antWidth * 0.5;
    const abdomenHeight = antHeight * 0.6;
    const abdomenX = centerX + (gameState.player.direction === 1 ? -abdomenWidth * 0.6 : abdomenWidth * 0.6);
    
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
    gameState.ctx.fillStyle = "#FF8C8C";
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
    const thoraxX = centerX + (gameState.player.direction === 1 ? thoraxWidth * 0.3 : -thoraxWidth * 0.3);
    
    gameState.ctx.fillStyle = "#FF6B6B";
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
    const headX = centerX + (gameState.player.direction === 1 ? 
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
    const eyeX1 = headX + (gameState.player.direction === 1 ? headSize * 0.15 : -headSize * 0.15);
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
    const eyeX2 = headX + (gameState.player.direction === 1 ? headSize * 0.3 : -headSize * 0.3);
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
        eyeX1 + (gameState.player.direction === 1 ? eyeSize * 0.2 : -eyeSize * 0.2),
        eyeY1,
        eyeSize / 5,
        0, Math.PI * 2
    );
    gameState.ctx.fill();
    
    // Right pupil
    gameState.ctx.beginPath();
    gameState.ctx.arc(
        eyeX2 + (gameState.player.direction === 1 ? eyeSize * 0.2 : -eyeSize * 0.2),
        eyeY2,
        eyeSize / 5,
        0, Math.PI * 2
    );
    gameState.ctx.fill();
    
    // Draw cute smile
    gameState.ctx.strokeStyle = "#000000";
    gameState.ctx.lineWidth = Math.max(1, antWidth * 0.02);
    
    gameState.ctx.beginPath();
    if (gameState.player.direction === 1) { // Facing right
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
    gameState.ctx.strokeStyle = "#FF6B6B";
    gameState.ctx.lineWidth = Math.max(1, antWidth * 0.03);
    
    // First antenna
    const antennaBaseX = headX + (gameState.player.direction === 1 ? headSize * 0.2 : -headSize * 0.2);
    const antennaBaseY = headY - headSize * 0.3;
    const antennaEndX = antennaBaseX + (gameState.player.direction === 1 ? headSize * 0.8 : -headSize * 0.8);
    const antennaEndY = antennaBaseY - headSize * 0.7;
    
    gameState.ctx.beginPath();
    gameState.ctx.moveTo(antennaBaseX, antennaBaseY);
    gameState.ctx.bezierCurveTo(
        antennaBaseX + (gameState.player.direction === 1 ? headSize * 0.4 : -headSize * 0.4),
        antennaBaseY - headSize * 0.5,
        antennaEndX - (gameState.player.direction === 1 ? headSize * 0.2 : -headSize * 0.2),
        antennaEndY - headSize * 0.2,
        antennaEndX,
        antennaEndY
    );
    gameState.ctx.stroke();
    
    // Add cute antenna tips (small circles)
    gameState.ctx.fillStyle = "#FF8C8C";
    gameState.ctx.beginPath();
    gameState.ctx.arc(
        antennaEndX,
        antennaEndY,
        Math.max(1, antWidth * 0.04),
        0, Math.PI * 2
    );
    gameState.ctx.fill();
    
    // Second antenna
    const antenna2BaseX = headX + (gameState.player.direction === 1 ? headSize * 0.4 : -headSize * 0.4);
    const antenna2BaseY = antennaBaseY;
    const antenna2EndX = antenna2BaseX + (gameState.player.direction === 1 ? headSize * 0.8 : -headSize * 0.8);
    const antenna2EndY = antennaEndY - headSize * 0.2;
    
    gameState.ctx.strokeStyle = "#FF6B6B";
    gameState.ctx.beginPath();
    gameState.ctx.moveTo(antenna2BaseX, antenna2BaseY);
    gameState.ctx.bezierCurveTo(
        antenna2BaseX + (gameState.player.direction === 1 ? headSize * 0.4 : -headSize * 0.4),
        antenna2BaseY - headSize * 0.5,
        antenna2EndX - (gameState.player.direction === 1 ? headSize * 0.2 : -headSize * 0.2),
        antenna2EndY - headSize * 0.2,
        antenna2EndX,
        antenna2EndY
    );
    gameState.ctx.stroke();
    
    // Add cute antenna tips (small circles)
    gameState.ctx.fillStyle = "#FF8C8C";
    gameState.ctx.beginPath();
    gameState.ctx.arc(
        antenna2EndX,
        antenna2EndY,
        Math.max(1, antWidth * 0.04),
        0, Math.PI * 2
    );
    gameState.ctx.fill();
    
    // Draw legs (cuter, more rounded)
    gameState.ctx.strokeStyle = "#FF6B6B";
    gameState.ctx.lineWidth = Math.max(1, antWidth * 0.04);
    
    // Draw 3 legs on each side of the thorax
    for (let i = 0; i < 3; i++) {
        const legOffsetY = thoraxHeight * (-0.3 + i * 0.3);
        const legLength = antWidth * 0.4;
        
        // Left leg
        gameState.ctx.beginPath();
        gameState.ctx.moveTo(
            thoraxX - thoraxWidth / 2,
            centerY + legOffsetY
        );
        
        // Middle joint of leg with curve
        const leftMidX = thoraxX - thoraxWidth / 2 - legLength * 0.4;
        const leftMidY = centerY + legOffsetY - legLength * 0.2;
        
        // End point of leg
        const leftEndX = leftMidX - legLength * 0.4;
        const leftEndY = leftMidY + legLength * 0.4;
        
        // Draw curved leg
        gameState.ctx.bezierCurveTo(
            thoraxX - thoraxWidth / 2 - legLength * 0.2,
            centerY + legOffsetY - legLength * 0.1,
            leftMidX + legLength * 0.1,
            leftMidY - legLength * 0.1,
            leftMidX,
            leftMidY
        );
        
        gameState.ctx.bezierCurveTo(
            leftMidX - legLength * 0.1,
            leftMidY + legLength * 0.1,
            leftEndX + legLength * 0.1,
            leftEndY - legLength * 0.1,
            leftEndX,
            leftEndY
        );
        
        gameState.ctx.stroke();
        
        // Right leg
        gameState.ctx.beginPath();
        gameState.ctx.moveTo(
            thoraxX + thoraxWidth / 2,
            centerY + legOffsetY
        );
        
        // Middle joint of leg
        const rightMidX = thoraxX + thoraxWidth / 2 + legLength * 0.4;
        const rightMidY = centerY + legOffsetY - legLength * 0.2;
        
        // End point of leg
        const rightEndX = rightMidX + legLength * 0.4;
        const rightEndY = rightMidY + legLength * 0.4;
        
        // Draw curved leg
        gameState.ctx.bezierCurveTo(
            thoraxX + thoraxWidth / 2 + legLength * 0.2,
            centerY + legOffsetY - legLength * 0.1,
            rightMidX - legLength * 0.1,
            rightMidY - legLength * 0.1,
            rightMidX,
            rightMidY
        );
        
        gameState.ctx.bezierCurveTo(
            rightMidX + legLength * 0.1,
            rightMidY + legLength * 0.1,
            rightEndX - legLength * 0.1,
            rightEndY - legLength * 0.1,
            rightEndX,
            rightEndY
        );
        
        gameState.ctx.stroke();
    }
    
    // Draw a thin "waist" connecting thorax and abdomen
    gameState.ctx.strokeStyle = "#FF6B6B";
    gameState.ctx.lineWidth = Math.max(1, antWidth * 0.03);
    gameState.ctx.beginPath();
    gameState.ctx.moveTo(
        thoraxX + (gameState.player.direction === 1 ? -thoraxWidth / 2 : thoraxWidth / 2),
        centerY
    );
    gameState.ctx.lineTo(
        abdomenX + (gameState.player.direction === 1 ? abdomenWidth / 2 : -abdomenWidth / 2),
        centerY
    );
    gameState.ctx.stroke();
}

// Draw particles directly in world coordinates
function drawParticlesDirect() {
    if (!gameState.particles || gameState.isZooming) return;
    
    for (const particle of gameState.particles) {
        gameState.ctx.fillStyle = particle.color;
        gameState.ctx.fillRect(
            particle.x,
            particle.y,
            particle.size,
            particle.size
        );
    }
}

// Update particles
function updateParticles(deltaTime) {
    if (!gameState.particles || gameState.isZooming) return;
    
    const currentTime = Date.now();
    const dt = deltaTime / 16.67; // Normalize to 60fps for consistent physics
    
    // Update each particle
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
        const particle = gameState.particles[i];
        
        // Remove expired particles
        if (currentTime > particle.expireTime) {
            gameState.particles.splice(i, 1);
            continue;
        }
        
        // Update position with delta time for smooth movement
        particle.x += particle.velocityX * dt;
        particle.y += particle.velocityY * dt;
        
        // Apply gravity (use particle's own gravity value if available)
        const gravity = particle.gravity || 0.1;
        particle.velocityY += gravity * dt;
        
        // Add drag to slow particles over time
        particle.velocityX *= 0.98;
        particle.velocityY *= 0.98;
    }
    
    // Safety check: if particles have been around for more than 10 seconds, remove them
    // This prevents any potential infinite loops
    if (gameState.particles.length > 0) {
        const oldestAllowedTime = currentTime - 10000; // 10 seconds ago
        gameState.particles = gameState.particles.filter(p => 
            (p.createdAt && p.createdAt > oldestAllowedTime) || 
            (p.expireTime > oldestAllowedTime)
        );
    }
}

// Draw particles
function drawParticles() {
    if (!gameState.particles || gameState.isZooming) return;
    
    const currentTime = Date.now();
    
    for (const particle of gameState.particles) {
        // Calculate opacity based on remaining lifetime
        const lifePercent = 1 - ((particle.expireTime - currentTime) / 
                               (particle.expireTime - (particle.createdAt || (particle.expireTime - 500))));
        const opacity = 1 - lifePercent; // Fade out as particles age
        
        // Set fill style with opacity
        gameState.ctx.globalAlpha = Math.max(0.1, opacity);
        gameState.ctx.fillStyle = particle.color;
        
        // Draw rounded particles instead of squares
        const x = Math.round((particle.x - gameState.camera.x) * gameState.zoom);
        const y = Math.round((particle.y - gameState.camera.y) * gameState.zoom);
        const size = particle.size * gameState.zoom;
        
        // Use circles for larger particles, squares for tiny ones (performance)
        if (size > 3) {
            gameState.ctx.beginPath();
            gameState.ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
            gameState.ctx.fill();
        } else {
            gameState.ctx.fillRect(x, y, size, size);
        }
    }
    
    // Reset global alpha
    gameState.ctx.globalAlpha = 1;
}

// Check and request chunks if needed
function checkAndRequestChunks() {
    // Skip if no requestChunk function available
    if (typeof window.requestChunk !== 'function') return;
    
    // Calculate player chunk
    const playerChunkX = Math.floor(gameState.player.x / TILE_SIZE / CHUNK_SIZE);
    const playerChunkY = Math.floor(gameState.player.y / TILE_SIZE / CHUNK_SIZE);
    
    // Request chunks in a radius around the player
    for (let y = playerChunkY - VISIBLE_CHUNKS_RADIUS; y <= playerChunkY + VISIBLE_CHUNKS_RADIUS; y++) {
        for (let x = playerChunkX - VISIBLE_CHUNKS_RADIUS; x <= playerChunkX + VISIBLE_CHUNKS_RADIUS; x++) {
            // Skip if out of world bounds
            if (x < 0 || y < 0 || x >= Math.ceil(WORLD_WIDTH / CHUNK_SIZE) || y >= Math.ceil(WORLD_HEIGHT / CHUNK_SIZE)) {
                continue;
            }
            
            // Request chunk
            window.requestChunk(x, y);
        }
    }
}

// Get a tile at specific world coordinates
function getTile(x, y) {
    // Check if out of bounds
    if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) {
        return TILE_TYPES.BEDROCK; // Out of bounds is bedrock
    }
    
    // Calculate chunk coordinates
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkY = Math.floor(y / CHUNK_SIZE);
    const chunkKey = `${chunkX},${chunkY}`;
    
    // Calculate local coordinates within chunk
    const localX = x % CHUNK_SIZE;
    const localY = y % CHUNK_SIZE;
    
    // Check if chunk exists
    if (!gameState.chunks[chunkKey]) {
        // Request chunk if multiplayer is enabled
        if (typeof window.requestChunk === 'function') {
            window.requestChunk(chunkX, chunkY);
        }
        
        // Return air for now
        return TILE_TYPES.AIR;
    }
    
    // Return tile from chunk
    return gameState.chunks[chunkKey][localY][localX];
}

// Set a tile at specific world coordinates
function setTile(x, y, tileType, sendToServer = true) {
    // Check if out of bounds
    if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) {
        return; // Out of bounds
    }
    
    // Calculate chunk coordinates
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkY = Math.floor(y / CHUNK_SIZE);
    const chunkKey = `${chunkX},${chunkY}`;
    
    // Calculate local coordinates within chunk
    const localX = x % CHUNK_SIZE;
    const localY = y % CHUNK_SIZE;
    
    // Check if chunk exists
    if (!gameState.chunks[chunkKey]) {
        // Request chunk if multiplayer is enabled
        if (typeof _requestChunk === 'function') {
            _requestChunk(chunkX, chunkY);
        }
        
        return; // Can't set tile in non-existent chunk
    }
    
    // Set tile in chunk
    gameState.chunks[chunkKey][localY][localX] = tileType;
    
    // Send to server if requested and multiplayer is enabled
    if (sendToServer && typeof _sendBlockDig === 'function') {
        _sendBlockDig(x, y, tileType);
    }
    
    // Mark as having unsaved changes
    gameState.hasUnsavedChanges = true;
}

// Expose game functions to window object for use in other modules
window.handlePlayerMovement = handlePlayerMovement;
window.handleDigging = handleDigging;
window.updateCamera = updateCamera;
window.drawWorld = drawWorld;
window.drawPlayer = drawPlayer;
window.drawUI = drawUI;
window.updateParticles = updateParticles;
window.drawParticles = drawParticles;
window.getTile = getTile;
window.setTile = setTile;
window.checkAndRequestChunks = checkAndRequestChunks;
window.renderGameInternal = renderGameInternal;
window.createParticles = createParticles;
window.isDiggable = isDiggable;
window.isSolid = isSolid;
window.isCollectible = isCollectible;

// Log that the functions have been exported
console.log("Game functions exported to window object");
console.log("handleDigging function available:", typeof window.handleDigging === 'function'); 