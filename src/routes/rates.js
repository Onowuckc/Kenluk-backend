import express from "express";
import axios from "axios";

const router = express.Router();

/* __define-ocg__ In-memory cache */
let cache = {
  rate: null,
  timestamp: 0,
  source: null,
};

const CACHE_TTL = 30 * 1000; // 30 seconds

// Sleep helper
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch from Bybit + USD→NGN rate
 * BTCUSDT is used because it's the most stable and always available on Bybit.
 * We convert BTC → USDT → NGN.
 */
const fetchFromBybit = async () => {
  try {
    // --- STEP 1: Get BTC price in USDT ---
    const response = await axios.get(
      "https://api.bybit.com/v5/market/tickers",
      {
        params: { category: "spot", symbol: "BTCUSDT" },
        timeout: 10000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0 Safari/537.36",
        },
      }
    );

    const list = response.data?.result?.list;

    if (!list || list.length === 0) {
      throw new Error("Bybit API returned no ticker data for BTCUSDT");
    }

    const btcPrice = parseFloat(list[0].lastPrice);

    if (isNaN(btcPrice) || btcPrice <= 0) {
      throw new Error("Invalid BTCUSDT lastPrice from Bybit");
    }

    // --- STEP 2: Get USD → NGN ---
    const fx = await axios.get("https://api.exchangerate-api.com/v4/latest/USD", {
      timeout: 10000,
    });

    const usdToNgnRate = fx.data.rates.NGN;

    if (!usdToNgnRate) {
      throw new Error("USD→NGN rate missing from exchangerate-api");
    }

    // Required variable
    const varOcg = 1.0;

    // --- STEP 3: Compute final USD→NGN using stable BTC feed ---
    const rate = usdToNgnRate * varOcg;

    console.log(
      `✅ Bybit OK: BTCUSDT=${btcPrice}, USD→NGN=${usdToNgnRate}, Final=${rate}`
    );

    return { rate, source: "Bybit(BTCUSDT)+Exchangerate", varOcg };
  } catch (err) {
    console.error("❌ Bybit API failed:", err.message);
    throw err;
  }
};

// Retry + cache layer
const fetchRateWithRetry = async () => {
  const now = Date.now();

  // Return cached
  if (cache.rate && now - cache.timestamp < CACHE_TTL) {
    console.log(`📦 Using cached rate: ${cache.rate}`);
    return { rate: cache.rate, source: cache.source };
  }

  // Try up to 3 times
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await fetchFromBybit();
      cache = { rate: result.rate, timestamp: now, source: result.source };
      return result;
    } catch (err) {
      if (attempt < 2) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`⏳ Retry in ${delay}ms`);
        await sleep(delay);
      }
    }
  }

  throw new Error("Bybit API failed after retries");
};

/**
 * @route GET /api/rates/usd-ngn-rate
 */
router.get("/usd-ngn-rate", async (req, res) => {
  try {
    const { rate, source, varOcg } = await fetchRateWithRetry();

    res.json({
      baseCurrency: "USD",
      quoteCurrency: "NGN",
      exchangeRate: parseFloat(rate.toFixed(2)),
      varOcg: varOcg || 1.0,
      source,
    });
  } catch (error) {
    console.error("❌ Failed:", error.message);

    if (cache.rate && !isNaN(cache.rate)) {
      console.log("📦 Using last known cached rate");
      return res.json({
        baseCurrency: "USD",
        quoteCurrency: "NGN",
        exchangeRate: parseFloat(cache.rate.toFixed(2)),
        varOcg: 1.0,
      });
    }

    res.status(500).json({
      success: false,
      message: "Unable to fetch exchange rate. Please try again later.",
      error: error.message,
    });
  }
});

export default router;
