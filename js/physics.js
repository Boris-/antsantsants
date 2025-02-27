// Update player position and physics
function updatePlayerPosition() {
    // Apply gravity
    gameState.player.velocityY += GRAVITY;
    
    // Apply horizontal movement with acceleration/deceleration
    // This is now handled in handleInput()
    
    // Improved collision detection - separate X and Y movement for better precision
    movePlayerWithCollision();
    
    // Check world boundaries
    if (gameState.player.x < 0) {
        gameState.player.x = 0;
        gameState.player.velocityX = 0;
    } else if (gameState.player.x + gameState.player.width > WORLD_WIDTH * TILE_SIZE) {
        gameState.player.x = WORLD_WIDTH * TILE_SIZE - gameState.player.width;
        gameState.player.velocityX = 0;
    }
    
    // Check if player fell off the world
    if (gameState.player.y > WORLD_HEIGHT * TILE_SIZE) {
        // Reset player position
        gameState.player.y = 0;
        gameState.player.health -= 20;
        document.getElementById('health').textContent = `Health: ${gameState.player.health}`;
        
        // Game over if health depleted
        if (gameState.player.health <= 0) {
            alert('Game Over! Refresh to restart.');
            gameState.player.health = 100;
            generateWorld();
        }
    }
}

// Improved collision detection with separate X and Y movement
function movePlayerWithCollision() {
    // Store original position for corner handling
    const originalX = gameState.player.x;
    const originalY = gameState.player.y;
    
    // First move horizontally and check for collisions
    const newX = gameState.player.x + gameState.player.velocityX;
    gameState.player.x = newX;
    
    // Check for horizontal collisions
    const horizontalCollision = checkHorizontalCollisions();
    
    // Then move vertically and check for collisions
    const newY = gameState.player.y + gameState.player.velocityY;
    gameState.player.y = newY;
    
    // Check for vertical collisions
    const verticalCollision = checkVerticalCollisions();
    
    // Handle corner cases - if we're stuck in a corner, try to slide along the wall
    if (horizontalCollision && verticalCollision) {
        // Try to resolve by sliding along the wall
        handleCornerCase(originalX, originalY);
    }
}

// Check for horizontal collisions and resolve them
function checkHorizontalCollisions() {
    // Get the tiles the player is overlapping with
    const playerLeft = Math.floor(gameState.player.x / TILE_SIZE);
    const playerRight = Math.floor((gameState.player.x + gameState.player.width - 1) / TILE_SIZE);
    const playerTop = Math.floor(gameState.player.y / TILE_SIZE);
    const playerBottom = Math.floor((gameState.player.y + gameState.player.height - 1) / TILE_SIZE);
    
    // Check each tile the player might be colliding with horizontally
    let collision = false;
    
    // Check all tiles along the player's height
    for (let y = playerTop; y <= playerBottom; y++) {
        if (y < 0 || y >= WORLD_HEIGHT) continue;
        
        // Check right edge collision
        if (gameState.player.velocityX > 0) {
            if (playerRight < WORLD_WIDTH && getTile(playerRight, y) !== TILE_TYPES.AIR) {
                // Collision on right side
                gameState.player.x = playerRight * TILE_SIZE - gameState.player.width;
                gameState.player.velocityX = 0;
                collision = true;
                break;
            }
        }
        // Check left edge collision
        else if (gameState.player.velocityX < 0) {
            if (playerLeft >= 0 && getTile(playerLeft, y) !== TILE_TYPES.AIR) {
                // Collision on left side
                gameState.player.x = (playerLeft + 1) * TILE_SIZE;
                gameState.player.velocityX = 0;
                collision = true;
                break;
            }
        }
    }
    
    return collision;
}

