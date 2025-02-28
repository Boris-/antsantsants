// Game constants
const TILE_SIZE = 32;
const CHUNK_SIZE = 16;
const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;
const GRAVITY = 0.4;
const ACCELERATION = 0.5;
const DECELERATION = 0.3;
const FRICTION = 0.9;
const MAX_SPEED = 5;
const JUMP_FORCE = 10;
const CAMERA_LERP = 0.1;
const VISIBLE_CHUNKS_RADIUS = 2;
const AUTO_SAVE_INTERVAL = 60000; // Auto-save every minute

// Tile types
const TILE_TYPES = {
    AIR: 0,
    DIRT: 1,
    STONE: 2,
    GRASS: 3,
    SAND: 4,
    ORE: 5,
    BEDROCK: 6,
    COAL: 7,      // Ore type
    IRON: 8,      // Ore type
    GOLD: 9,      // Ore type
    DIAMOND: 10,  // Ore type
    WOOD: 11,     // Tree trunk
    LEAVES: 12,   // Tree leaves
    BUSH: 13,     // Bush/shrub
    FLOWER: 14,   // Decorative flower
    TALL_GRASS: 15, // Tall grass
    CACTUS: 16,   // Desert cactus
    SNOW: 17,     // Snow block
    MUSHROOM: 18, // Forest mushroom
    WATER: 19     // Water block
};

// Biome types (for easier reference)
const BIOME_TYPES = {
    PLAINS: 'Plains',
    FOREST: 'Forest',
    DESERT: 'Desert',
    MOUNTAINS: 'Mountains'
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