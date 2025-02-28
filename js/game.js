// Helper function to get a chunk by coordinates
function getChunk(chunkX, chunkY) {
    const chunkKey = `${chunkX},${chunkY}`;
    return gameState.chunks[chunkKey] || null;
}

// Main game loop
function gameLoop(timestamp) {
    // Calculate delta time
    const deltaTime = timestamp - (gameState.lastFrameTime || timestamp);
    gameState.lastFrameTime = timestamp;
    
    // Clear canvas
    gameState.ctx.clearRect(0, 0, gameState.canvas.width, gameState.canvas.height);
    
    // Handle input
    handleInput();
    
    // Update player and enemies
    updatePlayerPosition();
    updateEnemies();
    
    // Update camera position with smooth following (adjusted for zoom)
    // Calculate the center position where the player should be on screen
    const centerX = gameState.canvas.width / 2;
    const centerY = gameState.canvas.height / 2;
    
    // Calculate the target camera position to center the player
    gameState.camera.targetX = gameState.player.x + (gameState.player.width / 2) - (centerX / gameState.zoom);
    gameState.camera.targetY = gameState.player.y + (gameState.player.height / 2) - (centerY / gameState.zoom);
    
    // Apply camera lerp for smooth movement
    gameState.camera.x += (gameState.camera.targetX - gameState.camera.x) * CAMERA_LERP;
    gameState.camera.y += (gameState.camera.targetY - gameState.camera.y) * CAMERA_LERP;
    
    // Draw world (now includes player and enemies)
    drawWorld();
    
    // Update UI
    updateUI();
    
    // Check for auto-save
    checkAutoSave();
    
    // Request next frame
    requestAnimationFrame(gameLoop);
}

// Update UI elements
function updateUI() {
    document.getElementById('health').textContent = `Health: ${gameState.player.health}`;
    updateScoreDisplay();
    updateInventoryDisplay();
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
    initializeGame();
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
}

