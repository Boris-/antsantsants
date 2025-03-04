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
    WATER: 19,     // Water block
    CLOUD: 20     // Cloud block
};

// Biome types
const BIOME_TYPES = {
    PLAINS: 'Plains',
    FOREST: 'Forest',
    DESERT: 'Desert',
    MOUNTAINS: 'Mountains',
    GRASSLAND: 'Grassland',  // New biome for ants
    WETLAND: 'Wetland'       // New biome for ants
};

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

// Initialize biome data
function initializeBiomes(gameState) {
    // Define biome types with expanded properties
    const biomeTypes = {
        [BIOME_TYPES.PLAINS]: {
            name: 'Plains',
            noiseThreshold: 0.3,
            heightModifier: 0,
            mapColor: '#7CFC00', // Light green
            soilDensity: 0.9,    // High soil density, fewer caves
            antFriendliness: 0.7, // Good for ants
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
            soilDensity: 0.85,   // Dense soil with some caves
            antFriendliness: 0.8, // Very good for ants
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
            soilDensity: 0.95,   // Very dense soil, minimal caves
            antFriendliness: 0.4, // Difficult for ants but possible
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
            soilDensity: 0.7,    // Less dense soil, more caves and tunnels
            antFriendliness: 0.5, // Moderate for ants
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
                },
                stone: {
                    frequency: 0.6  // More stone formations
                }
            }
        },
        [BIOME_TYPES.GRASSLAND]: {
            name: 'Grassland',
            noiseThreshold: 0.4,
            heightModifier: 2,
            mapColor: '#98FB98', // Pale green
            soilDensity: 0.88,   // Good soil density for ant tunneling
            antFriendliness: 0.9, // Excellent for ants
            features: {
                tallGrass: {
                    frequency: 0.5
                },
                flowers: {
                    frequency: 0.2
                },
                bushes: {
                    frequency: 0.05
                }
            }
        },
        [BIOME_TYPES.WETLAND]: {
            name: 'Wetland',
            noiseThreshold: 0.7,
            heightModifier: -2,
            mapColor: '#6B8E23', // Olive Drab
            soilDensity: 0.8,    // Moist soil, good for tunneling
            antFriendliness: 0.75, // Good for ants
            features: {
                water: {
                    frequency: 0.2
                },
                tallGrass: {
                    frequency: 0.4
                },
                mushrooms: {
                    frequency: 0.15
                }
            }
        }
    };
    
    // Store biome types in gameState for later use
    gameState.biomeTypes = biomeTypes;
    
    return biomeTypes;
}

// Generate biome map
function generateBiomeMap(gameState) {
    console.log('Generating biome map with seed:', gameState.worldSeed);
    
    const biomeMap = [];
    
    // Use 1D noise for biome generation to create larger, more coherent biomes
    // We'll use multiple noise scales to create more natural transitions
    
    // Biome size control - MUCH larger values for larger biomes
    const biomeScale = 0.0015; // Reduced from 0.005 for larger biomes
    
    // Create a biome noise array
    const biomeNoise = [];
    for (let x = 0; x < WORLD_WIDTH; x++) {
        // Generate multiple noise layers at different frequencies for more organic patterns
        const noiseX1 = seededRandom(gameState.worldSeed + x * biomeScale);
        const noiseX2 = seededRandom(gameState.worldSeed + 10000 + x * biomeScale * 0.5);
        const noiseX3 = seededRandom(gameState.worldSeed + 20000 + x * biomeScale * 0.2);
        
        // Combine noise values to create more interesting patterns
        // This gives a more organic, Minecraft-like biome distribution
        biomeNoise[x] = (noiseX1 * 0.6 + noiseX2 * 0.3 + noiseX3 * 0.1);
    }
    
    // Assign biomes based on noise value
    for (let x = 0; x < WORLD_WIDTH; x++) {
        const noise = biomeNoise[x];
        
        // Determine biome type based on noise value
        let biome;
        if (noise < 0.15) {
            biome = gameState.biomeTypes[BIOME_TYPES.DESERT];
        } else if (noise < 0.35) {
            biome = gameState.biomeTypes[BIOME_TYPES.PLAINS];
        } else if (noise < 0.50) {
            biome = gameState.biomeTypes[BIOME_TYPES.GRASSLAND];
        } else if (noise < 0.70) {
            biome = gameState.biomeTypes[BIOME_TYPES.FOREST];
        } else if (noise < 0.85) {
            biome = gameState.biomeTypes[BIOME_TYPES.WETLAND];
        } else {
            biome = gameState.biomeTypes[BIOME_TYPES.MOUNTAINS];
        }
        
        biomeMap[x] = biome;
    }
    
    // Smooth biome transitions
    smoothBiomeMap(biomeMap, gameState);
    
    return biomeMap;
}

