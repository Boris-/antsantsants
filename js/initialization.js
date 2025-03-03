// Initialize game state
function initializeGameState() {
    console.log("Initializing game state...");
    
    // Create canvas
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Initialize game state object as a global variable
    window.gameState = {
        canvas: canvas,
        ctx: ctx,
        chunks: {},
        loadedChunks: new Set(), // Track loaded chunks for multiplayer
        terrainHeights: {},
        biomeMap: {},
        player: {
            x: 0,
            y: 0,
            width: 20,
            height: 40,
            speed: 5,
            digRange: 100,
            health: 100,
            maxHealth: 100,
            direction: 1, // 1 for right, -1 for left
            invulnerable: false,
            flash: false,
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
        camera: {
            x: 0,
            y: 0
        },
        zoom: 1,
        keys: {},
        mouse: {
            x: 0,
            y: 0,
            leftPressed: false
        },
        inventory: {},
        score: 0,
        particles: [],
        enemies: [],
        worldSeed: Math.random() * 1000000,
        gameTime: 0,
        dayNightCycle: {
            time: 0,
            dayLength: 600, // 10 minutes per day
            isDay: true
        },
        sounds: {
            // Comment out sound loading to prevent file not found errors
            // dig: new Audio('sounds/dig.mp3'),
            // collect: new Audio('sounds/collect.mp3'),
            // hurt: new Audio('sounds/hurt.mp3')
        },
        debug: {
            showFPS: false,
            showChunkBorders: false,
            godMode: false
        },
        // Multiplayer specific properties
        lastPositionUpdate: 0,
        isMultiplayer: true
    };
    
    console.log("Game state initialized with player inventory:", JSON.stringify(window.gameState.player.inventory));
    
    // Initialize world
    initializeWorld();
    
    // Place player at spawn point
    spawnPlayer();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize UI
    initializeUI();
    
    // Start game loop
    gameLoop();
    
    console.log("Game state initialization complete");
}

// Initialize world
function initializeWorld() {
    // In multiplayer mode, world generation happens on the server
    if (!window.gameState.isMultiplayer) {
        // Initialize biomes first - this will store biomeTypes in gameState
        const biomeTypes = initializeBiomes();
        
        // Generate biome map using the initialized biome types
        window.gameState.biomeMap = generateBiomeMap();
        
        // Generate terrain heights for the entire world (now that biomes are available)
        generateTerrainHeights();
        
        // Generate initial chunks around player
        generateInitialChunks();
    }
}

// Generate initial chunks around player
function generateInitialChunks() {
    // In multiplayer mode, chunks are requested from the server
    if (window.gameState.isMultiplayer) return;
    
    // Calculate player chunk
    const playerChunkX = Math.floor(window.gameState.player.x / (CHUNK_SIZE * TILE_SIZE));
    const playerChunkY = Math.floor(window.gameState.player.y / (CHUNK_SIZE * TILE_SIZE));
    
    // Generate chunks in a 5x5 area around player
    for (let y = playerChunkY - 2; y <= playerChunkY + 2; y++) {
        for (let x = playerChunkX - 2; x <= playerChunkX + 2; x++) {
            generateChunk(x, y);
        }
    }
}

// Spawn player at a suitable location
function spawnPlayer() {
    // Find a suitable spawn point (on grass) with some randomization
    // Add a small random offset from the center (between -50 and 50 tiles)
    const randomOffset = Math.floor(Math.random() * 100) - 50;
    let spawnX = Math.floor(WORLD_WIDTH / 2) + randomOffset;
    
    // Ensure spawn point is within world bounds
    spawnX = Math.max(10, Math.min(WORLD_WIDTH - 10, spawnX));
    
    // Get terrain height at spawn X
    const terrainHeight = getTerrainHeight(spawnX);
    
    // Set player position
    window.gameState.player.x = spawnX * TILE_SIZE;
    window.gameState.player.y = (terrainHeight - 2) * TILE_SIZE; // Place player 2 blocks above terrain
    
    // Center camera on player
    updateCamera();
}

// Set up event listeners
function setupEventListeners() {
    // Keyboard events
    window.addEventListener('keydown', (e) => {
        window.gameState.keys[e.key] = true;
        
        // Toggle debug options
        if (e.key === 'f') {
            window.gameState.debug.showFPS = !window.gameState.debug.showFPS;
        }
        if (e.key === 'c') {
            window.gameState.debug.showChunkBorders = !window.gameState.debug.showChunkBorders;
        }
        if (e.key === 'g') {
            window.gameState.debug.godMode = !window.gameState.debug.godMode;
            if (window.gameState.debug.godMode) {
                window.gameState.player.health = window.gameState.player.maxHealth;
            }
        }
        
        // Zoom controls
        if (e.key === '=' || e.key === '+') {
            window.gameState.zoom = Math.min(2, window.gameState.zoom + 0.1);
        }
        if (e.key === '-' || e.key === '_') {
            window.gameState.zoom = Math.max(0.5, window.gameState.zoom - 0.1);
        }
        
        // Save/load game
        if (e.key === 's' && e.ctrlKey) {
            e.preventDefault();
            saveGame();
        }
        if (e.key === 'l' && e.ctrlKey) {
            e.preventDefault();
            loadGame();
        }
    });
    
    window.addEventListener('keyup', (e) => {
        window.gameState.keys[e.key] = false;
    });
    
    // Mouse events
    window.gameState.canvas.addEventListener('mousemove', (e) => {
        window.gameState.mouse.x = e.clientX;
        window.gameState.mouse.y = e.clientY;
    });
    
    window.gameState.canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            window.gameState.mouse.leftPressed = true;
        }
    });
    
    window.gameState.canvas.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            window.gameState.mouse.leftPressed = false;
        }
    });
    
    // Window resize
    window.addEventListener('resize', () => {
        window.gameState.canvas.width = window.innerWidth;
        window.gameState.canvas.height = window.innerHeight;
    });
}

