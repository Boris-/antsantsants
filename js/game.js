// Game logic module

// Reference to multiplayer functions - using different variable names to avoid conflicts
let _requestChunk = () => {}; // Default empty function
let _sendBlockDig = () => {}; // Default empty function

// Throttling mechanism for server updates
const pendingBlockDigs = new Map(); // Store pending updates
let blockDigUpdateTimer = null;
const BLOCK_DIG_THROTTLE_MS = 50; // Reduced from 100ms to 50ms for snappier response

// Throttled version of sendBlockDig
function throttledSendBlockDig(x, y, tileType) {
    // Store this update in the pending map, overwriting any previous update for the same coordinates
    pendingBlockDigs.set(`${x},${y}`, { x, y, tileType });
    
    // If no timer is running, start one
    if (!blockDigUpdateTimer) {
        blockDigUpdateTimer = setTimeout(() => {
            // Send all pending updates
            const updates = Array.from(pendingBlockDigs.values());
            
            // Process in batches if there are many updates
            const BATCH_SIZE = 15; // Increased batch size
            for (let i = 0; i < updates.length; i += BATCH_SIZE) {
                const batch = updates.slice(i, i + BATCH_SIZE);
                
                // Small delay between batches to avoid network congestion
                setTimeout(() => {
                    batch.forEach(update => {
                        _sendBlockDig(update.x, update.y, update.tileType);
                    });
                }, Math.floor(i / BATCH_SIZE) * 10); // Reduced inter-batch delay from 20ms to 10ms
            }
            
            // Clear the pending updates and timer
            pendingBlockDigs.clear();
            blockDigUpdateTimer = null;
        }, BLOCK_DIG_THROTTLE_MS);
    }
}

// Track recently dug blocks to prevent duplicate particle creation
const recentlyDugBlocks = new Map();

// Cleanup function for recentlyDugBlocks map
function cleanupRecentlyDugBlocks() {
    const now = Date.now();
    const expirationTime = 2000; // Reduced from 5 seconds to 2 seconds for better cleanup
    
    // Skip if the map is empty
    if (recentlyDugBlocks.size === 0) return;
    
    // Only perform cleanup if the map has grown beyond a certain size
    // to avoid unnecessary processing
    if (recentlyDugBlocks.size > 75) { // Reduced threshold from 100 to 75
        const keysToDelete = [];
        
        // Use for...of loop which is faster than Array.from().filter().map()
        for (const [key, timestamp] of recentlyDugBlocks.entries()) {
            if (now - timestamp > expirationTime) {
                keysToDelete.push(key);
            }
        }
        
        // Batch delete operations
        if (keysToDelete.length > 0) {
            for (const key of keysToDelete) {
                recentlyDugBlocks.delete(key);
            }
        }
    }
}

// Run cleanup more frequently with a dynamic interval
const CLEANUP_INTERVAL_MIN = 2000;  // Reduced from 5 seconds to 2 seconds
const CLEANUP_INTERVAL_MAX = 15000; // Reduced from 30 seconds to 15 seconds

// Adjust cleanup interval based on activity
function adjustCleanupInterval() {
    // If we have many recently dug blocks, run cleanup more frequently
    const intervalMs = recentlyDugBlocks.size > 40  // Threshold reduced from 50 to 40
        ? CLEANUP_INTERVAL_MIN 
        : Math.min(CLEANUP_INTERVAL_MAX, CLEANUP_INTERVAL_MIN * (1 + Math.floor(recentlyDugBlocks.size / 15)));
    
    return intervalMs;
}

// Initial cleanup interval
let cleanupInterval = setInterval(cleanupRecentlyDugBlocks, adjustCleanupInterval());

// Periodically adjust the cleanup interval
setInterval(() => {
    clearInterval(cleanupInterval);
    cleanupInterval = setInterval(cleanupRecentlyDugBlocks, adjustCleanupInterval());
}, 60000); // Reassess every minute