// Smooth biome transitions
function smoothBiomeMap(biomeMap, gameState) {
    const smoothedMap = [...biomeMap];
    
    // Use a larger smoothing window for more gradual transitions
    const smoothingRadius = 30; // Increased from 10 for wider transition zones
    
    // First pass: identify transition points
    const transitionPoints = [];
    for (let x = 1; x < WORLD_WIDTH; x++) {
        if (biomeMap[x] !== biomeMap[x-1]) {
            transitionPoints.push(x);
        }
    }
    
    // Second pass: smooth transitions
    for (const transitionPoint of transitionPoints) {
        const leftBiome = biomeMap[Math.max(0, transitionPoint-1)];
        const rightBiome = biomeMap[Math.min(WORLD_WIDTH-1, transitionPoint)];
        
        // Create a gradual transition between biomes
        for (let i = -smoothingRadius; i <= smoothingRadius; i++) {
            const x = transitionPoint + i;
            
            // Skip if outside world bounds
            if (x < 0 || x >= WORLD_WIDTH) continue;
            
            // Calculate transition probability based on distance from transition point
            // Further from transition = more likely to keep original biome
            const distanceRatio = Math.abs(i) / smoothingRadius;
            const transitionRand = getRandomForPosition(gameState.worldSeed, x, 0);
            
            // Create more natural, gradual transitions
            if (i < 0) {
                // Left side of transition
                if (transitionRand > Math.pow(distanceRatio, 1.5) * 0.9) {
                    smoothedMap[x] = leftBiome;
                }
            } else {
                // Right side of transition
                if (transitionRand > Math.pow(distanceRatio, 1.5) * 0.9) {
                    smoothedMap[x] = rightBiome;
                }
            }
        }
    }
    
    // Copy smoothed map back to biome map
    for (let x = 0; x < WORLD_WIDTH; x++) {
        biomeMap[x] = smoothedMap[x];
    }
    
    // Final pass: remove tiny biome segments (less than minBiomeSize)
    const minBiomeSize = 60; // Increased from 30 for larger minimum biome size
    let currentBiome = biomeMap[0];
    let currentSize = 1;
    let startIndex = 0;
    
    for (let x = 1; x < WORLD_WIDTH; x++) {
        if (biomeMap[x] === currentBiome) {
            currentSize++;
        } else {
            // Found a different biome
            if (currentSize < minBiomeSize) {
                // Current biome segment is too small, replace it
                const replacementBiome = (x < WORLD_WIDTH - 1) ? biomeMap[x] : currentBiome;
                for (let i = startIndex; i < x; i++) {
                    biomeMap[i] = replacementBiome;
                }
            }
            
            // Start tracking the new biome
            currentBiome = biomeMap[x];
            currentSize = 1;
            startIndex = x;
        }
    }
    
    // Check the last biome segment
    if (currentSize < minBiomeSize && startIndex > 0) {
        const replacementBiome = biomeMap[startIndex - 1];
        for (let i = startIndex; i < WORLD_WIDTH; i++) {
            biomeMap[i] = replacementBiome;
        }
    }
}

