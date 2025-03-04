// Tile color mapping
const TILE_COLORS = {
    [TILE_TYPES.DIRT]: '#8B4513',
    [TILE_TYPES.STONE]: '#808080',
    [TILE_TYPES.GRASS]: '#228B22',
    [TILE_TYPES.SAND]: '#F0E68C',
    [TILE_TYPES.ORE]: '#FFD700',
    [TILE_TYPES.BEDROCK]: '#1C1C1C',
    [TILE_TYPES.COAL]: '#2C2C2C',
    [TILE_TYPES.IRON]: '#C0C0C0',
    [TILE_TYPES.GOLD]: '#DAA520',
    [TILE_TYPES.DIAMOND]: '#00FFFF',
    [TILE_TYPES.WOOD]: '#8B4513',
    [TILE_TYPES.LEAVES]: '#006400',
    [TILE_TYPES.BUSH]: '#228B22',
    [TILE_TYPES.FLOWER]: '#FF69B4',
    [TILE_TYPES.TALL_GRASS]: '#32CD32',
    [TILE_TYPES.CACTUS]: '#2E8B57',
    [TILE_TYPES.SNOW]: '#FFFAFA',
    [TILE_TYPES.MUSHROOM]: '#B22222',
    [TILE_TYPES.WATER]: '#4169E1',
    [TILE_TYPES.CLOUD]: 'rgba(255, 255, 255, 0.7)' // Semi-transparent white for clouds
};

// Draw world
function drawWorld() {
    const { ctx, canvas, camera, zoom, isZooming } = gameState;
    
    // Draw background sky based on time of day
    const skyColor = getSkyColor();
    ctx.fillStyle = skyColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw sun or moon based on time of day
    drawCelestialBody();
    
    // Calculate visible chunks based on zoom level
    const startChunkX = Math.floor(camera.x / TILE_SIZE / CHUNK_SIZE);
    const endChunkX = Math.ceil((camera.x + canvas.width / zoom) / TILE_SIZE / CHUNK_SIZE);
    const startChunkY = Math.floor(camera.y / TILE_SIZE / CHUNK_SIZE);
    const endChunkY = Math.ceil((camera.y + canvas.height / zoom) / TILE_SIZE / CHUNK_SIZE);
    
    // Save context state before transformations
    ctx.save();
    
    // Apply camera and zoom transformations
    ctx.scale(zoom, zoom);
    ctx.translate(-camera.x, -camera.y);
    
    // Draw visible chunks
    const maxChunkX = Math.ceil(WORLD_WIDTH / CHUNK_SIZE);
    const maxChunkY = Math.ceil(WORLD_HEIGHT / CHUNK_SIZE);
    
    for (let chunkY = startChunkY; chunkY <= endChunkY; chunkY++) {
        if (chunkY < 0 || chunkY >= maxChunkY) continue;
        
        for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX++) {
            if (chunkX < 0 || chunkX >= maxChunkX) continue;
            drawChunk(chunkX, chunkY);
        }
    }
    
    // Draw entities
    drawPlayerDirect();
    drawEnemiesDirect();
    
    // Draw particles if not zooming
    if (!isZooming && typeof drawParticlesDirect === 'function') {
        drawParticlesDirect();
    }
    
    // Restore context
    ctx.restore();
    
    // Handle chunk loading/unloading
    loadChunksInView(startChunkX, endChunkX, startChunkY, endChunkY);
    unloadDistantChunks(startChunkX, endChunkX, startChunkY, endChunkY);
    
    // Draw UI elements last
    drawMinimap();
}

