// Handle input events
function setupEventListeners() {
    // Keyboard events
    window.addEventListener('keydown', (e) => {
        gameState.keys[e.code] = true;
    });
    
    window.addEventListener('keyup', (e) => {
        gameState.keys[e.code] = false;
    });
    
    // Mouse events
    gameState.canvas.addEventListener('mousemove', (e) => {
        const rect = gameState.canvas.getBoundingClientRect();
        gameState.mouseX = e.clientX - rect.left;
        gameState.mouseY = e.clientY - rect.top;
    });
    
    gameState.canvas.addEventListener('mousedown', () => {
        gameState.mouseDown = true;
    });
    
    gameState.canvas.addEventListener('mouseup', () => {
        gameState.mouseDown = false;
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
        gameState.canvas.width = window.innerWidth;
        gameState.canvas.height = window.innerHeight;
    });
    
    // Regenerate world button
    const regenerateButton = document.getElementById('regenerate-world');
    if (regenerateButton) {
        regenerateButton.addEventListener('click', () => {
            // Reset player health and position
            gameState.player.health = 100;
            
            // Clear enemies
            gameState.enemies = [];
            
            // Generate new world
            generateWorld();
            
            // Add visual feedback
            regenerateButton.textContent = "Regenerating...";
            setTimeout(() => {
                regenerateButton.textContent = "Regenerate World";
            }, 500);
        });
    }
}

// Handle player input
function handleInput() {
    // Movement
    const moveLeft = gameState.keys['ArrowLeft'] || gameState.keys['KeyA'];
    const moveRight = gameState.keys['ArrowRight'] || gameState.keys['KeyD'];
    const jump = gameState.keys['ArrowUp'] || gameState.keys['KeyW'] || gameState.keys['Space'];
    
    // Apply acceleration/deceleration for smoother movement
    if (moveLeft) {
        gameState.player.velocityX -= ACCELERATION;
        gameState.player.facingRight = false;
    } else if (moveRight) {
        gameState.player.velocityX += ACCELERATION;
        gameState.player.facingRight = true;
    } else {
        // Apply deceleration when no movement keys are pressed
        if (gameState.player.velocityX > 0) {
            gameState.player.velocityX = Math.max(0, gameState.player.velocityX - DECELERATION);
        } else if (gameState.player.velocityX < 0) {
            gameState.player.velocityX = Math.min(0, gameState.player.velocityX + DECELERATION);
        }
    }
    
    // Apply friction when on ground
    if (gameState.player.isGrounded) {
        gameState.player.velocityX *= FRICTION;
    }
    
    // Limit maximum speed
    gameState.player.velocityX = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, gameState.player.velocityX));
    
    // Jump only if on the ground
    if (jump && gameState.player.isGrounded) {
        gameState.player.velocityY = -JUMP_FORCE;
        gameState.player.isGrounded = false;
    }
    
    // Handle digging/attacking with mouse
    if (gameState.mouseDown) {
        handleDigging();
    }
    
    // Debug: Regenerate world with R key
    if (gameState.keys['KeyR'] && !gameState.lastKeyState?.['KeyR']) {
        generateWorld();
    }
    
    // Save game with S key
    if (gameState.keys['KeyS'] && !gameState.lastKeyState?.['KeyS'] && (gameState.keys['ControlLeft'] || gameState.keys['ControlRight'])) {
        saveGame();
        // Show save notification
        showNotification('Game saved!');
    }
    
    // Update last key state for one-time key presses
    gameState.lastKeyState = {...gameState.keys};
}

