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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-teal-400 bg-clip-text text-transparent">
            Token Monitor
          </h1>
          <div className={`px-4 py-2 rounded-full text-sm font-medium shadow-lg transition-all
            ${status === 'connected' 
              ? 'bg-gradient-to-r from-green-400 to-green-500 text-white' 
              : status === 'connecting' 
                ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white'
                : 'bg-gradient-to-r from-red-400 to-red-500 text-white'
            }`}>
            {status}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tokens.map(token => (
            <div key={token.mint} 
                 className="bg-white rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.05)] 
                          backdrop-blur-sm border border-gray-100 transition-all duration-300
                          hover:shadow-[0_8px_30px_rgb(0,0,0,0.1)] hover:translate-y-[-2px]">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-semibold bg-gradient-to-r from-blue-500 to-teal-400 bg-clip-text text-transparent">
                  {token.symbol}
                </h2>
                <span className="text-xs bg-gray-100 rounded-full px-3 py-1.5 text-gray-600 font-medium">
                  {Math.floor(token.metrics.age / 1000 / 60)}m old
                </span>
              </div>
              
              <div className="space-y-3">
                <MetricRow 
                  label="Market Cap" 
                  value={`${token.metrics.marketCap.toFixed(2)} SOL`}
                />
                <MetricRow 
                  label="Volume" 
                  value={`${Math.floor(token.metrics.totalVolumeTokens).toLocaleString()} tokens`}
                />
                <MetricRow 
                  label="Trades" 
                  value={<>
                    <span className="text-green-500">●</span> {token.metrics.buyCount} 
                    <span className="mx-1">|</span>
                    <span className="text-red-500">●</span> {token.metrics.sellCount}
                  </>}
                />
                <MetricRow 
                  label="Unique Traders" 
                  value={token.metrics.uniqueTraders}
                />
                <MetricRow 
                  label="Price Growth" 
                  value={
                    <span className={token.metrics.priceGrowth >= 0 ? 'text-green-500' : 'text-red-500'}>
                      {token.metrics.priceGrowth.toFixed(2)}%
                    </span>
                  }
                />
              </div>
              
              <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-400 font-medium truncate" title={token.mint}>
                  {token.mint}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MetricRow({ label, value }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-500 font-medium">{label}</span>
      <span className="text-sm text-gray-700 font-semibold">{value}</span>
    </div>
  )
}

export default App