// Draw a single chunk
function drawChunk(chunkX, chunkY) {
    const chunkKey = `${chunkX},${chunkY}`;
    const chunk = gameState.chunks[chunkKey] || generateChunk(chunkX, chunkY);
    
    // Calculate world position of chunk
    const worldX = chunkX * CHUNK_SIZE * TILE_SIZE;
    const worldY = chunkY * CHUNK_SIZE * TILE_SIZE;
    
    // Check if chunk is visible (screen space calculation)
    const screenX = (worldX - gameState.camera.x) * gameState.zoom;
    const screenY = (worldY - gameState.camera.y) * gameState.zoom;
    const chunkScreenSize = CHUNK_SIZE * TILE_SIZE * gameState.zoom;
    
    if (!isOnScreen(screenX, screenY, chunkScreenSize, chunkScreenSize)) {
        return;
    }
    
    // Draw visible tiles
    const ctx = gameState.ctx;
    for (let localY = 0; localY < CHUNK_SIZE; localY++) {
        for (let localX = 0; localX < CHUNK_SIZE; localX++) {
            const tileType = chunk[localY][localX];
            if (tileType === TILE_TYPES.AIR) continue;
            
            const tileWorldX = worldX + localX * TILE_SIZE;
            const tileWorldY = worldY + localY * TILE_SIZE;
            
            // Skip if tile is not visible
            const tileScreenX = (tileWorldX - gameState.camera.x) * gameState.zoom;
            const tileScreenY = (tileWorldY - gameState.camera.y) * gameState.zoom;
            const tileScreenSize = TILE_SIZE * gameState.zoom;
            
            if (!isOnScreen(tileScreenX, tileScreenY, tileScreenSize, tileScreenSize)) {
                continue;
            }
            
            // Draw tile with color from mapping
            if (tileType === TILE_TYPES.CLOUD) {
                // Set globalAlpha for semi-transparent clouds
                const originalAlpha = ctx.globalAlpha;
                ctx.globalAlpha = 0.7;
                ctx.fillStyle = TILE_COLORS[tileType] || '#FF00FF';
                ctx.fillRect(tileWorldX, tileWorldY, TILE_SIZE, TILE_SIZE);
                ctx.globalAlpha = originalAlpha;
            } else {
                ctx.fillStyle = TILE_COLORS[tileType] || '#FF00FF';
                ctx.fillRect(tileWorldX, tileWorldY, TILE_SIZE, TILE_SIZE);
            }
            
            // Add tile details if zoomed in enough
            if (gameState.zoom >= 1) {
                addTileDetail(chunkX * CHUNK_SIZE + localX, chunkY * CHUNK_SIZE + localY, tileType, tileWorldX, tileWorldY);
            }
        }
    }
}

// Helper function to check if an element is visible on screen
function isOnScreen(x, y, width, height) {
    return !(x > gameState.canvas.width || y > gameState.canvas.height || 
             x + width < 0 || y + height < 0);
}

// Add visual details to tiles based on type
function addTileDetail(worldX, worldY, tileType, tileWorldX, tileWorldY) {
    const ctx = gameState.ctx;
    
    switch (tileType) {
        case TILE_TYPES.DIRT:
            addRandomDots(ctx, tileWorldX, tileWorldY, '#6B3300', 5, 1, 2);
            break;
            
        case TILE_TYPES.STONE:
            addCracks(ctx, tileWorldX, tileWorldY, '#707070');
            break;
            
        case TILE_TYPES.GRASS:
            addGrassBlades(ctx, tileWorldX, tileWorldY);
            break;
            
        case TILE_TYPES.ORE:
        case TILE_TYPES.GOLD:
            addSparkles(ctx, tileWorldX, tileWorldY, '#FFFF00', 3);
            break;
            
        case TILE_TYPES.COAL:
            addRandomDots(ctx, tileWorldX, tileWorldY, '#000000', 4, 2, 3);
            break;
            
        case TILE_TYPES.IRON:
            addMetallicStreaks(ctx, tileWorldX, tileWorldY);
            break;
            
        case TILE_TYPES.CLOUD:
            addCloudWisps(ctx, tileWorldX, tileWorldY);
            break;
    }
}

// Helper functions for tile details
function addRandomDots(ctx, x, y, color, count, minSize, maxSize) {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
        const dotX = x + 5 + Math.random() * (TILE_SIZE - 10);
        const dotY = y + 5 + Math.random() * (TILE_SIZE - 10);
        const dotSize = minSize + Math.random() * (maxSize - minSize);
        ctx.fillRect(dotX, dotY, dotSize, dotSize);
    }
}

