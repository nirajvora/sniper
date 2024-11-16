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
    
    // Add error handler
    ws.on('error', (error) => {
        console.error('UI WebSocket error:', error);
    });
    
    // Add message handler to see if UI is sending anything
    ws.on('message', (data) => {
        console.log('Received message from UI:', data.toString());
    });
    
    ws.on('close', (code, reason) => {
        console.log('UI Client disconnected with code:', code, 'reason:', reason?.toString());
        uiClients.delete(ws);
    });
});

// Create broadcast function for UI updates
const broadcastToUI = (data) => {
    const sanitizedData = {
        type: data.type,
        data: Array.isArray(data.data) ? data.data.map(token => ({
            mint: token.mint || '',
            symbol: token.symbol || 'Unknown',
            metrics: {
                buyCount: Number(token.metrics?.buyCount) || 0,
                sellCount: Number(token.metrics?.sellCount) || 0,
                totalVolumeTokens: Number(token.metrics?.totalVolumeTokens) || 0,
                uniqueTraders: token.metrics?.uniqueTraders || 0,
                marketCap: Number(token.metrics?.marketCap) || 0,
                age: token.metrics?.age || 0,
                priceGrowth: Number(token.metrics?.priceGrowth) || 0 // Use the calculated value from TokenTracker
            }
        })) : []
    };

    uiClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(JSON.stringify(sanitizedData));
            } catch (error) {
                console.error('Error broadcasting to UI:', error);
            }
        }
    });
};

// Set broadcast function in TokenTracker
tt.setBroadcastFunction(broadcastToUI);

// Serve static files from UI build directory
app.use(express.static(join(__dirname, 'ui/dist')));

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
    try {
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
                if (!event.message?.startsWith("Success")) {
                    console.log('Undefined txType', event)
                }
                break;
            default:
                console.log('Unknown event type:', event);
        }
    } catch (error) {
        console.error('Error processing pump.fun message:', error);
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