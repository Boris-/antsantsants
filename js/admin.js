// Admin Panel functionality
let socket;
let connectedPlayers = {};
let worldData = {
    seed: 'Unknown',
    chunks: 0,
    blockUpdates: 0,
    creationDate: null
};
let isConnected = false;
let serverStats = {
    totalPlayers: 0,
    activePlayers: 0, 
    serverStartTime: null
};

// Map rendering variables
const mapCanvas = document.createElement('canvas');
const mapCtx = mapCanvas.getContext('2d');
const mapColors = {
    water: '#0077be',
    sand: '#c2b280',
    grass: '#567d46',
    forest: '#228b22',
    mountain: '#808080',
    snow: '#fffafa',
    cave: '#3b2921',
    player: '#ff0000',
    otherPlayers: '#ffaa00'
};

// Constants
const UPDATE_INTERVAL = 2000; // Update every 2 seconds
const SERVER_URL = window.location.hostname + ':3001'; // Dynamically determine server URL

// Initialize the admin panel
function initializeAdmin() {
    // Connect to the server - use secure WebSocket if page is loaded over HTTPS
    const protocol = window.location.protocol === 'https:' ? 'https://' : 'http://';
    socket = io(protocol + SERVER_URL);
    setupSocketEvents();
    
    // Setup UI elements
    setupUIElements();
    
    // Initialize the map
    initializeMap();
    
    // Start periodic updates
    startPeriodicUpdates();
    
    console.log('Admin panel initialized, connecting to:', protocol + SERVER_URL);
}

// Setup socket event handlers
function setupSocketEvents() {
    socket.on('connect', () => {
        console.log('Connected to server');
        isConnected = true;
        updateServerStatus('Connected');
        
        // Request initial data
        requestWorldData();
        requestPlayerList();
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        isConnected = false;
        updateServerStatus('Disconnected');
    });
    
    socket.on('worldData', (data) => {
        console.log('Received world data:', data);
        worldData = data;
        updateWorldDataDisplay();
    });
    
    socket.on('playerList', (data) => {
        console.log('Received player list:', data);
        connectedPlayers = data.players || {};
        
        // Update server stats
        if (data.totalPlayers !== undefined) serverStats.totalPlayers = data.totalPlayers;
        if (data.activePlayers !== undefined) serverStats.activePlayers = data.activePlayers;
        if (data.serverStartTime !== undefined) serverStats.serverStartTime = data.serverStartTime;
        
        updatePlayerListDisplay();
    });
    
    socket.on('worldMapData', (data) => {
        console.log('Received world map data');
        renderWorldMap(data);
    });
    
    socket.on('worldReset', () => {
        console.log('World has been reset');
        showNotification('World has been reset!');
        requestWorldData();
    });
    
    socket.on('worldSaved', () => {
        console.log('World has been saved');
        showNotification('World saved successfully!');
    });
}

// Setup UI elements and event handlers
function setupUIElements() {
    // Reset world button
    const resetWorldBtn = document.getElementById('reset-world-btn');
    resetWorldBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset the world? All progress will be lost.')) {
            resetWorld();
        }
    });
    
    // Reset with custom seed button
    const resetWorldCustomBtn = document.getElementById('reset-world-custom-btn');
    resetWorldCustomBtn.addEventListener('click', () => {
        const seedInput = document.getElementById('seed-input');
        const seed = parseInt(seedInput.value.trim());
        
        if (!isNaN(seed)) {
            if (confirm(`Are you sure you want to reset the world with seed ${seed}? All progress will be lost.`)) {
                resetWorld(seed);
            }
        } else {
            alert('Please enter a valid number as the seed.');
        }
    });
    
    // Save world button
    const saveWorldBtn = document.getElementById('save-world-btn');
    saveWorldBtn.addEventListener('click', () => {
        saveWorld();
    });
}

// Initialize the world map
function initializeMap() {
    const mapContainer = document.getElementById('world-map');
    
    // Set canvas dimensions
    mapCanvas.width = mapContainer.clientWidth;
    mapCanvas.height = mapContainer.clientHeight;
    
    // Append canvas to container
    mapContainer.innerHTML = '';
    mapContainer.appendChild(mapCanvas);
    
    // Request map data
    requestMapData();
}

