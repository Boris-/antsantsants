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
    
    // Update camera position with smooth following (adjusted for zoom)
    // Calculate the center position where the player should be on screen
    const centerX = gameState.canvas.width / 2;
    const centerY = gameState.canvas.height / 2;
    
    // Calculate the target camera position to center the player
    gameState.camera.targetX = gameState.player.x + (gameState.player.width / 2) - (centerX / gameState.zoom);
    gameState.camera.targetY = gameState.player.y + (gameState.player.height / 2) - (centerY / gameState.zoom);
    
    // Apply camera lerp for smooth movement
    gameState.camera.x += (gameState.camera.targetX - gameState.camera.x) * CAMERA_LERP;
    gameState.camera.y += (gameState.camera.targetY - gameState.camera.y) * CAMERA_LERP;
    
    // Draw world (now includes player and enemies)
    drawWorld();
    
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