function addCracks(ctx, x, y, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + TILE_SIZE * 0.2, y + TILE_SIZE * 0.3);
    ctx.lineTo(x + TILE_SIZE * 0.5, y + TILE_SIZE * 0.7);
    ctx.stroke();
}

function addGrassBlades(ctx, x, y) {
    ctx.fillStyle = '#1A6B1A';
    for (let i = 0; i < 4; i++) {
        const bladeX = x + 4 + i * 8;
        const bladeHeight = 2 + Math.random() * 4;
        ctx.fillRect(bladeX, y, 2, bladeHeight);
    }
}

function addSparkles(ctx, x, y, color, count) {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
        const sparkX = x + 5 + Math.random() * (TILE_SIZE - 10);
        const sparkY = y + 5 + Math.random() * (TILE_SIZE - 10);
        const sparkSize = 2 + Math.random() * 2;
        ctx.fillRect(sparkX, sparkY, sparkSize, sparkSize);
    }
}

function addMetallicStreaks(ctx, x, y) {
    ctx.strokeStyle = '#A0A0A0';
    ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
        const startX = x + Math.random() * TILE_SIZE;
        const startY = y + Math.random() * TILE_SIZE;
        const endX = startX + (Math.random() * 10) - 5;
        const endY = startY + (Math.random() * 10) - 5;
        
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    }
}

