export default class PumpFunAnalyzer {
    constructor() {
        // Key milestones from pump.fun's bonding curve 
        this.SOLANA_LIQUIDITY_THRESHOLD = 45 // SOL needed for "King of the Hill"
        this.RADIUM_LIQUIDITY_THRESHOLD = 86 // SOL needed for Radium transition
        this.TARGET_SUPPLY = 800_000_000 // 800M tokens in bonding curve
        
        // Analysis thresholds
        this.MIN_SOL_LIQUIDITY = 5 // Minimum SOL to consider token legitimate
        this.MIN_TRADE_COUNT = 10 // Minimum trades to establish pattern
        this.TIME_WINDOW = 1000 * 60 * 5 // 5 minute analysis window
        this.BUY_PRESSURE_THRESHOLD = 0.7 // 70% buys vs sells
        this.MIN_HOLDERS = 20 // Minimum unique holders
        this.MAX_HOLDER_SHARE = 0.15 // Max 15% held by single wallet
        
        // Price movement thresholds
        this.MIN_PRICE_GROWTH = 30 // 30% minimum growth
        this.MAX_PRICE_DROP = 20 // 20% maximum drop
        this.VOLUME_GROWTH_THRESHOLD = 50 // 50% volume growth rate
    }

    analyzeToken(token) {
        const metrics = this.calculateMetrics(token)
        const signals = this.evaluatePumpFunSignals(metrics)
        const risks = this.assessPumpFunRisks(metrics)
        
        return {
            isOpportunity: this.evaluateOpportunity(signals, risks),
            signals,
            risks,
            metrics,
            recommendation: this.generateRecommendation(signals, risks)
        }
    }

    evaluatePumpFunSignals(metrics) {
        return {
            // Supply signals
            approachingRadium: metrics.tokenSupply > (this.TARGET_SUPPLY * 0.7),
            healthyLiquidity: metrics.solLiquidity > this.MIN_SOL_LIQUIDITY,
            
            // Trading signals
            strongBuyPressure: metrics.buyPressure > this.BUY_PRESSURE_THRESHOLD,
            growingVolume: metrics.volumeGrowthRate > this.VOLUME_GROWTH_THRESHOLD,
            sufficientTrades: metrics.recentTradeCount > this.MIN_TRADE_COUNT,
            
            // Distribution signals
            diverseHolders: metrics.uniqueHolders > this.MIN_HOLDERS,
            noWhaleConcentration: !this.hasExcessiveHolderConcentration(metrics),
            
            // Price signals
            strongPriceGrowth: metrics.priceGrowth > this.MIN_PRICE_GROWTH,
            maintainingPrice: metrics.maxPriceDrop < this.MAX_PRICE_DROP,
            
            // Bonding curve progression
            approachingKingOfHill: metrics.solLiquidity > (this.SOLANA_LIQUIDITY_THRESHOLD * 0.8)
        }
    }

    assessPumpFunRisks(metrics) {
        return {
            insufficientLiquidity: metrics.solLiquidity < this.MIN_SOL_LIQUIDITY,
            lowTradeVolume: metrics.recentTradeCount < this.MIN_TRADE_COUNT,
            excessiveConcentration: this.hasExcessiveHolderConcentration(metrics),
            priceDumping: metrics.maxPriceDrop > this.MAX_PRICE_DROP,
            approachingMaxSupply: metrics.tokenSupply > (this.TARGET_SUPPLY * 0.95)
        }
    }

    generateRecommendation(signals, risks) {
        if (this.evaluateOpportunity(signals, risks)) {
            const phase = this.determineTokenPhase(signals);
            return {
                action: 'ENTER',
                phase,
                suggestedPosition: this.calculatePositionSize(signals, risks),
                stopLoss: this.calculateStopLoss(phase),
                takeProfit: this.calculateTakeProfit(phase)
            }
        }
        return { action: 'WAIT', reason: this.generateRejectionReason(signals, risks) }
    }

    determineTokenPhase(signals) {
        if (signals.approachingRadium) return 'LATE_STAGE';
        if (signals.approachingKingOfHill) return 'MID_STAGE';
        return 'EARLY_STAGE';
    }

    calculateStopLoss(phase) {
        const baseStopLoss = {
            'EARLY_STAGE': 0.15, // 15% stop loss
            'MID_STAGE': 0.10,   // 10% stop loss
            'LATE_STAGE': 0.05   // 5% stop loss
        }
        return baseStopLoss[phase];
    }

