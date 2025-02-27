// Tile types as Uint8 for memory efficiency
export const TileType = {
    EMPTY: 0,
    SOIL: 1,
    SAND: 3
};

const CHUNK_SIZE = 16; // Size of each chunk
const SKY_HEIGHT = 5; // Height of the sky layer
const CACHE_SIZE = 64; // Size of chunk cache

export class World {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.chunks = new Map(); // Store chunks using coordinates as keys
        this.chunkCache = new Map(); // Cache for recently accessed chunks
        this.lastCenterChunk = null; // Last center chunk for optimization
        this.loadState();
    }

    getChunkKey(chunkX, chunkY) {
        return `${chunkX},${chunkY}`;
    }

    getOrCreateChunk(chunkX, chunkY) {
        const key = this.getChunkKey(chunkX, chunkY);
        let chunk = this.chunks.get(key);
        
        if (!chunk) {
            // Check cache first
            chunk = this.chunkCache.get(key);
            if (chunk) {
                this.chunks.set(key, chunk);
                this.chunkCache.delete(key);
                return chunk;
            }

            // Create new chunk
            chunk = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
            this.generateChunkTerrain(chunk, chunkX, chunkY);
            this.chunks.set(key, chunk);
        }
        return chunk;
    }

    generateChunkTerrain(chunk, chunkX, chunkY) {
        // Pre-calculate world Y coordinates for the chunk
        const worldYStart = chunkY * CHUNK_SIZE;
        
        // Optimize common cases
        if (worldYStart + CHUNK_SIZE <= SKY_HEIGHT) {
            // Entire chunk is sky
            chunk.fill(TileType.EMPTY);
            return;
        } else if (worldYStart >= SKY_HEIGHT + 3) {
            // Deep underground - optimize for soil/sand mix
            const soilProbability = Math.min((worldYStart - SKY_HEIGHT - 3) / 20, 0.8);
            const primaryType = soilProbability > 0.5 ? TileType.SOIL : TileType.SAND;
            const secondaryType = primaryType === TileType.SOIL ? TileType.SAND : TileType.SOIL;
            const ratio = Math.round(Math.abs(0.5 - soilProbability) * 2 * 255);
            
            for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
                chunk[i] = ((Math.random() * 255) | 0) < ratio ? primaryType : secondaryType;
            }
            return;
        }

        // Mixed chunk - needs per-tile calculation
        for (let localY = 0; localY < CHUNK_SIZE; localY++) {
            const worldY = worldYStart + localY;
            const rowOffset = localY * CHUNK_SIZE;
            
            if (worldY < SKY_HEIGHT) {
                // Fill entire row with sky
                chunk.fill(TileType.EMPTY, rowOffset, rowOffset + CHUNK_SIZE);
            } else if (worldY === SKY_HEIGHT) {
                // Transition layer
                for (let x = 0; x < CHUNK_SIZE; x++) {
                    chunk[rowOffset + x] = Math.random() < 0.7 ? TileType.SAND : TileType.EMPTY;
                }
            } else if (worldY < SKY_HEIGHT + 3) {
                // Fill entire row with sand
                chunk.fill(TileType.SAND, rowOffset, rowOffset + CHUNK_SIZE);
            } else {
                // Underground mix
                const soilProbability = Math.min((worldY - SKY_HEIGHT - 3) / 20, 0.8);
                for (let x = 0; x < CHUNK_SIZE; x++) {
                    chunk[rowOffset + x] = Math.random() < soilProbability ? TileType.SOIL : TileType.SAND;
                }
            }
        }
    }

    worldToChunkCoords(x, y) {
        // Optimize with bitwise operations for integer division and modulo
        const chunkX = x >> 4; // Equivalent to Math.floor(x / CHUNK_SIZE)
        const chunkY = y >> 4;
        const localX = x & 15; // Equivalent to x % CHUNK_SIZE
        const localY = y & 15;
        return { chunkX, chunkY, localX, localY };
    }

    generate() {
        // Initialize the visible area
        for (let y = -2; y < 2; y++) {
            for (let x = -2; x < 2; x++) {
                this.getOrCreateChunk(x, y);
            }
        }
    }

    getTile(x, y) {
        // Fast path for sky
        if (y < SKY_HEIGHT) return TileType.EMPTY;
        
        // Ensure chunks are loaded for this position
        const { chunkX, chunkY, localX, localY } = this.worldToChunkCoords(x, y);
        
        // Get or create the chunk if within active radius
        const centerChunk = this.lastCenterChunk;
        if (centerChunk && 
            Math.abs(chunkX - centerChunk.x) <= 3 && 
            Math.abs(chunkY - centerChunk.y) <= 3) {
            const chunk = this.getOrCreateChunk(chunkX, chunkY);
            return chunk[localY * CHUNK_SIZE + localX];
        }
        
        // Return default values for far chunks
        const chunk = this.chunks.get(this.getChunkKey(chunkX, chunkY));
        if (!chunk) return y < SKY_HEIGHT ? TileType.EMPTY : TileType.SAND;
        return chunk[localY * CHUNK_SIZE + localX];
    }

    setTile(x, y, type) {
        const { chunkX, chunkY, localX, localY } = this.worldToChunkCoords(x, y);
        
        // Only modify chunks within active radius
        const centerChunk = this.lastCenterChunk;
        if (!centerChunk || 
            Math.abs(chunkX - centerChunk.x) > 3 || 
            Math.abs(chunkY - centerChunk.y) > 3) {
            return;
        }

        const chunk = this.getOrCreateChunk(chunkX, chunkY);
        const index = localY * CHUNK_SIZE + localX;
        
        // Only update if the tile type is actually changing
        if (chunk[index] !== type) {
            chunk[index] = type;
            this.saveState();
        }
    }

    saveState() {
        const state = {
            chunks: {}
        };

        // Save only modified chunks
        for (const [key, chunk] of this.chunks.entries()) {
            state.chunks[key] = Array.from(chunk);
        }

        localStorage.setItem('antWorld', JSON.stringify(state));
    }

    loadState() {
        try {
            const savedState = localStorage.getItem('antWorld');
            if (savedState) {
                const state = JSON.parse(savedState);
                
                // Load chunks
                for (const [key, chunkData] of Object.entries(state.chunks)) {
                    this.chunks.set(key, new Uint8Array(chunkData));
                }
            }
        } catch (error) {
            console.error('Error loading world state:', error);
            // Generate new world if loading fails
            this.generate();
        }
    }

    isDiggable(x, y) {
        const tile = this.getTile(x, y);
        return tile === TileType.SOIL || tile === TileType.SAND;
    }

    update(deltaTime, centerX, centerY) {
        // Convert center position to chunk coordinates
        const { chunkX, chunkY } = this.worldToChunkCoords(centerX, centerY);
        
        // Skip update if we're in the same chunk as last time
        if (this.lastCenterChunk && 
            this.lastCenterChunk.x === chunkX && 
            this.lastCenterChunk.y === chunkY) {
            return;
        }
        
        this.lastCenterChunk = { x: chunkX, y: chunkY };
        const loadRadius = 2;

        // Cache chunks that will be unloaded
        for (const [key, chunk] of this.chunks.entries()) {
            const [cx, cy] = key.split(',').map(Number);
            if (Math.abs(cx - chunkX) > loadRadius + 1 || Math.abs(cy - chunkY) > loadRadius + 1) {
                // Don't cache modified chunks to ensure fresh generation
                if (!this.isChunkModified(chunk)) {
                    this.chunkCache.set(key, chunk);
                }
                this.chunks.delete(key);
                
                // Limit cache size
                if (this.chunkCache.size > CACHE_SIZE) {
                    const firstKey = this.chunkCache.keys().next().value;
                    this.chunkCache.delete(firstKey);
                }
            }
        }

        // Load new chunks
        for (let y = chunkY - loadRadius; y <= chunkY + loadRadius; y++) {
            for (let x = chunkX - loadRadius; x <= chunkX + loadRadius; x++) {
                if (!this.chunks.has(this.getChunkKey(x, y))) {
                    this.getOrCreateChunk(x, y);
                }
            }
        }
    }

    isChunkModified(chunk) {
        // Check if chunk has been modified from its initial generation state
        const worldY = Math.floor(chunk.worldY / CHUNK_SIZE);
        if (worldY < 0) return false; // Sky chunks are never modified
        
        // Check a few random positions for modifications
        for (let i = 0; i < 5; i++) {
            const idx = Math.floor(Math.random() * CHUNK_SIZE * CHUNK_SIZE);
            const expected = this.getInitialTileType(worldY + Math.floor(idx / CHUNK_SIZE));
            if (chunk[idx] !== expected) return true;
        }
        return false;
    }

    getInitialTileType(worldY) {
        if (worldY < SKY_HEIGHT) return TileType.EMPTY;
        if (worldY === SKY_HEIGHT) return TileType.SAND;
        if (worldY < SKY_HEIGHT + 3) return TileType.SAND;
        return TileType.SOIL;
    }
} 