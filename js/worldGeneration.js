// Generate world
function generateWorld() {
    // Initialize with air
    for (let y = 0; y < WORLD_HEIGHT; y++) {
        gameState.world[y] = [];
        for (let x = 0; x < WORLD_WIDTH; x++) {
            gameState.world[y][x] = TILE_TYPES.AIR;
        }
    }

    // Generate terrain
    const surfaceLevel = Math.floor(WORLD_HEIGHT / 3);
    
    for (let x = 0; x < WORLD_WIDTH; x++) {
        // Create variation in the surface level
        const variation = Math.floor(Math.random() * 3) - 1;
        const currentSurfaceLevel = surfaceLevel + variation;
        
        for (let y = currentSurfaceLevel; y < WORLD_HEIGHT; y++) {
            if (y === currentSurfaceLevel) {
                gameState.world[y][x] = TILE_TYPES.GRASS;
            } else if (y < currentSurfaceLevel + 6) {
                gameState.world[y][x] = TILE_TYPES.DIRT;
            } else {
                gameState.world[y][x] = Math.random() < 0.9 ? TILE_TYPES.STONE : TILE_TYPES.DIRT;
            }
        }
    }
    
    // Place player above the surface
    gameState.player.y = (surfaceLevel - 2) * TILE_SIZE;
    
    // Add some enemies
    for (let i = 0; i < 5; i++) {
        const enemyX = Math.floor(Math.random() * WORLD_WIDTH) * TILE_SIZE;
        const enemyY = (surfaceLevel - 1) * TILE_SIZE;
        
        gameState.enemies.push({
            x: enemyX,
            y: enemyY,
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