// Generate terrain heights
function generateTerrainHeights(gameState) {
    console.log('Generating terrain heights with seed:', gameState.worldSeed);
    
    const terrainHeights = [];
    
    // Initialize Perlin noise generator if not already created
    if (!gameState.perlinNoise) {
        gameState.perlinNoise = new PerlinNoise(gameState.worldSeed);
    }
    
    // Base terrain height (middle of the world)
    const baseHeight = Math.floor(WORLD_HEIGHT * 0.5);
    
    // Generate initial terrain using improved noise functions
    for (let x = 0; x < WORLD_WIDTH; x++) {
        // Get biome at this position
        const biome = gameState.biomeMap[x];
        
        // Use the improved Perlin noise for more organic terrain
        // This generates Minecraft-like terrain with varying features
        const noiseValue = gameState.perlinNoise.terrainNoise(x, 0);
        
        // Apply biome-specific height modifiers
        let heightModifier = 0;
        if (biome) {
            heightModifier = biome.heightModifier || 0;
            
            // Amplify terrain features based on biome
            // Mountains have more dramatic terrain, plains are flatter
            let biomeAmplitude = 1.0;
            
            if (biome.name === BIOME_TYPES.PLAINS) {
                biomeAmplitude = 0.5; // Flatter terrain
            } else if (biome.name === BIOME_TYPES.FOREST) {
                biomeAmplitude = 0.7; // Reduced from 0.8 for smoother terrain
            } else if (biome.name === BIOME_TYPES.DESERT) {
                biomeAmplitude = 0.6; // Reduced from 0.7 for smoother dunes
            } else if (biome.name === BIOME_TYPES.MOUNTAINS) {
                biomeAmplitude = 1.8; // Reduced from 2.0 for less extreme mountains
            } else if (biome.name === BIOME_TYPES.GRASSLAND) {
                biomeAmplitude = 0.5; // Reduced from 0.6 for smoother hills
            } else if (biome.name === BIOME_TYPES.WETLAND) {
                biomeAmplitude = 0.3; // Reduced from 0.4 for flatter wetlands
            }
            
            // Calculate final height with biome-specific amplitude
            const height = Math.floor(
                baseHeight + 
                (noiseValue * 35 * biomeAmplitude) + // Reduced from 40 for smoother terrain
                heightModifier
            );
            
            terrainHeights[x] = height;
        } else {
            // Fallback if no biome is defined
            terrainHeights[x] = baseHeight + Math.floor(noiseValue * 20);
        }
    }
    
    // Apply more smoothing passes for a more natural, less noisy terrain surface
    smoothTerrain(terrainHeights, 3); // Increased from 2 to 3 passes for smoother terrain
    
    // Add terrain features like mountains and valleys
    addTerrainFeatures(terrainHeights, gameState);
    
    // Store in game state
    gameState.terrainHeights = terrainHeights;
}

// Smooth terrain heights with multiple passes
function smoothTerrain(terrainHeights, passes = 1) {
    for (let pass = 0; pass < passes; pass++) {
        const smoothedHeights = [...terrainHeights];
        
        // Use a larger window for smoother terrain
        const smoothingRadius = 3;
        
        // Apply smoothing
        for (let x = smoothingRadius; x < WORLD_WIDTH - smoothingRadius; x++) {
            // Calculate average of nearby heights
            let sum = 0;
            let count = 0;
            
            for (let i = -smoothingRadius; i <= smoothingRadius; i++) {
                const pos = x + i;
                if (pos >= 0 && pos < WORLD_WIDTH) {
                    // Weight by distance from center (closer points have more influence)
                    const weight = 1 - Math.abs(i) / (smoothingRadius + 1);
                    sum += terrainHeights[pos] * weight;
                    count += weight;
                }
            }
            
            // Set smoothed height
            if (count > 0) {
                smoothedHeights[x] = Math.round(sum / count);
            }
        }
        
        // Copy smoothed heights back
        for (let x = 0; x < WORLD_WIDTH; x++) {
            terrainHeights[x] = smoothedHeights[x];
        }
    }
}

