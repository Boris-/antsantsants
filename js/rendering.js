// Draw world
function drawWorld() {
    // Draw background sky
    gameState.ctx.fillStyle = '#87CEEB';
    gameState.ctx.fillRect(0, 0, gameState.canvas.width, gameState.canvas.height);
    
    // Calculate visible chunks based on zoom level
    const startChunkX = Math.floor(gameState.camera.x / TILE_SIZE / CHUNK_SIZE);
    const endChunkX = Math.ceil((gameState.camera.x + gameState.canvas.width / gameState.zoom) / TILE_SIZE / CHUNK_SIZE);
    const startChunkY = Math.floor(gameState.camera.y / TILE_SIZE / CHUNK_SIZE);
    const endChunkY = Math.ceil((gameState.camera.y + gameState.canvas.height / gameState.zoom) / TILE_SIZE / CHUNK_SIZE);
    
    // Save context state before transformations
    gameState.ctx.save();
    
    // Apply zoom transformation
    gameState.ctx.scale(gameState.zoom, gameState.zoom);
    
    // Apply camera transformation - translate to negative camera position
    gameState.ctx.translate(-gameState.camera.x, -gameState.camera.y);
    
    // Draw visible chunks
    for (let chunkY = startChunkY; chunkY <= endChunkY; chunkY++) {
        for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX++) {
            if (chunkX >= 0 && chunkX < Math.ceil(WORLD_WIDTH / CHUNK_SIZE) && 
                chunkY >= 0 && chunkY < Math.ceil(WORLD_HEIGHT / CHUNK_SIZE)) {
                drawChunk(chunkX, chunkY);
            }
        }
    }
    
    // Draw player directly in world coordinates
    drawPlayerDirect();
    
    // Draw enemies directly in world coordinates
    drawEnemiesDirect();
    
    // Restore context to original state
    gameState.ctx.restore();
    
    // Load chunks that are coming into view
    loadChunksInView(startChunkX, endChunkX, startChunkY, endChunkY);
    
    // Unload chunks that are far from view to save memory
    unloadDistantChunks(startChunkX, endChunkX, startChunkY, endChunkY);
    
    // Draw minimap (draw last so it appears on top)
    drawMinimap();
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
    
    // Calculate world position of chunk
    const worldX = chunkX * CHUNK_SIZE * TILE_SIZE;
    const worldY = chunkY * CHUNK_SIZE * TILE_SIZE;
    
    // Check if chunk is visible on screen (rough check)
    // Convert world coordinates to screen coordinates
    const screenX = (worldX - gameState.camera.x) * gameState.zoom;
    const screenY = (worldY - gameState.camera.y) * gameState.zoom;
    const chunkScreenSize = CHUNK_SIZE * TILE_SIZE * gameState.zoom;
    
    // Skip rendering if chunk is completely outside the viewport
    if (screenX > gameState.canvas.width || screenY > gameState.canvas.height || 
        screenX + chunkScreenSize < 0 || screenY + chunkScreenSize < 0) {
        return;
    }
    
    // Draw each tile in the chunk
    for (let localY = 0; localY < CHUNK_SIZE; localY++) {
        for (let localX = 0; localX < CHUNK_SIZE; localX++) {
            const tileType = chunk[localY][localX];
            if (tileType === TILE_TYPES.AIR) continue;
            
            const tileWorldX = worldX + localX * TILE_SIZE;
            const tileWorldY = worldY + localY * TILE_SIZE;
            
            // Skip rendering if tile is completely outside the viewport
            const tileScreenX = (tileWorldX - gameState.camera.x) * gameState.zoom;
            const tileScreenY = (tileWorldY - gameState.camera.y) * gameState.zoom;
            const tileScreenSize = TILE_SIZE * gameState.zoom;
            
            if (tileScreenX > gameState.canvas.width || tileScreenY > gameState.canvas.height || 
                tileScreenX + tileScreenSize < 0 || tileScreenY + tileScreenSize < 0) {
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
            gameState.ctx.fillRect(tileWorldX, tileWorldY, TILE_SIZE, TILE_SIZE);
            
            // Add some texture/detail to tiles
            addTileDetail(chunkX * CHUNK_SIZE + localX, chunkY * CHUNK_SIZE + localY, tileType, tileWorldX, tileWorldY);
        }
    }
}

