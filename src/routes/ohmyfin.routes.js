import express from 'express';
import { ohmyfinService } from '../services/ohmyfinService.js';
import { authenticate, requireAdmin, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/v4/ohmyfin/sanctions/screen
 * Screen an entity against 315 watchlists & PEP registries
 */
router.post('/sanctions/screen', optionalAuth, async (req, res, next) => {
  try {
    const screeningData = await ohmyfinService.screenSanctions(req.body);
    return res.json({
      success: true,
      data: screeningData
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v4/ohmyfin/sanctions/screen/bulk
 * Bulk screen entities (up to 25)
 */
router.post('/sanctions/screen/bulk', optionalAuth, async (req, res, next) => {
  try {
    const { entities } = req.body;
    if (!Array.isArray(entities) || entities.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of entities to screen.'
      });
    }

    const bulkResult = await ohmyfinService.bulkScreenSanctions(entities);
    return res.json({
      success: true,
      data: bulkResult
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v4/ohmyfin/banks
 * Search banks by name or BIC code
 */
router.get('/banks', optionalAuth, async (req, res, next) => {
  try {
    const { query, country, limit } = req.query;
    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter must be at least 2 characters long.'
      });
    }

    const banksData = await ohmyfinService.searchBanks(query, country, true, limit ? parseInt(limit, 10) : 20);
    return res.json({
      success: true,
      data: banksData
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v4/ohmyfin/country/:code
 * Get country regulatory & IBAN format profile
 */
router.get('/country/:code', optionalAuth, async (req, res, next) => {
  try {
    const countryProfile = await ohmyfinService.getCountryProfile(req.params.code);
    return res.json({
      success: true,
      data: countryProfile
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v4/ohmyfin/fx/rates
 * RESTRICTED TO ADMIN ONLY: Get Ohmyfin reference FX rates
 */
router.get('/fx/rates', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { base, target, date } = req.query;
    const fxData = await ohmyfinService.getFxRates(base || 'EUR', target || 'USD', date || '');
    return res.json({
      success: true,
      data: fxData
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v4/ohmyfin/fx/history
 * RESTRICTED TO ADMIN ONLY: Get Ohmyfin FX rate history series
 */
router.get('/fx/history', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { base, target, from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: 'Both `from` and `to` date parameters (YYYY-MM-DD) are required.'
      });
    }

    const fxHistoryData = await ohmyfinService.getFxHistory(base || 'USD', target || 'EUR', from, to);
    return res.json({
      success: true,
      data: fxHistoryData
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v4/ohmyfin/copilot/chat
 * Conversational Compliance AI Copilot Assistant
 */
router.post('/copilot/chat', optionalAuth, async (req, res, next) => {
  try {
    const { message, context } = req.body;
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required for AI Copilot.'
      });
    }

    const chatResponse = await ohmyfinService.complianceCopilotChat(message, context);
    return res.json({
      success: true,
      data: chatResponse
    });
  } catch (error) {
    next(error);
  }
});

export default router;
