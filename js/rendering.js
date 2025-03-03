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
    
    // Draw particles directly in world coordinates, but only if not zooming
    if (!gameState.isZooming && typeof drawParticlesDirect === 'function') {
        drawParticlesDirect();
    }
    
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
                case TILE_TYPES.COAL:
                    gameState.ctx.fillStyle = '#2C2C2C'; // Dark gray for coal
                    break;
                case TILE_TYPES.IRON:
                    gameState.ctx.fillStyle = '#C0C0C0'; // Silver color for iron
                    break;
                case TILE_TYPES.GOLD:
                    gameState.ctx.fillStyle = '#DAA520'; // Golden rod for gold
                    break;
                case TILE_TYPES.DIAMOND:
                    gameState.ctx.fillStyle = '#00FFFF'; // Cyan for diamond
                    break;
                case TILE_TYPES.WOOD:
                    gameState.ctx.fillStyle = '#8B4513'; // Brown for wood
                    break;
                case TILE_TYPES.LEAVES:
                    gameState.ctx.fillStyle = '#006400'; // Dark green for leaves
                    break;
                case TILE_TYPES.BUSH:
                    gameState.ctx.fillStyle = '#228B22'; // Forest green for bushes
                    break;
                case TILE_TYPES.FLOWER:
                    gameState.ctx.fillStyle = '#FF69B4'; // Pink for flowers
                    break;
                case TILE_TYPES.TALL_GRASS:
                    gameState.ctx.fillStyle = '#32CD32'; // Lime green for tall grass
                    break;
                case TILE_TYPES.CACTUS:
                    gameState.ctx.fillStyle = '#2E8B57'; // Sea green for cactus
                    break;
                case TILE_TYPES.SNOW:
                    gameState.ctx.fillStyle = '#FFFAFA'; // Snow white
                    break;
                case TILE_TYPES.MUSHROOM:
                    gameState.ctx.fillStyle = '#B22222'; // Firebrick red for mushrooms
                    break;
                case TILE_TYPES.WATER:
                    gameState.ctx.fillStyle = '#4169E1'; // Royal blue for water
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
            
        case TILE_TYPES.COAL:
            // Add black specks
            gameState.ctx.fillStyle = '#000000';
            for (let i = 0; i < 4; i++) {
                const speckX = tileWorldX + 5 + Math.random() * (TILE_SIZE - 10);
                const speckY = tileWorldY + 5 + Math.random() * (TILE_SIZE - 10);
                const speckSize = 2 + Math.random() * 3;
                gameState.ctx.fillRect(speckX, speckY, speckSize, speckSize);
            }
            break;
            
        case TILE_TYPES.IRON:
            // Add metallic streaks
            gameState.ctx.strokeStyle = '#A0A0A0';
            gameState.ctx.lineWidth = 1;
            for (let i = 0; i < 2; i++) {
                const startX = tileWorldX + Math.random() * TILE_SIZE;
                const startY = tileWorldY + Math.random() * TILE_SIZE;
                const endX = startX + (Math.random() * 10) - 5;
                const endY = startY + (Math.random() * 10) - 5;
                
                gameState.ctx.beginPath();
                gameState.ctx.moveTo(startX, startY);
                gameState.ctx.lineTo(endX, endY);
                gameState.ctx.stroke();
            }
            break;
            
        case TILE_TYPES.GOLD:
            // Add golden sparkles
            gameState.ctx.fillStyle = '#FFFF33';
            for (let i = 0; i < 5; i++) {
                const sparkX = tileWorldX + 3 + Math.random() * (TILE_SIZE - 6);
                const sparkY = tileWorldY + 3 + Math.random() * (TILE_SIZE - 6);
                const sparkSize = 1 + Math.random() * 2;
                gameState.ctx.fillRect(sparkX, sparkY, sparkSize, sparkSize);
            }
            break;
            
        case TILE_TYPES.DIAMOND:
            // Add diamond sparkles
            gameState.ctx.fillStyle = '#FFFFFF';
            for (let i = 0; i < 4; i++) {
                const sparkX = tileWorldX + 5 + Math.random() * (TILE_SIZE - 10);
                const sparkY = tileWorldY + 5 + Math.random() * (TILE_SIZE - 10);
                
                // Draw a small diamond shape
                gameState.ctx.beginPath();
                gameState.ctx.moveTo(sparkX, sparkY - 2);
                gameState.ctx.lineTo(sparkX + 2, sparkY);
                gameState.ctx.lineTo(sparkX, sparkY + 2);
                gameState.ctx.lineTo(sparkX - 2, sparkY);
                gameState.ctx.closePath();
                gameState.ctx.fill();
            }
            break;
            
        case TILE_TYPES.WOOD:
            // Add wood grain texture
            gameState.ctx.strokeStyle = '#6B4226';
            gameState.ctx.lineWidth = 1;
            
            // Vertical grain lines
            for (let i = 0; i < 3; i++) {
                const lineX = tileWorldX + 8 + i * 8;
                
                gameState.ctx.beginPath();
                gameState.ctx.moveTo(lineX, tileWorldY);
                gameState.ctx.lineTo(lineX, tileWorldY + TILE_SIZE);
                gameState.ctx.stroke();
            }
            
            // Horizontal rings
            for (let i = 0; i < 2; i++) {
                const ringY = tileWorldY + 10 + i * 12;
                
                gameState.ctx.beginPath();
                gameState.ctx.moveTo(tileWorldX, ringY);
                gameState.ctx.lineTo(tileWorldX + TILE_SIZE, ringY);
                gameState.ctx.stroke();
            }
            break;
            
        case TILE_TYPES.LEAVES:
            // Add leaf texture with small dots
            gameState.ctx.fillStyle = '#004D00';
            for (let i = 0; i < 8; i++) {
                const dotX = tileWorldX + Math.random() * TILE_SIZE;
                const dotY = tileWorldY + Math.random() * TILE_SIZE;
                const dotSize = 1 + Math.random() * 2;
                gameState.ctx.fillRect(dotX, dotY, dotSize, dotSize);
            }
            
            // Add some lighter spots to represent light through leaves
            gameState.ctx.fillStyle = '#00FF00';
            for (let i = 0; i < 3; i++) {
                const spotX = tileWorldX + Math.random() * TILE_SIZE;
                const spotY = tileWorldY + Math.random() * TILE_SIZE;
                const spotSize = 1 + Math.random() * 1.5;
                gameState.ctx.fillRect(spotX, spotY, spotSize, spotSize);
            }
            break;
            
        case TILE_TYPES.BUSH:
            // Add bush texture (similar to leaves but more rounded)
            gameState.ctx.fillStyle = '#004D00';
            
            // Draw a more rounded shape for the bush
            gameState.ctx.beginPath();
            gameState.ctx.arc(tileWorldX + TILE_SIZE / 2, tileWorldY + TILE_SIZE / 2, 
                             TILE_SIZE / 2 - 2, 0, Math.PI * 2);
            gameState.ctx.fill();
            
            // Add some lighter spots
            gameState.ctx.fillStyle = '#00FF00';
            for (let i = 0; i < 4; i++) {
                const spotX = tileWorldX + 5 + Math.random() * (TILE_SIZE - 10);
                const spotY = tileWorldY + 5 + Math.random() * (TILE_SIZE - 10);
                const spotSize = 1 + Math.random() * 2;
                gameState.ctx.fillRect(spotX, spotY, spotSize, spotSize);
            }
            break;
            
        case TILE_TYPES.FLOWER:
            // Draw flower stem
            gameState.ctx.fillStyle = '#228B22';
            gameState.ctx.fillRect(
                tileWorldX + TILE_SIZE / 2 - 1,
                tileWorldY + TILE_SIZE / 2,
                2,
                TILE_SIZE / 2
            );
            
            // Draw flower petals
            gameState.ctx.fillStyle = '#FF69B4';
            const centerX = tileWorldX + TILE_SIZE / 2;
            const centerY = tileWorldY + TILE_SIZE / 3;
            const petalSize = TILE_SIZE / 5;
            
            // Draw 5 petals
            for (let i = 0; i < 5; i++) {
                const angle = (i / 5) * Math.PI * 2;
                const petalX = centerX + Math.cos(angle) * petalSize;
                const petalY = centerY + Math.sin(angle) * petalSize;
                
                gameState.ctx.beginPath();
                gameState.ctx.arc(petalX, petalY, petalSize, 0, Math.PI * 2);
                gameState.ctx.fill();
            }
            
            // Draw flower center
            gameState.ctx.fillStyle = '#FFFF00';
            gameState.ctx.beginPath();
            gameState.ctx.arc(centerX, centerY, petalSize / 2, 0, Math.PI * 2);
            gameState.ctx.fill();
            break;
            
        case TILE_TYPES.TALL_GRASS:
            // Draw tall grass blades
            gameState.ctx.fillStyle = '#32CD32';
            
            for (let i = 0; i < 6; i++) {
                const baseX = tileWorldX + 3 + i * 5;
                const height = TILE_SIZE * 0.7 + Math.random() * (TILE_SIZE * 0.3);
                const width = 2 + Math.random() * 2;
                
                // Draw a blade of grass (slightly curved)
                gameState.ctx.beginPath();
                gameState.ctx.moveTo(baseX, tileWorldY + TILE_SIZE);
                
                // Control point for curve
                const cpX = baseX + (Math.random() * 6 - 3);
                const cpY = tileWorldY + TILE_SIZE - height / 2;
                
                // End point
                const endX = baseX + (Math.random() * 8 - 4);
                const endY = tileWorldY + TILE_SIZE - height;
                
                gameState.ctx.quadraticCurveTo(cpX, cpY, endX, endY);
                gameState.ctx.lineTo(endX + width, endY);
                gameState.ctx.quadraticCurveTo(cpX + width, cpY, baseX + width, tileWorldY + TILE_SIZE);
                gameState.ctx.closePath();
                gameState.ctx.fill();
            }
            break;
            
        case TILE_TYPES.CACTUS:
            // Draw cactus body
            gameState.ctx.fillStyle = '#2E8B57';
            
            // Main cactus body
            gameState.ctx.fillRect(
                tileWorldX + TILE_SIZE / 4,
                tileWorldY,
                TILE_SIZE / 2,
                TILE_SIZE
            );
            
            // Add cactus arms (50% chance for each arm)
            if (Math.random() > 0.5) {
                // Left arm
                gameState.ctx.fillRect(
                    tileWorldX,
                    tileWorldY + TILE_SIZE / 3,
                    TILE_SIZE / 4,
                    TILE_SIZE / 4
                );
            }
            
            if (Math.random() > 0.5) {
                // Right arm
                gameState.ctx.fillRect(
                    tileWorldX + TILE_SIZE * 3/4,
                    tileWorldY + TILE_SIZE / 2,
                    TILE_SIZE / 4,
                    TILE_SIZE / 4
                );
            }
            
            // Add cactus spines
            gameState.ctx.fillStyle = '#FFFFFF';
            for (let i = 0; i < 8; i++) {
                const spineX = tileWorldX + TILE_SIZE / 4 + (i % 2 === 0 ? -1 : TILE_SIZE / 2);
                const spineY = tileWorldY + 5 + i * (TILE_SIZE / 8);
                
                gameState.ctx.fillRect(spineX, spineY, 1, 2);
            }
            break;
            
        case TILE_TYPES.SNOW:
            // Add snow texture with small sparkles
            gameState.ctx.fillStyle = '#FFFFFF';
            for (let i = 0; i < 5; i++) {
                const sparkX = tileWorldX + Math.random() * TILE_SIZE;
                const sparkY = tileWorldY + Math.random() * TILE_SIZE;
                
                gameState.ctx.beginPath();
                gameState.ctx.arc(sparkX, sparkY, 1, 0, Math.PI * 2);
                gameState.ctx.fill();
            }
            break;
            
        case TILE_TYPES.MUSHROOM:
            // Draw mushroom stem
            gameState.ctx.fillStyle = '#F5DEB3'; // Wheat color
            gameState.ctx.fillRect(
                tileWorldX + TILE_SIZE / 2 - 2,
                tileWorldY + TILE_SIZE / 2,
                4,
                TILE_SIZE / 2
            );
            
            // Draw mushroom cap
            gameState.ctx.fillStyle = '#B22222'; // Firebrick red
            gameState.ctx.beginPath();
            gameState.ctx.arc(
                tileWorldX + TILE_SIZE / 2,
                tileWorldY + TILE_SIZE / 3,
                TILE_SIZE / 3,
                0, Math.PI, true
            );
            gameState.ctx.fill();
            
            // Add mushroom spots
            gameState.ctx.fillStyle = '#FFFFFF';
            for (let i = 0; i < 4; i++) {
                const spotX = tileWorldX + TILE_SIZE / 3 + Math.random() * (TILE_SIZE / 3);
                const spotY = tileWorldY + TILE_SIZE / 6 + Math.random() * (TILE_SIZE / 6);
                const spotSize = 1 + Math.random() * 2;
                
                gameState.ctx.beginPath();
                gameState.ctx.arc(spotX, spotY, spotSize, 0, Math.PI * 2);
                gameState.ctx.fill();
            }
            break;
            
        case TILE_TYPES.WATER:
            // Add water ripple effect
            gameState.ctx.strokeStyle = '#87CEEB'; // Sky blue
            gameState.ctx.lineWidth = 1;
            
            for (let i = 0; i < 3; i++) {
                const y = tileWorldY + 8 + i * 8;
                
                gameState.ctx.beginPath();
                gameState.ctx.moveTo(tileWorldX, y);
                
                // Create a wavy line
                for (let x = 0; x <= TILE_SIZE; x += 4) {
                    const waveHeight = Math.sin(x / 4 + (worldX + worldY) / 10) * 2;
                    gameState.ctx.lineTo(tileWorldX + x, y + waveHeight);
                }
                
                gameState.ctx.stroke();
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
            
            // If chunk has been modified, ensure it's saved to server before unloading
            if (gameState.isMultiplayer && window.socket && window.socket.connected) {
                // Check if we have metadata for this chunk
                const hasMetadata = gameState.chunkMetadata && gameState.chunkMetadata[chunkKey];
                
                // Only send to server if it was loaded from server or has local modifications
                if (hasMetadata && (gameState.chunkMetadata[chunkKey].loadedFromServer || 
                                   gameState.chunkMetadata[chunkKey].locallyModified)) {
                    // Send chunk back to server before unloading
                    window.socket.emit('saveChunk', {
                        chunkX: chunkX,
                        chunkY: chunkY,
                        data: gameState.chunks[chunkKey]
                    });
                    
                    console.log(`Saved chunk ${chunkKey} to server before unloading`);
                }
            } else {
                // For single player, mark for local saving
                gameState.hasUnsavedChanges = true;
            }
            
            // Remove from loaded chunks set if it exists
            if (gameState.loadedChunks && gameState.loadedChunks.has(chunkKey)) {
                gameState.loadedChunks.delete(chunkKey);
            }
            
            // Remove from loaded chunks
            delete gameState.chunks[chunkKey];
            
            // Also remove metadata if it exists
            if (gameState.chunkMetadata && gameState.chunkMetadata[chunkKey]) {
                delete gameState.chunkMetadata[chunkKey];
            }
        }
    }
}

