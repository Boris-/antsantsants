// Handle input events
function setupEventListeners() {
    // Keyboard events
    window.addEventListener('keydown', (e) => {
        gameState.keys[e.code] = true;
        
        // Toggle debug mode with F3
        if (e.code === 'F3') {
            toggleDebugMode();
        }
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
    
    gameState.canvas.addEventListener('mousedown', (e) => {
        gameState.mouseDown = true;
        
        // Update mouse position before handling digging
        const rect = gameState.canvas.getBoundingClientRect();
        gameState.mouseX = e.clientX - rect.left;
        gameState.mouseY = e.clientY - rect.top;
        
        // Only call handleDigging if mouse is down
        if (gameState.mouseDown) {
            handleDigging();
        }
    });
    
    gameState.canvas.addEventListener('mouseup', () => {
        gameState.mouseDown = false;
    });
    
    // Mouse wheel for zooming
    gameState.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        // Set zooming flag to disable particle animations
        gameState.isZooming = true;
        
        // Clear any existing zoom timeout
        if (gameState.zoomTimeout) {
            clearTimeout(gameState.zoomTimeout);
        }
        
        // Determine zoom direction
        const zoomAmount = e.deltaY > 0 ? -0.1 : 0.1;
        
        // Store old zoom for calculations
        const oldZoom = gameState.zoom;
        
        // Calculate new zoom level
        const newZoom = Math.max(
            gameState.minZoom, 
            Math.min(gameState.maxZoom, gameState.zoom + zoomAmount)
        );
        
        // Get mouse position relative to canvas
        const rect = gameState.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Calculate world coordinates under the mouse
        const worldX = gameState.camera.x + (mouseX / oldZoom);
        const worldY = gameState.camera.y + (mouseY / oldZoom);
        
        // Apply zoom
        gameState.zoom = newZoom;
        
        // Adjust camera to keep the world point under the mouse fixed
        gameState.camera.x = worldX - (mouseX / newZoom);
        gameState.camera.y = worldY - (mouseY / newZoom);
        
        // Update camera target to match new position
        gameState.camera.targetX = gameState.camera.x;
        gameState.camera.targetY = gameState.camera.y;
        
        // Show zoom level indicator
        showZoomIndicator();
        
        // Set a timeout to reset the zooming flag after zooming stops
        gameState.zoomTimeout = setTimeout(() => {
            gameState.isZooming = false;
        }, 500); // 500ms delay
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
    // Only proceed if mouse is down
    if (!gameState.mouseDown) return;
    
    // Get mouse position relative to canvas
    const rect = gameState.canvas.getBoundingClientRect();
    const mouseX = gameState.mouseX;
    const mouseY = gameState.mouseY;
    
    // Calculate mouse position in world coordinates (accounting for zoom)
    const mouseWorldX = gameState.camera.x + (mouseX / gameState.zoom);
    const mouseWorldY = gameState.camera.y + (mouseY / gameState.zoom);
    
    // Convert to tile coordinates
    const tileX = Math.floor(mouseWorldX / TILE_SIZE);
    const tileY = Math.floor(mouseWorldY / TILE_SIZE);
    
    // Debug output
    if (gameState.debug) {
        console.log(`Mouse: (${mouseX}, ${mouseY}), World: (${mouseWorldX}, ${mouseWorldY}), Tile: (${tileX}, ${tileY})`);
    }
    
    // Calculate distance from player to mouse position
    const playerCenterX = gameState.player.x + gameState.player.width / 2;
    const playerCenterY = gameState.player.y + gameState.player.height / 2;
    const tileCenterX = tileX * TILE_SIZE + TILE_SIZE / 2;
    const tileCenterY = tileY * TILE_SIZE + TILE_SIZE / 2;
    
    const distance = Math.sqrt(
        Math.pow(playerCenterX - tileCenterX, 2) + 
        Math.pow(playerCenterY - tileCenterY, 2)
    );
    
    // Only allow digging within a certain range
    const maxDigDistance = 100;
    if (distance <= maxDigDistance) {
        const tile = getTile(tileX, tileY);
        
        // Check if tile is diggable
        if (tile === TILE_TYPES.DIRT || tile === TILE_TYPES.GRASS || 
            tile === TILE_TYPES.STONE || tile === TILE_TYPES.ORE || 
            tile === TILE_TYPES.SAND || tile === TILE_TYPES.COAL ||
            tile === TILE_TYPES.IRON || tile === TILE_TYPES.GOLD ||
            tile === TILE_TYPES.DIAMOND) {
            
            // Add to inventory based on tile type
            if (tile === TILE_TYPES.DIRT || tile === TILE_TYPES.GRASS) {
                gameState.player.inventory.dirt++;
            } else if (tile === TILE_TYPES.STONE) {
                gameState.player.inventory.stone++;
            } else if (tile === TILE_TYPES.ORE) {
                gameState.player.inventory.ore++;
                gameState.score += 10; // Bonus points for ore
            } else if (tile === TILE_TYPES.COAL) {
                gameState.player.inventory.coal++;
                gameState.score += 15; // Bonus points for coal
            } else if (tile === TILE_TYPES.IRON) {
                gameState.player.inventory.iron++;
                gameState.score += 25; // Bonus points for iron
            } else if (tile === TILE_TYPES.GOLD) {
                gameState.player.inventory.gold++;
                gameState.score += 50; // Bonus points for gold
            } else if (tile === TILE_TYPES.DIAMOND) {
                gameState.player.inventory.diamond++;
                gameState.score += 100; // Bonus points for diamond
            }
            
            // Remove the tile
            setTile(tileX, tileY, TILE_TYPES.AIR);
            
            // Update UI
            updateInventoryDisplay();
            updateScoreDisplay();
            
            // Mark world as having unsaved changes
            gameState.hasUnsavedChanges = true;
        }
        
        // Check for enemies
        for (let i = 0; i < gameState.enemies.length; i++) {
            const enemy = gameState.enemies[i];
            const enemyTileX = Math.floor(enemy.x / TILE_SIZE);
            const enemyTileY = Math.floor(enemy.y / TILE_SIZE);
            
            if (enemyTileX === tileX && enemyTileY === tileY) {
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
                    i--;
                    
                    // Add score for killing enemy
                    gameState.score += 25;
                    updateScoreDisplay();
                }
            }
        }
    }
}

// Update inventory display
function updateInventoryDisplay() {
    // Call the centralized UI update function from ui.js
    if (typeof window.updateInventoryDisplay === 'function') {
        window.updateInventoryDisplay();
    }
}

// Update score display
function updateScoreDisplay() {
    // Call the centralized UI update function from ui.js
    if (typeof window.updateScoreDisplay === 'function') {
        window.updateScoreDisplay();
    }
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

// Show zoom level indicator
function showZoomIndicator() {
    // Create or get zoom indicator element
    let zoomIndicator = document.getElementById('zoom-indicator');
    
    if (!zoomIndicator) {
        zoomIndicator = document.createElement('div');
        zoomIndicator.id = 'zoom-indicator';
        zoomIndicator.style.position = 'absolute';
        zoomIndicator.style.top = '50px';
        zoomIndicator.style.right = '20px';
        zoomIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        zoomIndicator.style.color = 'white';
        zoomIndicator.style.padding = '8px 12px';
        zoomIndicator.style.borderRadius = '4px';
        zoomIndicator.style.fontFamily = 'Arial, sans-serif';
        zoomIndicator.style.fontSize = '14px';
        zoomIndicator.style.fontWeight = 'bold';
        zoomIndicator.style.zIndex = '1000';
        zoomIndicator.style.transition = 'opacity 0.3s';
        
        // Add to game container or body if container not found
        const container = document.getElementById('game-container') || document.body;
        container.appendChild(zoomIndicator);
    }
    
    // Update zoom level text
    zoomIndicator.textContent = `Zoom: ${Math.round(gameState.zoom * 100)}%`;
    
    // Make sure it's visible
    zoomIndicator.style.opacity = '1';
    zoomIndicator.style.display = 'block';
    
    // Clear any existing timeout
    clearTimeout(window.zoomIndicatorTimeout);
    
    // Hide after 2 seconds
    window.zoomIndicatorTimeout = setTimeout(() => {
        zoomIndicator.style.opacity = '0';
        
        // Remove from DOM after fade out
        setTimeout(() => {
            zoomIndicator.style.display = 'none';
        }, 300);
    }, 2000);
}

// Toggle debug mode
function toggleDebugMode() {
    gameState.debug = !gameState.debug;
    console.log(`Debug mode: ${gameState.debug ? 'ON' : 'OFF'}`);
    
    // Show or hide debug elements
    const debugElements = document.querySelectorAll('.debug-element');
    debugElements.forEach(el => {
        el.style.display = gameState.debug ? 'block' : 'none';
    });
    
    // Create debug overlay if it doesn't exist
    if (gameState.debug && !document.getElementById('debug-overlay')) {
        createDebugOverlay();
    }
}

// Create debug overlay
function createDebugOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'debug-overlay';
    overlay.className = 'debug-element';
    overlay.style.position = 'absolute';
    overlay.style.top = '10px';
    overlay.style.left = '10px';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.color = 'white';
    overlay.style.padding = '10px';
    overlay.style.borderRadius = '5px';
    overlay.style.fontFamily = 'monospace';
    overlay.style.fontSize = '12px';
    overlay.style.zIndex = '1000';
    overlay.style.display = gameState.debug ? 'block' : 'none';
    
    // Add debug info
    overlay.innerHTML = `
        <div>Debug Mode</div>
        <div id="debug-fps">FPS: 0</div>
        <div id="debug-player-pos">Player: (0, 0)</div>
        <div id="debug-camera-pos">Camera: (0, 0)</div>
        <div id="debug-mouse-pos">Mouse: (0, 0)</div>
        <div id="debug-zoom">Zoom: 100%</div>
        <div id="debug-chunks">Loaded Chunks: 0</div>
    `;
    
    document.body.appendChild(overlay);
    
    // Update debug info every frame
    function updateDebugInfo() {
        if (!gameState.debug) return;
        
        const fps = Math.round(1000 / (performance.now() - gameState.lastFrameTime));
        document.getElementById('debug-fps').textContent = `FPS: ${fps}`;
        
        document.getElementById('debug-player-pos').textContent = 
            `Player: (${Math.round(gameState.player.x)}, ${Math.round(gameState.player.y)})`;
        
        document.getElementById('debug-camera-pos').textContent = 
            `Camera: (${Math.round(gameState.camera.x)}, ${Math.round(gameState.camera.y)})`;
        
        document.getElementById('debug-mouse-pos').textContent = 
            `Mouse: (${gameState.mouseX}, ${gameState.mouseY}) | World: (${Math.round(gameState.camera.x + gameState.mouseX / gameState.zoom)}, ${Math.round(gameState.camera.y + gameState.mouseY / gameState.zoom)})`;
        
        document.getElementById('debug-zoom').textContent = 
            `Zoom: ${Math.round(gameState.zoom * 100)}%`;
        
        document.getElementById('debug-chunks').textContent = 
            `Loaded Chunks: ${Object.keys(gameState.chunks).length}`;
        
        requestAnimationFrame(updateDebugInfo);
    }
    
    updateDebugInfo();
    
    return overlay;
} 