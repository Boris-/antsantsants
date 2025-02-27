// Game constants
const TILE_SIZE = 32;
const WORLD_WIDTH = 50;
const WORLD_HEIGHT = 40;
const GRAVITY = 0.4;
const JUMP_FORCE = 8;
const MOVE_SPEED = 3.5;

// Tile types
const TILE_TYPES = {
    AIR: 0,
    DIRT: 1,
    STONE: 2,
    GRASS: 3,
    SAND: 4,
    COAL: 5,
    IRON: 6,
    GOLD: 7,
    BEDROCK: 8
};

// Enemy types
const ENEMY_TYPES = {
    BUG: {
        width: 24,
        height: 24,
        speed: 0.8,
        health: 20,
        damage: 10
    }
}; 