// Check for vertical collisions and resolve them
function checkVerticalCollisions() {
    // Get the tiles the player is overlapping with after horizontal movement
    const playerLeft = Math.floor(gameState.player.x / TILE_SIZE);
    const playerRight = Math.floor((gameState.player.x + gameState.player.width - 1) / TILE_SIZE);
    const playerTop = Math.floor(gameState.player.y / TILE_SIZE);
    const playerBottom = Math.floor((gameState.player.y + gameState.player.height - 1) / TILE_SIZE);
    
    // Reset grounded state
    gameState.player.isGrounded = false;
    
    // Check each tile the player might be colliding with vertically
    let collision = false;
    
    // Check all tiles along the player's width
    for (let x = playerLeft; x <= playerRight; x++) {
        if (x < 0 || x >= WORLD_WIDTH) continue;
        
        // Check bottom edge collision (falling)
        if (gameState.player.velocityY > 0) {
            if (playerBottom < WORLD_HEIGHT && getTile(x, playerBottom) !== TILE_TYPES.AIR) {
                // Collision on bottom side - player is on ground
                gameState.player.y = playerBottom * TILE_SIZE - gameState.player.height;
                gameState.player.velocityY = 0;
                gameState.player.isGrounded = true;
                collision = true;
                break;
            }
        }
        // Check top edge collision (jumping)
        else if (gameState.player.velocityY < 0) {
            if (playerTop >= 0 && getTile(x, playerTop) !== TILE_TYPES.AIR) {
                // Collision on top side - player hit ceiling
                gameState.player.y = (playerTop + 1) * TILE_SIZE;
                gameState.player.velocityY = 0;
                collision = true;
                break;
            }
        }
    }
    
    return collision;
}

// Handle corner cases where player gets stuck
function handleCornerCase(originalX, originalY) {
    // Try to resolve by prioritizing vertical movement
    gameState.player.x = originalX;
    gameState.player.y += gameState.player.velocityY;
    
    if (checkVerticalCollisions()) {
        // If vertical movement still causes collision, try horizontal
        gameState.player.y = originalY;
        gameState.player.x += gameState.player.velocityX;
        
        if (checkHorizontalCollisions()) {
            // If both directions cause collisions, just revert to original position
            gameState.player.x = originalX;
            gameState.player.y = originalY;
            gameState.player.velocityX = 0;
            gameState.player.velocityY = 0;
        }
    }
}

// Update enemy positions and AI
function updateEnemies() {
    for (let i = 0; i < gameState.enemies.length; i++) {
        const enemy = gameState.enemies[i];
        
        // Apply gravity
        enemy.velocityY += GRAVITY;
        
        // Update position with improved collision detection
        updateEnemyPosition(enemy);
        
        // Check for collision with player
        if (
            enemy.x < gameState.player.x + gameState.player.width &&
            enemy.x + enemy.width > gameState.player.x &&
            enemy.y < gameState.player.y + gameState.player.height &&
            enemy.y + enemy.height > gameState.player.y
        ) {
            // Damage player
            gameState.player.health -= enemy.damage * 0.1;
            document.getElementById('health').textContent = `Health: ${gameState.player.health}`;
            
            // Knock player back (gentler)
            const knockbackDirection = enemy.x < gameState.player.x ? 1 : -1;
            gameState.player.velocityX = knockbackDirection * 4; // Reduced from 8
            gameState.player.velocityY = -3; // Reduced from -5
            
            // Game over if health depleted
            if (gameState.player.health <= 0) {
                alert('Game Over! Refresh to restart.');
                gameState.player.health = 100;
                generateWorld();
            }
        }
        
        // Check if enemy fell off the world
        if (enemy.y > WORLD_HEIGHT * TILE_SIZE) {
            // Remove enemy
            gameState.enemies.splice(i, 1);
            i--;
        }
    }
}

