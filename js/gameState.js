// Game state object
const gameState = {
    // World properties
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    chunkSize: CHUNK_SIZE,
    chunks: {}, // Store loaded chunks
    loadedChunks: new Set(), // Track which chunks are loaded
    terrainHeights: [], // Store height of terrain at each x position
    biomeMap: [], // Store biome at each x position
    biomeTypes: {}, // Biome definitions
    
    // Player properties
    player: {
        x: 0,
        y: 0,
        width: 20,
        height: 30,
        velocityX: 0,
        velocityY: 0,
        health: 100,
        maxHealth: 100,
        isGrounded: false,
        facingRight: true,
        digRange: TILE_SIZE * 3, // Digging range
        speed: 2, // Movement speed
        inventory: {
            dirt: 0,
            stone: 0,
            ore: 0,
            coal: 0,
            iron: 0,
            gold: 0,
            diamond: 0
        }
    },
    
    // Camera properties
    camera: {
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0
    },
    
    // Zoom properties
    zoom: 1.0,
    minZoom: 0.5,
    maxZoom: 2.0,
    isZooming: false,
    zoomTimeout: null,
    
    // Game properties
    enemies: [],
    gravity: GRAVITY,
    tileSize: TILE_SIZE,
    canvas: null,
    ctx: null,
    lastFrameTime: 0,
    keys: {},
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    score: 0,
    particles: [], // Particle effects
    
    // Multiplayer properties
    lastPositionUpdate: 0,
    
    // Debug mode
    debug: false
};

// Initialize the game
function initializeGame() {
    // Create canvas
    gameState.canvas = document.createElement('canvas');
    gameState.canvas.width = window.innerWidth;
    gameState.canvas.height = window.innerHeight;
    gameState.ctx = gameState.canvas.getContext('2d');
    
    // Add canvas to the page
    const gameContainer = document.getElementById('game-container');
    gameContainer.appendChild(gameState.canvas);
    
    // Add world info display
    const worldInfo = document.createElement('div');
    worldInfo.id = 'world-info';
    worldInfo.textContent = `World Size: ${gameState.worldWidth}x${gameState.worldHeight}`;
    gameContainer.appendChild(worldInfo);
    
    // Set up event listeners
    // setupEventListeners();
    
    // Initialize UI
    initializeUI();
}

// Get a tile at specific world coordinates
function getTile(x, y) {
    if (x < 0 || x >= gameState.worldWidth || y < 0 || y >= gameState.worldHeight) {
        return TILE_TYPES.BEDROCK; // Out of bounds is bedrock
    }
    
    const chunkX = Math.floor(x / gameState.chunkSize);
    const chunkY = Math.floor(y / gameState.chunkSize);
    const chunkKey = `${chunkX},${chunkY}`;
    
    // Check if chunk is loaded
    if (!gameState.chunks[chunkKey]) {
        // Request chunk from server if available
        if (typeof window.requestChunk === 'function') {
            window.requestChunk(chunkX, chunkY);
        }
        return TILE_TYPES.AIR; // Return air while waiting for chunk
    }
    
    const localX = x % gameState.chunkSize;
    const localY = y % gameState.chunkSize;
    
    return gameState.chunks[chunkKey][localY][localX];
}

// Set a tile at specific world coordinates
function setTile(x, y, tileType, sendToServer = true) {
    if (x < 0 || x >= gameState.worldWidth || y < 0 || y >= gameState.worldHeight) {
        return; // Out of bounds
    }
    
    const chunkX = Math.floor(x / gameState.chunkSize);
    const chunkY = Math.floor(y / gameState.chunkSize);
    const chunkKey = `${chunkX},${chunkY}`;
    
    // Check if chunk is loaded
    if (!gameState.chunks[chunkKey]) {
        // Request chunk from server if available
        if (typeof window.requestChunk === 'function') {
            window.requestChunk(chunkX, chunkY);
        }
        return; // Can't set tile in unloaded chunk
    }
    
    const localX = x % gameState.chunkSize;
    const localY = y % gameState.chunkSize;
    
    // Set tile
    gameState.chunks[chunkKey][localY][localX] = tileType;
    
    // Send to server if requested
    if (sendToServer && typeof window.sendBlockDig === 'function') {
        window.sendBlockDig(x, y, tileType);
    }
}

