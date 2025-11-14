import express from 'express';
import axios from 'axios';

const router = express.Router();

// In-memory cache for rates
let cache = {
  rate: null,
  timestamp: 0,
  source: null
};

const CACHE_TTL = 30 * 1000; // 30 seconds in milliseconds

// Sleep function for exponential backoff
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch from Bybit (primary) - USDT spot price
const fetchFromBybit = async () => {
  try {
    // Bybit API for USDT spot price (USDT is pegged to USD ≈ 1:1)
    const response = await axios.get('https://api.bybit.com/v5/market/tickers?category=spot&symbol=USDTUSD', {
      timeout: 10000, // 10 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Defensive checks
    if (!response.data || !response.data.result || !response.data.result.list || response.data.result.list.length === 0) {
      throw new Error('Bybit API returned no ticker data for USDTUSD');
    }

    const lastPrice = response.data.result.list[0].lastPrice;
    const usdtPrice = parseFloat(lastPrice);
    if (isNaN(usdtPrice) || usdtPrice <= 0) {
      throw new Error('Invalid lastPrice from Bybit API');
    }

    // Use varOcg as a multiplier for additional calculation (e.g., for fees or adjustments)
    const varOcg = 1.0; // Default multiplier, can be adjusted based on business logic
    const rate = usdtPrice * varOcg;
    if (isNaN(rate) || rate <= 0) {
      throw new Error('Invalid rate calculated from Bybit API');
    }
    console.log(`✅ Fetched rate from Bybit: ${rate} (USDT: ${usdtPrice}, varOcg: ${varOcg})`);
    return { rate, source: 'Bybit', varOcg };
  } catch (error) {
    console.error('❌ Bybit API failed:', error.message);
    throw error;
  }
};



// Fetch rate with retry logic and caching
const fetchRateWithRetry = async () => {
  const now = Date.now();

  // Check cache
  if (cache.rate && (now - cache.timestamp) < CACHE_TTL) {
    console.log(`📦 Using cached rate: ${cache.rate} from ${cache.source}`);
    return { rate: cache.rate, source: cache.source };
  }

  // Try Bybit with retries
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await fetchFromBybit();
      cache = { rate: result.rate, timestamp: now, source: result.source };
      return result;
    } catch (error) {
      if (attempt < 2) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s
        console.log(`⏳ Retrying Bybit in ${delay}ms (attempt ${attempt + 1}/3)`);
        await sleep(delay);
      }
    }
  }

  // No fallback - Bybit only
  throw new Error('Bybit API failed after retries');
};

/**
 * @route   GET /api/rates/usd-ngn-rate
 * @desc    Get current USD to NGN exchange rate using Bybit USDT spot price
 * @access  Public
 */
router.get('/usd-ngn-rate', async (req, res) => {
  try {
    const { rate, source, varOcg } = await fetchRateWithRetry();

    res.json({
      baseCurrency: "USD",
      quoteCurrency: "NGN",
      exchangeRate: parseFloat(rate.toFixed(2)),
      varOcg: varOcg || 1.0,
      source
    });
  } catch (error) {
    console.error('❌ Failed to fetch exchange rate:', error.message);
    // Return last known rate if available
    if (cache.rate && typeof cache.rate === 'number' && !isNaN(cache.rate)) {
      console.log('📦 Returning last known rate due to API failure');
      res.json({
        baseCurrency: "USD",
        quoteCurrency: "NGN",
        exchangeRate: parseFloat(cache.rate.toFixed(2)),
        varOcg: 1.0
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Unable to fetch exchange rate. Please try again later.',
        error: error.message
      });
    }
  }
});



export default router;
