// Draw world
function drawWorld() {
    // Calculate visible chunks
    const startChunkX = Math.floor(gameState.camera.x / TILE_SIZE / CHUNK_SIZE);
    const endChunkX = Math.ceil((gameState.camera.x + gameState.canvas.width) / TILE_SIZE / CHUNK_SIZE);
    const startChunkY = Math.floor(gameState.camera.y / TILE_SIZE / CHUNK_SIZE);
    const endChunkY = Math.ceil((gameState.camera.y + gameState.canvas.height) / TILE_SIZE / CHUNK_SIZE);
    
    // Draw background sky
    gameState.ctx.fillStyle = '#87CEEB';
    gameState.ctx.fillRect(0, 0, gameState.canvas.width, gameState.canvas.height);
    
    // Draw visible chunks
    for (let chunkY = startChunkY; chunkY <= endChunkY; chunkY++) {
        for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX++) {
            if (chunkX >= 0 && chunkX < Math.ceil(WORLD_WIDTH / CHUNK_SIZE) && 
                chunkY >= 0 && chunkY < Math.ceil(WORLD_HEIGHT / CHUNK_SIZE)) {
                drawChunk(chunkX, chunkY);
            }
        }
    }
    
    // Load chunks that are coming into view
    loadChunksInView(startChunkX, endChunkX, startChunkY, endChunkY);
    
    // Unload chunks that are far from view to save memory
    unloadDistantChunks(startChunkX, endChunkX, startChunkY, endChunkY);
}

// Draw a single chunk
function drawChunk(chunkX, chunkY) {
    const chunkKey = `${chunkX},${chunkY}`;
    
    // Check if chunk exists in gameState.chunks
    if (!gameState.chunks[chunkKey]) {
        // Generate chunk if not loaded
        generateChunk(chunkX, chunkY);
    }
    
    const chunk = gameState.chunks[chunkKey];
    
    // Calculate screen position of chunk
    const screenX = chunkX * CHUNK_SIZE * TILE_SIZE - gameState.camera.x;
    const screenY = chunkY * CHUNK_SIZE * TILE_SIZE - gameState.camera.y;
    
    // Only draw if chunk is visible on screen
    if (screenX > gameState.canvas.width || screenY > gameState.canvas.height || 
        screenX + CHUNK_SIZE * TILE_SIZE < 0 || screenY + CHUNK_SIZE * TILE_SIZE < 0) {
        return;
    }
    
    // Draw each tile in the chunk
    for (let localY = 0; localY < CHUNK_SIZE; localY++) {
        for (let localX = 0; localX < CHUNK_SIZE; localX++) {
            const tileType = chunk[localY][localX];
            if (tileType === TILE_TYPES.AIR) continue;
            
            const tileScreenX = screenX + localX * TILE_SIZE;
            const tileScreenY = screenY + localY * TILE_SIZE;
            
            // Skip if tile is not visible
            if (tileScreenX + TILE_SIZE < 0 || tileScreenX > gameState.canvas.width || 
                tileScreenY + TILE_SIZE < 0 || tileScreenY > gameState.canvas.height) {
                continue;
            }
            
            // Determine color based on tile type
            switch (tileType) {
                case TILE_TYPES.DIRT:
                    gameState.ctx.fillStyle = '#8B4513';
                    break;
                case TILE_TYPES.STONE:
                    gameState.ctx.fillStyle = '#808080';
                    break;
                case TILE_TYPES.GRASS:
                    gameState.ctx.fillStyle = '#228B22';
                    break;
                case TILE_TYPES.SAND:
                    gameState.ctx.fillStyle = '#F0E68C';
                    break;
                case TILE_TYPES.ORE:
                    gameState.ctx.fillStyle = '#FFD700'; // Gold color for ore
                    break;
                case TILE_TYPES.BEDROCK:
                    gameState.ctx.fillStyle = '#1C1C1C';
                    break;
                default:
                    gameState.ctx.fillStyle = '#FF00FF'; // Error/debug color
            }
            
            // Draw the tile
            gameState.ctx.fillRect(tileScreenX, tileScreenY, TILE_SIZE, TILE_SIZE);
            
            // Add some texture/detail to tiles
            addTileDetail(chunkX * CHUNK_SIZE + localX, chunkY * CHUNK_SIZE + localY, tileType, tileScreenX, tileScreenY);
        }
    }
}

