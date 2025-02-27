// Game state object
const gameState = {
    // World properties
    worldWidth: 1000,
    worldHeight: 1000,
    chunkSize: 16,
    chunks: {}, // Store loaded chunks
    terrainHeights: [], // Store height of terrain at each x position
    
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
        inventory: {
            dirt: 0,
            stone: 0,
            ore: 0
        }
    },
    
    // Camera properties
    camera: {
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0
    },
    
    // Game properties
    enemies: [],
    gravity: 0.4,
    tileSize: 32,
    canvas: null,
    ctx: null,
    lastFrameTime: 0,
    keys: {},
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    score: 0,
    
    // World generation properties
    worldSeed: Math.floor(Math.random() * 1000000),
    hasUnsavedChanges: false,
    lastSaveTime: 0
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
    worldInfo.textContent = `World Size: ${gameState.worldWidth}x${gameState.worldHeight} | Seed: ${gameState.worldSeed}`;
    gameContainer.appendChild(worldInfo);
    
    // Set up event listeners
    setupEventListeners();
    
    // Try to load saved game
    if (!loadGame()) {
        // Generate new world if no saved game
        generateWorld();
    }
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
        // Generate chunk if not loaded
        generateChunk(chunkX, chunkY);
    }
    
    const localX = x % gameState.chunkSize;
    const localY = y % gameState.chunkSize;
    
    return gameState.chunks[chunkKey][localY][localX];
}

// Set a tile at specific world coordinates
function setTile(x, y, tileType) {
    if (x < 0 || x >= gameState.worldWidth || y < 0 || y >= gameState.worldHeight) {
        return; // Out of bounds
    }
    
    const chunkX = Math.floor(x / gameState.chunkSize);
    const chunkY = Math.floor(y / gameState.chunkSize);
    const chunkKey = `${chunkX},${chunkY}`;
    
    // Check if chunk is loaded
    if (!gameState.chunks[chunkKey]) {
        // Generate chunk if not loaded
        generateChunk(chunkX, chunkY);
    }
    
    const localX = x % gameState.chunkSize;
    const localY = y % gameState.chunkSize;
    
    // Only mark as unsaved if the tile actually changed
    if (gameState.chunks[chunkKey][localY][localX] !== tileType) {
        gameState.chunks[chunkKey][localY][localX] = tileType;
        gameState.hasUnsavedChanges = true;
    }
}

// Generate a single chunk
function generateChunk(chunkX, chunkY) {
    const chunkKey = `${chunkX},${chunkY}`;
    const chunk = [];
    
    // Initialize chunk with air
    for (let y = 0; y < gameState.chunkSize; y++) {
        chunk[y] = [];
        for (let x = 0; x < gameState.chunkSize; x++) {
            const worldX = chunkX * gameState.chunkSize + x;
            const worldY = chunkY * gameState.chunkSize + y;
            
            // Default to air
            let tileType = TILE_TYPES.AIR;
            
            // If terrain heights are generated
            if (gameState.terrainHeights.length > 0) {
                const terrainHeight = gameState.terrainHeights[worldX] || 0;
                
                if (worldY > terrainHeight + 20) {
                    // Deep underground - more chance of stone and ore
                    const rand = Math.random();
                    if (rand < 0.7) {
                        tileType = TILE_TYPES.STONE;
                    } else if (rand < 0.85) {
                        tileType = TILE_TYPES.DIRT;
                    } else {
                        tileType = TILE_TYPES.ORE;
                    }
                } else if (worldY > terrainHeight) {
                    // Underground - mostly dirt with some stone
                    const rand = Math.random();
                    if (rand < 0.8) {
                        tileType = TILE_TYPES.DIRT;
                    } else {
                        tileType = TILE_TYPES.STONE;
                    }
                } else if (worldY === terrainHeight) {
                    // Surface - grass
                    tileType = TILE_TYPES.GRASS;
                } else {
                    // Above ground - air
                    tileType = TILE_TYPES.AIR;
                }
                
                // Bedrock at bottom of world
                if (worldY >= gameState.worldHeight - 5) {
                    tileType = TILE_TYPES.BEDROCK;
                }
            }
            
            chunk[y][x] = tileType;
        }
    }
    
    gameState.chunks[chunkKey] = chunk;
}

// Save game to localStorage
function saveGame() {
    const saveData = {
        worldSeed: gameState.worldSeed,
        player: {
            x: gameState.player.x,
            y: gameState.player.y,
            health: gameState.player.health,
            inventory: gameState.player.inventory
        },
        score: gameState.score,
        chunks: {} // We'll save modified chunks only
    };
    
    // Only save chunks that have been modified
    for (const chunkKey in gameState.chunks) {
        // TODO: Add logic to determine if a chunk has been modified
        // For now, save all loaded chunks
        saveData.chunks[chunkKey] = gameState.chunks[chunkKey];
    }
    
    try {
        localStorage.setItem('antTerrariaSave', JSON.stringify(saveData));
        gameState.hasUnsavedChanges = false;
        gameState.lastSaveTime = Date.now();
        return true;
    } catch (e) {
        console.error('Failed to save game:', e);
        return false;
    }
}

// Load game from localStorage
function loadGame() {
    try {
        const saveData = JSON.parse(localStorage.getItem('antTerrariaSave'));
        if (!saveData) return false;
        
        // Load world seed and regenerate terrain heights
        gameState.worldSeed = saveData.worldSeed;
        generateTerrainHeights();
        
        // Load player data
        gameState.player.x = saveData.player.x;
        gameState.player.y = saveData.player.y;
        gameState.player.health = saveData.player.health;
        
        // Ensure inventory is properly initialized
        gameState.player.inventory = {
            dirt: (saveData.player.inventory && saveData.player.inventory.dirt) || 0,
            stone: (saveData.player.inventory && saveData.player.inventory.stone) || 0,
            ore: (saveData.player.inventory && saveData.player.inventory.ore) || 0
        };
        
        // Load score
        gameState.score = saveData.score;
        
        // Load chunks
        gameState.chunks = saveData.chunks || {};
        
        // Update camera position
        gameState.camera.x = gameState.player.x - gameState.canvas.width / 2;
        gameState.camera.y = gameState.player.y - gameState.canvas.height / 2;
        gameState.camera.targetX = gameState.camera.x;
        gameState.camera.targetY = gameState.camera.y;
        
        gameState.hasUnsavedChanges = false;
        gameState.lastSaveTime = Date.now();
        
        return true;
    } catch (e) {
        console.error('Failed to load game:', e);
        return false;
    }
}

// Set up event listeners
function setupEventListeners() {
    // Keyboard events
    window.addEventListener('keydown', (e) => {
        gameState.keys[e.code] = true;
    });
    
    window.addEventListener('keyup', (e) => {
        gameState.keys[e.code] = false;
    });
    
    // Mouse events
    gameState.canvas.addEventListener('mousemove', (e) => {
        const rect = gameState.canvas.getBoundingClientRect();
        gameState.mouseX = e.clientX - rect.left;
        gameState.mouseY = e.clientY - rect.top;
    });
    
    gameState.canvas.addEventListener('mousedown', () => {
        gameState.mouseDown = true;
    });
    
    gameState.canvas.addEventListener('mouseup', () => {
        gameState.mouseDown = false;
    });
    
    // Resize event
    window.addEventListener('resize', () => {
        gameState.canvas.width = window.innerWidth;
        gameState.canvas.height = window.innerHeight;
    });
} 