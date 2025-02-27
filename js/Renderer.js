import { TileType } from './World.js';
import * as THREE from 'three';

export class Renderer {
    constructor(canvas, world, ant) {
        this.world = world;
        this.ant = ant;
        this.canvas = canvas;
        
        // Three.js setup
        this.scene = new THREE.Scene();
        
        // Calculate tile size
        this.tileSize = Math.min(
            canvas.width / world.width,
            canvas.height / world.height
        );
        
        // Setup camera
        this.camera = new THREE.OrthographicCamera(
            -canvas.width / 2,
            canvas.width / 2,
            canvas.height / 2,
            -canvas.height / 2,
            0.1,
            1000
        );
        this.camera.position.set(0, 0, 100);
        this.camera.lookAt(0, 0, 0);
        this.camera.updateMatrixWorld();
        
        // Create renderer with proper canvas context
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(canvas.width, canvas.height, false);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x000000, 0);
        
        // Create materials
        this.materials = {
            [TileType.EMPTY]: new THREE.MeshBasicMaterial({ color: 0x87CEEB }),
            [TileType.SOIL]: new THREE.MeshBasicMaterial({ color: 0x8B4513 }),
            [TileType.SAND]: new THREE.MeshBasicMaterial({ color: 0xF4A460 }),
            [TileType.FOOD]: new THREE.MeshBasicMaterial({ color: 0xFFD700 }),
            ant: new THREE.MeshBasicMaterial({ color: 0x000000 })
        };
        
        // Create geometries
        this.tileGeometry = new THREE.PlaneGeometry(this.tileSize, this.tileSize);
        this.antGeometry = new THREE.CircleGeometry(this.tileSize * 0.4, 32);
        
        // Create scene containers with default material
        const defaultMaterial = new THREE.MeshBasicMaterial({ visible: false });
        
        this.worldContainer = new THREE.Group();
        this.worldContainer.updateMatrix();
        this.scene.add(this.worldContainer);
        
        this.tileContainer = new THREE.Group();
        this.tileContainer.updateMatrix();
        this.worldContainer.add(this.tileContainer);
        
        this.entityContainer = new THREE.Group();
        this.entityContainer.updateMatrix();
        this.worldContainer.add(this.entityContainer);
        
        // Initialize mesh pools
        this.tileMeshes = new Map();
        this.meshPool = [];
        
        // Create ant mesh
        this.antMesh = new THREE.Mesh(this.antGeometry, this.materials.ant);
        this.antMesh.position.z = 1;
        this.antMesh.updateMatrix();
        this.entityContainer.add(this.antMesh);
        
        // Create food mesh
        this.foodMesh = new THREE.Mesh(
            new THREE.CircleGeometry(this.tileSize * 0.25, 32),
            this.materials[TileType.FOOD]
        );
        this.foodMesh.position.z = 2;
        this.foodMesh.visible = false;
        this.foodMesh.updateMatrix();
        this.entityContainer.add(this.foodMesh);
        
        // Performance tracking
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.fps = 0;
        