// Play a sound
function playSound(soundName) {
    if (window.gameState.sounds[soundName]) {
        try {
            // Clone the audio to allow overlapping sounds
            const sound = window.gameState.sounds[soundName].cloneNode();
            sound.volume = 0.3;
            sound.play();
        } catch (error) {
            console.log('Sound playback error:', error);
        }
    }
}

// Create particles
function createParticles(x, y, tileType) {
    // Determine particle color based on tile type
    let color = '#8B4513'; // Default brown
    
    switch (tileType) {
        case TILE_TYPES.DIRT:
            color = '#8B4513';
            break;
        case TILE_TYPES.STONE:
            color = '#808080';
            break;
        case TILE_TYPES.GRASS:
            color = '#228B22';
            break;
        case TILE_TYPES.SAND:
            color = '#F0E68C';
            break;
        case TILE_TYPES.ORE:
            color = '#FFD700';
            break;
        case TILE_TYPES.COAL:
            color = '#2C2C2C';
            break;
        case TILE_TYPES.IRON:
            color = '#C0C0C0';
            break;
        case TILE_TYPES.GOLD:
            color = '#DAA520';
            break;
        case TILE_TYPES.DIAMOND:
            color = '#00FFFF';
            break;
        case TILE_TYPES.WOOD:
            color = '#8B4513';
            break;
        case TILE_TYPES.LEAVES:
            color = '#006400';
            break;
        case TILE_TYPES.BUSH:
            color = '#228B22';
            break;
        case TILE_TYPES.FLOWER:
            color = '#FF69B4';
            break;
        case TILE_TYPES.MUSHROOM:
            color = '#B22222';
            break;
        case TILE_TYPES.CACTUS:
            color = '#2E8B57';
            break;
        case TILE_TYPES.SNOW:
            color = '#FFFAFA';
            break;
        case TILE_TYPES.WATER:
            color = '#4169E1';
            break;
    }
    
    // Create 10 particles
    for (let i = 0; i < 10; i++) {
        const particle = {
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5 - 2,
            size: 2 + Math.random() * 3,
            color: color,
            life: 30 + Math.random() * 30
        };
        
        window.gameState.particles.push(particle);
    }
}

// Update particles
function updateParticles() {
    for (let i = window.gameState.particles.length - 1; i >= 0; i--) {
        const particle = window.gameState.particles[i];
        
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        // Apply gravity
        particle.vy += 0.1;
        
        // Reduce life
        particle.life--;
        
        // Remove dead particles
        if (particle.life <= 0) {
            window.gameState.particles.splice(i, 1);
        }
    }
}

// Draw particles
function drawParticles() {
    for (const particle of window.gameState.particles) {
        // Calculate screen position
        const screenX = (particle.x - window.gameState.camera.x) * window.gameState.zoom;
        const screenY = (particle.y - window.gameState.camera.y) * window.gameState.zoom;
        
        // Draw particle
        window.gameState.ctx.fillStyle = particle.color;
        window.gameState.ctx.globalAlpha = particle.life / 60; // Fade out as life decreases
        window.gameState.ctx.fillRect(screenX, screenY, particle.size * window.gameState.zoom, particle.size * window.gameState.zoom);
        window.gameState.ctx.globalAlpha = 1;
    }
}