// Add visual details to tiles based on type
function addTileDetail(worldX, worldY, tileType, screenX, screenY) {
    switch (tileType) {
        case TILE_TYPES.GRASS:
            // Add grass blades
            gameState.ctx.fillStyle = '#32CD32';
            for (let i = 0; i < 3; i++) {
                const grassX = screenX + 5 + i * 10;
                gameState.ctx.fillRect(grassX, screenY, 2, 5);
            }
            break;
            
        case TILE_TYPES.STONE:
            // Add stone cracks
            gameState.ctx.strokeStyle = '#707070';
            gameState.ctx.beginPath();
            gameState.ctx.moveTo(screenX + 5, screenY + 15);
            gameState.ctx.lineTo(screenX + 15, screenY + 5);
            gameState.ctx.stroke();
            break;
            
        case TILE_TYPES.ORE:
            // Add ore sparkles
            gameState.ctx.fillStyle = '#FFFFFF';
            gameState.ctx.fillRect(screenX + 8, screenY + 8, 2, 2);
            gameState.ctx.fillRect(screenX + 20, screenY + 15, 2, 2);
            break;
    }
}

// Load chunks that are coming into view
function loadChunksInView(startChunkX, endChunkX, startChunkY, endChunkY) {
    // Add a buffer zone to preload chunks just outside the view
    const bufferSize = 1;
    
    for (let y = startChunkY - bufferSize; y <= endChunkY + bufferSize; y++) {
        for (let x = startChunkX - bufferSize; x <= endChunkX + bufferSize; x++) {
            if (x >= 0 && x < Math.ceil(WORLD_WIDTH / CHUNK_SIZE) && 
                y >= 0 && y < Math.ceil(WORLD_HEIGHT / CHUNK_SIZE)) {
                const chunkKey = `${x},${y}`;
                if (!gameState.chunks[chunkKey]) {
                    generateChunk(x, y);
                }
            }
        }
    }
}

// Unload chunks that are far from view to save memory
function unloadDistantChunks(startChunkX, endChunkX, startChunkY, endChunkY) {
    // Only keep chunks that are within a certain distance from the view
    const unloadDistance = VISIBLE_CHUNKS_RADIUS + 2;
    
    for (const chunkKey in gameState.chunks) {
        const [chunkX, chunkY] = chunkKey.split(',').map(Number);
        
        // Check if chunk is far from view
        if (chunkX < startChunkX - unloadDistance || chunkX > endChunkX + unloadDistance ||
            chunkY < startChunkY - unloadDistance || chunkY > endChunkY + unloadDistance) {
            
            // If chunk has been modified, mark for saving
            gameState.hasUnsavedChanges = true;
            
            // Remove from loaded chunks
            delete gameState.chunks[chunkKey];
        }
    }
}

// Draw player (ant)
function drawPlayer() {
    // Body
    gameState.ctx.fillStyle = '#8B4513';
    
    const playerScreenX = gameState.player.x - gameState.camera.x;
    const playerScreenY = gameState.player.y - gameState.camera.y;
    
    // Ant body (oval)
    gameState.ctx.beginPath();
    gameState.ctx.ellipse(
        playerScreenX + gameState.player.width / 2,
        playerScreenY + gameState.player.height / 2,
        gameState.player.width / 2,
        gameState.player.height / 3,
        0, 0, Math.PI * 2
    );
    gameState.ctx.fill();
    
    // Head
    gameState.ctx.beginPath();
    gameState.ctx.arc(
        playerScreenX + (gameState.player.facingRight ? gameState.player.width * 0.75 : gameState.player.width * 0.25),
        playerScreenY + gameState.player.height / 2,
        gameState.player.width / 4,
        0, Math.PI * 2
    );
    gameState.ctx.fill();
    
    // Eyes
    gameState.ctx.fillStyle = '#FFFFFF';
    const eyeX = playerScreenX + (gameState.player.facingRight ? gameState.player.width * 0.85 : gameState.player.width * 0.15);
    gameState.ctx.beginPath();
    gameState.ctx.arc(
        eyeX,
        playerScreenY + gameState.player.height * 0.4,
        2,
        0, Math.PI * 2
    );
    gameState.ctx.fill();
    
    // Legs
    gameState.ctx.strokeStyle = '#8B4513';
    gameState.ctx.lineWidth = 2;
    
    // Draw 3 legs on each side
    for (let i = 0; i < 3; i++) {
        const legOffsetX = gameState.player.width * 0.2 + i * (gameState.player.width * 0.2);
        
        // Left legs
        gameState.ctx.beginPath();
        gameState.ctx.moveTo(
            playerScreenX + legOffsetX,
            playerScreenY + gameState.player.height / 2
        );
        gameState.ctx.lineTo(
            playerScreenX + legOffsetX - 5,
            playerScreenY + gameState.player.height * 0.8
        );
        gameState.ctx.stroke();
        
        // Right legs
        gameState.ctx.beginPath();
        gameState.ctx.moveTo(
            playerScreenX + legOffsetX,
            playerScreenY + gameState.player.height / 2
        );
        gameState.ctx.lineTo(
            playerScreenX + legOffsetX + 5,
            playerScreenY + gameState.player.height * 0.8
        );
        gameState.ctx.stroke();
    }
    
    // Antennae
    gameState.ctx.beginPath();
    gameState.ctx.moveTo(
        playerScreenX + (gameState.player.facingRight ? gameState.player.width * 0.8 : gameState.player.width * 0.2),
        playerScreenY + gameState.player.height * 0.3
    );
    gameState.ctx.lineTo(
        playerScreenX + (gameState.player.facingRight ? gameState.player.width * 0.9 : gameState.player.width * 0.1),
        playerScreenY + gameState.player.height * 0.15
    );
    gameState.ctx.stroke();
    
    gameState.ctx.beginPath();
    gameState.ctx.moveTo(
        playerScreenX + (gameState.player.facingRight ? gameState.player.width * 0.75 : gameState.player.width * 0.25),
        playerScreenY + gameState.player.height * 0.3
    );
    gameState.ctx.lineTo(
        playerScreenX + (gameState.player.facingRight ? gameState.player.width * 0.85 : gameState.player.width * 0.15),
        playerScreenY + gameState.player.height * 0.15
    );
    gameState.ctx.stroke();
}