// Add visual details to tiles based on type
function addTileDetail(worldX, worldY, tileType, tileWorldX, tileWorldY) {
    // Add details based on tile type
    switch (tileType) {
        case TILE_TYPES.DIRT:
            // Add some small dots for texture
            gameState.ctx.fillStyle = '#6B3300';
            for (let i = 0; i < 5; i++) {
                const dotX = tileWorldX + Math.random() * TILE_SIZE;
                const dotY = tileWorldY + Math.random() * TILE_SIZE;
                const dotSize = 1 + Math.random() * 2;
                gameState.ctx.fillRect(dotX, dotY, dotSize, dotSize);
            }
            break;
            
        case TILE_TYPES.STONE:
            // Add some cracks or lines
            gameState.ctx.strokeStyle = '#707070';
            gameState.ctx.lineWidth = 1;
            gameState.ctx.beginPath();
            gameState.ctx.moveTo(tileWorldX + TILE_SIZE * 0.2, tileWorldY + TILE_SIZE * 0.3);
            gameState.ctx.lineTo(tileWorldX + TILE_SIZE * 0.5, tileWorldY + TILE_SIZE * 0.7);
            gameState.ctx.stroke();
            break;
            
        case TILE_TYPES.GRASS:
            // Add grass blades on top
            gameState.ctx.fillStyle = '#1A6B1A';
            for (let i = 0; i < 4; i++) {
                const bladeX = tileWorldX + 4 + i * 8;
                const bladeHeight = 2 + Math.random() * 4;
                gameState.ctx.fillRect(bladeX, tileWorldY, 2, bladeHeight);
            }
            break;
            
        case TILE_TYPES.ORE:
            // Add sparkles to ore
            gameState.ctx.fillStyle = '#FFFF00';
            for (let i = 0; i < 3; i++) {
                const sparkX = tileWorldX + 5 + Math.random() * (TILE_SIZE - 10);
                const sparkY = tileWorldY + 5 + Math.random() * (TILE_SIZE - 10);
                const sparkSize = 2 + Math.random() * 2;
                gameState.ctx.fillRect(sparkX, sparkY, sparkSize, sparkSize);
            }
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
    // Apply zoom transformation
    gameState.ctx.save();
    gameState.ctx.scale(gameState.zoom, gameState.zoom);
    
    // Body
    gameState.ctx.fillStyle = '#8B4513';
    
    const playerScreenX = gameState.player.x - gameState.camera.x / gameState.zoom;
    const playerScreenY = gameState.player.y - gameState.camera.y / gameState.zoom;
    
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
    
    // Restore context
    gameState.ctx.restore();
}

// Draw enemies
function drawEnemies() {
    // Apply zoom transformation
    gameState.ctx.save();
    gameState.ctx.scale(gameState.zoom, gameState.zoom);
    
    for (const enemy of gameState.enemies) {
        const enemyScreenX = enemy.x - gameState.camera.x / gameState.zoom;
        const enemyScreenY = enemy.y - gameState.camera.y / gameState.zoom;
        
        // Only draw if on screen
        if (
            enemyScreenX > -enemy.width &&
            enemyScreenX < gameState.canvas.width / gameState.zoom &&
            enemyScreenY > -enemy.height &&
            enemyScreenY < gameState.canvas.height / gameState.zoom
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
    
    // Restore context
    gameState.ctx.restore();
}

// Draw minimap in the corner
function drawMinimap() {
    const minimapSize = 150;
    const minimapX = gameState.canvas.width - minimapSize - 10;
    const minimapY = 10;
    
    // Calculate minimap scale (how many world pixels per minimap pixel)
    const worldSizeInPixels = WORLD_WIDTH * TILE_SIZE;
    const minimapScale = minimapSize / worldSizeInPixels;
    
    // Draw minimap background
    gameState.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    gameState.ctx.fillRect(minimapX, minimapY, minimapSize, minimapSize);
    
    // Save context before drawing minimap elements
    gameState.ctx.save();
    
    // Draw loaded chunks on minimap
    for (const chunkKey in gameState.chunks) {
        const [chunkX, chunkY] = chunkKey.split(',').map(Number);
        
        // Calculate chunk position on minimap
        const chunkMinimapX = minimapX + (chunkX * CHUNK_SIZE * TILE_SIZE) * minimapScale;
        const chunkMinimapY = minimapY + (chunkY * CHUNK_SIZE * TILE_SIZE) * minimapScale;
        const chunkMinimapSize = CHUNK_SIZE * TILE_SIZE * minimapScale;
        
        // Draw chunk representation
        gameState.ctx.fillStyle = 'rgba(50, 150, 50, 0.3)';
        gameState.ctx.fillRect(
            chunkMinimapX, 
            chunkMinimapY, 
            chunkMinimapSize,
            chunkMinimapSize
        );
    }
    
    // Draw player position on minimap (as a bright dot)
    gameState.ctx.fillStyle = '#FFFFFF';
    const playerMapX = minimapX + gameState.player.x * minimapScale;
    const playerMapY = minimapY + gameState.player.y * minimapScale;
    
    // Draw player as a small circle
    gameState.ctx.beginPath();
    gameState.ctx.arc(playerMapX, playerMapY, 3, 0, Math.PI * 2);
    gameState.ctx.fill();
    
    // Draw current view area on minimap (adjusted for zoom)
    gameState.ctx.strokeStyle = '#FFFFFF';
    gameState.ctx.lineWidth = 1;
    
    // Calculate view area size based on zoom level
    const viewWidth = (gameState.canvas.width / gameState.zoom) * minimapScale;
    const viewHeight = (gameState.canvas.height / gameState.zoom) * minimapScale;
    
    gameState.ctx.strokeRect(
        minimapX + gameState.camera.x * minimapScale,
        minimapY + gameState.camera.y * minimapScale,
        viewWidth,
        viewHeight
    );
    
    // Draw border around minimap
    gameState.ctx.strokeStyle = '#FFFFFF';
    gameState.ctx.lineWidth = 2;
    gameState.ctx.strokeRect(minimapX, minimapY, minimapSize, minimapSize);
    
    // Draw zoom indicator on minimap
    gameState.ctx.fillStyle = '#FFFFFF';
    gameState.ctx.font = '10px Arial';
    gameState.ctx.fillText(`Zoom: ${Math.round(gameState.zoom * 100)}%`, minimapX + 5, minimapY + minimapSize - 5);
    
    // Restore context after drawing minimap
    gameState.ctx.restore();
}

// Draw player directly in world coordinates (used when ctx is already transformed)
function drawPlayerDirect() {
    // Body
    gameState.ctx.fillStyle = '#8B4513';
    
    // Ant body (oval)
    gameState.ctx.beginPath();
    gameState.ctx.ellipse(
        gameState.player.x + gameState.player.width / 2,
        gameState.player.y + gameState.player.height / 2,
        gameState.player.width / 2,
        gameState.player.height / 3,
        0, 0, Math.PI * 2
    );
    gameState.ctx.fill();
    
    // Head
    gameState.ctx.beginPath();
    gameState.ctx.arc(
        gameState.player.x + (gameState.player.facingRight ? gameState.player.width * 0.75 : gameState.player.width * 0.25),
        gameState.player.y + gameState.player.height / 2,
        gameState.player.width / 4,
        0, Math.PI * 2
    );
    gameState.ctx.fill();
    
    // Eyes
    gameState.ctx.fillStyle = '#FFFFFF';
    const eyeX = gameState.player.x + (gameState.player.facingRight ? gameState.player.width * 0.85 : gameState.player.width * 0.15);
    gameState.ctx.beginPath();
    gameState.ctx.arc(
        eyeX,
        gameState.player.y + gameState.player.height * 0.4,
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
            gameState.player.x + legOffsetX,
            gameState.player.y + gameState.player.height / 2
        );
        gameState.ctx.lineTo(
            gameState.player.x + legOffsetX - 5,
            gameState.player.y + gameState.player.height * 0.8
        );
        gameState.ctx.stroke();
        
        // Right legs
        gameState.ctx.beginPath();
        gameState.ctx.moveTo(
            gameState.player.x + legOffsetX,
            gameState.player.y + gameState.player.height / 2
        );
        gameState.ctx.lineTo(
            gameState.player.x + legOffsetX + 5,
            gameState.player.y + gameState.player.height * 0.8
        );
        gameState.ctx.stroke();
    }
    
    // Antennae
    gameState.ctx.beginPath();
    gameState.ctx.moveTo(
        gameState.player.x + (gameState.player.facingRight ? gameState.player.width * 0.8 : gameState.player.width * 0.2),
        gameState.player.y + gameState.player.height * 0.3
    );
    gameState.ctx.lineTo(
        gameState.player.x + (gameState.player.facingRight ? gameState.player.width * 0.9 : gameState.player.width * 0.1),
        gameState.player.y + gameState.player.height * 0.15
    );
    gameState.ctx.stroke();
    
    gameState.ctx.beginPath();
    gameState.ctx.moveTo(
        gameState.player.x + (gameState.player.facingRight ? gameState.player.width * 0.75 : gameState.player.width * 0.25),
        gameState.player.y + gameState.player.height * 0.3
    );
    gameState.ctx.lineTo(
        gameState.player.x + (gameState.player.facingRight ? gameState.player.width * 0.85 : gameState.player.width * 0.15),
        gameState.player.y + gameState.player.height * 0.15
    );
    gameState.ctx.stroke();
}

// Draw enemies directly in world coordinates (used when ctx is already transformed)
function drawEnemiesDirect() {
    for (const enemy of gameState.enemies) {
        // Only draw if on screen (rough check)
        const screenX = (enemy.x - gameState.camera.x) * gameState.zoom;
        const screenY = (enemy.y - gameState.camera.y) * gameState.zoom;
        const enemyScreenWidth = enemy.width * gameState.zoom;
        const enemyScreenHeight = enemy.height * gameState.zoom;
        
        if (
            screenX > -enemyScreenWidth &&
            screenX < gameState.canvas.width &&
            screenY > -enemyScreenHeight &&
            screenY < gameState.canvas.height
        ) {
            // Bug enemy
            gameState.ctx.fillStyle = '#FF0000';
            
            // Body
            gameState.ctx.beginPath();
            gameState.ctx.ellipse(
                enemy.x + enemy.width / 2,
                enemy.y + enemy.height / 2,
                enemy.width / 2,
                enemy.height / 3,
                0, 0, Math.PI * 2
            );
            gameState.ctx.fill();
            
            // Head
            const facingRight = enemy.velocityX > 0;
            gameState.ctx.beginPath();
            gameState.ctx.arc(
                enemy.x + (facingRight ? enemy.width * 0.75 : enemy.width * 0.25),
                enemy.y + enemy.height / 2,
                enemy.width / 4,
                0, Math.PI * 2
            );
            gameState.ctx.fill();
            
            // Eyes
            gameState.ctx.fillStyle = '#FFFFFF';
            const eyeX = enemy.x + (facingRight ? enemy.width * 0.85 : enemy.width * 0.15);
            gameState.ctx.beginPath();
            gameState.ctx.arc(
                eyeX,
                enemy.y + enemy.height * 0.4,
                2,
                0, Math.PI * 2
            );
            gameState.ctx.fill();
        }
    }
} 