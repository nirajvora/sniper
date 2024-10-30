// ui/src/App.jsx
import { useState, useEffect } from 'react'

function App() {
  const [tokens, setTokens] = useState([]);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}`);

    ws.onopen = () => {
      setStatus('connected');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'stateUpdate') {
        setTokens(message.data);
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setStatus('error');
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Active Tokens Monitor</h1>
          <div className={`px-3 py-1 rounded-full text-sm ${
            status === 'connected' ? 'bg-green-500' : 
            status === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
          }`}>
            {status}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tokens.map(token => (
            <div key={token.mint} className="bg-gray-800 rounded-lg p-4 shadow-lg">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-xl font-semibold text-blue-400">
                  {token.symbol}
                </h2>
                <span className="text-xs bg-gray-700 rounded px-2 py-1">
                  {Math.floor(token.metrics.age / 1000 / 60)}m old
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Market Cap</span>
                  <span>{token.metrics.marketCap.toFixed(2)} SOL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Volume</span>
                  <span>{Math.floor(token.metrics.totalVolumeTokens).toLocaleString()} tokens</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Trades</span>
                  <span>🟢 {token.metrics.buyCount} | 🔴 {token.metrics.sellCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Unique Traders</span>
                  <span>{token.metrics.uniqueTraders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Price Growth</span>
                  <span className={token.metrics.priceGrowth >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {token.metrics.priceGrowth.toFixed(2)}%
                  </span>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500 truncate" title={token.mint}>
                {token.mint}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App