// Handle digging and attacking
function handleDigging() {
    // Convert mouse position to world coordinates
    const mouseWorldX = Math.floor((gameState.mouseX + gameState.camera.x) / gameState.tileSize);
    const mouseWorldY = Math.floor((gameState.mouseY + gameState.camera.y) / gameState.tileSize);
    
    // Calculate distance from player to mouse position
    const playerCenterX = gameState.player.x + gameState.player.width / 2;
    const playerCenterY = gameState.player.y + gameState.player.height / 2;
    const mouseCenterX = mouseWorldX * gameState.tileSize + gameState.tileSize / 2;
    const mouseCenterY = mouseWorldY * gameState.tileSize + gameState.tileSize / 2;
    
    const distance = Math.sqrt(
        Math.pow(playerCenterX - mouseCenterX, 2) + 
        Math.pow(playerCenterY - mouseCenterY, 2)
    );
    
    // Only allow digging within a certain range
    const maxDigDistance = 100;
    if (distance <= maxDigDistance) {
        const tile = getTile(mouseWorldX, mouseWorldY);
        
        // Check if tile is diggable
        if (tile === TILE_TYPES.DIRT || tile === TILE_TYPES.GRASS || 
            tile === TILE_TYPES.STONE || tile === TILE_TYPES.ORE || 
            tile === TILE_TYPES.SAND) {
            
            // Add to inventory based on tile type
            if (tile === TILE_TYPES.DIRT || tile === TILE_TYPES.GRASS) {
                gameState.player.inventory.dirt++;
            } else if (tile === TILE_TYPES.STONE) {
                gameState.player.inventory.stone++;
            } else if (tile === TILE_TYPES.ORE) {
                gameState.player.inventory.ore++;
                gameState.score += 10; // Bonus points for ore
            }
            
            // Remove the tile
            setTile(mouseWorldX, mouseWorldY, TILE_TYPES.AIR);
            
            // Update UI
            updateInventoryDisplay();
        }
        
        // Check for enemies
        for (let i = 0; i < gameState.enemies.length; i++) {
            const enemy = gameState.enemies[i];
            const enemyTileX = Math.floor(enemy.x / gameState.tileSize);
            const enemyTileY = Math.floor(enemy.y / gameState.tileSize);
            
            if (enemyTileX === mouseWorldX && enemyTileY === mouseWorldY) {
                // Damage enemy
                enemy.health -= 10;
                
                // Apply knockback
                const knockbackForce = 5;
                const knockbackX = enemy.x > playerCenterX ? knockbackForce : -knockbackForce;
                const knockbackY = -knockbackForce / 2;
                
                enemy.velocityX = knockbackX;
                enemy.velocityY = knockbackY;
                
                // Remove enemy if health depleted
                if (enemy.health <= 0) {
                    gameState.enemies.splice(i, 1);
                    gameState.score += 50; // Points for killing enemy
                    updateScoreDisplay();
                    i--; // Adjust index after removal
                }
                
                break;
            }
        }
    }
}

// Update inventory display
function updateInventoryDisplay() {
    // Ensure inventory object exists
    if (!gameState.player.inventory) {
        gameState.player.inventory = {
            dirt: 0,
            stone: 0,
            ore: 0
        };
    }
    
    document.getElementById('dirt-count').textContent = `Dirt: ${gameState.player.inventory.dirt || 0}`;
    document.getElementById('stone-count').textContent = `Stone: ${gameState.player.inventory.stone || 0}`;
    document.getElementById('ore-count').textContent = `Ore: ${gameState.player.inventory.ore || 0}`;
}

// Update score display
function updateScoreDisplay() {
    document.getElementById('score').textContent = `Score: ${gameState.score}`;
}

// Show notification
function showNotification(message, duration = 2000) {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.style.position = 'absolute';
        notification.style.top = '50px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        notification.style.color = 'white';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '5px';
        notification.style.zIndex = '1000';
        notification.style.transition = 'opacity 0.3s';
        document.getElementById('game-container').appendChild(notification);
    }
    
    // Set message and show notification
    notification.textContent = message;
    notification.style.opacity = '1';
    
    // Hide after duration
    setTimeout(() => {
        notification.style.opacity = '0';
    }, duration);
} 