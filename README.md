# Multiplayer Ant Game

A 2D procedurally generated sandbox game with biomes, mining, and exploration. Now with multiplayer support!

## Features

- Explore different biomes (Plains, Forest, Desert, Mountains)
- Collect resources (coal, iron, gold, diamonds)
- Dig deeper to find rarer ores
- Play with friends in multiplayer mode
- Real-time world updates via WebSockets

## Controls

- **WASD** - Move your ant
- **Mouse Click** - Dig blocks
- **Scroll Wheel** - Zoom in/out

## How to Run

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```

### Running the Server

1. Start the server:
   ```
   node server.js
   ```
   This will start the server on port 3000.

### Running the Client

1. Open `index.html` in your browser
2. The game will automatically connect to the server running on localhost:3000

### Playing with Friends

To play with friends over the internet, you'll need to:

1. Make sure your server is accessible from the internet (you may need to configure port forwarding on your router)
2. Update the Socket.IO connection URL in `js/multiplayer.js` to point to your server's public IP or domain

## Technical Details

### Server-Side

- Express.js for serving static files
- Socket.IO for real-time communication
- Custom world generation algorithm

### Client-Side

- HTML5 Canvas for rendering
- Socket.IO client for multiplayer communication
- Procedural terrain generation

## Multiplayer Features

- Shared world for all players
- See other players moving in real-time
- Synchronized block digging
- Server-side world generation for consistency

## Future Improvements

- Player authentication
- Saving player progress
- More biomes and resources
- Crafting system
- Enemy mobs
- Day/night cycle

## License

MIT 