// Place player safely above the terrain
function placePlayerSafely() {
    // Find a relatively flat area for the player
    // Start with a random position near the center (between -50 and 50 tiles from center)
    const randomOffset = Math.floor(Math.random() * 100) - 50;
    const centerX = Math.floor(WORLD_WIDTH / 2) + randomOffset;
    
    // Search range - look within 30 tiles of the random center point
    const searchStart = Math.max(5, centerX - 15);
    const searchEnd = Math.min(WORLD_WIDTH - 5, centerX + 15);
    
    let bestX = centerX;
    let minVariation = Infinity;
    
    // Look for flat areas by checking height variations
    for (let x = searchStart; x < searchEnd; x++) {
        let variation = 0;
        for (let i = -2; i <= 2; i++) {
            if (gameState.terrainHeights[x + i] !== undefined) {
                variation += Math.abs(gameState.terrainHeights[x + i] - gameState.terrainHeights[x]);
            }
        }
        
        if (variation < minVariation) {
            minVariation = variation;
            bestX = x;
        }
    }
    
    // Place player above the surface at the chosen location
    const surfaceY = gameState.terrainHeights[bestX] || Math.floor(WORLD_HEIGHT / 3);
    gameState.player.x = bestX * TILE_SIZE;
    gameState.player.y = (surfaceY - 2) * TILE_SIZE;
}

// Update inventory display
/*
function updateInventoryDisplay() {
    // Get inventory container
    const inventoryContainer = document.getElementById('inventory-container');
    if (!inventoryContainer) return;
    
    // Clear existing inventory
    inventoryContainer.innerHTML = '';
    
    // Create inventory items
    for (const [item, count] of Object.entries(gameState.player.inventory)) {
        if (count > 0) {
            const itemElement = document.createElement('div');
            itemElement.className = 'inventory-item';
            itemElement.innerHTML = `
                <div class="item-icon ${item}"></div>
                <div class="item-count">${count}</div>
            `;
            inventoryContainer.appendChild(itemElement);
        }
    }
}

// Update score display
function updateScoreDisplay() {
    // Get score container
    const scoreContainer = document.getElementById('score-container');
    if (!scoreContainer) return;
    
    // Update score
    scoreContainer.textContent = `Score: ${gameState.score}`;
}
*/

// Initialize UI elements
function initializeUI() {
    // Create UI container if it doesn't exist
    let uiContainer = document.getElementById('ui');
    if (!uiContainer) {
        uiContainer = document.createElement('div');
        uiContainer.id = 'ui';
        document.body.appendChild(uiContainer);
    }
    
    // Create score display
    let scoreElement = document.getElementById('score');
    if (!scoreElement) {
        scoreElement = document.createElement('div');
        scoreElement.id = 'score';
        scoreElement.className = 'game-info';
        uiContainer.appendChild(scoreElement);
    }
    
    // Create inventory display
    let inventoryElement = document.getElementById('inventory');
    if (!inventoryElement) {
        inventoryElement = document.createElement('div');
        inventoryElement.id = 'inventory';
        inventoryElement.className = 'game-info';
        uiContainer.appendChild(inventoryElement);
    }
    
    // Create health display
    let healthElement = document.getElementById('health');
    if (!healthElement) {
        healthElement = document.createElement('div');
        healthElement.id = 'health';
        healthElement.className = 'game-info';
        uiContainer.appendChild(healthElement);
    }
    
    // Create biome display
    let biomeElement = document.getElementById('biome');
    if (!biomeElement) {
        biomeElement = document.createElement('div');
        biomeElement.id = 'biome';
        biomeElement.className = 'game-info';
        uiContainer.appendChild(biomeElement);
    }
    
    // Create debug info display
    let debugElement = document.getElementById('debug-info');
    if (!debugElement) {
        debugElement = document.createElement('div');
        debugElement.id = 'debug-info';
        debugElement.className = 'game-info';
        uiContainer.appendChild(debugElement);
    }
    
    // Add CSS for UI elements
    const style = document.createElement('style');
    style.textContent = `
        .game-info {
            position: absolute;
            background-color: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            z-index: 100;
        }
        
        #score {
            top: 10px;
            left: 10px;
        }
        
        #health {
            top: 10px;
            right: 10px;
        }
        
        #inventory {
            bottom: 10px;
            left: 10px;
            max-height: 200px;
            overflow-y: auto;
        }
        
        #biome {
            bottom: 10px;
            right: 10px;
        }
        
        #debug-info {
            top: 50px;
            left: 10px;
            display: none;
        }
        
        #player-info {
            top: 90px;
            left: 10px;
        }
    `;
    document.head.appendChild(style);
    
    // Update displays
    updateScoreDisplay();
    updateInventoryDisplay();
    updateHealthDisplay();
}

