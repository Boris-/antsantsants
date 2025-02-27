import { TileType } from './World.js';

export class Ant {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.speed = 20; // Increased base speed
        this.lastDigTime = 0;
        this.digCooldown = 100; // ms
        this.digRadius = 2;
    }

    update(deltaTime, input, world) {
        // Handle movement
        let dx = 0;
        let dy = 0;

        // Use direct key states from input
        if (input.left) dx -= 1;
        if (input.right) dx += 1;
        if (input.up) dy -= 1;
        if (input.down) dy += 1;

        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx = dx / length;
            dy = dy / length;
        }

        // Apply speed (deltaTime is in seconds)
        dx *= this.speed * deltaTime;
        dy *= this.speed * deltaTime;

        // Check X movement
        if (dx !== 0 && !this.checkCollision(world, this.x + dx, this.y)) {
            this.x += dx;
        }

        // Check Y movement
        if (dy !== 0 && !this.checkCollision(world, this.x, this.y + dy)) {
            this.y += dy;
        }

        // Handle digging
        if (input.dig) {
            const now = Date.now();
            if (now - this.lastDigTime > this.digCooldown) {
                this.dig(world);
                this.lastDigTime = now;
            }
        }
    }

    checkCollision(world, x, y) {
        // Check a 3x3 area around the ant for collisions
        const radius = 1;
        const centerX = Math.floor(x);
        const centerY = Math.floor(y);

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const tile = world.getTile(centerX + dx, centerY + dy);
                if (tile === TileType.SOIL || tile === TileType.SAND) {
                    const tileX = centerX + dx;
                    const tileY = centerY + dy;
                    
                    // Check if ant's position overlaps with tile
                    if (x + 0.5 > tileX && x - 0.5 < tileX + 1 &&
                        y + 0.5 > tileY && y - 0.5 < tileY + 1) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    dig(world) {
        const centerX = Math.floor(this.x);
        const centerY = Math.floor(this.y);

        // Dig in a small radius around the ant
        for (let dy = -this.digRadius; dy <= this.digRadius; dy++) {
            for (let dx = -this.digRadius; dx <= this.digRadius; dx++) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= this.digRadius) {
                    const x = centerX + dx;
                    const y = centerY + dy;
                    const tile = world.getTile(x, y);
                    
                    // Only dig soil and sand
                    if (tile === TileType.SOIL || tile === TileType.SAND) {
                        world.setTile(x, y, TileType.EMPTY);
                    }
                }
            }
        }
    }
} 