// Set up references to multiplayer functions
function setupMultiplayerReferences() {
    console.log("Setting up multiplayer references...");
    
    // Use object destructuring for cleaner code
    const { requestChunk, sendBlockDig } = window;
    
    if (typeof requestChunk === 'function') {
        console.log("Found requestChunk function");
        _requestChunk = requestChunk;
    } else {
        console.warn("requestChunk function not found");
    }
    
    if (typeof sendBlockDig === 'function') {
        console.log("Found sendBlockDig function");
        _sendBlockDig = sendBlockDig;
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
    
    // Calculate FPS using exponential moving average
    if (deltaTime > 0) {
        const fps = 1000 / deltaTime;
        const SMOOTHING = 0.8;
        gameState.fps = gameState.fps ? gameState.fps * SMOOTHING + fps * (1 - SMOOTHING) : fps;
    }
    
    // Update game state
    updateGame(deltaTime);
    
    // Render game
    renderGameInternal();
    
    // Request next frame
    requestAnimationFrame(gameLoop);
}

// Constants for player properties
const PLAYER_CONSTANTS = {
    WIDTH_RATIO: 0.6,  // 60% of tile size
    HEIGHT_RATIO: 0.5, // 50% of tile size
    DIG_RANGE: 3,      // tiles
    SPEED: 3,          // pixels per frame (increased for more agile movement)
    GRAVITY: 0.3,      // gravity acceleration (reduced for lighter feel)
    JUMP_FORCE: -8,    // initial jump velocity (reduced magnitude for more controlled jumps)
    MAX_FALL_SPEED: 8, // maximum falling speed (reduced for lighter feel)
    GROUND_FRICTION: 0.85, // friction when on ground (slightly increased for better control)
    WALL_SLIDE_SPEED: 2,   // Speed at which ant slides down walls
    WALL_STICK_FORCE: 0.5,  // How strongly ant sticks to walls when climbing
    PARACHUTE_DEPLOY_SPEED: 5, // Speed at which parachute deploys
    PARACHUTE_FALL_SPEED: 2,   // Fall speed with parachute
    PARACHUTE_DRIFT: 0.5,       // Horizontal drift with parachute
    JUMP_DELAY: 500,    // Delay in milliseconds before allowing another jump
    MIN_FALL_DISTANCE_FOR_PARACHUTE: 3 * 32  // 3 blocks (each block is 32 pixels)
};

// Update game state
function updateGame(deltaTime) {
    // Update player
    handlePlayerMovement();
    
    // Update camera
    updateCamera();
    
    // Update UI
    updateUI();
    
    // Save periodically
    checkAutoSave();
    
    // Update particles
    updateParticles(deltaTime);
    
    // Handle digging
    handleDigging();
    
    // Check and request chunks
    checkAndRequestChunks();
}

// Update camera
function updateCamera() {
    const { width, height } = gameState.canvas;
    const { zoom } = gameState;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Calculate target position
    const targetX = gameState.player.x + (gameState.player.width / 2) - (centerX / zoom);
    const targetY = gameState.player.y + (gameState.player.height / 2) - (centerY / zoom);
    
    // Use different smoothing values for horizontal and vertical movement
    const HORIZONTAL_SMOOTHING = 0.1;  // Responsive horizontal movement
    const VERTICAL_SMOOTHING = 0.03;   // Much smoother vertical movement
    
    // Apply smoothing separately for X and Y
    gameState.camera.x += (targetX - gameState.camera.x) * HORIZONTAL_SMOOTHING;
    gameState.camera.y += (targetY - gameState.camera.y) * VERTICAL_SMOOTHING;
}

// Update UI elements
function updateUI() {
    if (!window.gameState) {
        console.error("Game state not initialized in updateUI!");
        return;
    }
    
    // Use array of UI update functions for cleaner code
    const uiUpdaters = [
        'updateHealthDisplay',
        'updateScoreDisplay',
        'updateInventoryDisplay',
        'updateBiomeDisplay',
        'updateDebugInfo'
    ];
    
    uiUpdaters.forEach(updater => {
        if (typeof window[updater] === 'function') {
            window[updater]();
        }
    });
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

// Tile type checks using Set for better performance
const SOLID_TILES = new Set([
    TILE_TYPES.DIRT,
    TILE_TYPES.STONE,
    TILE_TYPES.BEDROCK,
    TILE_TYPES.COAL,
    TILE_TYPES.IRON,
    TILE_TYPES.GOLD,
    TILE_TYPES.DIAMOND
]);

const COLLECTIBLE_TILES = new Set([
    TILE_TYPES.DIRT,
    TILE_TYPES.STONE,
    TILE_TYPES.COAL,
    TILE_TYPES.IRON,
    TILE_TYPES.GOLD,
    TILE_TYPES.DIAMOND,
    TILE_TYPES.WOOD,
    TILE_TYPES.LEAVES,
    TILE_TYPES.FLOWER,
    TILE_TYPES.MUSHROOM
]);

// Check if a tile is solid (cannot be passed through)
function isSolid(tileType) {
    return SOLID_TILES.has(tileType);
}

// Check if a tile can be dug
function isDiggable(tileType) {
    return tileType !== TILE_TYPES.AIR && tileType !== TILE_TYPES.BEDROCK;
}

// Check if a tile is collectible
function isCollectible(tileType) {
    return COLLECTIBLE_TILES.has(tileType);
}

// Score values mapping
const SCORE_VALUES = {
    [TILE_TYPES.COAL]: 1,
    [TILE_TYPES.IRON]: 3,
    [TILE_TYPES.GOLD]: 5,
    [TILE_TYPES.DIAMOND]: 10,
    [TILE_TYPES.WOOD]: 1,
    [TILE_TYPES.LEAVES]: 1,
    [TILE_TYPES.FLOWER]: 2,
    [TILE_TYPES.MUSHROOM]: 3
};

// Get score value for a tile type
function getScoreValue(tileType) {
    return SCORE_VALUES[tileType] || 0;
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
        case TILE_TYPES.CLOUD: return "Cloud";
        default: return "Unknown";
    }
}

// Handle player movement
function handlePlayerMovement() {
    // Get player constants
    const { SPEED, GRAVITY, JUMP_FORCE, MAX_FALL_SPEED, GROUND_FRICTION, WALL_SLIDE_SPEED, WALL_STICK_FORCE, 
            PARACHUTE_DEPLOY_SPEED, PARACHUTE_FALL_SPEED, PARACHUTE_DRIFT, JUMP_DELAY, MIN_FALL_DISTANCE_FOR_PARACHUTE } = PLAYER_CONSTANTS;

    // Initialize states if they don't exist
    if (typeof gameState.player.velocityX === 'undefined') {
        gameState.player.velocityX = 0;
    }
    if (typeof gameState.player.velocityY === 'undefined') {
        gameState.player.velocityY = 0;
    }
    if (typeof gameState.player.isGrounded === 'undefined') {
        gameState.player.isGrounded = false;
    }
    if (typeof gameState.player.isWallSticking === 'undefined') {
        gameState.player.isWallSticking = false;
    }
    if (typeof gameState.player.hasParachute === 'undefined') {
        gameState.player.hasParachute = false;
    }
    if (typeof gameState.player.lastJumpTime === 'undefined') {
        gameState.player.lastJumpTime = 0;
    }
    if (typeof gameState.player.fallStartY === 'undefined') {
        gameState.player.fallStartY = gameState.player.y;
    }

    // Get movement input
    let moveX = 0;
    let moveY = 0;
    
    if (gameState.keys.ArrowLeft || gameState.keys.a || gameState.keys.A) {
        moveX = -1;
        gameState.player.direction = -1; // Face left
    }
    if (gameState.keys.ArrowRight || gameState.keys.d || gameState.keys.D) {
        moveX = 1;
        gameState.player.direction = 1; // Face right
    }
    if (gameState.keys.ArrowUp || gameState.keys.w || gameState.keys.W) {
        moveY = -1;
    }
    if (gameState.keys.ArrowDown || gameState.keys.s || gameState.keys.S) {
        moveY = 1;
    }

    // Check for wall contact
    const touchingLeftWall = checkCollision(gameState.player.x - 1, gameState.player.y);
    const touchingRightWall = checkCollision(gameState.player.x + 1, gameState.player.y);
    gameState.player.isWallSticking = (touchingLeftWall || touchingRightWall) && !gameState.player.isGrounded;

    // Handle parachute deployment
    if (!gameState.player.isGrounded && !gameState.player.isWallSticking) {
        // Update fall start position when starting to fall
        if (gameState.player.velocityY <= 0) {
            gameState.player.fallStartY = gameState.player.y;
        }
        
        // Check if we've fallen far enough and are falling fast enough
        const fallDistance = gameState.player.y - gameState.player.fallStartY;
        if (fallDistance > MIN_FALL_DISTANCE_FOR_PARACHUTE && gameState.player.velocityY > PARACHUTE_DEPLOY_SPEED) {
            gameState.player.hasParachute = true;
        }
    } else {
        gameState.player.hasParachute = false;
        gameState.player.fallStartY = gameState.player.y;
    }

    // Apply movement physics
    if (gameState.player.hasParachute) {
        // Slow fall with parachute
        gameState.player.velocityY = Math.min(gameState.player.velocityY, PARACHUTE_FALL_SPEED);
        
        // Allow slight horizontal movement with parachute
        if (moveX !== 0) {
            gameState.player.velocityX += moveX * PARACHUTE_DRIFT;
            gameState.player.velocityX = Math.max(-SPEED * 0.5, Math.min(SPEED * 0.5, gameState.player.velocityX));
        }
    } else if (gameState.player.isWallSticking) {
        // Allow vertical movement along the wall
        if (moveY !== 0) {
            gameState.player.velocityY = moveY * SPEED * 0.7;
        } else {
            // Slow wall slide
            gameState.player.velocityY = Math.min(WALL_SLIDE_SPEED, gameState.player.velocityY);
        }

        // Wall jump
        if (gameState.keys.Space) {
            // Jump away from wall
            gameState.player.velocityY = JUMP_FORCE;
            gameState.player.velocityX = (touchingLeftWall ? 1 : -1) * SPEED * 1.5;
            gameState.player.isWallSticking = false;
        }

        // Apply wall stick force
        gameState.player.velocityX *= WALL_STICK_FORCE;
    } else {
        // Normal horizontal movement
        const acceleration = gameState.player.isGrounded ? 1 : 0.5;
        gameState.player.velocityX += moveX * acceleration;

        // Apply ground friction
        if (gameState.player.isGrounded) {
            gameState.player.velocityX *= GROUND_FRICTION;
        }

        // Apply gravity
        gameState.player.velocityY += GRAVITY;
    }

    // Limit speeds
    gameState.player.velocityX = Math.max(-SPEED, Math.min(SPEED, gameState.player.velocityX));
    gameState.player.velocityY = Math.min(gameState.player.velocityY, MAX_FALL_SPEED);

    // Handle normal jumping
    const jumpKeyPressed = gameState.keys.ArrowUp || gameState.keys.w || gameState.keys.W || gameState.keys.Space;
    const currentTime = Date.now();
    
    if (jumpKeyPressed && gameState.player.isGrounded && currentTime - gameState.player.lastJumpTime >= JUMP_DELAY) {
        gameState.player.velocityY = JUMP_FORCE;
        gameState.player.isGrounded = false;
        gameState.player.lastJumpTime = currentTime;
    }

    // Reset grounded state before collision checks
    gameState.player.isGrounded = false;

    // Try to move horizontally
    if (gameState.player.velocityX !== 0) {
        const newX = gameState.player.x + gameState.player.velocityX;
        
        // Check for collision
        if (!checkCollision(newX, gameState.player.y)) {
            gameState.player.x = newX;
        } else {
            // Hit a wall, stop horizontal movement
            gameState.player.velocityX = 0;
        }
    }

    // Try to move vertically
    if (gameState.player.velocityY !== 0) {
        const newY = gameState.player.y + gameState.player.velocityY;
        
        // Check for collision
        if (!checkCollision(gameState.player.x, newY)) {
            gameState.player.y = newY;
        } else {
            // Hit something
            if (gameState.player.velocityY > 0) {
                // Hit the ground
                gameState.player.isGrounded = true;
            }
            gameState.player.velocityY = 0;
        }
    }

    // Check if we're standing on ground
    if (!gameState.player.isGrounded) {
        // Check one pixel below the player
        if (checkCollision(gameState.player.x, gameState.player.y + 1)) {
            gameState.player.isGrounded = true;
        }
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
        // Only log when the mouse state has changed
        if (!gameState.wasMouseDown) {
            gameState.wasMouseDown = true;
        }
        
        // Calculate mouse position in world coordinates
        const mouseWorldX = Math.floor((gameState.mouseX / gameState.zoom) + gameState.camera.x);
        const mouseWorldY = Math.floor((gameState.mouseY / gameState.zoom) + gameState.camera.y);
        
        // Calculate tile coordinates
        const tileX = Math.floor(mouseWorldX / TILE_SIZE);
        const tileY = Math.floor(mouseWorldY / TILE_SIZE);
        
        // Only track coordinate changes, not every frame
        const tileKey = `${tileX},${tileY}`;
        if (gameState.lastDigTile !== tileKey) {
            gameState.lastDigTile = tileKey;
        }
        
        // Calculate distance from player to mouse
        const playerCenterX = gameState.player.x + gameState.player.width / 2;
        const playerCenterY = gameState.player.y + gameState.player.height / 2;
        const distance = Math.sqrt(
            Math.pow(playerCenterX - mouseWorldX, 2) + 
            Math.pow(playerCenterY - mouseWorldY, 2)
        );
        
        // Check if mouse is within digging range
        if (distance <= gameState.player.digRange) {
            // Get current tile type
            const currentTile = getTile(tileX, tileY);
            
            // Check if tile is diggable
            if (isDiggable(currentTile)) {
                // Create a unique key for this block position
                const blockKey = `${tileX},${tileY}`;
                
                // Check if we've recently dug this block
                const now = Date.now();
                const lastDug = recentlyDugBlocks.get(blockKey);
                
                // Only process digging if cooldown has passed
                if (!lastDug || (now - lastDug > 250)) {
                    // Record this dig time
                    recentlyDugBlocks.set(blockKey, now);
                    
                    // Create particles at the center of the tile
                    const particleX = tileX * TILE_SIZE + TILE_SIZE / 2;
                    const particleY = tileY * TILE_SIZE + TILE_SIZE / 2;
                    const particleColor = getTileColor(currentTile);
                    
                    // Create particles - reduce number for performance
                    createParticles(particleX, particleY, particleColor, 10);
                    
                    // Check if tile is collectible
                    if (isCollectible(currentTile)) {
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
                        
                        // Add score
                        gameState.score += getScoreValue(currentTile);
                    }
                    
                    // Update the tile locally immediately for responsiveness
                    setTile(tileX, tileY, TILE_TYPES.AIR, false);
                    
                    // Then queue the server update if in multiplayer mode
                    if (typeof _sendBlockDig === 'function') {
                        throttledSendBlockDig(tileX, tileY, TILE_TYPES.AIR);
                    }
                }
            }
        }
    } else if (gameState.wasMouseDown) {
        gameState.wasMouseDown = false;
    }
}

// Create particles
function createParticles(x, y, color, count) {
    if (!gameState.particles) {
        gameState.particles = [];
    }
    
    // Limit the total number of particles for performance
    const MAX_PARTICLES = 500;
    
    // If we're at the limit, don't create more particles
    if (gameState.particles.length >= MAX_PARTICLES) {
        // Remove oldest particles when we exceed the limit
        gameState.particles.splice(0, count);
    }
    
    // Adjust count based on current particle count for smoother performance
    const adjustedCount = Math.min(count, Math.floor((MAX_PARTICLES - gameState.particles.length) / 2));
    if (adjustedCount <= 0) return;
    
    for (let i = 0; i < adjustedCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 5; // Faster particles
        
        gameState.particles.push({
            x: x,
            y: y,
            velocityX: Math.cos(angle) * speed,
            velocityY: Math.sin(angle) * speed - 2, // Initial upward boost
            color: color,
            size: 2 + Math.random() * 3,
            expireTime: Date.now() + 300 + Math.random() * 300, // Shorter lifetime for better performance
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

    // Draw parachute if deployed
    if (gameState.player.hasParachute) {
        const parachuteWidth = antWidth * 2;
        const parachuteHeight = antHeight * 1.2;
        const parachuteX = centerX - parachuteWidth / 2;
        const parachuteY = centerY - parachuteHeight;

        // Draw parachute canopy (cute rounded shape)
        gameState.ctx.fillStyle = "#FFB6C1"; // Light pink
        gameState.ctx.beginPath();
        gameState.ctx.moveTo(parachuteX, parachuteY + parachuteHeight * 0.5);
        gameState.ctx.bezierCurveTo(
            parachuteX, parachuteY,
            parachuteX + parachuteWidth, parachuteY,
            parachuteX + parachuteWidth, parachuteY + parachuteHeight * 0.5
        );
        gameState.ctx.fill();

        // Add stripes to the parachute
        gameState.ctx.strokeStyle = "#FFC0CB"; // Pink
        gameState.ctx.lineWidth = Math.max(1, antWidth * 0.05);
        for (let i = 1; i < 4; i++) {
            const x = parachuteX + (parachuteWidth * i / 4);
            gameState.ctx.beginPath();
            gameState.ctx.moveTo(x, parachuteY + parachuteHeight * 0.1);
            gameState.ctx.lineTo(x, parachuteY + parachuteHeight * 0.4);
            gameState.ctx.stroke();
        }

        // Draw strings
        gameState.ctx.strokeStyle = "#FFB6C1";
        gameState.ctx.lineWidth = Math.max(1, antWidth * 0.02);
        const stringCount = 4;
        for (let i = 0; i <= stringCount; i++) {
            const x = parachuteX + (parachuteWidth * i / stringCount);
            gameState.ctx.beginPath();
            gameState.ctx.moveTo(x, parachuteY + parachuteHeight * 0.4);
            gameState.ctx.lineTo(centerX + (i - stringCount/2) * (antWidth * 0.2), centerY - antHeight * 0.3);
            gameState.ctx.stroke();
        }
    }
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

// Update particles with improved performance
function updateParticles(deltaTime) {
    if (!gameState.particles || gameState.particles.length === 0) {
        return; // Skip if no particles
    }
    
    const now = Date.now();
    let i = 0;
    
    // Process particles in chunks for better performance
    const CHUNK_SIZE = 100; // Process this many particles at once
    const totalParticles = gameState.particles.length;
    
    // Only process a subset of particles each frame if there are too many
    const particlesToProcess = Math.min(totalParticles, CHUNK_SIZE);
    
    // Update only a subset of particles if there are too many
    for (i = 0; i < particlesToProcess; i++) {
        const particle = gameState.particles[i];
        
        // Apply gravity
        particle.velocityY += particle.gravity;
        
        // Update position
        particle.x += particle.velocityX;
        particle.y += particle.velocityY;
        
        // Slow down over time (air resistance)
        particle.velocityX *= 0.98;
        particle.velocityY *= 0.98;
        
        // Shrink over time
        particle.size *= 0.97;
    }
    
    // Remove expired particles - do this in bulk for better performance
    if (totalParticles > 0) {
        gameState.particles = gameState.particles.filter(p => now < p.expireTime);
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
        // Request chunk if multiplayer is enabled and we're trying to send to server
        // This prevents infinite loops of requesting chunks
        if (sendToServer && typeof _requestChunk === 'function') {
            _requestChunk(chunkX, chunkY);
        }
        
        return; // Can't set tile in non-existent chunk
    }
    
    // Check if tile is already the desired type (skip unnecessary updates)
    if (gameState.chunks[chunkKey][localY][localX] === tileType) {
        return; // No change needed
    }
    
    // Set tile in chunk
    gameState.chunks[chunkKey][localY][localX] = tileType;
    
    // Send to server if requested and multiplayer is enabled
    // We now expect throttledSendBlockDig to handle batching, so we don't use it directly here
    if (sendToServer && typeof _sendBlockDig === 'function') {
        // We use the throttled version in handleDigging, but direct here for single updates
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