// Update enemy position with improved collision detection
function updateEnemyPosition(enemy) {
    // First move horizontally and check for collisions
    const newX = enemy.x + enemy.velocityX;
    
    // Check horizontal collisions
    const enemyTileX1 = Math.floor(newX / TILE_SIZE);
    const enemyTileX2 = Math.floor((newX + enemy.width - 1) / TILE_SIZE);
    const enemyTileY1 = Math.floor(enemy.y / TILE_SIZE);
    const enemyTileY2 = Math.floor((enemy.y + enemy.height - 1) / TILE_SIZE);
    
    let horizontalCollision = false;
    
    // Check all tiles along the enemy's height
    for (let y = enemyTileY1; y <= enemyTileY2; y++) {
        if (y < 0 || y >= WORLD_HEIGHT) continue;
        
        if (enemy.velocityX > 0) {
            if (enemyTileX2 < WORLD_WIDTH && getTile(enemyTileX2, y) !== TILE_TYPES.AIR) {
                horizontalCollision = true;
                break;
            }
        } else if (enemy.velocityX < 0) {
            if (enemyTileX1 >= 0 && getTile(enemyTileX1, y) !== TILE_TYPES.AIR) {
                horizontalCollision = true;
                break;
            }
        }
    }
    
    if (!horizontalCollision) {
        enemy.x = newX;
    } else {
        // Reverse direction
        enemy.velocityX = -enemy.velocityX;
    }
    
    // Then move vertically and check for collisions
    const newY = enemy.y + enemy.velocityY;
    
    // Check vertical collisions
    const updatedEnemyTileX1 = Math.floor(enemy.x / TILE_SIZE);
    const updatedEnemyTileX2 = Math.floor((enemy.x + enemy.width - 1) / TILE_SIZE);
    const updatedEnemyTileY1 = Math.floor(newY / TILE_SIZE);
    const updatedEnemyTileY2 = Math.floor((newY + enemy.height - 1) / TILE_SIZE);
    
    let verticalCollision = false;
    let isGrounded = false;
    
    // Check all tiles along the enemy's width
    for (let x = updatedEnemyTileX1; x <= updatedEnemyTileX2; x++) {
        if (x < 0 || x >= WORLD_WIDTH) continue;
        
        if (enemy.velocityY > 0) {
            if (updatedEnemyTileY2 < WORLD_HEIGHT && getTile(x, updatedEnemyTileY2) !== TILE_TYPES.AIR) {
                verticalCollision = true;
                isGrounded = true;
                break;
            }
        } else if (enemy.velocityY < 0) {
            if (updatedEnemyTileY1 >= 0 && getTile(x, updatedEnemyTileY1) !== TILE_TYPES.AIR) {
                verticalCollision = true;
                break;
            }
        }
    }
    
    if (!verticalCollision) {
        enemy.y = newY;
    } else {
        if (enemy.velocityY > 0) {
            // Land on the ground precisely
            enemy.y = updatedEnemyTileY2 * TILE_SIZE - enemy.height;
        } else {
            // Hit ceiling precisely
            enemy.y = (updatedEnemyTileY1 + 1) * TILE_SIZE;
        }
        enemy.velocityY = 0;
    }
    
    // Check if enemy is on an edge (simple AI to avoid falling)
    if (isGrounded) {
        const checkX = enemy.velocityX > 0 ? updatedEnemyTileX2 + 1 : updatedEnemyTileX1 - 1;
        if (
            checkX >= 0 && checkX < WORLD_WIDTH &&
            updatedEnemyTileY2 + 1 < WORLD_HEIGHT
        ) {
            if (getTile(checkX, updatedEnemyTileY2 + 1) === TILE_TYPES.AIR) {
                // No ground ahead, reverse direction
                enemy.velocityX = -enemy.velocityX;
            }
        }
    }
}

// Update camera position to follow player
function updateCamera() {
    const targetX = gameState.player.x + gameState.player.width / 2 - gameState.canvas.width / 2;
    const targetY = gameState.player.y + gameState.player.height / 2 - gameState.canvas.height / 2;
    
    // Smoother camera movement with lerp (linear interpolation)
    gameState.camera.x = gameState.camera.x + (targetX - gameState.camera.x) * 0.1;
    gameState.camera.y = gameState.camera.y + (targetY - gameState.camera.y) * 0.1;
    
    // Clamp camera to world boundaries
    gameState.camera.x = Math.max(0, Math.min(gameState.camera.x, WORLD_WIDTH * TILE_SIZE - gameState.canvas.width));
    gameState.camera.y = Math.max(0, Math.min(gameState.camera.y, WORLD_HEIGHT * TILE_SIZE - gameState.canvas.height));
}

// Update health display
function updateHealth() {
    // Ensure health doesn't go below 0
    gameState.player.health = Math.max(0, gameState.player.health);
    document.getElementById('health').textContent = `Health: ${Math.ceil(gameState.player.health)}`;
    
    // Check for game over
    if (gameState.player.health <= 0) {
        alert('Game Over! Refresh to restart.');
        gameState.player.health = 100;
        generateWorld();
    }
} 