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

// Fetch from CoinGecko (primary)
const fetchFromCoinGecko = async () => {
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=ngn');
    const rate = response.data['usd-coin'].ngn;
    console.log(`✅ Fetched rate from CoinGecko: ${rate}`);
    return { rate, source: 'CoinGecko' };
  } catch (error) {
    console.error('❌ CoinGecko API failed:', error.message);
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

  // Try CoinGecko with retries
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await fetchFromCoinGecko();
      cache = { rate: result.rate, timestamp: now, source: result.source };
      return result;
    } catch (error) {
      if (attempt < 2) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s
        console.log(`⏳ Retrying CoinGecko in ${delay}ms (attempt ${attempt + 1}/3)`);
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
 * @route   GET /api/rates/usdc-ngn
 * @desc    Get current USDC to NGN exchange rate
 * @access  Public
 */
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