// Start periodic updates
function startPeriodicUpdates() {
    setInterval(() => {
        if (isConnected) {
            requestWorldData();
            requestPlayerList();
            requestMapData();
        }
    }, UPDATE_INTERVAL);
}

// Request world data from server
function requestWorldData() {
    if (isConnected) {
        socket.emit('getWorldData');
    }
}

// Request player list from server
function requestPlayerList() {
    if (isConnected) {
        socket.emit('getPlayerList');
    }
}

// Request map data from server
function requestMapData() {
    if (isConnected) {
        socket.emit('getWorldMap');
    }
}

// Reset the world
function resetWorld(seed) {
    if (isConnected) {
        if (seed !== undefined) {
            socket.emit('resetWorldSeed', { seed });
        } else {
            socket.emit('resetWorldSeed', {});
        }
        showNotification('Resetting world...');
    } else {
        alert('Cannot reset world: Not connected to server');
    }
}

// Save the world
function saveWorld() {
    if (isConnected) {
        socket.emit('saveWorld');
        showNotification('Saving world...');
    } else {
        alert('Cannot save world: Not connected to server');
    }
}

// Update server status display
function updateServerStatus(status) {
    const serverStatusElement = document.getElementById('server-status');
    serverStatusElement.textContent = status;
    
    // Add color coding based on status
    if (status === 'Connected') {
        serverStatusElement.style.color = '#44cc44';
    } else {
        serverStatusElement.style.color = '#cc4444';
    }
}

// Update world data display
function updateWorldDataDisplay() {
    if (worldData) {
        // Update seed
        document.getElementById('world-seed').textContent = worldData.worldSeed || 'Unknown';
        
        // Update chunk count
        document.getElementById('chunk-count').textContent = 
            Object.keys(worldData.chunks || {}).length.toString();
        
        // Update block updates
        document.getElementById('block-updates').textContent = 
            (worldData.worldMetadata?.blockUpdates || 0).toString();
        
        // Update world age
        const creationTime = worldData.worldMetadata?.createdAt;
        if (creationTime) {
            const ageInDays = Math.floor((Date.now() - creationTime) / (1000 * 60 * 60 * 24));
            document.getElementById('world-age').textContent = `${ageInDays} days`;
        }
    }
}

