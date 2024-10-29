import WebSocket from 'ws';
import TokenTracker from './tokenTracker.js';

// Initialize TokenTracker for managing state
const tt = new TokenTracker();

// Create WebSocket connection
const ws = new WebSocket('wss://pumpportal.fun/api/data');

// Make ws available to TokenTracker
tt.setWebSocket(ws);

ws.on('open', function open() {
    console.log('Connected to PumpPortal WebSocket');
    // Subscribe to new token events
    const newTokenPayload = {
        method: "subscribeNewToken"
    };
    ws.send(JSON.stringify(newTokenPayload));
});

ws.on('message', function message(data) {
    const event = JSON.parse(data);
    
    // Handle different event types
    switch (event.txType) {
        case 'create':
            tt.handleNewToken(event);
            break;
        case 'buy':
        case 'sell':
            // Pass the mint along with the event since we need it for tracking
            tt.handleTokenTrade(event.mint, event);
            break;
        default:
            console.log('Unknown event type:', event);
    }
});

ws.on('error', function error(err) {
  console.error('WebSocket error:', err);
});

ws.on('close', function close() {
  console.log('Disconnected from PumpPortal WebSocket');
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nClosing WebSocket connection...');
  ws.close();
  process.exit();
});