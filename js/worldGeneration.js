// Generate world
function generateWorld() {
    // Reset world data
    gameState.world = {};
    gameState.loadedChunks = new Set();
    gameState.terrainHeights = [];
    gameState.worldSeed = Math.floor(Math.random() * 1000000);
    gameState.hasUnsavedChanges = true;
    
    // Generate terrain heights for the entire world
    generateTerrainHeights();
    
    // We'll only generate chunks as needed, not the entire world at once
    // This makes it possible to have a huge world without performance issues
    
    // Place player above the surface at a safe location
    placePlayerSafely();
    
    // Add some enemies on the surface near the player
    spawnEnemies();
}

// Generate terrain heights for the entire world
function generateTerrainHeights() {
    // Base surface level
    const baseSurfaceLevel = Math.floor(WORLD_HEIGHT / 3);
    
    // Generate control points for the entire world
    const numControlPoints = Math.ceil(WORLD_WIDTH / 50); // One control point every 50 blocks
    const controlPoints = [];
    
    // Use the world seed for consistent terrain
    const random = new SeededRandom(gameState.worldSeed);
    
    for (let i = 0; i < numControlPoints; i++) {
        const x = Math.floor(i * WORLD_WIDTH / (numControlPoints - 1));
        // More variation for a more interesting world
        const height = baseSurfaceLevel + Math.floor(random.next() * 40) - 20;
        controlPoints.push({ x, height });
    }
    
    // Interpolate between control points for smooth terrain
    for (let x = 0; x < WORLD_WIDTH; x++) {
        // Find the two control points this x is between
        let leftPoint = controlPoints[0];
        let rightPoint = controlPoints[1];
        
        for (let i = 1; i < controlPoints.length; i++) {
            if (x >= controlPoints[i-1].x && x <= controlPoints[i].x) {
                leftPoint = controlPoints[i-1];
                rightPoint = controlPoints[i];
                break;
            }
        }
        
        // Interpolate between the two points
        let height;
        if (leftPoint.x === rightPoint.x) {
            height = leftPoint.height;
        } else {
            const t = (x - leftPoint.x) / (rightPoint.x - leftPoint.x);
            // Use cosine interpolation for smoother curves
            const ft = (1 - Math.cos(t * Math.PI)) / 2;
            height = Math.floor(leftPoint.height * (1 - ft) + rightPoint.height * ft);
        }
        
        // Add small noise for more natural terrain
        const noise = Math.floor(random.next() * 3) - 1;
        gameState.terrainHeights[x] = height + noise;
    }
    
    // Add special terrain features
    addTerrainFeatures();
}

// Add special terrain features like mountains, valleys, etc.
function addTerrainFeatures() {
    const random = new SeededRandom(gameState.worldSeed + 1); // Different seed for features
    
    // Add some mountains
    const numMountains = 5 + Math.floor(random.next() * 10);
    for (let i = 0; i < numMountains; i++) {
        const mountainCenter = Math.floor(random.next() * WORLD_WIDTH);
        const mountainWidth = 20 + Math.floor(random.next() * 40);
        const mountainHeight = 20 + Math.floor(random.next() * 30);
        
        // Create mountain shape
        for (let x = mountainCenter - mountainWidth; x <= mountainCenter + mountainWidth; x++) {
            if (x >= 0 && x < WORLD_WIDTH) {
                const distance = Math.abs(x - mountainCenter);
                const heightReduction = (distance / mountainWidth) * mountainHeight;
                const newHeight = gameState.terrainHeights[x] - mountainHeight + heightReduction;
                gameState.terrainHeights[x] = Math.min(gameState.terrainHeights[x], newHeight);
            }
        }
    }
    
    // Add some valleys/canyons
    const numValleys = 3 + Math.floor(random.next() * 7);
    for (let i = 0; i < numValleys; i++) {
        const valleyCenter = Math.floor(random.next() * WORLD_WIDTH);
        const valleyWidth = 15 + Math.floor(random.next() * 30);
        const valleyDepth = 15 + Math.floor(random.next() * 25);
        
        // Create valley shape
        for (let x = valleyCenter - valleyWidth; x <= valleyCenter + valleyWidth; x++) {
            if (x >= 0 && x < WORLD_WIDTH) {
                const distance = Math.abs(x - valleyCenter);
                const depthReduction = (distance / valleyWidth) * valleyDepth;
                const newHeight = gameState.terrainHeights[x] + valleyDepth - depthReduction;
                gameState.terrainHeights[x] = Math.max(gameState.terrainHeights[x], newHeight);
            }
        }
    }
}

