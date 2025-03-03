// Generate world
function generateWorld() {
    // Reset world data
    gameState.world = {};
    gameState.loadedChunks = new Set();
    gameState.terrainHeights = [];
    gameState.worldSeed = Math.floor(Math.random() * 1000000);
    gameState.hasUnsavedChanges = true;
    
    // Initialize biome data
    initializeBiomes();
    
    // Generate terrain heights for the entire world
    generateTerrainHeights();
    
    // We'll only generate chunks as needed, not the entire world at once
    // This makes it possible to have a huge world without performance issues
    
    // Place player above the surface at a safe location
    placePlayerSafely();
    
    // Add some enemies on the surface near the player
    spawnEnemies();
}

// Initialize biome data
function initializeBiomes() {
    // Define biome types with expanded properties
    const biomeTypes = {
        [BIOME_TYPES.PLAINS]: {
            name: 'Plains',
            noiseThreshold: 0.3,
            heightModifier: 0,
            mapColor: '#7CFC00', // Light green
            features: {
                trees: {
                    frequency: 0.05,
                    minHeight: 3,
                    maxHeight: 6,
                    types: {
                        oak: 0.8,
                        birch: 0.2
                    }
                },
                bushes: {
                    frequency: 0.1
                },
                flowers: {
                    frequency: 0.15
                },
                tallGrass: {
                    frequency: 0.3
                }
            }
        },
        [BIOME_TYPES.FOREST]: {
            name: 'Forest',
            noiseThreshold: 0.6,
            heightModifier: 5,
            mapColor: '#228B22', // Forest green
            features: {
                trees: {
                    frequency: 0.3,
                    minHeight: 4,
                    maxHeight: 8,
                    types: {
                        oak: 0.6,
                        birch: 0.3,
                        pine: 0.1
                    }
                },
                bushes: {
                    frequency: 0.15
                },
                tallGrass: {
                    frequency: 0.2
                },
                mushrooms: {
                    frequency: 0.1
                }
            }
        },
        [BIOME_TYPES.DESERT]: {
            name: 'Desert',
            noiseThreshold: 0.8,
            heightModifier: -5,
            mapColor: '#F0E68C', // Khaki
            features: {
                cacti: {
                    frequency: 0.1
                }
            }
        },
        [BIOME_TYPES.MOUNTAINS]: {
            name: 'Mountains',
            noiseThreshold: 1.0,
            heightModifier: 20,
            mapColor: '#A0A0A0', // Gray
            features: {
                trees: {
                    frequency: 0.1,
                    minHeight: 3,
                    maxHeight: 6,
                    types: {
                        pine: 0.8,
                        oak: 0.2
                    }
                },
                snow: {
                    frequency: 0.3
                }
            }
        }
    };
    
    // Store biome types in gameState for later use
    gameState.biomeTypes = biomeTypes;
    
    return biomeTypes;
}

// Generate biome map for the entire world
function generateBiomeMap() {
    const biomeTypes = gameState.biomeTypes || initializeBiomes();
    const biomeMap = {};
    
    // Create noise generators
    const biomeNoise = new SimplexNoise();
    const biomeVariationNoise = new SimplexNoise(); // Secondary noise for variation
    
    // Generate biome for each x coordinate
    for (let x = 0; x < WORLD_WIDTH; x++) {
        // Get noise value for this x coordinate (scaled down for smoother transitions)
        const noiseValue = (biomeNoise.noise2D(x / 500, 0) + 1) / 2;
        const variationValue = (biomeVariationNoise.noise2D(x / 200, 0) + 1) / 2;
        
        // Determine biome based on noise value
        let selectedBiome = null;
        let prevThreshold = 0;
        
        for (const biomeType in biomeTypes) {
            if (noiseValue >= prevThreshold && noiseValue < biomeTypes[biomeType].noiseThreshold) {
                selectedBiome = biomeTypes[biomeType];
                break;
            }
            prevThreshold = biomeTypes[biomeType].noiseThreshold;
        }
        
        // Default to plains if no biome selected
        if (!selectedBiome) {
            selectedBiome = biomeTypes[BIOME_TYPES.PLAINS];
        }
        
        // Store biome for this x coordinate
        biomeMap[x] = {
            ...selectedBiome,
            variation: variationValue,
            blendFactor: 0 // For biome blending (future enhancement)
        };
    }
    
    gameState.biomeMap = biomeMap;
    return biomeMap;
}