// Draw player (ant)
function drawPlayer() {
    // This function is now just a wrapper for drawAnt
    // which is defined in game.js
    if (typeof drawAnt === 'function') {
        drawAnt();
    }
}

// Draw enemies
function drawEnemies() {
    // Draw other players if the function exists
    if (typeof drawOtherPlayers === 'function') {
        drawOtherPlayers();
    }
    
    for (const enemy of gameState.enemies) {
        // Only draw if on screen (rough check)
        const screenX = Math.round((enemy.x - gameState.camera.x) * gameState.zoom);
        const screenY = Math.round((enemy.y - gameState.camera.y) * gameState.zoom);
        const screenWidth = enemy.width * gameState.zoom;
        const screenHeight = enemy.height * gameState.zoom;
        
        // Check if enemy is visible in the current view
        if (
            screenX + screenWidth > 0 &&
            screenX < gameState.canvas.width &&
            screenY + screenHeight > 0 &&
            screenY < gameState.canvas.height
        ) {
            // Bug enemy
            gameState.ctx.fillStyle = '#FF0000';
            
            // Body
            gameState.ctx.beginPath();
            gameState.ctx.ellipse(
                screenX + screenWidth / 2,
                screenY + screenHeight / 2,
                screenWidth / 2,
                screenHeight / 2,
                0, 0, Math.PI * 2
            );
            gameState.ctx.fill();
            
            // Eyes
            gameState.ctx.fillStyle = '#FFFFFF';
            
            // Left eye
            gameState.ctx.beginPath();
            gameState.ctx.arc(
                screenX + screenWidth * 0.3,
                screenY + screenHeight * 0.3,
                screenWidth * 0.1,
                0, Math.PI * 2
            );
            gameState.ctx.fill();
            
            // Right eye
            gameState.ctx.beginPath();
            gameState.ctx.arc(
                screenX + screenWidth * 0.7,
                screenY + screenHeight * 0.3,
                screenWidth * 0.1,
                0, Math.PI * 2
            );
            gameState.ctx.fill();
        }
    }
}

