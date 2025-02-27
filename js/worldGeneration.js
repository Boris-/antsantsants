// Generate world
function generateWorld() {
    // Initialize with air
    for (let y = 0; y < WORLD_HEIGHT; y++) {
        gameState.world[y] = [];
        for (let x = 0; x < WORLD_WIDTH; x++) {
            gameState.world[y][x] = TILE_TYPES.AIR;
        }
    }

    // Generate terrain using improved procedural generation
    generateProceduralTerrain();
    
    // Add caves and structures
    generateCaves();
    
    // Add ore deposits
    generateOreDeposits();
    
    // Place player above the surface at a safe location
    placePlayerSafely();
    
    // Add some enemies on the surface
    spawnEnemies();
}

// Generate procedural terrain with smooth hills and valleys
function generateProceduralTerrain() {
    // Base surface level
    const baseSurfaceLevel = Math.floor(WORLD_HEIGHT / 3);
    
    // Generate terrain heights using a simple noise function
    const terrainHeights = generateTerrainHeights(baseSurfaceLevel);
    
    // Apply the terrain heights to create the surface
    for (let x = 0; x < WORLD_WIDTH; x++) {
        const surfaceY = terrainHeights[x];
        
        // Create layers of different materials
        for (let y = surfaceY; y < WORLD_HEIGHT; y++) {
            if (y === surfaceY) {
                // Surface layer is grass or sand based on height
                if (surfaceY < baseSurfaceLevel - 2) {
                    // Higher elevations are grass
                    gameState.world[y][x] = TILE_TYPES.GRASS;
                } else if (surfaceY > baseSurfaceLevel + 2) {
                    // Lower elevations are sand
                    gameState.world[y][x] = TILE_TYPES.SAND;
                } else {
                    // Middle elevations are grass
                    gameState.world[y][x] = TILE_TYPES.GRASS;
                }
            } else if (y < surfaceY + 4 + Math.floor(Math.random() * 3)) {
                // Dirt layer with variable thickness
                gameState.world[y][x] = TILE_TYPES.DIRT;
            } else if (y > WORLD_HEIGHT - 3) {
                // Bedrock at the bottom of the world
                gameState.world[y][x] = TILE_TYPES.BEDROCK;
            } else {
                // Stone layer with occasional dirt patches
                gameState.world[y][x] = Math.random() < 0.9 ? TILE_TYPES.STONE : TILE_TYPES.DIRT;
            }
        }
    }
    
    // Store the terrain heights for later use (player placement, etc.)
    gameState.terrainHeights = terrainHeights;
}

// Generate terrain heights using a simple noise algorithm
function generateTerrainHeights(baseSurfaceLevel) {
    const heights = [];
    
    // Generate initial random points
    const numControlPoints = 8;
    const controlPoints = [];
    
    for (let i = 0; i < numControlPoints; i++) {
        const x = Math.floor(i * WORLD_WIDTH / (numControlPoints - 1));
        const height = baseSurfaceLevel + Math.floor(Math.random() * 7) - 3;
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
        
        heights[x] = height;
    }
    
    return heights;
}

// Generate caves using cellular automata
function generateCaves() {
    // Initialize a noise map for cave generation
    let caveMap = [];
    for (let y = 0; y < WORLD_HEIGHT; y++) {
        caveMap[y] = [];
        for (let x = 0; x < WORLD_WIDTH; x++) {
            // Only consider generating caves below the surface
            if (y > gameState.terrainHeights[x] + 5) {
                // 40% chance of starting with a "filled" cell
                caveMap[y][x] = Math.random() < 0.4;
            } else {
                caveMap[y][x] = false; // No caves near the surface
            }
        }
    }
    
    // Run cellular automata iterations to create natural-looking caves
    const iterations = 4;
    for (let i = 0; i < iterations; i++) {
        caveMap = evolveCaves(caveMap);
    }
    
    // Apply the cave map to the world
    for (let y = 0; y < WORLD_HEIGHT; y++) {
        for (let x = 0; x < WORLD_WIDTH; x++) {
            if (caveMap[y][x] && gameState.world[y][x] !== TILE_TYPES.AIR) {
                gameState.world[y][x] = TILE_TYPES.AIR; // Carve out caves
            }
        }
    }
}

