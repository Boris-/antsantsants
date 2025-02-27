// Update player position and physics
function updatePlayer() {
    // Apply input for movement with wall sliding
    const movingLeft = gameState.keys['ArrowLeft'] || gameState.keys['a'] || gameState.keys['A'];
    const movingRight = gameState.keys['ArrowRight'] || gameState.keys['d'] || gameState.keys['D'];
    const jumping = gameState.keys['ArrowUp'] || gameState.keys['w'] || gameState.keys['W'];
    
    // Apply more controlled movement
    // Slower acceleration and deceleration for smoother control
    const acceleration = 0.5;
    const deceleration = 0.7;
    const maxSpeed = MOVE_SPEED * 0.8; // Slightly slower max speed for better control
    
    // Apply horizontal movement with acceleration/deceleration
    if (movingLeft) {
        // Gradually decrease velocity (accelerate in negative direction)
        gameState.player.velocityX = Math.max(gameState.player.velocityX - acceleration, -maxSpeed);
        gameState.player.facingRight = false;
    } else if (movingRight) {
        // Gradually increase velocity
        gameState.player.velocityX = Math.min(gameState.player.velocityX + acceleration, maxSpeed);
        gameState.player.facingRight = true;
    } else {
        // Gradually slow down when no input
        if (gameState.player.velocityX > 0) {
            gameState.player.velocityX = Math.max(gameState.player.velocityX - deceleration, 0);
        } else if (gameState.player.velocityX < 0) {
            gameState.player.velocityX = Math.min(gameState.player.velocityX + deceleration, 0);
        }
    }
    
    // Apply gentler gravity
    const gentlerGravity = GRAVITY * 0.8;
    gameState.player.velocityY += gentlerGravity;
    
    // Apply more controlled jumping
    if (jumping && gameState.player.isGrounded) {
        // Gentler jump with lower force
        gameState.player.velocityY = -JUMP_FORCE * 0.7;
        gameState.player.isGrounded = false;
    }
    
    // Improved collision detection - separate X and Y movement for better precision
    // First handle horizontal movement
    let newX = gameState.player.x + gameState.player.velocityX;
    
    // Check horizontal collisions
    const horizontalCollision = checkHorizontalCollisions(newX, gameState.player.y);
    
    if (!horizontalCollision.collision) {
        gameState.player.x = newX;
    } else {
        // Snap to the edge of the tile for smoother wall interactions
        gameState.player.x = horizontalCollision.snapPosition;
        gameState.player.velocityX = 0;
    }
    
    // Then handle vertical movement
    let newY = gameState.player.y + gameState.player.velocityY;
    
    // Check vertical collisions
    const verticalCollision = checkVerticalCollisions(gameState.player.x, newY);
    
    if (!verticalCollision.collision) {
        gameState.player.y = newY;
        gameState.player.isGrounded = false;
    } else {
        // Snap to the edge of the tile
        gameState.player.y = verticalCollision.snapPosition;
        gameState.player.velocityY = 0;
        
        // Set grounded state if collision is below
        if (verticalCollision.direction === 'bottom') {
            gameState.player.isGrounded = true;
        }
    }
    
    // Add friction when on ground for better control
    if (gameState.player.isGrounded) {
        gameState.player.velocityX *= 0.9; // Apply friction
    }
    
    // Check world boundaries
    if (gameState.player.x < 0) {
        gameState.player.x = 0;
    } else if (gameState.player.x + gameState.player.width > WORLD_WIDTH * TILE_SIZE) {
        gameState.player.x = WORLD_WIDTH * TILE_SIZE - gameState.player.width;
    }
    
    // Check if player fell off the world
    if (gameState.player.y > WORLD_HEIGHT * TILE_SIZE) {
        // Reset player position
        gameState.player.y = 0;
        gameState.player.health -= 20;
        updateHealth();
    }
    
    // Handle digging (mouse interaction)
    if (gameState.mouseDown) {
        const mouseWorldX = gameState.mouseX + gameState.camera.x;
        const mouseWorldY = gameState.mouseY + gameState.camera.y;
        
        const tilePosX = Math.floor(mouseWorldX / TILE_SIZE);
        const tilePosY = Math.floor(mouseWorldY / TILE_SIZE);
        
        // Check if tile is within range of player (4 tiles)
        const playerCenterX = gameState.player.x + gameState.player.width / 2;
        const playerCenterY = gameState.player.y + gameState.player.height / 2;
        const tileDistanceX = Math.abs((tilePosX * TILE_SIZE + TILE_SIZE / 2) - playerCenterX);
        const tileDistanceY = Math.abs((tilePosY * TILE_SIZE + TILE_SIZE / 2) - playerCenterY);
        const maxDistance = 4 * TILE_SIZE;
        
        if (tileDistanceX <= maxDistance && tileDistanceY <= maxDistance) {
            // Check if tile is valid and not air
            if (
                tilePosX >= 0 && tilePosX < WORLD_WIDTH &&
                tilePosY >= 0 && tilePosY < WORLD_HEIGHT &&
                gameState.world[tilePosY][tilePosX] !== TILE_TYPES.AIR
            ) {
                // Dig the tile (set to air)
                gameState.world[tilePosY][tilePosX] = TILE_TYPES.AIR;
            }
            
            // Check for enemy hit
            for (let i = 0; i < gameState.enemies.length; i++) {
                const enemy = gameState.enemies[i];
                const enemyTilePosX = Math.floor(enemy.x / TILE_SIZE);
                const enemyTilePosY = Math.floor(enemy.y / TILE_SIZE);
                
                if (tilePosX === enemyTilePosX && tilePosY === enemyTilePosY) {
                    // Hit enemy
                    enemy.health -= 10;
                    
                    if (enemy.health <= 0) {
                        // Remove enemy
                        gameState.enemies.splice(i, 1);
                    }
                    
                    break;
                }
            }
        }
    }
}