// Draw minimap in the corner
function drawMinimap() {
    // Minimap settings
    const minimapWidth = 150;
    const minimapHeight = 100;
    const minimapX = gameState.canvas.width - minimapWidth - 10;
    const minimapY = 10;
    const minimapScale = minimapWidth / WORLD_WIDTH;
    
    // Draw minimap background
    gameState.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    gameState.ctx.fillRect(minimapX, minimapY, minimapWidth, minimapHeight);
    
    // Draw terrain on minimap
    for (let x = 0; x < WORLD_WIDTH; x += 10) { // Sample every 10 blocks for performance
        if (gameState.terrainHeights[x] !== undefined) {
            const terrainHeight = gameState.terrainHeights[x];
            
            // Get biome at this x position
            const biome = gameState.biomeMap[x];
            
            // Set color based on biome
            if (biome) {
                gameState.ctx.fillStyle = biome.mapColor || '#7CFC00'; // Default light green
            } else {
                gameState.ctx.fillStyle = '#7CFC00'; // Default light green
            }
            
            // Draw a line from the terrain height to the bottom of the minimap
            const mapX = minimapX + x * minimapScale;
            const mapY = minimapY + (terrainHeight * minimapScale);
            const lineHeight = minimapHeight - (terrainHeight * minimapScale);
            
            gameState.ctx.fillRect(mapX, mapY, minimapScale * 10, lineHeight);
        }
    }
    
    // Draw player position on minimap
    const playerMapX = minimapX + (gameState.player.x / TILE_SIZE) * minimapScale;
    const playerMapY = minimapY + (gameState.player.y / TILE_SIZE) * minimapScale;
    
    gameState.ctx.fillStyle = '#FF0000';
    gameState.ctx.beginPath();
    gameState.ctx.arc(playerMapX, playerMapY, 2, 0, Math.PI * 2);
    gameState.ctx.fill();
    
    // Draw current view area on minimap
    const viewX = minimapX + (gameState.camera.x / TILE_SIZE) * minimapScale;
    const viewY = minimapY + (gameState.camera.y / TILE_SIZE) * minimapScale;
    const viewWidth = (gameState.canvas.width / gameState.zoom / TILE_SIZE) * minimapScale;
    const viewHeight = (gameState.canvas.height / gameState.zoom / TILE_SIZE) * minimapScale;
    
    gameState.ctx.strokeStyle = '#FFFFFF';
    gameState.ctx.lineWidth = 1;
    gameState.ctx.strokeRect(viewX, viewY, viewWidth, viewHeight);
    
    // Draw biome name
    const playerX = Math.floor(gameState.player.x / TILE_SIZE);
    if (playerX >= 0 && playerX < WORLD_WIDTH && gameState.biomeMap[playerX]) {
        const biomeName = gameState.biomeMap[playerX].name;
        gameState.ctx.fillStyle = '#FFFFFF';
        gameState.ctx.font = '10px Arial';
        gameState.ctx.fillText(`Biome: ${biomeName}`, minimapX + 5, minimapY + minimapHeight + 12);
    }
}

