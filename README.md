# D&D Grid Game with AI & Multiplayer

A web-based D&D game with AI-powered DM, character generation, and real-time multiplayer.

## Features

- 🎲 Interactive grid-based D&D gameplay
- 🤖 AI Dungeon Master powered by Venice AI
- 🎨 AI character and scene generation
- 👥 Real-time multiplayer (2+ players in same room)
- 📊 Character sheets with auto-fill from stat blocks
- 🎯 Dice roller
- 💾 Save/load game states

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.env` file** with your Venice API key:
   ```
   VENICE_API_KEY=your_api_key_here
   ```

3. **Start the server:**
   ```bash
   npm start
   ```
   or
   ```bash
   node server.js
   ```

4. **Open in browser:**
   ```
   http://localhost:8080
   ```

## How to Play

### Single Player
1. Open the game in your browser
2. Use the chat to interact with the AI DM
3. Click "Start Quest" to begin a campaign
4. Use arrow keys to move characters on the grid

### Multiplayer
1. **Host:** Click "Multiplayer" → "Host Game" → Share the 6-character room code
2. **Join:** Click "Multiplayer" → Enter room code → "Join Game"
3. Both players can chat, move units, and interact with the AI DM
4. All game state syncs automatically

### Meet Character Feature
When the DM introduces a new NPC:
1. The DM will provide a stat block
2. Click "Meet Character" button
3. Character automatically generates, saves, appears on map with stats filled

## Controls

- **Arrow Keys:** Move selected character
- **Click Unit:** Select/view character sheet
- **Chat Input:** Talk to DM or NPCs
- **Sidebar Buttons:** Access different panels

## Technical Details

- **Server:** Node.js + Socket.io
- **Real-time sync:** WebSocket-based multiplayer
- **AI:** Venice AI API (Mistral + Stable Diffusion)
- **Storage:** Browser localStorage

## Multiplayer Architecture

```
Player 1 Browser ←→ Socket.io Server ←→ Player 2 Browser
                          ↓
                    Venice AI API
```

All game state (chat, units, sheets, maps) syncs in real-time between players.

## Port

Default port: `8080`

To change, edit `PORT` in `server.js`.
