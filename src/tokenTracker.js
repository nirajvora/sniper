import PumpFunAnalyzer from './pumpFunAnalyzer.js';

export default class TokenTracker {
    constructor(enableBroadcast = true) {
        this.activeTokens = new Map();
        this.pumpWs = null;
        this.broadcastToUI = null;
        this.analyzer = new PumpFunAnalyzer();
        this.tradingOpportunities = new Map();
        this.TIME_WINDOW = 1000 * 60 * 60;
    
        // Conditionally set up periodic broadcasting
        if (enableBroadcast) {
            setInterval(() => {
                this.broadcastState();
            }, 1000); // Update UI every second

            setInterval(() => {
                this.analyzeAndBroadcast();
            }, 5000);
        }
    }

    async handleNewToken(tokenCreationEvent) {
        const tokenMint = tokenCreationEvent.mint;
        
        if (!this.activeTokens.has(tokenMint)) {
            try {
                const tradeSubscription = await this.subscribeToTokenTrades(tokenMint);
                
                this.activeTokens.set(tokenMint, {
                    creationEvent: tokenCreationEvent,
                    subscription: tradeSubscription,
                    name: tokenCreationEvent.name,
                    symbol: tokenCreationEvent.symbol,
                    trades: [],
                    metrics: {
                        initialSolInCurve: tokenCreationEvent.vSolInBondingCurve,
                        initialTokensInCurve: tokenCreationEvent.vTokensInBondingCurve,
                        initialMarketCap: tokenCreationEvent.marketCapSol,
                        buyCount: 0,
                        sellCount: 0,
                        totalVolumeTokens: 0,
                        uniqueTraders: new Set(),
                        priceHistory: [], // Track price points for trend analysis
                        createdAt: Date.now(),
                        lastUpdate: Date.now(),
                        highestMarketCap: tokenCreationEvent.marketCapSol,
                        lowestMarketCap: tokenCreationEvent.marketCapSol
                    }
                });

            } catch (error) {
                console.error(`Failed to subscribe to trades for token ${tokenMint}:`, error);
            }
        }
    }

    async subscribeToTokenTrades(tokenMint) {
        if (!this.pumpWs) {
            throw new Error('WebSocket connection not initialized');
        }

        // Create subscription message for specific token
        const subscriptionPayload = {
            method: "subscribeTokenTrade",
            keys: [tokenMint]
        };

        // Send subscription request
        this.pumpWs.send(JSON.stringify(subscriptionPayload));

        // Return an object with unsubscribe method
        return {
            unsubscribe: () => {
                const unsubscribePayload = {
                    method: "unsubscribeTokenTrade",
                    keys: [tokenMint]
                };
                this.ws.send(JSON.stringify(unsubscribePayload));
                console.log(`Unsubscribed from token trades: ${tokenMint}`);
            }
        };
    }

    async reconnectSubscriptions() {
        if (!this.pumpWs) {
            throw new Error('WebSocket connection not initialized');
        }

        // Resubscribe to all active tokens
        for (const [tokenMint, tokenData] of this.activeTokens.entries()) {
            try {
                tokenData.subscription = await this.subscribeToTokenTrades(tokenMint);
                console.log(`Resubscribed to token trades: ${tokenMint}`);
            } catch (error) {
                console.error(`Failed to resubscribe to token ${tokenMint}:`, error);
            }
        }
    }

    setPumpWebSocket(ws) {
        this.pumpWs = ws;
    }

    setBroadcastFunction(broadcastFn) {
        this.broadcastToUI = broadcastFn;
    }

    broadcastState() {
        if (!this.broadcastToUI) return;

        const state = Array.from(this.activeTokens.entries()).map(([mint, data]) => ({
            mint,
            symbol: data.creationEvent?.symbol || 'Unknown',
            metrics: {
                buyCount: data.metrics.buyCount,
                sellCount: data.metrics.sellCount,
                totalVolumeTokens: data.metrics.totalVolumeTokens,
                uniqueTraders: data.metrics.uniqueTraders.size,
                marketCap: data.metrics.highestMarketCap,
                age: Date.now() - data.metrics.createdAt
            }
        }));

        this.broadcastToUI({ type: 'stateUpdate', data: state });
    }

    analyzeAndBroadcast() {
        const opportunities = [];
        
        for (const [mint, tokenData] of this.activeTokens.entries()) {
            const analysis = this.analyzer.analyzeToken(tokenData);
            
            // Store/update analysis result
            this.tradingOpportunities.set(mint, analysis);
            
            if (analysis.isOpportunity) {
                opportunities.push({
                    mint,
                    symbol: tokenData.symbol,
                    ...analysis
                });
            }
        }
    
        // Broadcast if we have opportunities
        if (opportunities.length > 0 && this.broadcastToUI) {
            this.broadcastToUI({
                type: 'tradingOpportunities',
                data: opportunities
            });
        }
    }

    handleTokenTrade(tokenMint, tradeEvent) {
        const tokenData = this.activeTokens.get(tokenMint);
        if (!tokenData) return;

        // Add trade to history
        tokenData.trades.push(tradeEvent);
        
        // Update metrics
        this.updateTokenMetrics(tokenMint, tradeEvent);

        // Analyze after each trade
        this.analyzeTradingPattern(tokenMint);
    }

    updateTokenMetrics(tokenMint, tradeEvent) {
        const tokenData = this.activeTokens.get(tokenMint);
        const metrics = tokenData.metrics;

        // Update basic metrics
        metrics.lastUpdate = Date.now();
        metrics[tradeEvent.txType === 'buy' ? 'buyCount' : 'sellCount']++;
        metrics.totalVolumeTokens += tradeEvent.tokenAmount;
        metrics.uniqueTraders.add(tradeEvent.traderPublicKey);

        // Update market cap tracking
        metrics.highestMarketCap = Math.max(metrics.highestMarketCap, tradeEvent.marketCapSol);
        metrics.lowestMarketCap = Math.min(metrics.lowestMarketCap, tradeEvent.marketCapSol);

        // Update price history
        metrics.priceHistory.push({
            timestamp: Date.now(),
            price: tradeEvent.marketCapSol / tradeEvent.vTokensInBondingCurve,
            marketCap: tradeEvent.marketCapSol,
            solLiquidity: tradeEvent.vSolInBondingCurve
        });
    }

    analyzeTradingPattern(tokenMint) {
        const tokenData = this.activeTokens.get(tokenMint);
        const analysis = this.analyzer.analyzeToken(tokenData);
        
        // Store the analysis result
        this.tradingOpportunities.set(tokenMint, analysis);
        
        // If this is a new opportunity, broadcast immediately
        if (analysis.isOpportunity && this.broadcastToUI) {
            this.broadcastToUI({
                type: 'newOpportunity',
                data: {
                    mint: tokenMint,
                    symbol: tokenData.symbol,
                    ...analysis
                }
            });
        }
        
        return analysis;
    }

    // Cleanup method for inactive tokens
    cleanup(maxAge = 24 * 60 * 60 * 1000) {
        const now = Date.now();
        for (const [tokenMint, tokenData] of this.activeTokens.entries()) {
            if (now - tokenData.metrics.lastUpdate > maxAge) {
                if (tokenData.subscription?.unsubscribe) {
                    tokenData.subscription.unsubscribe();
                }
                this.activeTokens.delete(tokenMint);
                this.tradingOpportunities.delete(tokenMint); // Add this line
                console.log(`Stopped monitoring inactive token: ${tokenMint}`);
            }
        }
    }
}