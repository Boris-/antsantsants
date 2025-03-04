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
    
    // Day/Night cycle properties
    dayNightCycle: {
        time: 0, // 0-1 representing time of day (0 = midnight, 0.5 = noon)
        dayLength: 1200000, // 20 minutes in milliseconds for a full day cycle
        lastUpdate: Date.now(),
        enabled: true // Ensure day/night cycle is enabled by default
    },
    
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
    debug: false,
    
    // New properties for chunk metadata
    chunkMetadata: {}
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
    
    // Only update if the tile is actually changing
    if (gameState.chunks[chunkKey][localY][localX] !== tileType) {
        // Set tile
        gameState.chunks[chunkKey][localY][localX] = tileType;
        
        // Mark chunk as locally modified
        if (!gameState.chunkMetadata) {
            gameState.chunkMetadata = {};
        }
        
        if (!gameState.chunkMetadata[chunkKey]) {
            gameState.chunkMetadata[chunkKey] = {};
        }
        
        gameState.chunkMetadata[chunkKey].locallyModified = true;
        gameState.chunkMetadata[chunkKey].lastModified = Date.now();
        
        // Send to server if requested
        if (sendToServer && typeof window.sendBlockDig === 'function') {
            window.sendBlockDig(x, y, tileType);
        }
    }
}

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
    
    // Create time display for day/night cycle
    let timeElement = document.getElementById('timeDisplay');
    if (!timeElement) {
        timeElement = document.createElement('div');
        timeElement.id = 'timeDisplay';
        timeElement.className = 'game-info';
        uiContainer.appendChild(timeElement);
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
            top: 50px;
            left: 10px;
        }
        
        #timeDisplay {
            top: 90px;
            left: 10px;
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
    if (!debugElement) return;
    
    const playerX = Math.floor(gameState.player.x / TILE_SIZE);
    const playerY = Math.floor(gameState.player.y / TILE_SIZE);
    const chunkX = Math.floor(playerX / CHUNK_SIZE);
    const chunkY = Math.floor(playerY / CHUNK_SIZE);
    const chunk = gameState.chunks[`${chunkX},${chunkY}`];
    const biome = getBiome(playerX);
    
    // Day/Night cycle info
    let timeInfo = 'Day/Night: Disabled';
    if (gameState.dayNightCycle && gameState.dayNightCycle.enabled) {
        const time = gameState.dayNightCycle.time;
        const hours = Math.floor(time * 24);
        const minutes = Math.floor((time * 24 * 60) % 60);
        timeInfo = `Day/Night: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} (${(time * 100).toFixed(1)}%)`;
    }
    
    debugElement.innerHTML = `
        FPS: ${Math.round(1000 / (Date.now() - gameState.lastFrameTime))}
        Player: (${playerX}, ${playerY})
        Chunk: (${chunkX}, ${chunkY})
        Zoom: ${gameState.zoom.toFixed(1)}
        Chunks Loaded: ${Object.keys(gameState.chunks).length}
        Biome: ${biome ? biome.name : 'Unknown'}
        ${timeInfo}
    `;
    
    gameState.lastFrameTime = Date.now();
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

// Update day/night cycle
function updateDayNightCycle(timestamp) {
    if (!gameState.dayNightCycle) {
        // Initialize the day/night cycle if it doesn't exist
        gameState.dayNightCycle = {
            time: 0.5, // Start at noon
            dayLength: 1200000, // 20 minutes for a full day
            lastUpdate: timestamp || Date.now(),
            enabled: true
        };
        console.log('Day/night cycle initialized:', gameState.dayNightCycle);
        return;
    }
    
    // Skip if disabled
    if (!gameState.dayNightCycle.enabled) {
        return;
    }
    
    // Calculate time elapsed since last update
    const now = timestamp || Date.now();
    const elapsed = now - gameState.dayNightCycle.lastUpdate;
    
    // Calculate the time adjustment for smooth client-side interpolation
    const adjustment = elapsed / gameState.dayNightCycle.dayLength;
    
    // Small incremental update for smoother transitions
    gameState.dayNightCycle.time += adjustment;
    
    // Keep time between 0 and 1
    while (gameState.dayNightCycle.time >= 1) {
        gameState.dayNightCycle.time -= 1;
    }
    
    // Update lastUpdate for next frame
    gameState.dayNightCycle.lastUpdate = now;
    
    // Update UI time display
    updateTimeDisplay();
    
    // Update debug info if in debug mode
    if (gameState.debug) {
        updateDebugInfo();
    }
}

// Update the time display in the UI
function updateTimeDisplay() {
    const timeDisplay = document.getElementById('timeDisplay');
    if (timeDisplay && gameState.dayNightCycle) {
        const hours = Math.floor(gameState.dayNightCycle.time * 24);
        const minutes = Math.floor((gameState.dayNightCycle.time * 24 * 60) % 60);
        timeDisplay.textContent = `Time: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
}

// Handle server day/night cycle updates
function syncDayNightCycleWithServer(serverTimeData) {
    if (!gameState.dayNightCycle) {
        gameState.dayNightCycle = {
            enabled: true,
            lastUpdate: Date.now()
        };
    }
    
    // Update with server data
    gameState.dayNightCycle.time = serverTimeData.time;
    gameState.dayNightCycle.dayLength = serverTimeData.dayLength;
    gameState.dayNightCycle.lastUpdate = Date.now();
    gameState.dayNightCycle.enabled = true;
    
    // Update UI immediately after sync
    updateTimeDisplay();
    
    console.log('Synced day/night cycle with server:', gameState.dayNightCycle);
}

// Make functions available globally
window.updateDayNightCycle = updateDayNightCycle;
window.syncDayNightCycleWithServer = syncDayNightCycleWithServer;

// Function to toggle debug mode
function toggleDebugMode() {
    gameState.debug = !gameState.debug;
    console.log(`Debug mode ${gameState.debug ? 'enabled' : 'disabled'}`);
    
    // Update debug display
    updateDebugInfo();
    
    return gameState.debug;
}

// Make debug toggle available globally
window.toggleDebugMode = toggleDebugMode; 