// Helper function to check horizontal collisions
function checkHorizontalCollisions(newX, y) {
    const result = {
        collision: false,
        snapPosition: newX,
        direction: null
    };
    
    // Calculate tile positions
    const playerTileY1 = Math.floor(y / TILE_SIZE);
    const playerTileY2 = Math.floor((y + gameState.player.height - 1) / TILE_SIZE);
    
    // Check if moving right
    if (gameState.player.velocityX > 0) {
        const rightEdgeX = newX + gameState.player.width;
        const rightTileX = Math.floor(rightEdgeX / TILE_SIZE);
        
        // Check all tiles along the right edge
        for (let tileY = playerTileY1; tileY <= playerTileY2; tileY++) {
            if (tileY < 0 || tileY >= WORLD_HEIGHT || rightTileX < 0 || rightTileX >= WORLD_WIDTH) continue;
            
            if (gameState.world[tileY][rightTileX] !== TILE_TYPES.AIR) {
                result.collision = true;
                result.snapPosition = rightTileX * TILE_SIZE - gameState.player.width - 0.1;
                result.direction = 'right';
                break;
            }
        }
    }
    // Check if moving left
    else if (gameState.player.velocityX < 0) {
        const leftTileX = Math.floor(newX / TILE_SIZE);
        
        // Check all tiles along the left edge
        for (let tileY = playerTileY1; tileY <= playerTileY2; tileY++) {
            if (tileY < 0 || tileY >= WORLD_HEIGHT || leftTileX < 0 || leftTileX >= WORLD_WIDTH) continue;
            
            if (gameState.world[tileY][leftTileX] !== TILE_TYPES.AIR) {
                result.collision = true;
                result.snapPosition = (leftTileX + 1) * TILE_SIZE + 0.1;
                result.direction = 'left';
                break;
            }
        }
    }
    
    return result;
}

// Helper function to check vertical collisions
function checkVerticalCollisions(x, newY) {
    const result = {
        collision: false,
        snapPosition: newY,
        direction: null
    };
    
    // Calculate tile positions
    const playerTileX1 = Math.floor(x / TILE_SIZE);
    const playerTileX2 = Math.floor((x + gameState.player.width - 1) / TILE_SIZE);
    
    // Check if moving down
    if (gameState.player.velocityY > 0) {
        const bottomEdgeY = newY + gameState.player.height;
        const bottomTileY = Math.floor(bottomEdgeY / TILE_SIZE);
        
        // Check all tiles along the bottom edge
        for (let tileX = playerTileX1; tileX <= playerTileX2; tileX++) {
            if (tileX < 0 || tileX >= WORLD_WIDTH || bottomTileY < 0 || bottomTileY >= WORLD_HEIGHT) continue;
            
            if (gameState.world[bottomTileY][tileX] !== TILE_TYPES.AIR) {
                result.collision = true;
                result.snapPosition = bottomTileY * TILE_SIZE - gameState.player.height - 0.1;
                result.direction = 'bottom';
                break;
            }
        }
    }
    // Check if moving up
    else if (gameState.player.velocityY < 0) {
        const topTileY = Math.floor(newY / TILE_SIZE);
        
        // Check all tiles along the top edge
        for (let tileX = playerTileX1; tileX <= playerTileX2; tileX++) {
            if (tileX < 0 || tileX >= WORLD_WIDTH || topTileY < 0 || topTileY >= WORLD_HEIGHT) continue;
            
            if (gameState.world[topTileY][tileX] !== TILE_TYPES.AIR) {
                result.collision = true;
                result.snapPosition = (topTileY + 1) * TILE_SIZE + 0.1;
                result.direction = 'top';
                break;
            }
        }
    }
    
    return result;
}

