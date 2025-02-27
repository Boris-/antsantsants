// Game constants
const TILE_SIZE = 32;
const WORLD_WIDTH = 1000;
const WORLD_HEIGHT = 1000;
const GRAVITY = 0.4;
const JUMP_FORCE = 8;
const MOVE_SPEED = 3.5;
const MAX_SPEED = 6;
const ACCELERATION = 0.5;
const DECELERATION = 0.8;
const FRICTION = 0.9;
const CAMERA_LERP = 0.1;

// Chunk system constants for efficient rendering
const CHUNK_SIZE = 16; // Size of each chunk in tiles
const VISIBLE_CHUNKS_RADIUS = 2; // How many chunks to render around the player

// Auto-save settings
const AUTO_SAVE_INTERVAL = 60000; // 1 minute in milliseconds

// Tile types
const TILE_TYPES = {
    AIR: 0,
    DIRT: 1,
    STONE: 2,
    GRASS: 3,
    ORE: 4,
    BEDROCK: 5,
    SAND: 6
};

// Enemy types
const ENEMY_TYPES = {
    BUG: {
        width: 20,
        height: 20,
        speed: 0.8,
        damage: 10,
        health: 30
    }
}; 