// Draw player directly in world coordinates (used when ctx is already transformed)
function drawPlayerDirect() {
    // Check if we have the direct drawing function
    if (typeof drawAntDirect === 'function') {
        // Use the direct drawing function that doesn't apply zoom
        drawAntDirect();
    } else {
        // Fallback to the original method
        // Save current transformation state
        gameState.ctx.save();
        
        // Temporarily adjust camera to work with drawAnt
        const originalCameraX = gameState.camera.x;
        const originalCameraY = gameState.camera.y;
        
        // Set camera to 0 since context is already transformed
        gameState.camera.x = 0;
        gameState.camera.y = 0;
        
        // Draw the ant using the main function
        if (typeof drawAnt === 'function') {
            // Temporarily set zoom to 1 to avoid double-zooming
            const originalZoom = gameState.zoom;
            gameState.zoom = 1;
            
            drawAnt();
            
            // Restore zoom
            gameState.zoom = originalZoom;
        }
        
        // Restore camera position
        gameState.camera.x = originalCameraX;
        gameState.camera.y = originalCameraY;
        
        // Restore transformation state
        gameState.ctx.restore();
    }
}

// Draw enemies directly in world coordinates (used when ctx is already transformed)
function drawEnemiesDirect() {
    // Draw other players if the function exists
    if (typeof drawOtherPlayersDirect === 'function') {
        drawOtherPlayersDirect();
    }
    
    for (const enemy of gameState.enemies) {
        // Only draw if on screen (rough check)
        // Since context is already transformed, we don't need to apply zoom here
        const enemyX = enemy.x;
        const enemyY = enemy.y;
        
        // Check if enemy is visible in the current view
        if (
            enemyX + enemy.width > gameState.camera.x &&
            enemyX < gameState.camera.x + (gameState.canvas.width / gameState.zoom) &&
            enemyY + enemy.height > gameState.camera.y &&
            enemyY < gameState.camera.y + (gameState.canvas.height / gameState.zoom)
        ) {
            // Bug enemy
            gameState.ctx.fillStyle = '#FF0000';
            
            // Body
            gameState.ctx.beginPath();
            gameState.ctx.ellipse(
                enemy.x + enemy.width / 2,
                enemy.y + enemy.height / 2,
                enemy.width / 2,
                enemy.height / 2,
                0, 0, Math.PI * 2
            );
            gameState.ctx.fill();
            
            // Eyes
            gameState.ctx.fillStyle = '#FFFFFF';
            
            // Left eye
            gameState.ctx.beginPath();
            gameState.ctx.arc(
                enemy.x + enemy.width * 0.3,
                enemy.y + enemy.height * 0.3,
                enemy.width * 0.1,
                0, Math.PI * 2
            );
            gameState.ctx.fill();
            
            // Right eye
            gameState.ctx.beginPath();
            gameState.ctx.arc(
                enemy.x + enemy.width * 0.7,
                enemy.y + enemy.height * 0.3,
                enemy.width * 0.1,
                0, Math.PI * 2
            );
            gameState.ctx.fill();
        }
    }
} 