// Draw enemies
function drawEnemies() {
    for (const enemy of gameState.enemies) {
        const enemyScreenX = enemy.x - gameState.camera.x;
        const enemyScreenY = enemy.y - gameState.camera.y;
        
        // Only draw if on screen
        if (
            enemyScreenX > -enemy.width &&
            enemyScreenX < gameState.canvas.width &&
            enemyScreenY > -enemy.height &&
            enemyScreenY < gameState.canvas.height
        ) {
            // Bug enemy
            gameState.ctx.fillStyle = '#FF0000';
            
            // Body
            gameState.ctx.beginPath();
            gameState.ctx.ellipse(
                enemyScreenX + enemy.width / 2,
                enemyScreenY + enemy.height / 2,
                enemy.width / 2,
                enemy.height / 3,
                0, 0, Math.PI * 2
            );
            gameState.ctx.fill();
            
            // Head
            const facingRight = enemy.velocityX > 0;
            gameState.ctx.beginPath();
            gameState.ctx.arc(
                enemyScreenX + (facingRight ? enemy.width * 0.75 : enemy.width * 0.25),
                enemyScreenY + enemy.height / 2,
                enemy.width / 4,
                0, Math.PI * 2
            );
            gameState.ctx.fill();
            
            // Eyes
            gameState.ctx.fillStyle = '#FFFFFF';
            const eyeX = enemyScreenX + (facingRight ? enemy.width * 0.85 : enemy.width * 0.15);
            gameState.ctx.beginPath();
            gameState.ctx.arc(
                eyeX,
                enemyScreenY + enemy.height * 0.4,
                2,
                0, Math.PI * 2
            );
            gameState.ctx.fill();
        }
    }
}

// Draw minimap in the corner
function drawMinimap() {
    const minimapSize = 150;
    const minimapX = gameState.canvas.width - minimapSize - 10;
    const minimapY = 10;
    const minimapScale = minimapSize / (WORLD_WIDTH * TILE_SIZE);
    
    // Draw minimap background
    gameState.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    gameState.ctx.fillRect(minimapX, minimapY, minimapSize, minimapSize);
    
    // Draw terrain on minimap
    gameState.ctx.fillStyle = '#228B22'; // Green for terrain
    for (let x = 0; x < WORLD_WIDTH; x++) {
        if (gameState.terrainHeights[x] !== undefined) {
            const mapX = minimapX + x * minimapScale * TILE_SIZE;
            const mapY = minimapY + gameState.terrainHeights[x] * minimapScale * TILE_SIZE;
            gameState.ctx.fillRect(mapX, mapY, Math.max(1, minimapScale * TILE_SIZE), 1);
        }
    }
    
    // Draw player position on minimap
    gameState.ctx.fillStyle = '#FFFFFF';
    const playerMapX = minimapX + gameState.player.x * minimapScale;
    const playerMapY = minimapY + gameState.player.y * minimapScale;
    gameState.ctx.fillRect(playerMapX - 2, playerMapY - 2, 4, 4);
    
    // Draw current view area on minimap
    gameState.ctx.strokeStyle = '#FFFFFF';
    gameState.ctx.lineWidth = 1;
    gameState.ctx.strokeRect(
        minimapX + gameState.camera.x * minimapScale,
        minimapY + gameState.camera.y * minimapScale,
        gameState.canvas.width * minimapScale,
        gameState.canvas.height * minimapScale
    );
} 