// Update player list display
function updatePlayerListDisplay() {
    const playerCountElement = document.getElementById('player-count');
    const playerListElement = document.getElementById('player-list');
    
    // Update player count - show active vs total
    const playerCount = Object.keys(connectedPlayers).length;
    playerCountElement.textContent = `${serverStats.activePlayers} active / ${serverStats.totalPlayers} total`;
    
    // Update player list
    if (playerCount === 0) {
        playerListElement.innerHTML = '<div>No players connected</div>';
    } else {
        playerListElement.innerHTML = '';
        
        // Create a table for the player list
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        
        // Create header row
        const headerRow = document.createElement('tr');
        ['ID', 'Username', 'Position', 'Health', 'Score', 'Status', 'Session Time'].forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            th.style.textAlign = 'left';
            th.style.padding = '5px';
            th.style.borderBottom = '1px solid #444';
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);
        
        // Sort players by active status first, then by join time
        const sortedPlayers = Object.entries(connectedPlayers).sort((a, b) => {
            // Sort by active status first (active players on top)
            if (a[1].active !== b[1].active) {
                return a[1].active ? -1 : 1;
            }
            // Then sort by join time (newest first)
            return (b[1].joinedAt || 0) - (a[1].joinedAt || 0);
        });
        
        // Add rows for each player
        sortedPlayers.forEach(([id, playerData]) => {
            const row = document.createElement('tr');
            const isActive = playerData.active === true;
            
            // Set row background based on active status
            row.style.backgroundColor = isActive ? 'rgba(0, 100, 0, 0.1)' : 'rgba(50, 50, 50, 0.1)';
            
            // ID cell
            const idCell = document.createElement('td');
            idCell.textContent = id.substring(0, 8) + '...'; // Truncate long IDs
            idCell.style.padding = '5px';
            row.appendChild(idCell);
            
            // Username cell
            const usernameCell = document.createElement('td');
            usernameCell.textContent = playerData.username || `Player-${id.substring(0, 4)}`;
            usernameCell.style.padding = '5px';
            usernameCell.style.fontWeight = 'bold';
            row.appendChild(usernameCell);
            
            // Position cell
            const posCell = document.createElement('td');
            const x = Math.round(playerData.x || 0);
            const y = Math.round(playerData.y || 0);
            posCell.textContent = `${x}, ${y}`;
            posCell.style.padding = '5px';
            row.appendChild(posCell);
            
            // Health cell
            const healthCell = document.createElement('td');
            const health = playerData.health || 100;
            healthCell.innerHTML = createProgressBar(health, 100, health >= 70 ? '#44cc44' : health >= 30 ? '#cccc44' : '#cc4444');
            healthCell.style.padding = '5px';
            row.appendChild(healthCell);
            
            // Score cell
            const scoreCell = document.createElement('td');
            scoreCell.textContent = playerData.score || '0';
            scoreCell.style.padding = '5px';
            row.appendChild(scoreCell);
            
            // Status cell
            const statusCell = document.createElement('td');
            statusCell.textContent = isActive ? 'Active' : 'Inactive';
            statusCell.style.padding = '5px';
            statusCell.style.color = isActive ? '#44cc44' : '#cc4444';
            statusCell.style.fontWeight = 'bold';
            row.appendChild(statusCell);
            
            // Session time cell
            const sessionCell = document.createElement('td');
            if (playerData.joinedAt) {
                const sessionTime = Math.floor((Date.now() - playerData.joinedAt) / 1000);
                sessionCell.textContent = formatTimeElapsed(sessionTime);
            } else {
                sessionCell.textContent = 'Unknown';
            }
            sessionCell.style.padding = '5px';
            row.appendChild(sessionCell);
            
            table.appendChild(row);
        });
        
        playerListElement.appendChild(table);
        
        // Add server uptime information
        if (serverStats.serverStartTime) {
            const uptimeInfo = document.createElement('div');
            uptimeInfo.style.marginTop = '15px';
            uptimeInfo.style.fontSize = '12px';
            uptimeInfo.style.color = '#aaa';
            
            const uptime = Math.floor((Date.now() - serverStats.serverStartTime) / 1000);
            uptimeInfo.textContent = `Server uptime: ${formatTimeElapsed(uptime)}`;
            
            playerListElement.appendChild(uptimeInfo);
        }
    }
}

// Create a progress bar element
function createProgressBar(value, max, color) {
    const percentage = Math.round((value / max) * 100);
    return `
        <div style="background-color: #333; border-radius: 4px; height: 10px; width: 100%; margin: 2px 0;">
            <div style="background-color: ${color}; border-radius: 4px; height: 10px; width: ${percentage}%;"></div>
        </div>
        <div style="font-size: 10px; text-align: center;">${value}/${max}</div>
    `;
}

// Format time elapsed into a human-readable string
function formatTimeElapsed(seconds) {
    if (seconds < 60) {
        return `${seconds} seconds`;
    } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (seconds < 86400) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        return `${days} day${days !== 1 ? 's' : ''} ${hours} hour${hours !== 1 ? 's' : ''}`;
    }
}

