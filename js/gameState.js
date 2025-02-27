// Game state
let gameState = {
    player: {
        x: WORLD_WIDTH * TILE_SIZE / 2,
        y: 0,
        width: 24,
        height: 24,
        velocityX: 0,
        velocityY: 0,
        health: 100,
        facingRight: true,
        isJumping: false,
        isGrounded: false,
        coyoteTime: 0,
        wallSliding: false,
        wallJumpCooldown: 0
    },
    camera: {
        x: 0,
        y: 0
    },
    world: [],
    enemies: [],
    keys: {},
    mouseX: 0,
    mouseY: 0,
    mouseDown: false
};

// Initialize canvas and context
let canvas, ctx;
let healthDisplay;

function initializeGame() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Health display
    healthDisplay = document.getElementById('health');
    
    // Initialize and start game
    generateWorld();
    setupEventListeners();
    gameLoop();

    // Hide tutorial after 10 seconds
    setTimeout(() => {
        document.getElementById('tutorial').style.display = 'none';
    }, 10000);
} 