// Add wispy details to cloud blocks
function addCloudWisps(ctx, x, y) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    
    // Add random curved wisps
    const wispsCount = 3 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < wispsCount; i++) {
        const offsetX = 5 + Math.random() * (TILE_SIZE - 10);
        const offsetY = 5 + Math.random() * (TILE_SIZE - 10);
        const size = 3 + Math.random() * 4;
        
        ctx.beginPath();
        ctx.arc(x + offsetX, y + offsetY, size, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Add some brightness to the center
    const grd = ctx.createRadialGradient(
        x + TILE_SIZE/2, y + TILE_SIZE/2, 2, 
        x + TILE_SIZE/2, y + TILE_SIZE/2, TILE_SIZE/2
    );
    grd.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    grd.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = grd;
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
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

// Function to calculate sky color based on time of day
function getSkyColor() {
    if (!gameState.dayNightCycle || !gameState.dayNightCycle.enabled) {
        return '#87CEEB'; // Default sky blue
    }
    
    const time = gameState.dayNightCycle.time;
    
    // Day: 0.25 to 0.75 (noon at 0.5)
    // Night: 0.75 to 0.25 (midnight at 0)
    
    // Dawn/dusk transition periods
    const dawnStart = 0.2;
    const dawnEnd = 0.3;
    const duskStart = 0.7;
    const duskEnd = 0.8;
    
    // Day and night colors
    const dayColor = { r: 135, g: 206, b: 235 }; // Sky blue
    const nightColor = { r: 10, g: 10, b: 35 };  // Dark blue
    const dawnDuskColor = { r: 255, g: 130, b: 80 }; // Orange-ish
    
    // Helper to interpolate between colors
    function interpolateColor(color1, color2, factor) {
        return {
            r: Math.round(color1.r + (color2.r - color1.r) * factor),
            g: Math.round(color1.g + (color2.g - color1.g) * factor),
            b: Math.round(color1.b + (color2.b - color1.b) * factor)
        };
    }
    
    // Dawn transition
    if (time >= dawnStart && time <= dawnEnd) {
        const factor = (time - dawnStart) / (dawnEnd - dawnStart);
        const color = interpolateColor(nightColor, dawnDuskColor, factor);
        return `rgb(${color.r}, ${color.g}, ${color.b})`;
    } 
    // Morning transition
    else if (time > dawnEnd && time < 0.5) {
        const factor = (time - dawnEnd) / (0.5 - dawnEnd);
        const color = interpolateColor(dawnDuskColor, dayColor, factor);
        return `rgb(${color.r}, ${color.g}, ${color.b})`;
    }
    // Afternoon
    else if (time >= 0.5 && time < duskStart) {
        return `rgb(${dayColor.r}, ${dayColor.g}, ${dayColor.b})`;
    }
    // Dusk transition
    else if (time >= duskStart && time <= duskEnd) {
        const factor = (time - duskStart) / (duskEnd - duskStart);
        const color = interpolateColor(dayColor, dawnDuskColor, factor);
        return `rgb(${color.r}, ${color.g}, ${color.b})`;
    }
    // Night transition
    else if (time > duskEnd && time < 1.0) {
        const factor = (time - duskEnd) / (1.0 - duskEnd);
        const color = interpolateColor(dawnDuskColor, nightColor, factor);
        return `rgb(${color.r}, ${color.g}, ${color.b})`;
    }
    // Deep night
    else {
        return `rgb(${nightColor.r}, ${nightColor.g}, ${nightColor.b})`;
    }
}

// Function to draw the sun or moon
function drawCelestialBody() {
    if (!gameState.dayNightCycle || !gameState.dayNightCycle.enabled) {
        return;
    }
    
    const { ctx, canvas } = gameState;
    const time = gameState.dayNightCycle.time;
    
    // Position the celestial body based on time (circular path across the sky)
    const angle = (time * 2 * Math.PI) - (Math.PI / 2); // Start at top (noon)
    const radius = Math.min(canvas.width, canvas.height) * 0.4; // Orbit radius
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height + radius * 0.5; // Position horizon lower
    
    // Only show celestial body when it's above the horizon
    if (time >= 0.25 && time <= 0.75) {
        // It's daytime - draw the sun
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        const sunSize = 40;
        
        // Draw sun glow
        const gradient = ctx.createRadialGradient(x, y, sunSize * 0.5, x, y, sunSize * 2);
        gradient.addColorStop(0, 'rgba(255, 255, 200, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 240, 150, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x - sunSize * 2, y - sunSize * 2, sunSize * 4, sunSize * 4);
        
        // Draw sun
        ctx.fillStyle = '#FFFF00';
        ctx.beginPath();
        ctx.arc(x, y, sunSize, 0, Math.PI * 2);
        ctx.fill();
    } else if ((time >= 0 && time < 0.25) || (time > 0.75 && time <= 1)) {
        // It's nighttime - draw the moon
        // Offset the moon so it's opposite the sun
        const moonAngle = angle + Math.PI;
        const x = centerX + Math.cos(moonAngle) * radius;
        const y = centerY + Math.sin(moonAngle) * radius;
        const moonSize = 30;
        
        // Draw moon glow
        const gradient = ctx.createRadialGradient(x, y, moonSize * 0.5, x, y, moonSize * 1.5);
        gradient.addColorStop(0, 'rgba(200, 200, 255, 0.5)');
        gradient.addColorStop(1, 'rgba(200, 200, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x - moonSize * 2, y - moonSize * 2, moonSize * 4, moonSize * 4);
        
        // Draw moon
        ctx.fillStyle = '#DDDDFF';
        ctx.beginPath();
        ctx.arc(x, y, moonSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw moon craters for detail
        ctx.fillStyle = '#CCCCEE';
        // Crater 1
        ctx.beginPath();
        ctx.arc(x - moonSize * 0.3, y - moonSize * 0.2, moonSize * 0.2, 0, Math.PI * 2);
        ctx.fill();
        // Crater 2
        ctx.beginPath();
        ctx.arc(x + moonSize * 0.1, y + moonSize * 0.3, moonSize * 0.15, 0, Math.PI * 2);
        ctx.fill();
        // Crater 3
        ctx.beginPath();
        ctx.arc(x + moonSize * 0.4, y - moonSize * 0.4, moonSize * 0.1, 0, Math.PI * 2);
        ctx.fill();
    }
} 