// Save game
function saveGame() {
    // Create save data object
    const saveData = {
        player: {
            x: window.gameState.player.x,
            y: window.gameState.player.y,
            health: window.gameState.player.health
        },
        inventory: window.gameState.inventory,
        score: window.gameState.score,
        worldSeed: window.gameState.worldSeed
    };
    
    // Convert to JSON and save to localStorage
    localStorage.setItem('antGameSave', JSON.stringify(saveData));
    
    // Show save message
    showMessage('Game saved!');
}

// Load game
function loadGame() {
    // Get save data from localStorage
    const saveDataJson = localStorage.getItem('antGameSave');
    
    if (saveDataJson) {
        // Parse save data
        const saveData = JSON.parse(saveDataJson);
        
        // Restore player position and health
        window.gameState.player.x = saveData.player.x;
        window.gameState.player.y = saveData.player.y;
        window.gameState.player.health = saveData.player.health;
        
        // Restore inventory and score
        window.gameState.inventory = saveData.inventory;
        window.gameState.score = saveData.score;
        
        // Restore world seed
        window.gameState.worldSeed = saveData.worldSeed;
        
        // Regenerate world with the same seed
        initializeWorld();
        
        // Update camera
        updateCamera();
        
        // Show load message
        showMessage('Game loaded!');
    } else {
        // Show error message
        showMessage('No save data found!');
    }
}

// Show message
function showMessage(text) {
    const messageElement = document.createElement('div');
    messageElement.className = 'game-message';
    messageElement.textContent = text;
    
    document.body.appendChild(messageElement);
    
    // Remove message after 3 seconds
    setTimeout(() => {
        messageElement.classList.add('fade-out');
        setTimeout(() => {
            document.body.removeChild(messageElement);
        }, 1000);
    }, 2000);
}

// Update camera to follow player
function updateCamera() {
    // Center camera on player
    window.gameState.camera.x = window.gameState.player.x + window.gameState.player.width / 2 - window.gameState.canvas.width / window.gameState.zoom / 2;
    window.gameState.camera.y = window.gameState.player.y + window.gameState.player.height / 2 - window.gameState.canvas.height / window.gameState.zoom / 2;
    
    // Clamp camera to world bounds
    window.gameState.camera.x = Math.max(0, Math.min(window.gameState.camera.x, WORLD_WIDTH * TILE_SIZE - window.gameState.canvas.width / window.gameState.zoom));
    window.gameState.camera.y = Math.max(0, Math.min(window.gameState.camera.y, WORLD_HEIGHT * TILE_SIZE - window.gameState.canvas.height / window.gameState.zoom));
}

// Place player safely above the terrain
function placePlayerSafely() {
    // Find a relatively flat area for the player
    let spawnX = Math.floor(WORLD_WIDTH / 2);
    
    // Get terrain height at spawn position
    const terrainHeight = window.gameState.terrainHeights[spawnX] || 0;
    
    // Set player position
    window.gameState.player.x = spawnX * TILE_SIZE;
    window.gameState.player.y = (terrainHeight - 2) * TILE_SIZE; // Place player 2 tiles above the surface
    
    // Center camera on player
    window.gameState.camera.x = window.gameState.player.x - window.gameState.canvas.width / 2;
    window.gameState.camera.y = window.gameState.player.y - window.gameState.canvas.height / 2;
}

// Add to inventory
function addToInventory(tileType) {
    // Convert tile type to inventory item name
    let itemName;
    switch (tileType) {
        case TILE_TYPES.DIRT:
            itemName = 'dirt';
            break;
        case TILE_TYPES.STONE:
            itemName = 'stone';
            break;
        case TILE_TYPES.GRASS:
            itemName = 'grass';
            break;
        case TILE_TYPES.SAND:
            itemName = 'sand';
            break;
        case TILE_TYPES.COAL:
            itemName = 'coal';
            break;
        case TILE_TYPES.IRON:
            itemName = 'iron';
            break;
        case TILE_TYPES.GOLD:
            itemName = 'gold';
            break;
        case TILE_TYPES.DIAMOND:
            itemName = 'diamond';
            break;
        default:
            itemName = 'unknown';
    }
    
    // Add to inventory
    window.gameState.inventory[itemName] = (window.gameState.inventory[itemName] || 0) + 1;
    
    // Update score based on item value
    if (tileType === TILE_TYPES.COAL) {
        window.gameState.score += 5;
    } else if (tileType === TILE_TYPES.IRON) {
        window.gameState.score += 10;
    } else if (tileType === TILE_TYPES.GOLD) {
        window.gameState.score += 25;
    } else if (tileType === TILE_TYPES.DIAMOND) {
        window.gameState.score += 100;
    } else {
        window.gameState.score += 1;
    }
} 