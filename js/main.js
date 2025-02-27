import { World } from './World.js';
import { Ant } from './Ant.js';
import { InputHandler } from './InputHandler.js';
import { Renderer } from './Renderer.js';

class Game {
    constructor() {
        // Get the canvas element
        this.canvas = document.getElementById('gameCanvas');
        
        // Ensure the canvas is properly initialized for WebGL
        if (!this.canvas) {
            throw new Error('Could not find canvas element');
        }
        
        // Set canvas size with proper pixel ratio
        const pixelRatio = window.devicePixelRatio || 1;
        const width = 800;
        const height = 600;
        
        // Set the display size (css pixels) and buffer size (actual pixels)
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        this.canvas.width = Math.floor(width * pixelRatio);
        this.canvas.height = Math.floor(height * pixelRatio);
        
        // Initialize game components
        this.world = new World(80, 60);
        this.ant = new Ant(0, 0);
        this.input = new InputHandler();
        
        // Initialize renderer after canvas setup
        try {
            this.renderer = new Renderer(this.canvas, this.world, this.ant);
        } catch (error) {
            console.error('Failed to initialize renderer:', error);
            throw error;
        }
        
        // Initialize camera position to center on ant
        this.cameraX = this.ant.x - this.canvas.width / (2 * this.renderer.tileSize);
        this.cameraY = this.ant.y - this.canvas.height / (2 * this.renderer.tileSize);
        
        // Game timing
        this.lastTime = 0;
        this.accumulator = 0;
        this.timeStep = 1/60; // Fixed time step of 60 FPS
        
        // Bind the game loop
        this.gameLoop = this.gameLoop.bind(this);
        
        // Add reset button
        this.setupControls();
        
        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    onWindowResize() {
        const pixelRatio = window.devicePixelRatio || 1;
        const width = 800;
        const height = 600;
        
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        this.canvas.width = Math.floor(width * pixelRatio);
        this.canvas.height = Math.floor(height * pixelRatio);
        
        this.renderer.onWindowResize(this.canvas.width, this.canvas.height);
    }

    setupControls() {
        const controls = document.querySelector('.controls');
        const resetButton = document.createElement('button');
        resetButton.textContent = 'Reset World';
        resetButton.style.marginTop = '10px';
        resetButton.style.padding = '5px 10px';
        resetButton.addEventListener('click', () => {
            localStorage.removeItem('antWorld');
            location.reload();
        });
        controls.appendChild(resetButton);
    }

    start() {
        // Initialize the world
        this.world.generate();
        
        // Start the game loop
        requestAnimationFrame(this.gameLoop);
    }

    update(deltaTime) {
        // Get input state
        const input = this.input.getInput();
        
        // Update ant with fixed time step
        this.ant.update(deltaTime, input, this.world);
        
        // Update camera to follow ant with smooth interpolation
        const targetX = this.ant.x - this.canvas.width / (2 * this.renderer.tileSize);
        const targetY = this.ant.y - this.canvas.height / (2 * this.renderer.tileSize);
        
        // Increased camera speed and added minimum movement threshold for smoother following
        const cameraSpeed = 8 * deltaTime;
        const dx = targetX - this.cameraX;
        const dy = targetY - this.cameraY;
        
        // Add minimum threshold to prevent tiny jittery movements
        if (Math.abs(dx) > 0.01) {
            this.cameraX += dx * cameraSpeed;
        }
        if (Math.abs(dy) > 0.01) {
            this.cameraY += dy * cameraSpeed;
        }
        
        // Update world state with player position for chunk loading
        this.world.update(deltaTime, this.ant.x, this.ant.y);
    }

    gameLoop(currentTime) {
        if (!this.lastTime) {
            this.lastTime = currentTime;
        }
        
        // Calculate frame time and update accumulator
        const frameTime = Math.min((currentTime - this.lastTime) / 1000, 0.25);
        this.accumulator += frameTime;
        this.lastTime = currentTime;
        
        // Update game state with fixed time step
        while (this.accumulator >= this.timeStep) {
            this.update(this.timeStep);
            this.accumulator -= this.timeStep;
        }
        
        // Render with interpolation
        const alpha = this.accumulator / this.timeStep;
        this.renderer.render(this.cameraX, this.cameraY);
        
        // Continue the game loop
        requestAnimationFrame(this.gameLoop);
    }
}

// Start the game when the window loads
window.addEventListener('load', () => {
    const game = new Game();
    game.start();
}); 