// Add special terrain features
function addTerrainFeatures(terrainHeights, gameState) {
    // Add mountains in mountain biomes
    for (let x = 0; x < WORLD_WIDTH; x++) {
        const biome = gameState.biomeMap[x];
        
        if (biome && biome.name === BIOME_TYPES.MOUNTAINS) {
            // Check if we should add a mountain peak here
            const mountainRand = getRandomForPosition(gameState.worldSeed, x, 1000);
            
            if (mountainRand < 0.05) { // 5% chance for a mountain peak
                // Create a mountain peak
                const peakHeight = 40 + Math.floor(mountainRand * 30);
                const mountainWidth = 20 + Math.floor(getRandomForPosition(gameState.worldSeed, x, 1001) * 30);
                
                // Apply mountain to terrain
                for (let i = -mountainWidth; i <= mountainWidth; i++) {
                    const pos = x + i;
                    if (pos >= 0 && pos < WORLD_WIDTH) {
                        // Calculate height reduction based on distance from peak
                        const distanceRatio = Math.abs(i) / mountainWidth;
                        const heightReduction = peakHeight * (1 - Math.pow(1 - distanceRatio, 2));
                        
                        // Apply mountain height
                        terrainHeights[pos] -= Math.floor(peakHeight - heightReduction);
                    }
                }
                
                // Skip ahead to avoid multiple peaks too close together
                x += mountainWidth;
            }
        }
    }
    
    // Add valleys/rivers
    let valleyCount = 5 + Math.floor(getRandomForPosition(gameState.worldSeed, 0, 2000) * 5);
    
    for (let v = 0; v < valleyCount; v++) {
        // Determine valley position
        const valleyX = Math.floor(getRandomForPosition(gameState.worldSeed, v, 3000) * WORLD_WIDTH);
        const valleyWidth = 10 + Math.floor(getRandomForPosition(gameState.worldSeed, v, 3001) * 20);
        const valleyDepth = 10 + Math.floor(getRandomForPosition(gameState.worldSeed, v, 3002) * 15);
        
        // Apply valley to terrain
        for (let i = -valleyWidth; i <= valleyWidth; i++) {
            const pos = valleyX + i;
            if (pos >= 0 && pos < WORLD_WIDTH) {
                // Calculate depth reduction based on distance from center
                const distanceRatio = Math.abs(i) / valleyWidth;
                const depthReduction = valleyDepth * Math.pow(distanceRatio, 2);
                
                // Apply valley depth
                terrainHeights[pos] += Math.floor(valleyDepth - depthReduction);
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
                const biome = getBiomeAt(worldX, gameState);
                
                // Get soil density from biome (used to determine underground structure)
                const soilDensity = biome ? biome.soilDensity || 0.85 : 0.85;
                
                if (worldY > terrainHeight + 20) {
                    // Deep underground - more chance of stone and ore
                    const rand = getRandomForPosition(gameState.worldSeed, worldX, worldY);
                    if (rand < 0.7) {
                        tileType = TILE_TYPES.STONE;
                    } else if (rand < 0.9) { // Increased dirt from 0.85 to 0.9
                        tileType = TILE_TYPES.DIRT;
                    } else {
                        // Generate different types of ore based on depth
                        tileType = generateOre(worldX, worldY, terrainHeight, gameState.worldSeed);
                    }
                } else if (worldY > terrainHeight) {
                    // Underground - mostly dirt with some stone
                    const rand = getRandomForPosition(gameState.worldSeed, worldX, worldY);
                    if (rand < 0.85) { // Increased from 0.8
                        tileType = TILE_TYPES.DIRT;
                    } else {
                        tileType = TILE_TYPES.STONE;
                    }
                    
                    // Add clay in certain biomes
                    if (biome && (biome.name === BIOME_TYPES.WETLAND || biome.name === BIOME_TYPES.DESERT)) {
                        const clayRand = getRandomForPosition(gameState.worldSeed + 500, worldX, worldY);
                        if (clayRand < 0.15) {
                            tileType = TILE_TYPES.DIRT;
                        }
                    }
                    
                    // Add fungi in wet/forest biomes
                    if (biome && (biome.name === BIOME_TYPES.WETLAND || biome.name === BIOME_TYPES.FOREST)) {
                        const fungiRand = getRandomForPosition(gameState.worldSeed + 600, worldX, worldY);
                        if (fungiRand < 0.07) {
                            tileType = TILE_TYPES.DIRT;
                        }
                    }
                    
                    // Add roots near surface in vegetated areas
                    if (biome && (biome.name === BIOME_TYPES.FOREST || biome.name === BIOME_TYPES.PLAINS || 
                                biome.name === BIOME_TYPES.GRASSLAND) && 
                        worldY < terrainHeight + 10) { // Only near surface
                        const rootRand = getRandomForPosition(gameState.worldSeed + 700, worldX, worldY);
                        if (rootRand < 0.08) {
                            tileType = TILE_TYPES.DIRT;
                        }
                    }
                } else if (worldY === terrainHeight) {
                    // Surface - grass or biome-specific block
                    if (biome) {
                        if (biome.name === BIOME_TYPES.DESERT) {
                            tileType = TILE_TYPES.SAND;
                        } else if (biome.name === BIOME_TYPES.MOUNTAINS && worldY < terrainHeight - 10) {
                            tileType = TILE_TYPES.SNOW;
                        } else if (biome.name === BIOME_TYPES.WETLAND) {
                            // Chance for water patches in wetland
                            const waterRand = getRandomForPosition(gameState.worldSeed + 800, worldX, worldY);
                            if (waterRand < 0.2) {
                                tileType = TILE_TYPES.WATER;
                            } else {
                                tileType = TILE_TYPES.GRASS;
                            }
                        } else {
                            tileType = TILE_TYPES.GRASS;
                        }
                    } else {
                        tileType = TILE_TYPES.GRASS;
                    }
                } else {
                    // Above ground - air
                    tileType = TILE_TYPES.AIR;
                    
                    // Generate clouds above a certain height
                    // We'll make clouds appear all the way from above terrain to max height
                    const cloudMinHeight = 15; // Minimum blocks above terrain
                    
                    // Check if we're above the minimum height above terrain
                    if (worldY <= terrainHeight - cloudMinHeight) {
                        
                        // Use 2D noise for natural-looking clouds
                        // No animation - using fixed coordinates
                        const cloudNoise = getRandomForPosition(gameState.worldSeed + 1000, worldX / 3, worldY / 2);
                        
                        // Only place cloud blocks if noise value is above threshold
                        // This creates patchy, natural-looking clouds
                        if (cloudNoise > 0.75 && cloudNoise < 0.92) {
                            tileType = TILE_TYPES.CLOUD;
                        }
                    }
                }
                
                // Bedrock at bottom of world
                if (worldY >= WORLD_HEIGHT - 5) {
                    tileType = TILE_TYPES.BEDROCK;
                }
                
                // Add caves and ant tunnels
                if (tileType !== TILE_TYPES.AIR && tileType !== TILE_TYPES.BEDROCK) {
                    // Get biome ant-friendliness factor - affects tunnel generation
                    const antFactor = biome ? biome.antFriendliness || 0.5 : 0.5;
                    
                    // Generate cave noise
                    const caveNoise = generateCaveNoise(worldX, worldY, gameState.worldSeed);
                    
                    // Regular caves - threshold adjusted by soil density
                    // Higher soil density = higher threshold = fewer caves
                    // Increased base threshold from 0.55 to 0.60 to reduce cave frequency
                    const caveThreshold = 0.60 + (soilDensity * 0.2);
                    
                    // Calculate depth from surface - used to restrict caves to deeper areas
                    const depthFromSurface = worldY - terrainHeight;
                    
                    // Only generate caves if we're at least 20 blocks below the surface
                    // This keeps the surface more solid and natural looking with a thicker crust
                    if (depthFromSurface >= 20 && caveNoise > caveThreshold && worldY > terrainHeight + 5) {
                        tileType = TILE_TYPES.AIR;
                    } 
                    // Ant tunnels also only generate at least 20 blocks below the surface
                    // This ensures the surface terrain remains intact
                    // Narrowed the noise range to make tunnels less frequent
                    else if (depthFromSurface >= 20 && 
                             caveNoise > 0.38 && caveNoise < 0.48 && 
                             antFactor > 0.4 && 
                             worldY > terrainHeight + 3 && worldY < terrainHeight + 50) {
                        // Create ant tunnels using AIR blocks instead of ANT_TUNNEL to avoid rendering issues
                        tileType = TILE_TYPES.AIR;
                        
                        // Occasional ant chambers at tunnel junctions
                        // Increased probability from 0.1 to 0.25 to create more chambers
                        const chamberRand = getRandomForPosition(gameState.worldSeed + 950, worldX, worldY);
                        if (chamberRand < 0.25) {
                            // Mark this location for chamber expansion
                            // Will be processed in a post-generation pass
                            if (!gameState.antChambers) {
                                gameState.antChambers = [];
                            }
                            
                            gameState.antChambers.push({
                                x: worldX,
                                y: worldY,
                                chunkX: chunkX,
                                chunkY: chunkY
                            });
                        }
                    }
                }
            }
            
            chunk[y][x] = tileType;
        }
    }
    
    // Add biome-specific features with deterministic randomness
    addBiomeFeaturesWithSeed(chunk, chunkX, chunkY, gameState);
    
    return chunk;
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

// Add biome features with deterministic randomness
function addBiomeFeaturesWithSeed(chunk, chunkX, chunkY, gameState) {
    // Iterate through the chunk
    for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
            // Calculate world coordinates
            const worldX = chunkX * CHUNK_SIZE + x;
            const worldY = chunkY * CHUNK_SIZE + y;
            
            // Skip if outside world bounds
            if (worldX < 0 || worldX >= WORLD_WIDTH) {
                continue;
            }
            
            // Get terrain height at this x position
            const terrainHeight = gameState.terrainHeights[worldX] || 0;
            
            // Only add features at or near the surface
            if (worldY <= terrainHeight && worldY >= terrainHeight - 1) {
                // Get biome at this x position
                const biome = getBiomeAt(worldX, gameState);
                
                if (biome) {
                    // Use deterministic random for feature generation
                    const featureRand = getRandomForPosition(gameState.worldSeed, worldX, worldY);
                    
                    // Add biome-specific features
                    addBiomeFeature(chunk, x, y, worldX, worldY, biome, terrainHeight, featureRand, gameState.worldSeed);
                }
            }
        }
    }
}

