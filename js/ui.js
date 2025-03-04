// UI.js - Handles all UI rendering and updates

// Initialize UI elements
function initializeUI() {
    // Create UI container if it doesn't exist
    const uiContainer = document.getElementById('ui-container');
    if (!uiContainer) {
        console.error("UI container not found!");
        return;
    }
    
    // Clear any existing content
    uiContainer.innerHTML = '';
    
    // Create health display
    const healthDisplay = document.createElement('div');
    healthDisplay.id = 'health-display';
    healthDisplay.className = 'ui-element';
    uiContainer.appendChild(healthDisplay);
    
    // Create score display
    const scoreDisplay = document.createElement('div');
    scoreDisplay.id = 'score-display';
    scoreDisplay.className = 'ui-element';
    uiContainer.appendChild(scoreDisplay);
    
    // Create inventory container
    const inventoryContainer = document.createElement('div');
    inventoryContainer.id = 'inventory-container';
    inventoryContainer.className = 'ui-element';
    
    const inventoryTitle = document.createElement('div');
    inventoryTitle.id = 'inventory-title';
    inventoryTitle.textContent = 'Inventory';
    inventoryContainer.appendChild(inventoryTitle);
    
    const inventoryItems = document.createElement('div');
    inventoryItems.id = 'inventory-items';
    inventoryContainer.appendChild(inventoryItems);
    
    uiContainer.appendChild(inventoryContainer);
    
    // Create biome indicator
    const biomeIndicator = document.createElement('div');
    biomeIndicator.id = 'biome-indicator';
    biomeIndicator.className = 'ui-element';
    uiContainer.appendChild(biomeIndicator);
    
    // Create player stats display (bottom left)
    const playerStatsDisplay = document.createElement('div');
    playerStatsDisplay.id = 'player-stats-display';
    playerStatsDisplay.className = 'ui-element';
    uiContainer.appendChild(playerStatsDisplay);
    
    
    // Initial UI update
    updateUI();
    
    console.log("UI initialized successfully with reset seed button");
}

// Update all UI elements
function updateUI() {
    // Directly call the specific update functions to avoid circular references
    updateHealthDisplay();
    updateScoreDisplay();
    updateInventoryDisplay();
    updateBiomeDisplay();
    updateDebugInfo();
    updatePlayerStatsDisplay();
}

// Update health display
function updateHealthDisplay() {
    const healthDisplay = document.getElementById('health-display');
    if (healthDisplay) {
        if (!window.gameState || !window.gameState.player) {
            healthDisplay.innerHTML = `<div class="health-bar-container">
                <div class="health-bar" style="width: 100%"></div>
                <div class="health-text">Health: Not available</div>
            </div>`;
            return;
        }
        
        const healthPercent = (window.gameState.player.health / window.gameState.player.maxHealth) * 100;
        
        healthDisplay.innerHTML = `
            <div class="health-bar-container">
                <div class="health-bar" style="width: ${healthPercent}%"></div>
                <div class="health-text">Health: ${window.gameState.player.health}/${window.gameState.player.maxHealth}</div>
            </div>
        `;
    }
}

// Update score display
function updateScoreDisplay() {
    const scoreDisplay = document.getElementById('score-display');
    if (scoreDisplay) {
        if (!window.gameState) {
            scoreDisplay.textContent = `Score: Not available`;
            return;
        }
        scoreDisplay.textContent = `Score: ${window.gameState.score}`;
    }
}

// Update inventory display
function updateInventoryDisplay() {
    const inventoryItems = document.getElementById('inventory-items');
    if (!inventoryItems) {
        console.error("Inventory items container not found!");
        return;
    }
    
    // Check if player and inventory exist
    if (!window.gameState || !window.gameState.player || !window.gameState.player.inventory) {
        console.error("Game state or player inventory not initialized!");
        console.log("gameState exists:", !!window.gameState);
        console.log("player exists:", window.gameState && !!window.gameState.player);
        console.log("inventory exists:", window.gameState && window.gameState.player && !!window.gameState.player.inventory);
        
        const emptyText = document.createElement('div');
        emptyText.className = 'empty-inventory';
        emptyText.textContent = 'Inventory not available';
        inventoryItems.appendChild(emptyText);
        return;
    }

    // Cache the inventory for comparison
    if (!window.previousInventory) {
        window.previousInventory = {};
    }
    
    // Check if inventory has changed
    let hasChanged = false;
    const currentInventory = window.gameState.player.inventory;
    
    for (const resourceKey in currentInventory) {
        if (window.previousInventory[resourceKey] !== currentInventory[resourceKey]) {
            hasChanged = true;
            break;
        }
    }
    
    // Also check if any previous keys are now missing
    for (const resourceKey in window.previousInventory) {
        if (currentInventory[resourceKey] === undefined) {
            hasChanged = true;
            break;
        }
    }
    
    // If inventory hasn't changed, return early
    if (!hasChanged) {
        return;
    }
    
    console.log("Updating inventory display");
    
    // Update the cache with current values
    window.previousInventory = JSON.parse(JSON.stringify(currentInventory));
    
    // Clear current inventory display
    inventoryItems.innerHTML = '';
    
    console.log("Player inventory:", JSON.stringify(currentInventory));
    
    // Check if inventory is empty
    let hasItems = false;
    
    // Resource types and their colors
    const resourceTypes = {
        'dirt': { color: '#8B4513', name: 'Dirt' },
        'stone': { color: '#808080', name: 'Stone' },
        'ore': { color: '#FFD700', name: 'Ore' },
        'coal': { color: '#2C2C2C', name: 'Coal' },
        'iron': { color: '#C0C0C0', name: 'Iron' },
        'gold': { color: '#DAA520', name: 'Gold' },
        'diamond': { color: '#00FFFF', name: 'Diamond' }
    };
    
    // Add each inventory item
    for (const resourceKey in currentInventory) {
        const count = currentInventory[resourceKey];
        console.log(`Resource ${resourceKey}: ${count}`);
        if (count > 0) {
            hasItems = true;
            
            const resourceInfo = resourceTypes[resourceKey] || { color: '#FFFFFF', name: resourceKey };
            
            const itemElement = document.createElement('div');
            itemElement.className = 'inventory-item';
            
            const itemColor = document.createElement('div');
            itemColor.className = 'item-color';
            itemColor.style.backgroundColor = resourceInfo.color;
            
            const itemDetails = document.createElement('div');
            itemDetails.className = 'item-details';
            itemDetails.textContent = `${resourceInfo.name}: ${count}`;
            
            itemElement.appendChild(itemColor);
            itemElement.appendChild(itemDetails);
            inventoryItems.appendChild(itemElement);
        }
    }
    
    // Show "Empty" if no items
    if (!hasItems) {
        console.log("No items in inventory");
        const emptyText = document.createElement('div');
        emptyText.className = 'empty-inventory';
        emptyText.textContent = 'Empty';
        inventoryItems.appendChild(emptyText);
    }
}

