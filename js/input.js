// Handle input events
function setupEventListeners() {
    // Keyboard events
    window.addEventListener('keydown', (e) => {
        gameState.keys[e.key] = true;
    });
    
    window.addEventListener('keyup', (e) => {
        gameState.keys[e.key] = false;
    });
    
    // Mouse events
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        gameState.mouseX = e.clientX - rect.left;
        gameState.mouseY = e.clientY - rect.top;
    });
    
    canvas.addEventListener('mousedown', () => {
        gameState.mouseDown = true;
    });
    
    canvas.addEventListener('mouseup', () => {
        gameState.mouseDown = false;
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
    
    // Regenerate world button
    const regenerateButton = document.getElementById('regenerate-world');
    regenerateButton.addEventListener('click', () => {
        // Reset player health and position
        gameState.player.health = 100;
        updateHealth();
        
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