// Generate terrain heights for the entire world
function generateTerrainHeights() {
    // Initialize terrainHeights array
    gameState.terrainHeights = new Array(WORLD_WIDTH);
    
    // Base surface level
    const baseSurfaceLevel = Math.floor(WORLD_HEIGHT / 3);
    
    // Create noise generators
    const mainNoise = new PerlinNoise(gameState.worldSeed);
    const detailNoise = new PerlinNoise(gameState.worldSeed + 1);
    
    // Generate heights using multiple layers of noise
    for (let x = 0; x < WORLD_WIDTH; x++) {
        // Get biome at this x position
        const biome = gameState.biomeMap[x];
        
        // Use multiple noise octaves for more natural terrain
        const mainScale = 0.01;
        const detailScale = 0.05;
        
        // Main terrain shape
        const mainValue = mainNoise.noise(x * mainScale, 0);
        
        // Detail variations
        const detailValue = detailNoise.noise(x * detailScale, 0) * 0.3;
        
        // Combine noise values
        const combinedNoise = mainValue + detailValue;
        
        // Apply biome-specific height variation
        const heightVariation = biome.heightModifier;
        
        // Calculate final height
        gameState.terrainHeights[x] = Math.floor(baseSurfaceLevel + combinedNoise * heightVariation);
    }
    
    // Add special terrain features
    addTerrainFeatures();
}

