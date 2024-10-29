class TokenTracker {
    constructor() {
        this.activeTokens = new Map();
        this.ws = null;
        // Thresholds for analysis
        this.VOLUME_THRESHOLD = 1000000; // Example token amount
        this.SOL_LIQUIDITY_THRESHOLD = 50; // SOL
        this.TRADE_COUNT_THRESHOLD = 20; // Number of trades
        this.TIME_WINDOW = 1000 * 60 * 60; // 1 hour in milliseconds
    }

    async handleNewToken(tokenCreationEvent) {
        const tokenMint = tokenCreationEvent.mint;
        
        if (!this.activeTokens.has(tokenMint)) {
            try {
                const tradeSubscription = await this.subscribeToTokenTrades(tokenMint);
                
                this.activeTokens.set(tokenMint, {
                    creationEvent: tokenCreationEvent,
                    subscription: tradeSubscription,
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

                console.log(`Started monitoring trades for token: ${tokenMint}`);
                console.log('Initial bonding curve state:', {
                    solLiquidity: tokenCreationEvent.vSolInBondingCurve,
                    tokenSupply: tokenCreationEvent.vTokensInBondingCurve,
                    marketCap: tokenCreationEvent.marketCapSol
                });
            } catch (error) {
                console.error(`Failed to subscribe to trades for token ${tokenMint}:`, error);
            }
        }
    }

    async subscribeToTokenTrades(tokenMint) {
        if (!this.ws) {
            throw new Error('WebSocket connection not initialized');
        }

        // Create subscription message for specific token
        const subscriptionPayload = {
            method: "subscribeTokenTrade",
            token: tokenMint
        };

        // Send subscription request
        this.ws.send(JSON.stringify(subscriptionPayload));

        // Return an object with unsubscribe method
        return {
            unsubscribe: () => {
                const unsubscribePayload = {
                    method: "unsubscribeTokenTrade",
                    token: tokenMint
                };
                this.ws.send(JSON.stringify(unsubscribePayload));
                console.log(`Unsubscribed from token trades: ${tokenMint}`);
            }
        };
    }

    async reconnectSubscriptions() {
        if (!this.ws) {
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

    setWebSocket(ws) {
        this.ws = ws;
    }

    handleTokenTrade(tokenMint, tradeEvent) {
        const tokenData = this.activeTokens.get(tokenMint);
        if (!tokenData) return;

        // Add trade to history
        tokenData.trades.push(tradeEvent);
        
        // Update metrics
        this.updateTokenMetrics(tokenMint, tradeEvent);

        // Analyze after each trade
        const analysis = this.analyzeTradingPattern(tokenMint);
        if (analysis.strongSignals) {
            console.log(`Strong listing signals detected for ${tokenMint}:`, analysis);
        }
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

        // Calculate implied price and add to price history
        const impliedPrice = tradeEvent.marketCapSol / tradeEvent.vTokensInBondingCurve;
        metrics.priceHistory.push({
            timestamp: Date.now(),
            price: impliedPrice,
            marketCap: tradeEvent.marketCapSol,
            solLiquidity: tradeEvent.vSolInBondingCurve
        });
    }

    analyzeTradingPattern(tokenMint) {
        const tokenData = this.activeTokens.get(tokenMint);
        const metrics = tokenData.metrics;
        const recentTrades = this.getRecentTrades(tokenData.trades);

        // Calculate key metrics
        const timeElapsed = Date.now() - metrics.createdAt;
        const recentVolume = this.calculateRecentVolume(recentTrades);
        const buyPressure = metrics.buyCount / (metrics.buyCount + metrics.sellCount);
        const priceGrowth = this.calculatePriceGrowth(metrics.priceHistory);
        const liquidityGrowth = (recentTrades[0]?.vSolInBondingCurve || 0) - metrics.initialSolInCurve;
        const uniqueTraderGrowth = metrics.uniqueTraders.size;

        // Market cap momentum
        const marketCapGrowth = ((metrics.highestMarketCap - metrics.initialMarketCap) / metrics.initialMarketCap) * 100;

        // Define signal strengths
        const signals = {
            strongVolume: recentVolume > this.VOLUME_THRESHOLD,
            highBuyPressure: buyPressure > 0.7,
            significantLiquidity: liquidityGrowth > this.SOL_LIQUIDITY_THRESHOLD,
            sustainedGrowth: priceGrowth > 20, // 20% growth
            activeTraders: uniqueTraderGrowth > 50,
            marketCapMomentum: marketCapGrowth > 100 // 100% growth
        };

        // Determine if signals are strong enough to suggest listing
        const strongSignals = Object.values(signals).filter(Boolean).length >= 4;

        return {
            strongSignals,
            signals,
            metrics: {
                timeElapsed,
                recentVolume,
                buyPressure,
                priceGrowth,
                liquidityGrowth,
                uniqueTraderGrowth,
                marketCapGrowth
            }
        };
    }

    getRecentTrades(trades) {
        const cutoffTime = Date.now() - this.TIME_WINDOW;
        return trades.filter(trade => trade.timestamp > cutoffTime);
    }

    calculateRecentVolume(trades) {
        return trades.reduce((sum, trade) => sum + trade.tokenAmount, 0);
    }

    calculatePriceGrowth(priceHistory) {
        if (priceHistory.length < 2) return 0;
        const initial = priceHistory[0].price;
        const current = priceHistory[priceHistory.length - 1].price;
        return ((current - initial) / initial) * 100;
    }

    // Cleanup method for inactive tokens
    cleanup(maxAge = 24 * 60 * 60 * 1000) {
        const now = Date.now();
        for (const [tokenMint, tokenData] of this.activeTokens.entries()) {
            if (now - tokenData.metrics.lastUpdate > maxAge) {
                // Unsubscribe from token trades
                if (tokenData.subscription && tokenData.subscription.unsubscribe) {
                    tokenData.subscription.unsubscribe();
                }
                this.activeTokens.delete(tokenMint);
                console.log(`Stopped monitoring inactive token: ${tokenMint}`);
            }
        }
    }
}

module.exports = TokenTracker;