    calculateTakeProfit(phase) {
        const takeProfitTargets = {
            'EARLY_STAGE': 0.5,  // 50% profit target
            'MID_STAGE': 0.3,    // 30% profit target
            'LATE_STAGE': 0.15   // 15% profit target
        }
        return takeProfitTargets[phase];
    }

    calculateMetrics(token) {
        const recentTrades = token.trades.filter(t => 
            t.timestamp > Date.now() - this.TIME_WINDOW
        );
        
        const currentPrice = token.metrics.priceHistory[token.metrics.priceHistory.length - 1]?.price || 0;
        const initialPrice = token.metrics.priceHistory[0]?.price || 0;
        const priceGrowth = ((currentPrice - initialPrice) / initialPrice) * 100;
        
        const recentPrices = token.metrics.priceHistory
            .filter(p => p.timestamp > Date.now() - this.TIME_WINDOW)
            .map(p => p.price);
        
        const maxDrop = recentPrices.length > 1 ? 
            Math.max(...recentPrices.map((p, i) => 
                i > 0 ? ((recentPrices[i-1] - p) / recentPrices[i-1]) * 100 : 0
            )) : 0;
    
        return {
            tokenSupply: token.metrics.totalVolumeTokens,
            solLiquidity: token.metrics.initialSolInCurve,
            buyPressure: token.metrics.buyCount / (token.metrics.buyCount + token.metrics.sellCount),
            volumeGrowthRate: this.calculateVolumeGrowth(recentTrades),
            recentTradeCount: recentTrades.length,
            uniqueHolders: token.metrics.uniqueTraders.size,
            priceGrowth,
            maxPriceDrop: maxDrop,
            largestHolder: this.getLargestHolderShare(token)
        };
    }
    
    calculateVolumeGrowth(recentTrades) {
        if (recentTrades.length < 2) return 0;
        
        const halfwayPoint = Math.floor(recentTrades.length / 2);
        const firstHalfVolume = recentTrades.slice(0, halfwayPoint)
            .reduce((sum, trade) => sum + trade.tokenAmount, 0);
        const secondHalfVolume = recentTrades.slice(halfwayPoint)
            .reduce((sum, trade) => sum + trade.tokenAmount, 0);
        
        return ((secondHalfVolume - firstHalfVolume) / firstHalfVolume) * 100;
    }
    
    getLargestHolderShare(token) {
        // Simple approximation based on trades
        const holderBalances = new Map();
        
        token.trades.forEach(trade => {
            const currentBalance = holderBalances.get(trade.traderPublicKey) || 0;
            if (trade.txType === 'buy') {
                holderBalances.set(trade.traderPublicKey, currentBalance + trade.tokenAmount);
            } else {
                holderBalances.set(trade.traderPublicKey, currentBalance - trade.tokenAmount);
            }
        });
        
        const maxBalance = Math.max(...holderBalances.values());
        return maxBalance / token.metrics.totalVolumeTokens;
    }
    
    hasExcessiveHolderConcentration(metrics) {
        return metrics.largestHolder > this.MAX_HOLDER_SHARE;
    }
    
    evaluateOpportunity(signals, risks) {
        const positiveSignals = Object.values(signals).filter(Boolean).length;
        const riskFactors = Object.values(risks).filter(Boolean).length;
        
        // Require at least 7 positive signals and no more than 1 risk factor
        return positiveSignals >= 7 && riskFactors <= 1;
    }
    
    calculatePositionSize(signals, risks) {
        const riskLevel = Object.values(risks).filter(Boolean).length;
        const signalStrength = Object.values(signals).filter(Boolean).length / Object.keys(signals).length;
        
        // Base position size between 1-5% based on signal strength
        const baseSize = signalStrength * 0.05;
        
        // Reduce position size based on risk factors
        return Math.max(0.01, baseSize * (1 - (riskLevel * 0.25)));
    }
    
    generateRejectionReason(signals, risks) {
        const failedSignals = Object.entries(signals)
            .filter(([_, value]) => !value)
            .map(([key, _]) => key);
        
        const activeRisks = Object.entries(risks)
            .filter(([_, value]) => value)
            .map(([key, _]) => key);
        
        return {
            failedSignals,
            activeRisks,
            summary: `Missing ${failedSignals.length} key signals with ${activeRisks.length} risk factors`
        };
    }
}