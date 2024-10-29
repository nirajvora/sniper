import WebSocket from 'ws';
import { Connection, PublicKey } from '@solana/web3.js';

// Initialize Solana connection (using devnet for testing)
const connection = new Connection('https://api.mainnet-beta.solana.com');

// Create WebSocket connection
const ws = new WebSocket('wss://pumpportal.fun/api/data');

// Track token prices
const tokenPrices = new Map();

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
  console.log(event)
  // Handle different event types
  switch (event.txType) {
    case 'create':
      handleNewToken(event);
      break;
    case 'trade':
      handleTrade(event);
      break;
    default:
      console.log('Unknown event type:');
      console.log(event);
  }
});

function handleNewToken(event) {
  console.log('\nNew Token Created:', event.name);
  console.log(event);
  
  // Subscribe to trades for this new token
  const tradePayload = {
    method: "subscribeTokenTrade",
    keys: [event.signature]
  };
  ws.send(JSON.stringify(tradePayload));
  
  // Initialize price tracking
  tokenPrices.set(event.signature, event.initialPrice);
}

function handleTrade(event) {
  const currentPrice = event.price;
  const tokenAddress = event.tokenAddress;
  const previousPrice = tokenPrices.get(tokenAddress);
  
  // Update price
  tokenPrices.set(tokenAddress, currentPrice);
  
  // Calculate price change
  const priceChange = previousPrice ? 
    ((currentPrice - previousPrice) / previousPrice * 100).toFixed(2) : 
    '0.00';
  
  console.log('\nTrade Event:');
  console.log('Token:', tokenAddress);
  console.log('Current Price:', currentPrice);
  console.log(`Price Change: ${priceChange}%`);
}

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