// Check for collision at the specified position
function checkCollision(x, y) {
    // Calculate player bounds
    const playerLeft = x;
    const playerRight = x + gameState.player.width;
    const playerTop = y;
    const playerBottom = y + gameState.player.height;
    
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
    // Check if mouse is pressed
    if (gameState.mouse.leftPressed) {
        // Calculate world coordinates of mouse
        const worldX = gameState.mouse.x / gameState.zoom + gameState.camera.x;
        const worldY = gameState.mouse.y / gameState.zoom + gameState.camera.y;
        
        // Calculate tile coordinates
        const tileX = Math.floor(worldX / TILE_SIZE);
        const tileY = Math.floor(worldY / TILE_SIZE);
        
        // Calculate distance to player center
        const playerCenterX = gameState.player.x + gameState.player.width / 2;
        const playerCenterY = gameState.player.y + gameState.player.height / 2;
        const tileCenterX = tileX * TILE_SIZE + TILE_SIZE / 2;
        const tileCenterY = tileY * TILE_SIZE + TILE_SIZE / 2;
        
        const distanceX = tileCenterX - playerCenterX;
        const distanceY = tileCenterY - playerCenterY;
        const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
        
        // Check if tile is within digging range
        if (distance <= gameState.player.digRange) {
            // Get chunk coordinates
            const chunkX = Math.floor(tileX / CHUNK_SIZE);
            const chunkY = Math.floor(tileY / CHUNK_SIZE);
            
            // Get local coordinates within chunk
            const localX = ((tileX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            const localY = ((tileY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            
            // Get chunk
            const chunk = getChunk(chunkX, chunkY);
            
            // Check if tile can be dug
            if (chunk && isDiggable(chunk[localY][localX])) {
                // Check if tile is collectible
                if (isCollectible(chunk[localY][localX])) {
                    // Add to inventory
                    const tileType = chunk[localY][localX];
                    gameState.inventory[tileType] = (gameState.inventory[tileType] || 0) + 1;
                    
                    // Add to score
                    gameState.score += getScoreValue(tileType);
                    
                    // Play sound
                    if (gameState.sounds && gameState.sounds.collect) {
                        gameState.sounds.collect.currentTime = 0;
                        gameState.sounds.collect.play().catch(e => console.error("Error playing sound:", e));
                    }
                    
                    // Create particles
                    createParticles(
                        tileX * TILE_SIZE + TILE_SIZE / 2,
                        tileY * TILE_SIZE + TILE_SIZE / 2,
                        getTileColor(chunk[localY][localX]),
                        10
                    );
                } else {
                    // Play sound
                    if (gameState.sounds && gameState.sounds.dig) {
                        gameState.sounds.dig.currentTime = 0;
                        gameState.sounds.dig.play().catch(e => console.error("Error playing sound:", e));
                    }
                    
                    // Create particles
                    createParticles(
                        tileX * TILE_SIZE + TILE_SIZE / 2,
                        tileY * TILE_SIZE + TILE_SIZE / 2,
                        getTileColor(chunk[localY][localX]),
                        5
                    );
                }
                
                // Remove tile
                chunk[localY][localX] = TILE_TYPES.AIR;
                
                // Mark game as having unsaved changes
                gameState.hasUnsavedChanges = true;
            }
        }
    }
}

// Create particles
function createParticles(x, y, color, count) {
    if (!gameState.particles) {
        gameState.particles = [];
    }
    
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 2;
        
        gameState.particles.push({
            x: x,
            y: y,
            velocityX: Math.cos(angle) * speed,
            velocityY: Math.sin(angle) * speed,
            color: color,
            size: 2 + Math.random() * 3,
            expireTime: Date.now() + 500 + Math.random() * 1000
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
function drawPlayer() {
    // Calculate screen position
    const screenX = Math.round(gameState.player.x - gameState.camera.x);
    const screenY = Math.round(gameState.player.y - gameState.camera.y);
    
    // Draw player body
    gameState.ctx.fillStyle = "#FF0000";
    
    // Draw player as a rectangle
    gameState.ctx.fillRect(
        screenX,
        screenY,
        gameState.player.width,
        gameState.player.height
    );
    
    // Draw player direction indicator (eyes)
    const eyeSize = 4;
    const eyeY = screenY + gameState.player.height / 3;
    
    // Draw eyes based on direction
    if (gameState.player.direction === 1) { // Facing right
        // Right eye
        gameState.ctx.fillStyle = "#FFFFFF";
        gameState.ctx.fillRect(
            screenX + gameState.player.width - eyeSize * 2,
            eyeY,
            eyeSize,
            eyeSize
        );
    } else { // Facing left
        // Left eye
        gameState.ctx.fillStyle = "#FFFFFF";
        gameState.ctx.fillRect(
            screenX + eyeSize,
            eyeY,
            eyeSize,
            eyeSize
        );
    }
    
    // Draw antenna
    gameState.ctx.strokeStyle = "#FF0000";
    gameState.ctx.lineWidth = 2;
    gameState.ctx.beginPath();
    gameState.ctx.moveTo(
        screenX + gameState.player.width / 2,
        screenY
    );
    gameState.ctx.lineTo(
        screenX + gameState.player.width / 2,
        screenY - 10
    );
    gameState.ctx.stroke();
}

// Draw UI
function drawUI() {
    // Draw health bar
    gameState.ctx.fillStyle = "#333333";
    gameState.ctx.fillRect(10, 10, 200, 20);
    
    gameState.ctx.fillStyle = "#FF0000";
    const healthWidth = (gameState.player.health / gameState.player.maxHealth) * 196;
    gameState.ctx.fillRect(12, 12, healthWidth, 16);
    
    gameState.ctx.fillStyle = "#FFFFFF";
    gameState.ctx.font = "12px Arial";
    gameState.ctx.fillText(`Health: ${gameState.player.health}/${gameState.player.maxHealth}`, 15, 25);
    
    // Draw score
    gameState.ctx.fillStyle = "#FFFFFF";
    gameState.ctx.font = "16px Arial";
    gameState.ctx.fillText(`Score: ${gameState.score}`, 10, 50);
    
    // Draw inventory
    let inventoryY = 70;
    gameState.ctx.fillStyle = "#FFFFFF";
    gameState.ctx.font = "14px Arial";
    gameState.ctx.fillText("Inventory:", 10, inventoryY);
    
    inventoryY += 20;
    let hasItems = false;
    
    for (const tileType in gameState.inventory) {
        if (gameState.inventory[tileType] > 0) {
            hasItems = true;
            
            // Draw item background
            gameState.ctx.fillStyle = "#333333";
            gameState.ctx.fillRect(10, inventoryY, 40, 40);
            
            // Draw item
            gameState.ctx.fillStyle = getTileColor(parseInt(tileType));
            gameState.ctx.fillRect(15, inventoryY + 5, 30, 30);
            
            // Draw item count
            gameState.ctx.fillStyle = "#FFFFFF";
            gameState.ctx.font = "12px Arial";
            gameState.ctx.fillText(gameState.inventory[tileType], 40, inventoryY + 35);
            
            // Draw item name
            gameState.ctx.fillText(getTileName(parseInt(tileType)), 60, inventoryY + 25);
            
            inventoryY += 50;
        }
    }
    
    if (!hasItems) {
        gameState.ctx.fillStyle = "#FFFFFF";
        gameState.ctx.font = "12px Arial";
        gameState.ctx.fillText("Empty", 15, inventoryY + 15);
    }
    
    // Draw current biome
    if (gameState.biomeMap) {
        const playerBiomeX = Math.floor(gameState.player.x / TILE_SIZE);
        const biomeType = getBiomeAt(playerBiomeX);
        
        let biomeName = "Unknown";
        switch (biomeType) {
            case BIOME_TYPES.PLAINS: biomeName = "Plains"; break;
            case BIOME_TYPES.FOREST: biomeName = "Forest"; break;
            case BIOME_TYPES.DESERT: biomeName = "Desert"; break;
            case BIOME_TYPES.MOUNTAINS: biomeName = "Mountains"; break;
        }
        
        // Create or update biome indicator
        let biomeIndicator = document.querySelector('.biome-indicator');
        if (!biomeIndicator) {
            biomeIndicator = document.createElement('div');
            biomeIndicator.className = 'biome-indicator';
            document.body.appendChild(biomeIndicator);
        }
        
        biomeIndicator.textContent = `Biome: ${biomeName}`;
    }
    
    // Draw debug info if enabled
    if (gameState.debug) {
        const playerX = Math.floor(gameState.player.x / TILE_SIZE);
        const playerY = Math.floor(gameState.player.y / TILE_SIZE);
        
        let debugInfo = document.querySelector('.debug-info');
        if (!debugInfo) {
            debugInfo = document.createElement('div');
            debugInfo.className = 'debug-info';
            document.body.appendChild(debugInfo);
        }
        
        debugInfo.innerHTML = `
            Position: (${playerX}, ${playerY})<br>
            FPS: ${Math.round(gameState.fps || 0)}<br>
            Chunks: ${Object.keys(gameState.chunks).length}
        `;
    }
}

// Get biome at x coordinate
function getBiomeAt(x) {
    if (!gameState.biomeMap) return BIOME_TYPES.PLAINS;
    
    return gameState.biomeMap[x] ? gameState.biomeMap[x].biomeType : BIOME_TYPES.PLAINS;
} 