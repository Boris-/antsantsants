// Game loop
function gameLoop() {
    // Update game state
    updatePlayer();
    updateEnemies();
    updateCamera();
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw game elements
    drawWorld();
    drawPlayer();
    drawEnemies();
    
    // Continue loop
    requestAnimationFrame(gameLoop);
}

// Initialize the game when the window loads
window.addEventListener('load', initializeGame); 