// Update enemy positions and AI
function updateEnemies() {
    for (let i = 0; i < gameState.enemies.length; i++) {
        const enemy = gameState.enemies[i];
        
        // Apply gravity
        enemy.velocityY += GRAVITY;
        
        // Update position with improved collision detection
        // First handle horizontal movement
        let newX = enemy.x + enemy.velocityX;
        
        // Check horizontal collisions
        const horizontalCollision = checkEnemyHorizontalCollisions(enemy, newX, enemy.y);
        
        if (!horizontalCollision.collision) {
            enemy.x = newX;
        } else {
            // Snap to the edge of the tile
            enemy.x = horizontalCollision.snapPosition;
            enemy.velocityX = -enemy.velocityX; // Reverse direction
        }
        
        // Then handle vertical movement
        let newY = enemy.y + enemy.velocityY;
        
        // Check vertical collisions
        const verticalCollision = checkEnemyVerticalCollisions(enemy, enemy.x, newY);
        
        if (!verticalCollision.collision) {
            enemy.y = newY;
        } else {
            // Snap to the edge of the tile
            enemy.y = verticalCollision.snapPosition;
            enemy.velocityY = 0;
        }
        
        // Check if enemy is on an edge (simple AI to avoid falling)
        if (enemy.velocityY === 0) {
            const checkX = enemy.velocityX > 0 ? 
                Math.floor((enemy.x + enemy.width + 2) / TILE_SIZE) : 
                Math.floor((enemy.x - 2) / TILE_SIZE);
            
            const checkY = Math.floor((enemy.y + enemy.height + 2) / TILE_SIZE);
            
            if (
                checkX >= 0 && checkX < WORLD_WIDTH &&
                checkY >= 0 && checkY < WORLD_HEIGHT
            ) {
                if (gameState.world[checkY][checkX] === TILE_TYPES.AIR) {
                    // No ground ahead, reverse direction
                    enemy.velocityX = -enemy.velocityX;
                }
            }
        }
        
        // Check for collision with player using more precise AABB collision
        if (checkAABBCollision(
            enemy.x, enemy.y, enemy.width, enemy.height,
            gameState.player.x, gameState.player.y, gameState.player.width, gameState.player.height
        )) {
            // Damage player
            gameState.player.health -= enemy.damage * 0.1;
            updateHealth();
            
            // Knock player back (gentler)
            const knockbackDirection = enemy.x < gameState.player.x ? 1 : -1;
            gameState.player.velocityX = knockbackDirection * 4; // Reduced from 8
            gameState.player.velocityY = -3; // Reduced from -5
        }
        
        // Check if enemy fell off the world
        if (enemy.y > WORLD_HEIGHT * TILE_SIZE) {
            // Remove enemy
            gameState.enemies.splice(i, 1);
            i--;
        }
    }
}