// Render the world map
function renderWorldMap(mapData) {
    if (!mapData || !mapData.terrain) return;
    
    const ctx = mapCtx;
    const width = mapCanvas.width;
    const height = mapCanvas.height;
    const mapCenter = { x: width / 2, y: height / 2 };
    
    // Clear the canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw the terrain
    const terrainData = mapData.terrain;
    const tileSize = Math.min(width / terrainData[0].length, height / terrainData.length);
    
    // Calculate map offset to center it
    const mapOffsetX = (width - (terrainData[0].length * tileSize)) / 2;
    const mapOffsetY = (height - (terrainData.length * tileSize)) / 2;
    
    for (let y = 0; y < terrainData.length; y++) {
        for (let x = 0; x < terrainData[y].length; x++) {
            const tileType = terrainData[y][x];
            ctx.fillStyle = getTileColor(tileType);
            ctx.fillRect(
                mapOffsetX + (x * tileSize), 
                mapOffsetY + (y * tileSize), 
                tileSize, 
                tileSize
            );
        }
    }
    
    // Draw grid lines (optional)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;
    
    // Draw players
    if (mapData.players) {
        const scale = mapData.scale || 10;
        const mapSize = terrainData.length * tileSize;
        
        // Draw a border around the map
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(mapOffsetX, mapOffsetY, terrainData[0].length * tileSize, terrainData.length * tileSize);
        
        // Draw coordinate system origin
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mapCenter.x, mapOffsetY);
        ctx.lineTo(mapCenter.x, mapOffsetY + mapSize);
        ctx.moveTo(mapOffsetX, mapCenter.y);
        ctx.lineTo(mapOffsetX + mapSize, mapCenter.y);
        ctx.stroke();
        
        // Mark center of map
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(mapCenter.x, mapCenter.y, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw each player
        Object.entries(mapData.players).forEach(([id, player]) => {
            if (!player || typeof player.x !== 'number' || typeof player.y !== 'number') return;
            
            // Calculate position in map coordinates
            const playerX = mapCenter.x + (player.x / scale);
            const playerY = mapCenter.y + (player.y / scale);
            
            // Check if player is within map bounds
            if (
                playerX >= mapOffsetX && 
                playerX <= mapOffsetX + (terrainData[0].length * tileSize) &&
                playerY >= mapOffsetY && 
                playerY <= mapOffsetY + (terrainData.length * tileSize)
            ) {
                // Draw player marker
                const isActive = player.active === true;
                ctx.fillStyle = isActive ? mapColors.player : mapColors.otherPlayers;
                
                // Draw player dot
                ctx.beginPath();
                ctx.arc(playerX, playerY, 5, 0, Math.PI * 2);
                ctx.fill();
                
                // Draw player ID label
                ctx.font = '10px Arial';
                ctx.fillStyle = 'white';
                ctx.textAlign = 'center';
                ctx.fillText(id.substring(0, 4), playerX, playerY - 10);
            }
        });
        
        // Add a legend for the map
        const legendY = height - 25;
        const legendX = 15;
        const legendSpacing = 80;
        
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        
        // Active player legend
        ctx.fillStyle = mapColors.player;
        ctx.beginPath();
        ctx.arc(legendX, legendY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.fillText('Active Player', legendX + 10, legendY + 4);
        
        // Inactive player legend
        ctx.fillStyle = mapColors.otherPlayers;
        ctx.beginPath();
        ctx.arc(legendX + legendSpacing, legendY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.fillText('Inactive Player', legendX + legendSpacing + 10, legendY + 4);
        
        // Origin marker legend
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(legendX + (legendSpacing * 2), legendY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.fillText('Origin (0,0)', legendX + (legendSpacing * 2) + 10, legendY + 4);
    }
}

// Get color for tile type
function getTileColor(tileType) {
    switch(tileType) {
        case 0: return mapColors.water;
        case 1: return mapColors.sand;
        case 2: return mapColors.grass;
        case 3: return mapColors.forest;
        case 4: return mapColors.mountain;
        case 5: return mapColors.snow;
        case 6: return mapColors.cave;
        default: return '#333333';
    }
}

// Show notification
function showNotification(message) {
    // Check if notification container exists
    let notificationContainer = document.getElementById('notification-container');
    
    // Create if it doesn't exist
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.style.position = 'fixed';
        notificationContainer.style.top = '20px';
        notificationContainer.style.right = '20px';
        notificationContainer.style.zIndex = '1000';
        document.body.appendChild(notificationContainer);
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.backgroundColor = '#333';
    notification.style.color = 'white';
    notification.style.padding = '10px 15px';
    notification.style.margin = '5px 0';
    notification.style.borderRadius = '4px';
    notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s ease-in-out';
    
    // Add to container
    notificationContainer.appendChild(notification);
    
    // Fade in
    setTimeout(() => {
        notification.style.opacity = '1';
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Initialize when the page loads
window.addEventListener('load', initializeAdmin); 