        // Ensure all objects are properly initialized
        this.scene.updateMatrixWorld(true);
    }

    getMeshFromPool() {
        let mesh;
        if (this.meshPool.length > 0) {
            mesh = this.meshPool.pop();
        } else {
            mesh = new THREE.Mesh(
                this.tileGeometry,
                this.materials[TileType.EMPTY]
            );
            mesh.position.z = 0;
            mesh.updateMatrix();
            this.tileContainer.add(mesh);
        }
        mesh.visible = true;
        return mesh;
    }

    returnMeshToPool(mesh) {
        if (mesh && mesh.parent) {
            mesh.visible = false;
            mesh.updateMatrix();
            this.meshPool.push(mesh);
        }
    }

    cleanupScene() {
        // Hide all active meshes
        for (const [key, mesh] of this.tileMeshes) {
            if (mesh && mesh.parent) {
                mesh.visible = false;
                mesh.updateMatrix();
                this.meshPool.push(mesh);
            }
        }
        this.tileMeshes.clear();
    }

    render(cameraX, cameraY) {
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;
        this.frameCount++;
        
        if (deltaTime >= 1000) {
            this.fps = (this.frameCount * 1000) / deltaTime;
            this.frameCount = 0;
            this.lastFrameTime = currentTime;
        }
        
        // Update world container position
        this.worldContainer.position.x = -cameraX * this.tileSize;
        this.worldContainer.position.y = cameraY * this.tileSize;
        this.worldContainer.updateMatrix();
        
        // Calculate visible range
        const startX = Math.floor(cameraX - this.camera.right / this.tileSize);
        const startY = Math.floor(cameraY - this.camera.top / this.tileSize);
        const endX = Math.ceil(cameraX + this.camera.right / this.tileSize);
        const endY = Math.ceil(cameraY + this.camera.top / this.tileSize);
        
        // Track visible tiles
        const visibleTileKeys = new Set();
        
        // Update visible tiles
        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                const key = `${x},${y}`;
                visibleTileKeys.add(key);
                
                const tile = this.world.getTile(x, y);
                let mesh = this.tileMeshes.get(key);
                
                if (!mesh) {
                    mesh = this.getMeshFromPool();
                    this.tileMeshes.set(key, mesh);
                }
                
                if (mesh && mesh.parent) {
                    mesh.visible = true;
                    mesh.material = this.materials[tile];
                    mesh.position.x = x * this.tileSize;
                    mesh.position.y = -y * this.tileSize;
                    mesh.updateMatrix();
                }
            }
        }
        
        // Remove and pool invisible meshes
        for (const [key, mesh] of this.tileMeshes) {
            if (!visibleTileKeys.has(key)) {
                this.returnMeshToPool(mesh);
                this.tileMeshes.delete(key);
            }
        }
        
        // Update ant position
        if (this.antMesh && this.antMesh.parent) {
            this.antMesh.position.x = this.ant.x * this.tileSize;
            this.antMesh.position.y = -this.ant.y * this.tileSize;
            this.antMesh.updateMatrix();
        }
        
        // Update food position if carrying
        if (this.foodMesh && this.foodMesh.parent) {
            this.foodMesh.visible = this.ant.isCarryingFood;
            if (this.ant.isCarryingFood) {
                this.foodMesh.position.x = this.ant.x * this.tileSize;
                this.foodMesh.position.y = -this.ant.y * this.tileSize;
                this.foodMesh.updateMatrix();
            }
        }
        
        // Update matrices
        this.scene.updateMatrixWorld(true);
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize(width, height) {
        // Clean up existing meshes
        this.cleanupScene();
        
        // Update camera
        this.camera.left = -width / 2;
        this.camera.right = width / 2;
        this.camera.top = height / 2;
        this.camera.bottom = -height / 2;
        this.camera.updateProjectionMatrix();
        this.camera.updateMatrixWorld();
        
        // Update renderer
        this.renderer.setSize(width, height, false);
        
        // Recalculate tile size
        this.tileSize = Math.min(
            width / this.world.width,
            height / this.world.height
        );
        
        // Update geometries
        this.tileGeometry = new THREE.PlaneGeometry(this.tileSize, this.tileSize);
        this.antGeometry = new THREE.CircleGeometry(this.tileSize * 0.4, 32);
        
        // Update existing meshes
        if (this.antMesh && this.antMesh.parent) {
            this.antMesh.geometry = this.antGeometry;
            this.antMesh.updateMatrix();
        }
        if (this.foodMesh && this.foodMesh.parent) {
            this.foodMesh.geometry = new THREE.CircleGeometry(this.tileSize * 0.25, 32);
            this.foodMesh.updateMatrix();
        }
        
        // Update scene
        this.scene.updateMatrixWorld(true);
    }
} 