// Helper function to check enemy horizontal collisions
function checkEnemyHorizontalCollisions(enemy, newX, y) {
    const result = {
        collision: false,
        snapPosition: newX
    };
    
    // Calculate tile positions
    const enemyTileY1 = Math.floor(y / TILE_SIZE);
    const enemyTileY2 = Math.floor((y + enemy.height - 1) / TILE_SIZE);
    
    // Check if moving right
    if (enemy.velocityX > 0) {
        const rightEdgeX = newX + enemy.width;
        const rightTileX = Math.floor(rightEdgeX / TILE_SIZE);
        
        // Check all tiles along the right edge
        for (let tileY = enemyTileY1; tileY <= enemyTileY2; tileY++) {
            if (tileY < 0 || tileY >= WORLD_HEIGHT || rightTileX < 0 || rightTileX >= WORLD_WIDTH) continue;
            
            if (gameState.world[tileY][rightTileX] !== TILE_TYPES.AIR) {
                result.collision = true;
                result.snapPosition = rightTileX * TILE_SIZE - enemy.width - 0.1;
                break;
            }
        }
    }
    // Check if moving left
    else if (enemy.velocityX < 0) {
        const leftTileX = Math.floor(newX / TILE_SIZE);
        
        // Check all tiles along the left edge
        for (let tileY = enemyTileY1; tileY <= enemyTileY2; tileY++) {
            if (tileY < 0 || tileY >= WORLD_HEIGHT || leftTileX < 0 || leftTileX >= WORLD_WIDTH) continue;
            
            if (gameState.world[tileY][leftTileX] !== TILE_TYPES.AIR) {
                result.collision = true;
                result.snapPosition = (leftTileX + 1) * TILE_SIZE + 0.1;
                break;
            }
        }
    }
    
    return result;
}

// Helper function to check enemy vertical collisions
function checkEnemyVerticalCollisions(enemy, x, newY) {
    const result = {
        collision: false,
        snapPosition: newY
    };
    
    // Calculate tile positions
    const enemyTileX1 = Math.floor(x / TILE_SIZE);
    const enemyTileX2 = Math.floor((x + enemy.width - 1) / TILE_SIZE);
    
    // Check if moving down
    if (enemy.velocityY > 0) {
        const bottomEdgeY = newY + enemy.height;
        const bottomTileY = Math.floor(bottomEdgeY / TILE_SIZE);
        
        // Check all tiles along the bottom edge
        for (let tileX = enemyTileX1; tileX <= enemyTileX2; tileX++) {
            if (tileX < 0 || tileX >= WORLD_WIDTH || bottomTileY < 0 || bottomTileY >= WORLD_HEIGHT) continue;
            
            if (gameState.world[bottomTileY][tileX] !== TILE_TYPES.AIR) {
                result.collision = true;
                result.snapPosition = bottomTileY * TILE_SIZE - enemy.height - 0.1;
                break;
            }
        }
    }
    // Check if moving up
    else if (enemy.velocityY < 0) {
        const topTileY = Math.floor(newY / TILE_SIZE);
        
        // Check all tiles along the top edge
        for (let tileX = enemyTileX1; tileX <= enemyTileX2; tileX++) {
            if (tileX < 0 || tileX >= WORLD_WIDTH || topTileY < 0 || topTileY >= WORLD_HEIGHT) continue;
            
            if (gameState.world[topTileY][tileX] !== TILE_TYPES.AIR) {
                result.collision = true;
                result.snapPosition = (topTileY + 1) * TILE_SIZE + 0.1;
                break;
            }
        }
    }
    
    return result;
}

// Helper function for AABB collision detection
function checkAABBCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
    return (
        x1 < x2 + w2 &&
        x1 + w1 > x2 &&
        y1 < y2 + h2 &&
        y1 + h1 > y2
    );
}

// Update camera position to follow player
function updateCamera() {
    const targetX = gameState.player.x + gameState.player.width / 2 - canvas.width / 2;
    const targetY = gameState.player.y + gameState.player.height / 2 - canvas.height / 2;
    
    // Smoother camera movement with lerp (linear interpolation)
    gameState.camera.x = gameState.camera.x + (targetX - gameState.camera.x) * 0.1;
    gameState.camera.y = gameState.camera.y + (targetY - gameState.camera.y) * 0.1;
    
    // Clamp camera to world boundaries
    gameState.camera.x = Math.max(0, Math.min(gameState.camera.x, WORLD_WIDTH * TILE_SIZE - canvas.width));
    gameState.camera.y = Math.max(0, Math.min(gameState.camera.y, WORLD_HEIGHT * TILE_SIZE - canvas.height));
}

// Update health display
function updateHealth() {
    // Ensure health doesn't go below 0
    gameState.player.health = Math.max(0, gameState.player.health);
    healthDisplay.textContent = Math.ceil(gameState.player.health);
    
    // Check for game over
    if (gameState.player.health <= 0) {
        alert('Game Over! Refresh to restart.');
        gameState.player.health = 100;
        generateWorld();
    }
} 