// Evolve the cave map using cellular automata rules
function evolveCaves(caveMap) {
    const newMap = [];
    for (let y = 0; y < WORLD_HEIGHT; y++) {
        newMap[y] = [];
        for (let x = 0; x < WORLD_WIDTH; x++) {
            // Count filled neighbors
            let filledNeighbors = 0;
            for (let ny = -1; ny <= 1; ny++) {
                for (let nx = -1; nx <= 1; nx++) {
                    if (nx === 0 && ny === 0) continue; // Skip self
                    
                    const checkY = y + ny;
                    const checkX = x + nx;
                    
                    // Count edge cells as filled
                    if (checkX < 0 || checkX >= WORLD_WIDTH || checkY < 0 || checkY >= WORLD_HEIGHT) {
                        filledNeighbors++;
                    } else if (caveMap[checkY][checkX]) {
                        filledNeighbors++;
                    }
                }
            }
            
            // Apply cellular automata rules
            if (caveMap[y][x]) {
                // If cell is filled, stay filled if it has 4 or more filled neighbors
                newMap[y][x] = filledNeighbors >= 4;
            } else {
                // If cell is empty, become filled if it has 5 or more filled neighbors
                newMap[y][x] = filledNeighbors >= 5;
            }
        }
    }
    return newMap;
}

// Generate ore deposits throughout the stone layer
function generateOreDeposits() {
    // Generate different types of ore veins
    generateOreType(TILE_TYPES.COAL, 0.08, 5, 8);  // Common coal
    generateOreType(TILE_TYPES.IRON, 0.04, 3, 6);  // Less common iron
    generateOreType(TILE_TYPES.GOLD, 0.01, 2, 4);  // Rare gold
}

// Generate a specific type of ore throughout the world
function generateOreType(oreType, probability, minSize, maxSize) {
    for (let y = 0; y < WORLD_HEIGHT; y++) {
        // Different ore types appear at different depths
        let depthProbability = probability;
        
        // Adjust probability based on depth
        if (oreType === TILE_TYPES.COAL) {
            // Coal is more common near the surface
            depthProbability *= (1 - y / WORLD_HEIGHT);
        } else if (oreType === TILE_TYPES.IRON) {
            // Iron is more common in the middle
            depthProbability *= Math.sin((y / WORLD_HEIGHT) * Math.PI);
        } else if (oreType === TILE_TYPES.GOLD) {
            // Gold is more common deeper
            depthProbability *= (y / WORLD_HEIGHT);
        }
        
        for (let x = 0; x < WORLD_WIDTH; x++) {
            if (gameState.world[y][x] === TILE_TYPES.STONE && Math.random() < depthProbability) {
                // Start an ore vein
                const size = minSize + Math.floor(Math.random() * (maxSize - minSize + 1));
                generateOreVein(x, y, size, oreType);
            }
        }
    }
}

// Generate a small vein of ore starting from a point
function generateOreVein(startX, startY, size, oreType) {
    // Simple flood fill for the ore vein
    let placedOre = 0;
    let queue = [{ x: startX, y: startY }];
    
    while (queue.length > 0 && placedOre < size) {
        const current = queue.shift();
        const { x, y } = current;
        
        // Skip if out of bounds
        if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) continue;
        
        // Skip if not stone
        if (gameState.world[y][x] !== TILE_TYPES.STONE) continue;
        
        // Place ore
        gameState.world[y][x] = oreType;
        placedOre++;
        
        // Add neighbors with decreasing probability
        const directions = [
            { x: x+1, y: y },
            { x: x-1, y: y },
            { x: x, y: y+1 },
            { x: x, y: y-1 }
        ];
        
        // Shuffle directions for more natural-looking veins
        shuffleArray(directions);
        
        for (const dir of directions) {
            // Probability decreases as vein gets larger
            const continueProbability = 0.7 * (1 - placedOre / size);
            if (Math.random() < continueProbability) {
                queue.push(dir);
            }
        }
    }
}

// Utility function to shuffle an array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
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
}

// Spawn enemies on the surface
function spawnEnemies() {
    // Clear existing enemies
    gameState.enemies = [];
    
    // Add some enemies on the surface
    const numEnemies = 5 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < numEnemies; i++) {
        // Find a suitable location on the surface
        const x = Math.floor(Math.random() * WORLD_WIDTH);
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