// Update health display
function updateHealthDisplay() {
    const healthElement = document.getElementById('health');
    if (healthElement) {
        healthElement.innerHTML = `Health: ${gameState.player.health}/${gameState.player.maxHealth}`;
    }
}

// Update biome display
function updateBiomeDisplay() {
    const biomeElement = document.getElementById('biome');
    if (biomeElement) {
        const playerX = Math.floor(gameState.player.x / TILE_SIZE);
        const biome = gameState.biomeMap[playerX];
        
        if (biome) {
            biomeElement.textContent = `Biome: ${biome.name}`;
        } else {
            biomeElement.textContent = 'Biome: Unknown';
        }
    }
}

// Update debug info
function updateDebugInfo() {
    const debugElement = document.getElementById('debug-info');
    if (debugElement) {
        if (gameState.debug) {
            const playerX = Math.floor(gameState.player.x / TILE_SIZE);
            const playerY = Math.floor(gameState.player.y / TILE_SIZE);
            const chunkX = Math.floor(playerX / CHUNK_SIZE);
            const chunkY = Math.floor(playerY / CHUNK_SIZE);
            const fps = Math.round(gameState.fps || 0);
            
            debugElement.style.display = 'block';
            debugElement.innerHTML = `
                <div>FPS: ${fps}</div>
                <div>Position: (${playerX}, ${playerY})</div>
                <div>Chunk: (${chunkX}, ${chunkY})</div>
                <div>Loaded Chunks: ${gameState.loadedChunks.size}</div>
                <div>Camera: (${Math.floor(gameState.camera.x)}, ${Math.floor(gameState.camera.y)})</div>
                <div>Zoom: ${gameState.zoom.toFixed(2)}</div>
            `;
        } else {
            debugElement.style.display = 'none';
        }
    }
}

// Set up event listeners
/*
function setupEventListeners() {
    // Keyboard events
    window.addEventListener('keydown', (e) => {
        gameState.keys[e.code] = true;
        
        // Toggle debug mode with F3
        if (e.code === 'F3') {
            gameState.debug = !gameState.debug;
            updateDebugInfo();
        }
    });
    
    window.addEventListener('keyup', (e) => {
        gameState.keys[e.code] = false;
    });
    
    // Mouse events
    gameState.canvas.addEventListener('mousedown', (e) => {
        gameState.mouseDown = true;
        gameState.mouseX = e.clientX;
        gameState.mouseY = e.clientY;
    });
    
    gameState.canvas.addEventListener('mouseup', () => {
        gameState.mouseDown = false;
    });
}
*/

// Zoom with mouse wheel
gameState.canvas.addEventListener('wheel', (e) => {
    // Prevent default scrolling
    e.preventDefault();
    
    // Calculate zoom factor
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    
    // Apply zoom
    gameState.zoom = Math.max(gameState.minZoom, Math.min(gameState.maxZoom, gameState.zoom * zoomFactor));
    
    // Set zooming flag
    gameState.isZooming = true;
    
    // Clear previous timeout
    if (gameState.zoomTimeout) {
        clearTimeout(gameState.zoomTimeout);
    }
    
    // Set timeout to reset zooming flag
    gameState.zoomTimeout = setTimeout(() => {
        gameState.isZooming = false;
    }, 200);
});

// Window resize event
window.addEventListener('resize', () => {
    gameState.canvas.width = window.innerWidth;
    gameState.canvas.height = window.innerHeight;
}); 