// Place player safely above the terrain
function placePlayerSafely() {
    // Find a relatively flat area for the player
    let bestX = Math.floor(WORLD_WIDTH / 2);
    let minVariation = Infinity;
    
    // Look for flat areas by checking height variations
    for (let x = 5; x < WORLD_WIDTH - 5; x++) {
        let variation = 0;
        for (let i = -2; i <= 2; i++) {
            variation += Math.abs(gameState.terrainHeights[x + i] - gameState.terrainHeights[x]);
        }
        
        if (variation < minVariation) {
            minVariation = variation;
            bestX = x;
        }
    }
    
    // Place player above the surface at the chosen location
    const surfaceY = gameState.terrainHeights[bestX];
    gameState.player.x = bestX * TILE_SIZE;
    gameState.player.y = (surfaceY - 2) * TILE_SIZE;
    
    // Pre-generate chunks around the player for initial view
    preGenerateChunksAroundPlayer();
}

// Pre-generate chunks around the player for initial view
function preGenerateChunksAroundPlayer() {
    const playerChunkX = Math.floor(gameState.player.x / TILE_SIZE / CHUNK_SIZE);
    const playerChunkY = Math.floor(gameState.player.y / TILE_SIZE / CHUNK_SIZE);
    
    // Generate chunks in a radius around the player
    for (let y = playerChunkY - VISIBLE_CHUNKS_RADIUS; y <= playerChunkY + VISIBLE_CHUNKS_RADIUS; y++) {
        for (let x = playerChunkX - VISIBLE_CHUNKS_RADIUS; x <= playerChunkX + VISIBLE_CHUNKS_RADIUS; x++) {
            if (x >= 0 && x < Math.ceil(WORLD_WIDTH / CHUNK_SIZE) && 
                y >= 0 && y < Math.ceil(WORLD_HEIGHT / CHUNK_SIZE)) {
                const chunkKey = `${x},${y}`;
                getOrGenerateChunk(chunkKey);
            }
        }
    }
}

// Spawn enemies on the surface near the player
function spawnEnemies() {
    // Clear existing enemies
    gameState.enemies = [];
    
    // Add some enemies on the surface near the player
    const numEnemies = 5 + Math.floor(Math.random() * 3);
    const playerX = Math.floor(gameState.player.x / TILE_SIZE);
    
    for (let i = 0; i < numEnemies; i++) {
        // Find a suitable location on the surface near the player
        const offset = Math.floor(Math.random() * 40) - 20;
        const x = Math.max(0, Math.min(WORLD_WIDTH - 1, playerX + offset));
        const surfaceY = gameState.terrainHeights[x];
        
        gameState.enemies.push({
            x: x * TILE_SIZE,
            y: (surfaceY - 1) * TILE_SIZE,
            width: ENEMY_TYPES.BUG.width,
            height: ENEMY_TYPES.BUG.height,
            velocityX: Math.random() < 0.5 ? -ENEMY_TYPES.BUG.speed : ENEMY_TYPES.BUG.speed,
            velocityY: 0,
            health: ENEMY_TYPES.BUG.health,
            damage: ENEMY_TYPES.BUG.damage,
            type: 'BUG'
        });
    }
}

// Seeded random number generator
class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }
    
    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
} 