// Add a specific biome feature at a position
function addBiomeFeature(chunk, localX, localY, worldX, worldY, biome, terrainHeight, featureRand, worldSeed) {
    // Only add features at the surface level
    if (worldY !== terrainHeight - 1) return;
    
    // Check if this position already has a feature
    if (chunk[localY][localX] !== TILE_TYPES.AIR) return;
    
    // Different features based on biome type
    switch (biome.name) {
        case BIOME_TYPES.PLAINS:
            // Trees (rare)
            if (biome.features.trees && featureRand < biome.features.trees.frequency) {
                generateTreeWithSeed(chunk, localX, localY, worldX, worldY, biome, worldSeed);
                return;
            }
            
            // Adjust rand for next feature check
            featureRand = getRandomForPosition(worldSeed, worldX, worldY + 100);
            
            // Tall grass (common)
            if (biome.features.tallGrass && featureRand < biome.features.tallGrass.frequency) {
                chunk[localY][localX] = TILE_TYPES.TALL_GRASS;
                return;
            }
            
            // Adjust rand for next feature check
            featureRand = getRandomForPosition(worldSeed, worldX, worldY + 200);
            
            // Flowers (uncommon)
            if (biome.features.flowers && featureRand < biome.features.flowers.frequency) {
                chunk[localY][localX] = TILE_TYPES.FLOWER;
                return;
            }
            
            // Adjust rand for next feature check
            featureRand = getRandomForPosition(worldSeed, worldX, worldY + 300);
            
            // Bushes (uncommon)
            if (biome.features.bushes && featureRand < biome.features.bushes.frequency) {
                chunk[localY][localX] = TILE_TYPES.BUSH;
                return;
            }
            break;
            
        case BIOME_TYPES.FOREST:
            // Trees (common)
            if (biome.features.trees && featureRand < biome.features.trees.frequency) {
                generateTreeWithSeed(chunk, localX, localY, worldX, worldY, biome, worldSeed);
                return;
            }
            
            // Adjust rand for next feature check
            featureRand = getRandomForPosition(worldSeed, worldX, worldY + 100);
            
            // Mushrooms (uncommon)
            if (biome.features.mushrooms && featureRand < biome.features.mushrooms.frequency) {
                chunk[localY][localX] = TILE_TYPES.MUSHROOM;
                return;
            }
            
            // Adjust rand for next feature check
            featureRand = getRandomForPosition(worldSeed, worldX, worldY + 200);
            
            // Tall grass (uncommon)
            if (biome.features.tallGrass && featureRand < biome.features.tallGrass.frequency) {
                chunk[localY][localX] = TILE_TYPES.TALL_GRASS;
                return;
            }
            
            // Adjust rand for next feature check
            featureRand = getRandomForPosition(worldSeed, worldX, worldY + 300);
            
            // Bushes (uncommon)
            if (biome.features.bushes && featureRand < biome.features.bushes.frequency) {
                chunk[localY][localX] = TILE_TYPES.BUSH;
                return;
            }
            break;
            
        case BIOME_TYPES.DESERT:
            // Cacti (uncommon)
            if (biome.features.cacti && featureRand < biome.features.cacti.frequency) {
                chunk[localY][localX] = TILE_TYPES.CACTUS;
                
                // Try to add a second cactus block above if within chunk bounds
                if (localY > 0) {
                    chunk[localY - 1][localX] = TILE_TYPES.CACTUS;
                }
                return;
            }
            break;
            
        case BIOME_TYPES.MOUNTAINS:
            // Snow patches
            if (featureRand < 0.2) {
                chunk[localY][localX] = TILE_TYPES.SNOW;
                return;
            }
            
            // Adjust rand for next feature check
            featureRand = getRandomForPosition(worldSeed, worldX, worldY + 100);
            
            // Trees (rare, only at lower elevations)
            if (biome.features.trees && featureRand < biome.features.trees.frequency * 0.5) {
                generateTreeWithSeed(chunk, localX, localY, worldX, worldY, biome, worldSeed);
                return;
            }
            break;
    }
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

// Generate cave noise with deterministic randomness
function generateCaveNoise(x, y, seed) {
    // Use our improved PerlinNoise implementation
    // This creates larger, more connected cave systems like Minecraft

    // Create static perlin noise instance
    if (!generateCaveNoise.perlinNoise) {
        generateCaveNoise.perlinNoise = new PerlinNoise(seed);
    }
    
    // Further reduce noise frequency for even larger, more isolated cave systems
    // Decreasing the scale makes cave features larger and less frequent
    const caveScale = 0.025; // Reduced from 0.03
    
    // Get coordinates at different scales
    const nx1 = x * caveScale;
    const ny1 = y * caveScale;
    const nx2 = x * caveScale * 1.5; // Reduced from 1.7
    const ny2 = y * caveScale * 1.5; // Reduced from 1.7
    
    // Horizontal bias for more ant-like tunnels
    // This creates flatter tunnels but uses standard blocks
    const hBias = 0.8;
    const yFactor = y * (1 - hBias) + (seed % 1000) * hBias;
    
    // Base noise - reduced amplitude for the second layer
    const noise1 = generateCaveNoise.perlinNoise.noise(nx1, ny1);
    const noise2 = generateCaveNoise.perlinNoise.noise(nx2, ny2) * 0.25; // Reduced from 0.3
    
    // Add horizontal bias to y-coordinate
    // Reduced frequency for more pronounced horizontal sections
    const horizontalNoise = generateCaveNoise.perlinNoise.noise(x * 0.01, yFactor * 0.04) * 0.25; // Reduced from 0.015/0.05/0.3
    
    // Add some vertical shafts - but even less frequently
    const verticalFrequency = 0.02; // Reduced from 0.03
    const verticalValue = Math.sin(x * verticalFrequency + seed);
    const verticalShaft = verticalValue > 0.85 ? 0.12 : 0; // Higher threshold and lower amplitude
    
    // Add occasional chambers - reduced frequency
    const chamberPattern = 
        (Math.sin(x * 0.01 + seed) > 0.75 && Math.cos(y * 0.01 + seed) > 0.75) ? 0.15 : 0;
    
    // Combine all noise components with adjusted weights
    return noise1 + noise2 + horizontalNoise + verticalShaft + chamberPattern;
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
    
    // Generate fractal/octave noise for more complex terrain
    // Combines multiple layers of noise at different frequencies and amplitudes
    octaveNoise(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;
        
        for (let i = 0; i < octaves; i++) {
            total += this.noise(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }
        
        // Normalize result to range [-1, 1]
        return (total / maxValue) * 2 - 1;
    }
    
    // Generate terrain noise that's more suitable for Minecraft-like terrain
    terrainNoise(x, y, large = 1.0, medium = 0.5, small = 0.25, tiny = 0.1) {
        // Large-scale terrain features (continent/biome level)
        const largeScale = this.octaveNoise(x * 0.001, y * 0.001, 2, 0.5, 2.0) * large;
        
        // Medium-scale terrain features (hills/valleys)
        const mediumScale = this.octaveNoise(x * 0.01, y * 0.01, 4, 0.5, 2.0) * medium;
        
        // Small-scale terrain features (small hills/depressions)
        const smallScale = this.octaveNoise(x * 0.05, y * 0.05, 2, 0.5, 2.0) * small;
        
        // Tiny-scale terrain features (roughness/texture)
        const tinyScale = this.octaveNoise(x * 0.1, y * 0.1, 1, 0.5, 2.0) * tiny;
        
        // Combine all scales with different weights
        return largeScale + mediumScale + smallScale + tinyScale;
    }
}

// Process ant chambers after all chunks are generated
function processAntChambers(gameState) {
    if (!gameState.antChambers || gameState.antChambers.length === 0) {
        return;
    }
    
    console.log(`Processing ${gameState.antChambers.length} ant chambers`);
    
    // Create a map to group chambers by chunk
    const chambersByChunk = {};
    
    // Filter chambers to only include those deep enough underground
    const validChambers = gameState.antChambers.filter(chamber => {
        // Get terrain height at this position
        const terrainHeight = gameState.terrainHeights[chamber.x] || 0;
        
        // Make sure chamber is at least 20 blocks underground
        return chamber.y - terrainHeight >= 20;
    });
    
    // Group chambers by chunk coordinates
    for (const chamber of validChambers) {
        const key = `${chamber.chunkX},${chamber.chunkY}`;
        if (!chambersByChunk[key]) {
            chambersByChunk[key] = [];
        }
        chambersByChunk[key].push(chamber);
    }
    
    // Process each chunk's chambers
    for (const key in chambersByChunk) {
        const [chunkX, chunkY] = key.split(',').map(Number);
        const chambers = chambersByChunk[key];
        
        // Get the chunk
        const chunk = gameState.chunks[key];
        if (!chunk) continue;
        
        // Process each chamber
        for (const chamber of chambers) {
            // Calculate the local coordinates in the chunk
            const localX = chamber.x % CHUNK_SIZE;
            const localY = chamber.y % CHUNK_SIZE;
            
            // Create a chamber of random size (3-6 blocks wide)
            const chamberSize = 2 + Math.floor(getRandomForPosition(gameState.worldSeed, chamber.x, chamber.y) * 4);
            
            // Determine chamber shape - create some diversity
            const chamberTypeRand = getRandomForPosition(gameState.worldSeed + 123, chamber.x, chamber.y);
            
            // Horizontal stretch factor - makes chambers more oval shaped
            const horizontalStretch = 1.5 + chamberTypeRand * 0.5;
            
            // Vertical stretch - sometimes make taller chambers
            const verticalStretch = 0.6 + chamberTypeRand * 0.3;
            
            // Create the chamber by expanding in all directions
            for (let cy = -Math.floor(chamberSize * verticalStretch); cy <= Math.floor(chamberSize * verticalStretch); cy++) {
                for (let cx = -Math.floor(chamberSize * horizontalStretch); cx <= Math.floor(chamberSize * horizontalStretch); cx++) {
                    // Skip if outside chunk boundaries
                    const newLocalX = localX + cx;
                    const newLocalY = localY + cy;
                    if (newLocalX < 0 || newLocalX >= CHUNK_SIZE || newLocalY < 0 || newLocalY >= CHUNK_SIZE) {
                        continue;
                    }
                    
                    // Calculate distance from center, accounting for oval shape
                    const distance = Math.sqrt(Math.pow(cx / horizontalStretch, 2) + Math.pow(cy / verticalStretch, 2));
                    
                    // Create oval-shaped chamber with smoother edges
                    if (distance <= chamberSize * 0.9) {
                        // Core of the chamber - use AIR blocks instead of custom types
                        chunk[newLocalY][newLocalX] = TILE_TYPES.AIR;
                        
                        // Occasionally add standard block types for variety
                        // Use existing block types that won't cause rendering issues
                        const specialRand = getRandomForPosition(gameState.worldSeed * 2, chamber.x + cx, chamber.y + cy);
                        if (specialRand < 0.08) {
                            if (specialRand < 0.03) {
                                chunk[newLocalY][newLocalX] = TILE_TYPES.STONE;
                            } else if (specialRand < 0.06) {
                                chunk[newLocalY][newLocalX] = TILE_TYPES.DIRT;
                            } else {
                                chunk[newLocalY][newLocalX] = TILE_TYPES.COAL;
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Clear processed chambers
    gameState.antChambers = [];
}

// Export functions for use in server.js
module.exports = {
    initializeBiomes,
    generateBiomeMap,
    generateTerrainHeights,
    generateChunk,
    processAntChambers,
    TILE_TYPES,
    BIOME_TYPES
}; 