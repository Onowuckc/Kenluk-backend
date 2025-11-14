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
    const response = await axios.get('https://api.bybit.com/v5/market/tickers?category=spot&symbol=USDTUSDC');
    const usdtPrice = parseFloat(response.data.result.list[0].lastPrice);
    // Since USDT ≈ USD, we use USDT price as USD equivalent
    // For NGN, we need to get USD to NGN rate. Since Bybit doesn't provide NGN directly,
    // we'll use a reliable fallback for USD to NGN conversion
    const usdToNgnResponse = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
    const usdToNgnRate = usdToNgnResponse.data.rates.NGN;
    const rate = usdtPrice * usdToNgnRate;
    console.log(`✅ Fetched rate from Bybit + Exchangerate: ${rate} (USDT: ${usdtPrice}, USD→NGN: ${usdToNgnRate})`);
    return { rate, source: 'Bybit + Exchangerate' };
  } catch (error) {
    console.error('❌ Bybit API failed:', error.message);
    throw error;
  }
};

// Fetch from Exchangerate.host (fallback)
const fetchFallback = async () => {
  try {
    const response = await axios.get('https://api.exchangerate.host/convert?from=USD&to=NGN');
    const rate = response.data.result;
    console.log(`✅ Fetched rate from Exchangerate.host: ${rate}`);
    return { rate, source: 'Exchangerate.host' };
  } catch (error) {
    console.error('❌ Exchangerate.host API failed:', error.message);
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

  // Fallback to Exchangerate.host
  try {
    const result = await fetchFallback();
    cache = { rate: result.rate, timestamp: now, source: result.source };
    return result;
  } catch (error) {
    throw new Error('All API sources failed');
  }
};

/**
 * @route   GET /api/rates/usd-ngn-rate
 * @desc    Get current USD to NGN exchange rate using Bybit USDT spot price
 * @access  Public
 */
router.get('/usd-ngn-rate', async (req, res) => {
  try {
    const { rate, source } = await fetchRateWithRetry();

    res.json({
      baseCurrency: "USD",
      quoteCurrency: "NGN",
      exchangeRate: parseFloat(rate.toFixed(2))
    });
  } catch (error) {
    console.error('❌ Failed to fetch exchange rate:', error.message);
    // Return last known rate if available
    if (cache.rate) {
      console.log('📦 Returning last known rate due to API failure');
      res.json({
        baseCurrency: "USD",
        quoteCurrency: "NGN",
        exchangeRate: parseFloat(cache.rate.toFixed(2))
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

// Keep old endpoint for backward compatibility (marked for removal)
router.get('/usdc-ngn', async (req, res) => {
  try {
    const { rate, source } = await fetchRateWithRetry();

    res.json({
      success: true,
      rate: parseFloat(rate.toFixed(2)),
      source,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Failed to fetch exchange rate:', error.message);
    res.status(500).json({
      success: false,
      message: 'Unable to fetch exchange rate. Please try again later.',
      error: error.message
    });
  }
});

export default router;
