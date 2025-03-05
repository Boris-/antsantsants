// Main game entry point
window.addEventListener('load', () => {
    console.log('Game starting...');
    
    // Initialize the game state
    initializeGameState();
    
    // Set up event listeners
    if (typeof window.setupEventListeners === 'function') {
        window.setupEventListeners();
        console.log('Event listeners set up from main.js');
    } else {
        console.error('setupEventListeners function not found!');
    }
    
    // Initialize UI after game state is initialized
    if (typeof window.initializeUI === 'function') {
        window.initializeUI();
        console.log('UI initialized from main.js');
    } else {
        console.error('UI initialization function not found!');
    }
    
    // Initialize background music
    if (typeof window.initBackgroundMusic === 'function') {
        window.initBackgroundMusic();
        console.log('Background music initialized from main.js');
    } else {
        console.error('Background music initialization function not found!');
    }
    
    // Ensure day/night cycle is initialized even if not connected to server
    if (!gameState.dayNightCycle && typeof window.updateDayNightCycle === 'function') {
        window.updateDayNightCycle(Date.now());
        console.log('Day/night cycle initialized from main.js');
    }
    
    // Initialize multiplayer connection
    initializeMultiplayer();
    
    // Start the game loop
    requestAnimationFrame(gameLoop);
});

// Main game loop
function gameLoop(timestamp) {
    // Clear the canvas
    gameState.ctx.clearRect(0, 0, gameState.canvas.width, gameState.canvas.height);
    
    // Update game state
    updateGameState(timestamp);
    
    // Render the game
    renderGame();
    
    // Request the next frame
    requestAnimationFrame(gameLoop);
}

// Update game state
function updateGameState(timestamp) {
    // Handle player movement
    handlePlayerMovement();
    
    // Handle digging
    handleDigging();
    
    // Update camera position
    updateCamera();
    
    // Use the consolidated day/night cycle function from gameState.js
    if (typeof window.updateDayNightCycle === 'function') {
        window.updateDayNightCycle(timestamp);
    }
    
    // Update particles
    updateParticles();
    
    // Update enemies
    updateEnemies();
    
    // Send player position to server (for multiplayer)
    if (socket && socket.connected && (!gameState.lastPositionUpdate || gameState.lastPositionUpdate + 50 < Date.now())) {
        sendPlayerPosition();
        gameState.lastPositionUpdate = Date.now();
    }
}

// Render the game
function renderGame() {
    // Draw the world
    drawWorld();
    
    // Draw other players (for multiplayer)
    if (socket && socket.connected) {
        drawOtherPlayers();
    }
    
    // Draw the player
    drawPlayer();
    
    // Draw particles
    drawParticles();
    
    // Draw enemies
    drawEnemies();
    
    // Update UI
    if (typeof window.updateHealthDisplay === 'function' &&
        typeof window.updateScoreDisplay === 'function' &&
        typeof window.updateInventoryDisplay === 'function' &&
        typeof window.updateBiomeDisplay === 'function' &&
        typeof window.updatePlayerStatsDisplay === 'function') {
        window.updateHealthDisplay();
        window.updateScoreDisplay();
        window.updateInventoryDisplay();
        window.updateBiomeDisplay();
        window.updatePlayerStatsDisplay();
    }
}

// Expose renderGame to the window object
window.mainRenderGame = renderGame;

// Update camera position to follow player
function updateCamera() {
    // Center camera on player
    gameState.camera.x = gameState.player.x + gameState.player.width / 2 - gameState.canvas.width / gameState.zoom / 2;
    gameState.camera.y = gameState.player.y + gameState.player.height / 2 - gameState.canvas.height / gameState.zoom / 2;
    
    // Clamp camera to world bounds
    gameState.camera.x = Math.max(0, Math.min(gameState.camera.x, WORLD_WIDTH * TILE_SIZE - gameState.canvas.width / gameState.zoom));
    gameState.camera.y = Math.max(0, Math.min(gameState.camera.y, WORLD_HEIGHT * TILE_SIZE - gameState.canvas.height / gameState.zoom));
}

// Update particles
function updateParticles() {
    if (!gameState.particles) return;
    
    const currentTime = Date.now();
    
    // Update each particle
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
        const particle = gameState.particles[i];
        
        // Remove expired particles
        if (currentTime > particle.expireTime) {
            gameState.particles.splice(i, 1);
            continue;
        }
        
        // Update position
        particle.x += particle.velocityX;
        particle.y += particle.velocityY;
        
        // Apply gravity
        particle.velocityY += 0.1;
    }
}

// Draw particles
function drawParticles() {
    if (!gameState.particles) return;
    
    for (const particle of gameState.particles) {
        gameState.ctx.fillStyle = particle.color;
        gameState.ctx.fillRect(
            Math.round(particle.x - gameState.camera.x),
            Math.round(particle.y - gameState.camera.y),
            particle.size,
            particle.size
        );
    }
}

// Update enemies
function updateEnemies() {
    if (!gameState.enemies) return;
    
    for (const enemy of gameState.enemies) {
        // Simple AI: move towards player if within range
        const distanceToPlayer = Math.sqrt(
            Math.pow(gameState.player.x - enemy.x, 2) + 
            Math.pow(gameState.player.y - enemy.y, 2)
        );
        
        if (distanceToPlayer < 200) {
            // Move towards player
            const directionX = gameState.player.x - enemy.x;
            const directionY = gameState.player.y - enemy.y;
            const length = Math.sqrt(directionX * directionX + directionY * directionY);
            
            enemy.x += (directionX / length) * enemy.speed;
            enemy.y += (directionY / length) * enemy.speed;
            
            // Check for collision with player
            if (distanceToPlayer < 20) {
                // Damage player
                if (!enemy.lastAttack || Date.now() - enemy.lastAttack > 1000) {
                    gameState.player.health -= enemy.damage;
                    enemy.lastAttack = Date.now();
                    
                    // Create damage flash effect
                    const flash = document.createElement('div');
                    flash.className = 'damage-flash';
                    document.body.appendChild(flash);
                    
                    // Remove flash after animation
                    setTimeout(() => {
                        document.body.removeChild(flash);
                    }, 200);
                    
                    // Check if player is dead
                    if (gameState.player.health <= 0) {
                        gameOver();
                    }
                }
            }
        }
    }
}

// Draw enemies
function drawEnemies() {
    if (!gameState.enemies) return;
    
    for (const enemy of gameState.enemies) {
        gameState.ctx.fillStyle = enemy.color;
        gameState.ctx.beginPath();
        gameState.ctx.arc(
            Math.round(enemy.x - gameState.camera.x),
            Math.round(enemy.y - gameState.camera.y),
            enemy.size,
            0,
            Math.PI * 2
        );
        gameState.ctx.fill();
    }
}

// Game over
function gameOver() {
    // Show game over message
    const message = document.createElement('div');
    message.className = 'game-message';
    message.textContent = 'Game Over';
    document.body.appendChild(message);
    
    // Restart game after delay
    setTimeout(() => {
        document.body.removeChild(message);
        initializeGameState();
    }, 3000);
} 