// Add special terrain features like mountains, valleys, etc.
function addTerrainFeatures() {
    const random = new SeededRandom(gameState.worldSeed + 4);
    
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

// Get or generate a chunk
function getOrGenerateChunk(chunkKey) {
    if (!gameState.chunks[chunkKey]) {
        const [chunkX, chunkY] = chunkKey.split(',').map(Number);
        generateChunk(chunkX, chunkY);
    }
    return gameState.chunks[chunkKey];
}

// Get a chunk by coordinates
function getChunk(chunkX, chunkY) {
    const chunkKey = `${chunkX},${chunkY}`;
    return getOrGenerateChunk(chunkKey);
}

// Deterministic random number generator
function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

// Get a deterministic random number based on world seed, x, y coordinates
function getRandomForPosition(worldSeed, x, y) {
    const combinedSeed = worldSeed + (x * 374761393) + (y * 668265263);
    return seededRandom(combinedSeed);
}

// Generate chunk with deterministic randomness
function generateChunk(chunkX, chunkY) {
    const chunkKey = `${chunkX},${chunkY}`;
    
    // If chunk already exists, return it
    if (gameState.chunks[chunkKey]) {
        return gameState.chunks[chunkKey];
    }
    
    // In multiplayer mode, we should request chunks from the server instead of generating locally
    if (gameState.isMultiplayer && typeof window.requestChunk === 'function') {
        window.requestChunk(chunkX, chunkY);
        
        // Create an empty chunk as a placeholder until server data arrives
        const emptyChunk = [];
        for (let y = 0; y < CHUNK_SIZE; y++) {
            emptyChunk[y] = [];
            for (let x = 0; x < CHUNK_SIZE; x++) {
                emptyChunk[y][x] = TILE_TYPES.AIR;
            }
        }
        
        // Store the empty chunk
        gameState.chunks[chunkKey] = emptyChunk;
        return emptyChunk;
    }
    
    // Create a new chunk
    const chunk = [];
    for (let y = 0; y < CHUNK_SIZE; y++) {
        chunk[y] = [];
        for (let x = 0; x < CHUNK_SIZE; x++) {
            // Calculate world coordinates
            const worldX = chunkX * CHUNK_SIZE + x;
            const worldY = chunkY * CHUNK_SIZE + y;
            
            // Skip if outside world bounds
            if (worldX < 0 || worldX >= WORLD_WIDTH) {
                chunk[y][x] = TILE_TYPES.AIR;
                continue;
            }
            
            // Get terrain height at this x position
            const terrainHeight = getTerrainHeight(worldX);
            
            // Get biome at this x position
            const biome = gameState.biomeMap[worldX];
            
            // Determine tile type based on position and biome
            let tileType = TILE_TYPES.AIR;
            
            // Above ground
            if (worldY < terrainHeight) {
                // Check for biome features (trees, bushes, etc.)
                if (worldY === terrainHeight - 1) {
                    // Surface level - check for trees, bushes, etc.
                    if (biome) {
                        // Use deterministic random for feature generation
                        const featureRand = getRandomForPosition(gameState.worldSeed, worldX, worldY);
                        
                        // Check for trees
                        if (biome.features && biome.features.trees && featureRand < biome.features.trees.frequency) {
                            // Generate a tree
                            generateTreeWithSeed(chunk, x, y, worldX, worldY, biome, gameState.worldSeed);
                            continue;
                        }
                        
                        // Adjust rand for next feature check
                        const bushRand = getRandomForPosition(gameState.worldSeed, worldX, worldY + 100);
                        
                        // Check for bushes
                        if (biome.features && biome.features.bushes && bushRand < biome.features.bushes.frequency) {
                            chunk[y][x] = TILE_TYPES.BUSH;
                            continue;
                        }
                        
                        // Adjust rand for next feature check
                        const flowerRand = getRandomForPosition(gameState.worldSeed, worldX, worldY + 200);
                        
                        // Check for flowers
                        if (biome.features && biome.features.flowers && flowerRand < biome.features.flowers.frequency) {
                            chunk[y][x] = TILE_TYPES.FLOWER;
                            continue;
                        }
                        
                        // Adjust rand for next feature check
                        const grassRand = getRandomForPosition(gameState.worldSeed, worldX, worldY + 300);
                        
                        // Check for tall grass
                        if (biome.features && biome.features.tallGrass && grassRand < biome.features.tallGrass.frequency) {
                            chunk[y][x] = TILE_TYPES.TALL_GRASS;
                            continue;
                        }
                        
                        // Adjust rand for next feature check
                        const cactiRand = getRandomForPosition(gameState.worldSeed, worldX, worldY + 400);
                        
                        // Check for cacti
                        if (biome.features && biome.features.cacti && cactiRand < biome.features.cacti.frequency) {
                            chunk[y][x] = TILE_TYPES.CACTUS;
                            continue;
                        }
                        
                        // Adjust rand for next feature check
                        const mushroomRand = getRandomForPosition(gameState.worldSeed, worldX, worldY + 500);
                        
                        // Check for mushrooms
                        if (biome.features && biome.features.mushrooms && mushroomRand < biome.features.mushrooms.frequency) {
                            chunk[y][x] = TILE_TYPES.MUSHROOM;
                            continue;
                        }
                        
                        // Adjust rand for next feature check
                        const snowRand = getRandomForPosition(gameState.worldSeed, worldX, worldY + 600);
                        
                        // Check for snow
                        if (biome.features && biome.features.snow && snowRand < biome.features.snow.frequency) {
                            chunk[y][x] = TILE_TYPES.SNOW;
                            continue;
                        }
                    }
                }
                
                tileType = TILE_TYPES.AIR;
            }
            // Ground level
            else if (worldY === terrainHeight) {
                // Set surface block based on biome
                if (biome) {
                    switch (biome.name) {
                        case 'Plains':
                        case 'Forest':
                            tileType = TILE_TYPES.GRASS;
                            break;
                        case 'Desert':
                            tileType = TILE_TYPES.SAND;
                            break;
                        case 'Mountains':
                            tileType = worldY > terrainHeight - 5 ? TILE_TYPES.STONE : TILE_TYPES.GRASS;
                            break;
                        default:
                            tileType = TILE_TYPES.GRASS;
                    }
                } else {
                    tileType = TILE_TYPES.GRASS;
                }
            }
            // Underground
            else {
                // Bedrock at the bottom of the world
                if (worldY >= WORLD_HEIGHT - 5) {
                    tileType = TILE_TYPES.BEDROCK;
                }
                // Stone layer
                else if (worldY > terrainHeight + 3) {
                    // Default to stone for most underground blocks
                    tileType = TILE_TYPES.STONE;
                    
                    // Calculate depth from surface
                    const depth = worldY - terrainHeight;
                    
                    // Generate caves - use deterministic noise
                    const caveNoiseValue = generateCaveNoise(worldX, worldY, gameState.worldSeed);
                    if (caveNoiseValue > 0.78) {
                        tileType = TILE_TYPES.AIR;
                    } 
                    // Create occasional dirt pockets in the stone layer
                    else {
                        const dirtRand = getRandomForPosition(gameState.worldSeed, worldX, worldY + 700);
                        if (depth < 20 && dirtRand < 0.15) {
                            tileType = TILE_TYPES.DIRT;
                        }
                        // Create occasional small water pockets deeper down
                        else if (depth > 40 && caveNoiseValue > 0.75 && caveNoiseValue <= 0.78) {
                            const waterRand = getRandomForPosition(gameState.worldSeed, worldX, worldY + 800);
                            if (waterRand < 0.2) {
                                tileType = TILE_TYPES.WATER;
                            }
                        }
                    }
                    
                    // Generate ores with deterministic randomness
                    if (tileType === TILE_TYPES.STONE) {
                        const oreType = generateOre(worldX, worldY, terrainHeight, gameState.worldSeed);
                        if (oreType !== TILE_TYPES.STONE) {
                            tileType = oreType;
                        }
                    }
                }
                // Dirt layer near surface
                else {
                    // Mostly dirt with occasional stone
                    const stoneRand = getRandomForPosition(gameState.worldSeed, worldX, worldY + 900);
                    if (stoneRand < 0.85) {
                        tileType = TILE_TYPES.DIRT;
                    } else {
                        tileType = TILE_TYPES.STONE;
                    }
                    
                    // Occasional small caves or tunnels near the surface
                    const surfaceCaveNoise = generateCaveNoise(worldX, worldY, gameState.worldSeed);
                    if (surfaceCaveNoise > 0.85) {
                        tileType = TILE_TYPES.AIR;
                    }
                }
            }
            
            chunk[y][x] = tileType;
        }
    }
    
    // Store the chunk
    gameState.chunks[chunkKey] = chunk;
    
    return chunk;
}

// Generate a tree with deterministic randomness
function generateTreeWithSeed(chunk, localX, localY, worldX, worldY, biome, worldSeed) {
    // Determine tree height based on biome and seed
    let minHeight = 4;
    let maxHeight = 7;
    
    if (biome.features && biome.features.trees) {
        minHeight = biome.features.trees.minHeight || minHeight;
        maxHeight = biome.features.trees.maxHeight || maxHeight;
    }
    
    // Use deterministic random for tree height
    const heightRand = getRandomForPosition(worldSeed, worldX, worldY + 500);
    const treeHeight = Math.floor(minHeight + heightRand * (maxHeight - minHeight + 1));
    
    // Generate tree trunk
    for (let h = 0; h < treeHeight; h++) {
        // Skip if outside chunk bounds
        if (localY - h < 0) continue;
        
        chunk[localY - h][localX] = TILE_TYPES.WOOD;
    }
    
    // Generate tree leaves
    const leafStartHeight = Math.floor(treeHeight * 0.6);
    const leafRadius = Math.floor(treeHeight * 0.4) + 1;
    
    for (let h = leafStartHeight; h < treeHeight + 2; h++) {
        // Skip if outside chunk bounds
        if (localY - h < 0) continue;
        
        const layerRadius = h === treeHeight + 1 ? 1 : leafRadius;
        
        for (let lx = -layerRadius; lx <= layerRadius; lx++) {
            for (let ly = -layerRadius; ly <= layerRadius; ly++) {
                // Skip trunk position
                if (lx === 0 && ly === 0 && h < treeHeight) continue;
                
                // Calculate distance from trunk
                const distance = Math.sqrt(lx * lx + ly * ly);
                
                // Skip if too far from trunk
                if (distance > layerRadius) continue;
                
                // Skip if outside chunk bounds
                if (localX + lx < 0 || localX + lx >= CHUNK_SIZE || 
                    localY - h + ly < 0 || localY - h + ly >= CHUNK_SIZE) continue;
                
                // Skip if not air (don't overwrite existing blocks)
                if (chunk[localY - h + ly][localX + lx] !== TILE_TYPES.AIR) continue;
                
                // Add leaf block
                chunk[localY - h + ly][localX + lx] = TILE_TYPES.LEAVES;
            }
        }
    }
}

// Generate ore based on depth with deterministic randomness
function generateOre(worldX, worldY, terrainHeight, worldSeed) {
    const depth = worldY - terrainHeight;
    
    // Different ore types have different spawn rates based on depth
    if (depth > 80) {
        // Deep underground - chance for diamond
        const rand = getRandomForPosition(worldSeed, worldX, worldY);
        if (rand < 0.02) {
            return TILE_TYPES.DIAMOND;
        } else if (rand < 0.1) {
            return TILE_TYPES.GOLD;
        } else if (rand < 0.25) {
            return TILE_TYPES.IRON;
        } else if (rand < 0.4) {
            return TILE_TYPES.COAL;
        }
    } else if (depth > 50) {
        // Mid-deep - gold and iron
        const rand = getRandomForPosition(worldSeed, worldX, worldY);
        if (rand < 0.08) {
            return TILE_TYPES.GOLD;
        } else if (rand < 0.25) {
            return TILE_TYPES.IRON;
        } else if (rand < 0.4) {
            return TILE_TYPES.COAL;
        }
    } else if (depth > 20) {
        // Mid-level - mostly iron and coal
        const rand = getRandomForPosition(worldSeed, worldX, worldY);
        if (rand < 0.2) {
            return TILE_TYPES.IRON;
        } else if (rand < 0.4) {
            return TILE_TYPES.COAL;
        }
    } else {
        // Near surface - mostly coal
        const rand = getRandomForPosition(worldSeed, worldX, worldY);
        if (rand < 0.15) {
            return TILE_TYPES.COAL;
        }
    }
    
    return TILE_TYPES.STONE;
}

// Generate cave noise with deterministic randomness
function generateCaveNoise(x, y, seed) {
    // Use a simple but deterministic noise function
    const noiseX = seededRandom(seed + x * 0.1);
    const noiseY = seededRandom(seed + y * 0.1);
    const noise = seededRandom(seed + noiseX * 10000 + noiseY * 1000);
    
    // Add some variation based on position
    const variation = (Math.sin(x * 0.1) + Math.cos(y * 0.1)) * 0.1;
    
    return noise + variation;
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

// Perlin Noise implementation for smoother terrain
class PerlinNoise {
    constructor(seed) {
        this.seed = seed;
        this.random = new SeededRandom(seed);
        this.permutation = this.generatePermutation();
    }
    
    generatePermutation() {
        const p = new Array(512);
        for (let i = 0; i < 256; i++) {
            p[i] = Math.floor(this.random.next() * 256);
        }
        // Duplicate to avoid buffer overflow
        for (let i = 0; i < 256; i++) {
            p[i + 256] = p[i];
        }
        return p;
    }
    
    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
    
    lerp(a, b, t) {
        return a + t * (b - a);
    }
    
    grad(hash, x, y) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : x;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
    
    noise(x, y) {
        // Find unit grid cell containing point
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        
        // Get relative coords of point within cell
        x -= Math.floor(x);
        y -= Math.floor(y);
        
        // Compute fade curves
        const u = this.fade(x);
        const v = this.fade(y);
        
        // Hash coordinates of the 4 square corners
        const A = this.permutation[X] + Y;
        const AA = this.permutation[A];
        const AB = this.permutation[A + 1];
        const B = this.permutation[X + 1] + Y;
        const BA = this.permutation[B];
        const BB = this.permutation[B + 1];
        
        // Add blended results from 4 corners of square
        const result = this.lerp(
            this.lerp(this.grad(this.permutation[AA], x, y), 
                     this.grad(this.permutation[BA], x - 1, y), u),
            this.lerp(this.grad(this.permutation[AB], x, y - 1), 
                     this.grad(this.permutation[BB], x - 1, y - 1), u),
            v
        );
        
        // Scale to 0-1
        return (result + 1) / 2;
    }
}

// Get terrain height at a specific x position
function getTerrainHeight(x) {
    // If terrain height is already calculated, return it
    if (gameState.terrainHeights[x] !== undefined) {
        return gameState.terrainHeights[x];
    }
    
    // Otherwise, calculate it
    // Base surface level
    const baseSurfaceLevel = Math.floor(WORLD_HEIGHT / 3);
    
    // Create noise generators
    const mainNoise = new SimplexNoise(gameState.worldSeed);
    const detailNoise = new SimplexNoise(gameState.worldSeed + 1);
    
    // Use multiple noise octaves for more natural terrain
    const mainScale = 0.01;
    const detailScale = 0.05;
    
    // Main terrain shape
    const mainValue = (mainNoise.noise2D(x * mainScale, 0) + 1) / 2;
    
    // Detail variations
    const detailValue = (detailNoise.noise2D(x * detailScale, 0) + 1) / 2 * 0.3;
    
    // Combine noise values
    const combinedNoise = mainValue + detailValue;
    
    // Get biome at this x position
    const biome = gameState.biomeMap[x];
    
    // Apply biome-specific height modifier
    const heightModifier = biome ? biome.heightModifier : 0;
    
    // Calculate final height
    const terrainHeight = Math.floor(baseSurfaceLevel + combinedNoise * 30 + heightModifier);
    
    // Store and return
    gameState.terrainHeights[x] = terrainHeight;
    return terrainHeight;
} 