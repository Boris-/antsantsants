// Initialize game state
function initializeGameState() {
    // Create canvas
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Initialize game state object
    gameState = {
        canvas: canvas,
        ctx: ctx,
        chunks: {},
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
            flash: false
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
        }
    };
    
    // Initialize world
    initializeWorld();
    
    // Place player at spawn point
    spawnPlayer();
    
    // Set up event listeners
    setupEventListeners();
    
    // Start game loop
    gameLoop();
}

// Initialize world
function initializeWorld() {
    // Initialize biomes first - this will store biomeTypes in gameState
    const biomeTypes = initializeBiomes();
    
    // Generate biome map using the initialized biome types
    gameState.biomeMap = generateBiomeMap();
    
    // Generate terrain heights for the entire world (now that biomes are available)
    generateTerrainHeights();
    
    // Generate initial chunks around player
    generateInitialChunks();
}

// Generate initial chunks around player
function generateInitialChunks() {
    // Calculate player chunk
    const playerChunkX = Math.floor(gameState.player.x / (CHUNK_SIZE * TILE_SIZE));
    const playerChunkY = Math.floor(gameState.player.y / (CHUNK_SIZE * TILE_SIZE));
    
    // Generate chunks in a 5x5 area around player
    const renderDistance = 2;
    
    for (let y = playerChunkY - renderDistance; y <= playerChunkY + renderDistance; y++) {
        for (let x = playerChunkX - renderDistance; x <= playerChunkX + renderDistance; x++) {
            generateChunk(x, y);
        }
    }
}

// Spawn player at a suitable location
function spawnPlayer() {
    // Find a suitable spawn point (on grass)
    let spawnX = Math.floor(WORLD_WIDTH / 2);
    
    // Get terrain height at spawn X
    const terrainHeight = getTerrainHeight(spawnX);
    
    // Set player position
    gameState.player.x = spawnX * TILE_SIZE;
    gameState.player.y = (terrainHeight - 2) * TILE_SIZE; // Place player 2 blocks above terrain
    
    // Center camera on player
    updateCamera();
}

// Set up event listeners
function setupEventListeners() {
    // Keyboard events
    window.addEventListener('keydown', (e) => {
        gameState.keys[e.key] = true;
        
        // Toggle debug options
        if (e.key === 'f') {
            gameState.debug.showFPS = !gameState.debug.showFPS;
        }
        if (e.key === 'c') {
            gameState.debug.showChunkBorders = !gameState.debug.showChunkBorders;
        }
        if (e.key === 'g') {
            gameState.debug.godMode = !gameState.debug.godMode;
            if (gameState.debug.godMode) {
                gameState.player.health = gameState.player.maxHealth;
            }
        }
        
        // Zoom controls
        if (e.key === '=' || e.key === '+') {
            gameState.zoom = Math.min(2, gameState.zoom + 0.1);
        }
        if (e.key === '-' || e.key === '_') {
            gameState.zoom = Math.max(0.5, gameState.zoom - 0.1);
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
        gameState.keys[e.key] = false;
    });
    
    // Mouse events
    gameState.canvas.addEventListener('mousemove', (e) => {
        gameState.mouse.x = e.clientX;
        gameState.mouse.y = e.clientY;
    });
    
    gameState.canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            gameState.mouse.leftPressed = true;
        }
    });
    
    gameState.canvas.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            gameState.mouse.leftPressed = false;
        }
    });
    
    // Window resize
    window.addEventListener('resize', () => {
        gameState.canvas.width = window.innerWidth;
        gameState.canvas.height = window.innerHeight;
    });
}

// Play a sound
function playSound(soundName) {
    if (gameState.sounds[soundName]) {
        try {
            // Clone the audio to allow overlapping sounds
            const sound = gameState.sounds[soundName].cloneNode();
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
        
        gameState.particles.push(particle);
    }
}

// Update particles
function updateParticles() {
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
        const particle = gameState.particles[i];
        
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        // Apply gravity
        particle.vy += 0.1;
        
        // Reduce life
        particle.life--;
        
        // Remove dead particles
        if (particle.life <= 0) {
            gameState.particles.splice(i, 1);
        }
    }
}

// Draw particles
function drawParticles() {
    for (const particle of gameState.particles) {
        // Calculate screen position
        const screenX = (particle.x - gameState.camera.x) * gameState.zoom;
        const screenY = (particle.y - gameState.camera.y) * gameState.zoom;
        
        // Draw particle
        gameState.ctx.fillStyle = particle.color;
        gameState.ctx.globalAlpha = particle.life / 60; // Fade out as life decreases
        gameState.ctx.fillRect(screenX, screenY, particle.size * gameState.zoom, particle.size * gameState.zoom);
        gameState.ctx.globalAlpha = 1;
    }
}

// Save game
function saveGame() {
    // Create save data object
    const saveData = {
        player: {
            x: gameState.player.x,
            y: gameState.player.y,
            health: gameState.player.health
        },
        inventory: gameState.inventory,
        score: gameState.score,
        worldSeed: gameState.worldSeed
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
        gameState.player.x = saveData.player.x;
        gameState.player.y = saveData.player.y;
        gameState.player.health = saveData.player.health;
        
        // Restore inventory and score
        gameState.inventory = saveData.inventory;
        gameState.score = saveData.score;
        
        // Restore world seed
        gameState.worldSeed = saveData.worldSeed;
        
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
    gameState.camera.x = gameState.player.x + gameState.player.width / 2 - gameState.canvas.width / gameState.zoom / 2;
    gameState.camera.y = gameState.player.y + gameState.player.height / 2 - gameState.canvas.height / gameState.zoom / 2;
    
    // Clamp camera to world bounds
    gameState.camera.x = Math.max(0, Math.min(gameState.camera.x, WORLD_WIDTH * TILE_SIZE - gameState.canvas.width / gameState.zoom));
    gameState.camera.y = Math.max(0, Math.min(gameState.camera.y, WORLD_HEIGHT * TILE_SIZE - gameState.canvas.height / gameState.zoom));
} 