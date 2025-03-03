// Server-side world generation module
// Remove SimplexNoise dependency
// const SimplexNoise = require('simplex-noise');

// Constants (copied from client constants.js)
const TILE_SIZE = 32;
const CHUNK_SIZE = 16;
const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;

// Tile types
const TILE_TYPES = {
    AIR: 0,
    DIRT: 1,
    STONE: 2,
    GRASS: 3,
    SAND: 4,
    ORE: 5,
    BEDROCK: 6,
    COAL: 7,      // Ore type
    IRON: 8,      // Ore type
    GOLD: 9,      // Ore type
    DIAMOND: 10,  // Ore type
    WOOD: 11,     // Tree trunk
    LEAVES: 12,   // Tree leaves
    BUSH: 13,     // Bush/shrub
    FLOWER: 14,   // Decorative flower
    TALL_GRASS: 15, // Tall grass
    CACTUS: 16,   // Desert cactus
    SNOW: 17,     // Snow block
    MUSHROOM: 18, // Forest mushroom
    WATER: 19     // Water block
};

// Biome types
const BIOME_TYPES = {
    PLAINS: 'Plains',
    FOREST: 'Forest',
    DESERT: 'Desert',
    MOUNTAINS: 'Mountains'
};

// Initialize biome data
function initializeBiomes(gameState) {
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
function generateBiomeMap(gameState) {
    const biomeTypes = gameState.biomeTypes || initializeBiomes(gameState);
    const biomeMap = {};
    
    // Create noise generators using our custom PerlinNoise instead of SimplexNoise
    const biomeNoise = new PerlinNoise(gameState.worldSeed);
    const biomeVariationNoise = new PerlinNoise(gameState.worldSeed + 1);
    
    // Generate biome for each x coordinate
    for (let x = 0; x < WORLD_WIDTH; x++) {
        // Get noise value for this x coordinate (scaled down for smoother transitions)
        const noiseValue = (biomeNoise.noise(x / 500, 0) + 1) / 2;
        const variationValue = (biomeVariationNoise.noise(x / 200, 0) + 1) / 2;
        
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
    
    return biomeMap;
}

// Generate terrain heights for the entire world
function generateTerrainHeights(gameState) {
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
    addTerrainFeatures(gameState);
    
    return gameState.terrainHeights;
}

// Add special terrain features like mountains, valleys, etc.
function addTerrainFeatures(gameState) {
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

// Generate a single chunk
function generateChunk(chunkX, chunkY, gameState) {
    const chunk = [];
    
    // Initialize chunk with air
    for (let y = 0; y < CHUNK_SIZE; y++) {
        chunk[y] = [];
        for (let x = 0; x < CHUNK_SIZE; x++) {
            const worldX = chunkX * CHUNK_SIZE + x;
            const worldY = chunkY * CHUNK_SIZE + y;
            
            // Default to air
            let tileType = TILE_TYPES.AIR;
            
            // If terrain heights are generated
            if (gameState.terrainHeights && gameState.terrainHeights.length > 0) {
                const terrainHeight = gameState.terrainHeights[worldX] || 0;
                
                if (worldY > terrainHeight + 20) {
                    // Deep underground - more chance of stone and ore
                    const rand = Math.random();
                    if (rand < 0.7) {
                        tileType = TILE_TYPES.STONE;
                    } else if (rand < 0.85) {
                        tileType = TILE_TYPES.DIRT;
                    } else {
                        // Generate different types of ore based on depth
                        tileType = generateOre(worldX, worldY, terrainHeight);
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
                    // Surface - grass or biome-specific block
                    const biome = getBiomeAt(worldX, gameState);
                    if (biome && biome.name === BIOME_TYPES.DESERT) {
                        tileType = TILE_TYPES.SAND;
                    } else if (biome && biome.name === BIOME_TYPES.MOUNTAINS && worldY < terrainHeight - 10) {
                        tileType = TILE_TYPES.SNOW;
                    } else {
                        tileType = TILE_TYPES.GRASS;
                    }
                } else {
                    // Above ground - air
                    tileType = TILE_TYPES.AIR;
                }
                
                // Bedrock at bottom of world
                if (worldY >= WORLD_HEIGHT - 5) {
                    tileType = TILE_TYPES.BEDROCK;
                }
                
                // Add caves
                if (tileType !== TILE_TYPES.AIR && tileType !== TILE_TYPES.BEDROCK) {
                    const caveNoise = generateCaveNoise(worldX, worldY, gameState.worldSeed);
                    if (caveNoise > 0.7 && worldY > terrainHeight + 5) {
                        tileType = TILE_TYPES.AIR;
                    }
                }
            }
            
            chunk[y][x] = tileType;
        }
    }
    
    // Add biome-specific features
    addBiomeFeatures(chunk, chunkX, chunkY, gameState);
    
    return chunk;
}

// Generate ore based on depth
function generateOre(worldX, worldY, terrainHeight) {
    const depth = worldY - terrainHeight;
    
    // Different ore types have different spawn rates based on depth
    if (depth > 80) {
        // Deep underground - chance for diamond
        const rand = Math.random();
        if (rand < 0.02) {
            return TILE_TYPES.DIAMOND;
        } else if (rand < 0.1) {
            return TILE_TYPES.GOLD;
        } else if (rand < 0.3) {
            return TILE_TYPES.IRON;
        } else if (rand < 0.5) {
            return TILE_TYPES.COAL;
        }
    } else if (depth > 50) {
        // Mid-deep - gold and iron
        const rand = Math.random();
        if (rand < 0.1) {
            return TILE_TYPES.GOLD;
        } else if (rand < 0.3) {
            return TILE_TYPES.IRON;
        } else if (rand < 0.5) {
            return TILE_TYPES.COAL;
        }
    } else if (depth > 30) {
        // Mid-level - mostly iron and coal
        const rand = Math.random();
        if (rand < 0.2) {
            return TILE_TYPES.IRON;
        } else if (rand < 0.5) {
            return TILE_TYPES.COAL;
        }
    } else {
        // Near surface - mostly coal
        const rand = Math.random();
        if (rand < 0.3) {
            return TILE_TYPES.COAL;
        }
    }
    
    return TILE_TYPES.STONE;
}

// Add biome-specific features to a chunk
function addBiomeFeatures(chunk, chunkX, chunkY, gameState) {
    // Loop through each column in the chunk
    for (let x = 0; x < CHUNK_SIZE; x++) {
        const worldX = chunkX * CHUNK_SIZE + x;
        const biome = getBiomeAt(worldX, gameState);
        
        if (!biome) continue;
        
        // Find the surface level for this column
        let surfaceY = -1;
        for (let y = 0; y < CHUNK_SIZE; y++) {
            const worldY = chunkY * CHUNK_SIZE + y;
            if (chunk[y][x] === TILE_TYPES.GRASS || chunk[y][x] === TILE_TYPES.SAND) {
                surfaceY = y;
                break;
            }
        }
        
        // Skip if no surface found in this chunk column
        if (surfaceY === -1) continue;
        
        // Add features based on biome
        if (biome.name === BIOME_TYPES.PLAINS || biome.name === BIOME_TYPES.FOREST) {
            // Add trees
            if (biome.features.trees && Math.random() < biome.features.trees.frequency) {
                generateTree(chunk, x, surfaceY, chunkX * CHUNK_SIZE + x, chunkY * CHUNK_SIZE + surfaceY, biome);
            }
            
            // Add tall grass
            if (biome.features.tallGrass && Math.random() < biome.features.tallGrass.frequency) {
                if (surfaceY > 0 && chunk[surfaceY-1][x] === TILE_TYPES.AIR) {
                    chunk[surfaceY-1][x] = TILE_TYPES.TALL_GRASS;
                }
            }
            
            // Add flowers
            if (biome.features.flowers && Math.random() < biome.features.flowers.frequency) {
                if (surfaceY > 0 && chunk[surfaceY-1][x] === TILE_TYPES.AIR) {
                    chunk[surfaceY-1][x] = TILE_TYPES.FLOWER;
                }
            }
        } else if (biome.name === BIOME_TYPES.DESERT) {
            // Add cacti
            if (biome.features.cacti && Math.random() < biome.features.cacti.frequency) {
                if (surfaceY > 0 && chunk[surfaceY-1][x] === TILE_TYPES.AIR) {
                    chunk[surfaceY-1][x] = TILE_TYPES.CACTUS;
                    if (surfaceY > 1 && chunk[surfaceY-2][x] === TILE_TYPES.AIR) {
                        chunk[surfaceY-2][x] = TILE_TYPES.CACTUS;
                    }
                }
            }
        }
    }
}

// Generate a tree at the specified location
function generateTree(chunk, localX, localY, worldX, worldY, biome) {
    // Determine tree height based on biome
    const minHeight = biome.features.trees.minHeight || 3;
    const maxHeight = biome.features.trees.maxHeight || 6;
    const treeHeight = minHeight + Math.floor(Math.random() * (maxHeight - minHeight + 1));
    
    // Check if tree can fit in the chunk
    if (localY - treeHeight < 0) return;
    
    // Create trunk
    for (let y = 1; y <= treeHeight; y++) {
        if (localY - y >= 0) {
            chunk[localY - y][localX] = TILE_TYPES.WOOD;
        }
    }
    
    // Create leaves
    const leafRadius = 2;
    for (let y = treeHeight - leafRadius; y >= treeHeight - (leafRadius * 2); y--) {
        if (localY - y < 0) continue;
        
        for (let lx = -leafRadius; lx <= leafRadius; lx++) {
            const leafX = localX + lx;
            if (leafX < 0 || leafX >= CHUNK_SIZE) continue;
            
            // Make leaves more dense near the trunk
            const distance = Math.abs(lx);
            if (distance <= leafRadius && Math.random() > distance / (leafRadius + 1)) {
                chunk[localY - y][leafX] = TILE_TYPES.LEAVES;
            }
        }
    }
}

// Generate cave noise
function generateCaveNoise(x, y, seed) {
    const caveNoise = new PerlinNoise(seed + 2);
    const scale = 0.05;
    return caveNoise.noise(x * scale, y * scale);
}

// Get biome at a specific x coordinate
function getBiomeAt(x, gameState) {
    return gameState.biomeMap[x] || null;
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

// Perlin noise generator
class PerlinNoise {
    constructor(seed) {
        this.seed = seed;
        this.permutation = this.generatePermutation();
    }
    
    generatePermutation() {
        const random = new SeededRandom(this.seed);
        const p = new Array(512);
        for (let i = 0; i < 256; i++) {
            p[i] = Math.floor(random.next() * 256);
        }
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
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        
        x -= Math.floor(x);
        y -= Math.floor(y);
        
        const u = this.fade(x);
        const v = this.fade(y);
        
        const a = this.permutation[X] + Y;
        const aa = this.permutation[a];
        const ab = this.permutation[a + 1];
        const b = this.permutation[X + 1] + Y;
        const ba = this.permutation[b];
        const bb = this.permutation[b + 1];
        
        return this.lerp(
            this.lerp(this.grad(this.permutation[aa], x, y), this.grad(this.permutation[ba], x - 1, y), u),
            this.lerp(this.grad(this.permutation[ab], x, y - 1), this.grad(this.permutation[bb], x - 1, y - 1), u),
            v
        );
    }
}

// Export functions for use in server.js
module.exports = {
    initializeBiomes,
    generateBiomeMap,
    generateTerrainHeights,
    generateChunk,
    TILE_TYPES,
    BIOME_TYPES
}; 