// ui/src/App.jsx
import { useState, useEffect } from 'react'

function App() {
  const [tokens, setTokens] = useState([]);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}`);
    
    ws.onopen = () => setStatus('connected');
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'stateUpdate') {
        setTokens(message.data);
      }
    };
    ws.onclose = () => setStatus('disconnected');
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setStatus('error');
    };

    return () => ws.close();
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12">
          <h1 className="text-2xl font-semibold text-[#64748B] mb-2">
            Token Monitor
          </h1>
          <p className="text-[#94A3B8]">
            Real-time analysis of token performance and metrics
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tokens.map(token => (
            <div key={token.mint} 
                 className="bg-white rounded-2xl p-6 shadow-[0_0_50px_0_rgba(0,0,0,0.05)] 
                          transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-[#334155]">
                    {token.symbol}
                  </h2>
                  <p className="text-sm text-[#94A3B8] mt-1">
                    {Math.floor(token.metrics.age / 1000 / 60)}m ago
                  </p>
                </div>
                <StatusIndicator positive={token.metrics.priceGrowth >= 0} />
              </div>

              <div className="space-y-4">
                <MetricTile
                  label="Market Cap"
                  value={`${token.metrics.marketCap.toFixed(2)} SOL`}
                  icon="📊"
                />
                <MetricTile
                  label="Trading Volume"
                  value={`${Math.floor(token.metrics.totalVolumeTokens).toLocaleString()}`}
                  icon="📈"
                />
                <MetricTile
                  label="Trade Count"
                  value={`${token.metrics.buyCount + token.metrics.sellCount}`}
                  secondaryValue={`${token.metrics.buyCount}↑ ${token.metrics.sellCount}↓`}
                  icon="🔄"
                />
                <MetricTile
                  label="Price Growth"
                  value={`${token.metrics.priceGrowth.toFixed(2)}%`}
                  positive={token.metrics.priceGrowth >= 0}
                  icon="💹"
                />
              </div>

              <div className="mt-6 pt-4 border-t border-[#F1F5F9]">
                <div className="text-xs text-[#94A3B8] font-medium truncate">
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

function MetricTile({ label, value, secondaryValue, icon, positive }) {
  return (
    <div className="flex items-center">
      <div className="w-8 h-8 bg-[#F1F5F9] rounded-lg flex items-center justify-center mr-3">
        <span className="text-sm">{icon}</span>
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-[#64748B]">{label}</div>
        <div className={`text-sm font-semibold mt-0.5 ${
          positive !== undefined
            ? positive 
              ? 'text-emerald-500' 
              : 'text-red-500'
            : 'text-[#334155]'
        }`}>
          {value}
          {secondaryValue && (
            <span className="text-[#94A3B8] text-xs ml-2">
              {secondaryValue}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusIndicator({ positive }) {
  return (
    <div className={`w-2 h-2 rounded-full ${
      positive ? 'bg-emerald-500' : 'bg-red-500'
    }`} />
  )
}

export default App