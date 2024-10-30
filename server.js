// src/wsConnection.js
import WebSocket from 'ws';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import TokenTracker from './src/tokenTracker.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express and create server
const app = express();
const server = createServer(app);
const uiWss = new WebSocketServer({ server });

// Initialize TokenTracker
const tt = new TokenTracker();

// Store UI WebSocket clients
const uiClients = new Set();

// Handle UI client connections
uiWss.on('connection', (ws) => {
    console.log('UI Client connected');
    uiClients.add(ws);
    
    ws.on('close', () => {
        console.log('UI Client disconnected');
        uiClients.delete(ws);
    });
});

// Create broadcast function for UI updates
const broadcastToUI = (data) => {
    uiClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
};

// Set broadcast function in TokenTracker
tt.setBroadcastFunction(broadcastToUI);

// Serve static files from UI build directory
app.use(express.static(join(dirname(__dirname), 'ui/dist')));

// Initialize PumpPortal connection
const ws = new WebSocket('wss://pumpportal.fun/api/data');

// Make ws available to TokenTracker
tt.setPumpWebSocket(ws);

ws.on('open', function open() {
    console.log('Connected to PumpPortal WebSocket');
    const newTokenPayload = {
        method: "subscribeNewToken"
    };
    ws.send(JSON.stringify(newTokenPayload));
});

ws.on('message', function message(data) {
    const event = JSON.parse(data);
    
    switch (event.txType) {
        case 'create':
            tt.handleNewToken(event);
            break;
        case 'buy':
        case 'sell':
            tt.handleTokenTrade(event.mint, event);
            break;
        case undefined:
            if (!event.message.startsWith("Success")) {
              console.log('Undefined txType', event)
            }
            break;
        default:
            console.log('Unknown event type:', event);
    }
});

ws.on('error', function error(error) {
    console.error('WebSocket error:', error);
});

ws.on('close', function close() {
    console.log('WebSocket connection closed');
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});