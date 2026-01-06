const http = require('http');
const url = require('url');
const finalhandler = require('finalhandler');
const serveStatic = require('serve-static');
const { Server } = require('socket.io');
require('dotenv').config(); // Load environment variables from .env file

// --- STARTUP VALIDATION: CHECK IF API KEY IS LOADED ---
// This will print to the console when you start the server.
// If it says 'undefined', your .env file is not being read correctly.
const veniceApiKey = process.env.VENICE_API_KEY;
if (!veniceApiKey) {
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.error('!!! FATAL ERROR: VENICE_API_KEY is not defined.      !!!');
    console.error('!!! Please check your .env file and its location.    !!!');
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    // We can exit the process because the server won't work without the key.
    process.exit(1);
} else {
    console.log('SUCCESS: Venice API Key loaded from .env file.');
}
// --- END STARTUP VALIDATION ---


const serve = serveStatic('.', { 'index': ['index.html'] });

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);

    // Enable CORS for all requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Text Chat Proxy
    if (parsedUrl.pathname === '/api/chat' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            let requestData = {};
            try {
                requestData = JSON.parse(body || '{}');
            } catch (e) {
                console.error('JSON parse error:', e);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON body' }));
                return;
            }
            try {
                const veniceResponse = await fetch('https://api.venice.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${veniceApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: requestData.model || 'mistral-31-24b',
                        messages: requestData.messages || [],
                        temperature: 0.8,
                        max_tokens: 8096
                    })
                });

                const responseText = await veniceResponse.text();

                // Improved Error Logging
                if (!veniceResponse.ok) {
                    console.error('--- Venice Chat API Error ---');
                    console.error('Status:', veniceResponse.status, veniceResponse.statusText);
                    console.error('Body:', responseText);
                    console.error('-----------------------------');
                } else {
                    console.log('Venice chat success:', veniceResponse.status);
                }
                
                res.writeHead(veniceResponse.status, { 'Content-Type': 'application/json' });
                res.end(responseText);
            } catch (err) {
                console.error('Chat fetch failed:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Proxy error', details: err.message }));
            }
        });
        return;
    }

    // Image Generation Proxy
    if (parsedUrl.pathname === '/api/image' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            let requestData = {};
            try {
                requestData = JSON.parse(body || '{}');
            } catch (e) {
                console.error('JSON parse error:', e);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON body' }));
                return;
            }
            try {
                const veniceResponse = await fetch('https://api.venice.ai/api/v1/image/generate', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${veniceApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'venice-sd35',
                        prompt: requestData.prompt,
                        return_binary: false
                    })
                });

                const responseData = await veniceResponse.json();

                // Improved Error Logging
                if (!veniceResponse.ok) {
                    console.error('--- Venice Image API Error ---');
                    console.error('Status:', veniceResponse.status, veniceResponse.statusText);
                    console.error('Body:', JSON.stringify(responseData, null, 2));
                    console.error('------------------------------');
                } else {
                    console.log('Venice image success:', veniceResponse.status);
                }

                res.writeHead(veniceResponse.status, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(responseData));
            } catch (err) {
                console.error('Image generation failed:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Image generation failed', details: err.message }));
            }
        });
        return;
    }

    // Static files
    serve(req, res, finalhandler(req, res));
});

const PORT = 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}/`);
});

// Socket.io setup for multiplayer
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Room management
const rooms = new Map(); // roomCode -> { players: Set, gameState: {} }

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Host creates a new room
    socket.on('host-game', () => {
        const roomCode = generateRoomCode();
        rooms.set(roomCode, {
            players: new Set([socket.id]),
            gameState: {}
        });
        socket.join(roomCode);
        socket.roomCode = roomCode;
        console.log(`Room ${roomCode} created by ${socket.id}`);
        socket.emit('room-created', roomCode);
    });

    // Join existing room
    socket.on('join-game', (roomCode) => {
        const room = rooms.get(roomCode);
        if (room) {
            room.players.add(socket.id);
            socket.join(roomCode);
            socket.roomCode = roomCode;
            console.log(`Player ${socket.id} joined room ${roomCode}`);
            socket.emit('room-joined', { roomCode, gameState: room.gameState });
            // Notify other players
            socket.to(roomCode).emit('player-joined', socket.id);
        } else {
            socket.emit('room-error', 'Room not found');
        }
    });

    // Sync chat messages
    socket.on('chat-message', (data) => {
        if (socket.roomCode) {
            socket.to(socket.roomCode).emit('chat-message', data);
        }
    });

    // Sync game state changes
    socket.on('game-state-update', (data) => {
        if (socket.roomCode) {
            const room = rooms.get(socket.roomCode);
            if (room) {
                // Update server-side game state
                room.gameState = { ...room.gameState, ...data };
                // Broadcast to other players
                socket.to(socket.roomCode).emit('game-state-update', data);
            }
        }
    });

    // Relay voice chat audio
    socket.on('voice-data', (audioData) => {
        if (socket.roomCode) {
            socket.to(socket.roomCode).emit('voice-data', audioData);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        if (socket.roomCode) {
            const room = rooms.get(socket.roomCode);
            if (room) {
                room.players.delete(socket.id);
                // Notify other players
                socket.to(socket.roomCode).emit('player-left', socket.id);
                // Clean up empty rooms
                if (room.players.size === 0) {
                    rooms.delete(socket.roomCode);
                    console.log(`Room ${socket.roomCode} deleted (empty)`);
                }
            }
        }
    });
});

console.log('Socket.io multiplayer server initialized');