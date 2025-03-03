# Ant Terraria - Persistent Multiplayer World

A 2D sandbox game inspired by Terraria, featuring a persistent world where multiple players can play and build together.

## Features

- **Persistent World**: The world is generated once by the server and saved to disk, allowing players to make permanent changes to the environment.
- **Multiplayer Support**: Multiple players can join the same world, see each other, and interact with the environment together.
- **Biome System**: Different biomes with unique features and terrain generation.
- **Mining and Building**: Dig through the terrain and collect resources.
- **Inventory System**: Collect and store resources in your inventory.

## How to Run

### Prerequisites

- Node.js (v14 or higher)
- NPM (v6 or higher)

### Server Setup

1. Clone the repository:
   ```
   git clone <repository-url>
   cd antsantsants
   ```

2. Install dependencies:
   ```
   npm install express socket.io cors
   ```

3. Start the server:
   ```
   node server.js
   ```
   The server will start on port 3001 by default.

### Client Setup

1. Open a web browser and navigate to:
   ```
   http://localhost:3001
   ```

2. Multiple players can connect to the same server by opening the URL in different browser windows or from different computers on the same network.

## Controls

- **WASD**: Move the player
- **Mouse**: Aim
- **Left Mouse Button**: Dig blocks
- **F3**: Toggle debug information
- **Mouse Wheel**: Zoom in/out

## Technical Details

### Server-Side World Generation

The world is generated once when the server starts for the first time. The world data is saved to a file (`world_save.json`) and loaded each time the server restarts. This ensures that all changes made to the world persist between server restarts.

### Client-Server Communication

- The server sends the initial world data (terrain heights, biome map) to clients when they connect.
- Clients request chunks from the server as needed when exploring the world.
- When a player breaks a block, the client sends the change to the server, which updates its world state and broadcasts the change to all connected clients.
- Player positions are continuously synchronized between clients.

### Auto-Saving

The server automatically saves the world state:
- Every 5 minutes
- After every 100 block updates
- When the server is shutting down

## Future Improvements

- Block placement
- Crafting system
- More biomes and terrain features
- Enemies and combat
- Day/night cycle
- Weather effects

## Troubleshooting

- If you can't connect to the server, make sure the server is running and that you're using the correct URL.
- If the world doesn't load properly, try clearing your browser cache and refreshing the page.
- If players can't see each other, check that they're connected to the same server instance.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 