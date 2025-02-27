// Draw world
function drawWorld() {
    // Calculate visible tiles
    const startX = Math.floor(gameState.camera.x / TILE_SIZE);
    const endX = startX + Math.ceil(canvas.width / TILE_SIZE) + 1;
    const startY = Math.floor(gameState.camera.y / TILE_SIZE);
    const endY = startY + Math.ceil(canvas.height / TILE_SIZE) + 1;
    
    // Draw background sky
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw background grid for empty space
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.2)';
    ctx.lineWidth = 1;
    
    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            ctx.strokeRect(
                x * TILE_SIZE - gameState.camera.x,
                y * TILE_SIZE - gameState.camera.y,
                TILE_SIZE,
                TILE_SIZE
            );
        }
    }
    
    // Draw tiles
    for (let y = startY; y < endY; y++) {
        if (y < 0 || y >= WORLD_HEIGHT) continue;
        
        for (let x = startX; x < endX; x++) {
            if (x < 0 || x >= WORLD_WIDTH) continue;
            
            const tileType = gameState.world[y][x];
            if (tileType === TILE_TYPES.AIR) continue;
            
            // Determine color based on tile type
            switch (tileType) {
                case TILE_TYPES.DIRT:
                    ctx.fillStyle = '#8B4513';
                    break;
                case TILE_TYPES.STONE:
                    ctx.fillStyle = '#808080';
                    break;
                case TILE_TYPES.GRASS:
                    ctx.fillStyle = '#228B22';
                    break;
                default:
                    ctx.fillStyle = '#FF00FF'; // Error/debug color
            }
            
            // Fill the tile
            ctx.fillRect(
                x * TILE_SIZE - gameState.camera.x,
                y * TILE_SIZE - gameState.camera.y,
                TILE_SIZE,
                TILE_SIZE
            );
            
            // Draw grid lines
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.lineWidth = 1;
            ctx.strokeRect(
                x * TILE_SIZE - gameState.camera.x,
                y * TILE_SIZE - gameState.camera.y,
                TILE_SIZE,
                TILE_SIZE
            );
        }
    }
}

// Draw player (ant)
function drawPlayer() {
    // Body
    ctx.fillStyle = '#8B4513';
    
    const playerScreenX = gameState.player.x - gameState.camera.x;
    const playerScreenY = gameState.player.y - gameState.camera.y;
    
    // Ant body (oval)
    ctx.beginPath();
    ctx.ellipse(
        playerScreenX + gameState.player.width / 2,
        playerScreenY + gameState.player.height / 2,
        gameState.player.width / 2,
        gameState.player.height / 3,
        0, 0, Math.PI * 2
    );
    ctx.fill();
    
    // Head
    ctx.beginPath();
    ctx.arc(
        playerScreenX + (gameState.player.facingRight ? gameState.player.width * 0.75 : gameState.player.width * 0.25),
        playerScreenY + gameState.player.height / 2,
        gameState.player.width / 4,
        0, Math.PI * 2
    );
    ctx.fill();
    
    // Eyes
    ctx.fillStyle = '#FFFFFF';
    const eyeX = playerScreenX + (gameState.player.facingRight ? gameState.player.width * 0.85 : gameState.player.width * 0.15);
    ctx.beginPath();
    ctx.arc(
        eyeX,
        playerScreenY + gameState.player.height * 0.4,
        2,
        0, Math.PI * 2
    );
    ctx.fill();
    
    // Legs
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2;
    
    // Draw 3 legs on each side
    for (let i = 0; i < 3; i++) {
        const legOffsetX = gameState.player.width * 0.2 + i * (gameState.player.width * 0.2);
        
        // Left legs
        ctx.beginPath();
        ctx.moveTo(
            playerScreenX + legOffsetX,
            playerScreenY + gameState.player.height / 2
        );
        ctx.lineTo(
            playerScreenX + legOffsetX - 5,
            playerScreenY + gameState.player.height * 0.8
        );
        ctx.stroke();
        
        // Right legs
        ctx.beginPath();
        ctx.moveTo(
            playerScreenX + legOffsetX,
            playerScreenY + gameState.player.height / 2
        );
        ctx.lineTo(
            playerScreenX + legOffsetX + 5,
            playerScreenY + gameState.player.height * 0.8
        );
        ctx.stroke();
    }
    
    // Antennae
    ctx.beginPath();
    ctx.moveTo(
        playerScreenX + (gameState.player.facingRight ? gameState.player.width * 0.8 : gameState.player.width * 0.2),
        playerScreenY + gameState.player.height * 0.3
    );
    ctx.lineTo(
        playerScreenX + (gameState.player.facingRight ? gameState.player.width * 0.9 : gameState.player.width * 0.1),
        playerScreenY + gameState.player.height * 0.15
    );
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(
        playerScreenX + (gameState.player.facingRight ? gameState.player.width * 0.75 : gameState.player.width * 0.25),
        playerScreenY + gameState.player.height * 0.3
    );
    ctx.lineTo(
        playerScreenX + (gameState.player.facingRight ? gameState.player.width * 0.85 : gameState.player.width * 0.15),
        playerScreenY + gameState.player.height * 0.15
    );
    ctx.stroke();
}

// Draw enemies
function drawEnemies() {
    for (const enemy of gameState.enemies) {
        const enemyScreenX = enemy.x - gameState.camera.x;
        const enemyScreenY = enemy.y - gameState.camera.y;
        
        // Only draw if on screen
        if (
            enemyScreenX > -enemy.width &&
            enemyScreenX < canvas.width &&
            enemyScreenY > -enemy.height &&
            enemyScreenY < canvas.height
        ) {
            // Bug enemy
            ctx.fillStyle = '#FF0000';
            
            // Body
            ctx.beginPath();
            ctx.ellipse(
                enemyScreenX + enemy.width / 2,
                enemyScreenY + enemy.height / 2,
                enemy.width / 2,
                enemy.height / 3,
                0, 0, Math.PI * 2
            );
            ctx.fill();
            
            // Head
            const facingRight = enemy.velocityX > 0;
            ctx.beginPath();
            ctx.arc(
                enemyScreenX + (facingRight ? enemy.width * 0.75 : enemy.width * 0.25),
                enemyScreenY + enemy.height / 2,
                enemy.width / 4,
                0, Math.PI * 2
            );
            ctx.fill();
            
            // Eyes
            ctx.fillStyle = '#FFFFFF';
            const eyeX = enemyScreenX + (facingRight ? enemy.width * 0.85 : enemy.width * 0.15);
            ctx.beginPath();
            ctx.arc(
                eyeX,
                enemyScreenY + enemy.height * 0.4,
                2,
                0, Math.PI * 2
            );
            ctx.fill();
        }
    }
} 