// Main game loop
function gameLoop(timestamp) {
    // Calculate delta time
    const deltaTime = timestamp - (gameState.lastFrameTime || timestamp);
    gameState.lastFrameTime = timestamp;
    
    // Clear canvas
    gameState.ctx.clearRect(0, 0, gameState.canvas.width, gameState.canvas.height);
    
    // Handle input
    handleInput();
    
    // Update player and enemies
    updatePlayerPosition();
    updateEnemies();
    
    // Update camera position with smooth following
    gameState.camera.targetX = gameState.player.x - gameState.canvas.width / 2 + gameState.player.width / 2;
    gameState.camera.targetY = gameState.player.y - gameState.canvas.height / 2 + gameState.player.height / 2;
    
    // Apply camera lerp for smooth movement
    gameState.camera.x += (gameState.camera.targetX - gameState.camera.x) * CAMERA_LERP;
    gameState.camera.y += (gameState.camera.targetY - gameState.camera.y) * CAMERA_LERP;
    
    // Draw world
    drawWorld();
    
    // Draw player
    drawPlayer();
    
    // Draw enemies
    drawEnemies();
    
    // Draw minimap
    drawMinimap();
    
    // Update UI
    updateUI();
    
    // Check for auto-save
    checkAutoSave();
    
    // Request next frame
    requestAnimationFrame(gameLoop);
}

// Update UI elements
function updateUI() {
    document.getElementById('health').textContent = `Health: ${gameState.player.health}`;
    updateScoreDisplay();
    updateInventoryDisplay();
}

// Check if we should auto-save
function checkAutoSave() {
    const currentTime = Date.now();
    if (gameState.hasUnsavedChanges && currentTime - gameState.lastSaveTime > AUTO_SAVE_INTERVAL) {
        saveGame();
        showNotification('Game auto-saved');
    }
}

// Draw minimap
function drawMinimap() {
    const minimapSize = 150;
    const minimapX = gameState.canvas.width - minimapSize - 10;
    const minimapY = 10;
    const minimapScale = 0.05; // Scale factor for the minimap
    
    // Draw minimap background
    gameState.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    gameState.ctx.fillRect(minimapX, minimapY, minimapSize, minimapSize);
    
    // Draw visible chunks on minimap
    const playerChunkX = Math.floor(gameState.player.x / (gameState.chunkSize * gameState.tileSize));
    const playerChunkY = Math.floor(gameState.player.y / (gameState.chunkSize * gameState.tileSize));
    
    // Draw chunks
    for (const chunkKey in gameState.chunks) {
        const [chunkX, chunkY] = chunkKey.split(',').map(Number);
        
        // Calculate minimap position
        const chunkMinimapX = minimapX + minimapSize / 2 + (chunkX - playerChunkX) * gameState.chunkSize * gameState.tileSize * minimapScale;
        const chunkMinimapY = minimapY + minimapSize / 2 + (chunkY - playerChunkY) * gameState.chunkSize * gameState.tileSize * minimapScale;
        
        // Only draw if within minimap bounds
        if (chunkMinimapX >= minimapX && chunkMinimapX <= minimapX + minimapSize &&
            chunkMinimapY >= minimapY && chunkMinimapY <= minimapY + minimapSize) {
            
            // Draw chunk representation
            gameState.ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
            gameState.ctx.fillRect(
                chunkMinimapX, 
                chunkMinimapY, 
                gameState.chunkSize * gameState.tileSize * minimapScale,
                gameState.chunkSize * gameState.tileSize * minimapScale
            );
        }
    }
    
    // Draw player on minimap
    const playerMinimapX = minimapX + minimapSize / 2;
    const playerMinimapY = minimapY + minimapSize / 2;
    
    gameState.ctx.fillStyle = 'red';
    gameState.ctx.beginPath();
    gameState.ctx.arc(playerMinimapX, playerMinimapY, 3, 0, Math.PI * 2);
    gameState.ctx.fill();
    
    // Draw current view area
    const viewWidth = gameState.canvas.width * minimapScale;
    const viewHeight = gameState.canvas.height * minimapScale;
    
    gameState.ctx.strokeStyle = 'white';
    gameState.ctx.lineWidth = 1;
    gameState.ctx.strokeRect(
        playerMinimapX - viewWidth / 2,
        playerMinimapY - viewHeight / 2,
        viewWidth,
        viewHeight
    );
}

// Add save button to UI
function addSaveButton() {
    const saveButton = document.createElement('button');
    saveButton.id = 'save-game';
    saveButton.textContent = 'Save Game';
    saveButton.addEventListener('click', () => {
        if (saveGame()) {
            saveButton.textContent = 'Game Saved!';
            setTimeout(() => {
                saveButton.textContent = 'Save Game';
            }, 2000);
        } else {
            saveButton.textContent = 'Save Failed!';
            setTimeout(() => {
                saveButton.textContent = 'Save Game';
            }, 2000);
        }
    });
    
    document.getElementById('ui').appendChild(saveButton);
}

// Initialize game when window loads
window.addEventListener('load', () => {
    initializeGame();
    addSaveButton();
    gameLoop(0);
    
    // Hide tutorial after 10 seconds
    setTimeout(() => {
        const tutorial = document.getElementById('tutorial');
        if (tutorial) {
            tutorial.style.opacity = '0';
            tutorial.style.transition = 'opacity 1s';
        }
    }, 10000);
}); 