// Update biome display
function updateBiomeDisplay() {
    const biomeIndicator = document.getElementById('biome-indicator');
    if (!biomeIndicator || !window.gameState || !window.gameState.biomeMap) return;
    
    const playerBiomeX = Math.floor(window.gameState.player.x / TILE_SIZE);
    const biomeType = getBiomeAt(playerBiomeX);
    
    let biomeName = "Unknown";
    switch (biomeType) {
        case BIOME_TYPES.PLAINS: biomeName = "Plains"; break;
        case BIOME_TYPES.FOREST: biomeName = "Forest"; break;
        case BIOME_TYPES.DESERT: biomeName = "Desert"; break;
        case BIOME_TYPES.MOUNTAINS: biomeName = "Mountains"; break;
    }
    
    biomeIndicator.textContent = `Biome: ${biomeName}`;
}

// Update debug info
function updateDebugInfo() {
    const debugInfo = document.getElementById('debug-info');
    if (!debugInfo) return;
    
    // Only show debug info if enabled
    if (window.gameState && window.gameState.debug && window.gameState.debug.showFPS) {
        debugInfo.style.display = 'block';
        
        const playerX = Math.floor(window.gameState.player.x / TILE_SIZE);
        const playerY = Math.floor(window.gameState.player.y / TILE_SIZE);
        
        debugInfo.innerHTML = `
            Position: (${playerX}, ${playerY})<br>
            FPS: ${Math.round(window.gameState.fps || 0)}<br>
            Chunks: ${Object.keys(window.gameState.chunks).length}
        `;
    } else {
        debugInfo.style.display = 'none';
    }
}

// Update player stats display (position, connected players, FPS)
function updatePlayerStatsDisplay() {
    const playerStatsDisplay = document.getElementById('player-stats-display');
    if (!playerStatsDisplay) return;
    
    if (!window.gameState || !window.gameState.player) {
        playerStatsDisplay.textContent = 'Player stats not available';
        return;
    }
    
    const playerX = Math.floor(window.gameState.player.x);
    const playerY = Math.floor(window.gameState.player.y);
    const fps = Math.round(window.gameState.fps || 0);
    
    // Get connected players count from gameState
    // This is updated by the multiplayer module
    const connectedPlayers = window.gameState.connectedPlayersCount || 1;
    
    playerStatsDisplay.innerHTML = `
        <div>Position: (${playerX}, ${playerY})</div>
        <div>Connected Players: ${connectedPlayers}</div>
        <div>FPS: ${fps}</div>
    `;
}

// Show a temporary message to the player
function showGameMessage(text, duration = 3000) {
    // Remove any existing message
    const existingMessage = document.querySelector('.game-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create new message
    const messageElement = document.createElement('div');
    messageElement.className = 'game-message';
    messageElement.textContent = text;
    document.body.appendChild(messageElement);
    
    // Fade out and remove after duration
    setTimeout(() => {
        messageElement.classList.add('fade-out');
        setTimeout(() => {
            messageElement.remove();
        }, 1000);
    }, duration);
}

// Toggle debug mode
function toggleDebugMode() {
    if (!window.gameState.debug) window.gameState.debug = {};
    window.gameState.debug.showFPS = !window.gameState.debug.showFPS;
    updateDebugInfo();
}

// Show damage flash effect
function showDamageFlash() {
    // Remove any existing flash
    const existingFlash = document.querySelector('.damage-flash');
    if (existingFlash) {
        existingFlash.remove();
    }
    
    // Create flash element
    const flashElement = document.createElement('div');
    flashElement.className = 'damage-flash';
    document.body.appendChild(flashElement);
    
    // Remove after animation completes
    setTimeout(() => {
        flashElement.remove();
    }, 200);
}

// Expose UI functions to window object
window.initializeUI = initializeUI;
window.updateUI = updateUI;
window.updateHealthDisplay = updateHealthDisplay;
window.updateScoreDisplay = updateScoreDisplay;
window.updateInventoryDisplay = updateInventoryDisplay;
window.updateBiomeDisplay = updateBiomeDisplay;
window.updateDebugInfo = updateDebugInfo;
window.updatePlayerStatsDisplay = updatePlayerStatsDisplay;
window.showGameMessage = showGameMessage;
window.toggleDebugMode = toggleDebugMode;
window.showDamageFlash = showDamageFlash;

// Log that UI functions have been exported
console.log("UI functions exported to window object"); 