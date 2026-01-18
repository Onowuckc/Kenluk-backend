import express from 'express';
import { getExchangeRates, updateExchangeRates } from '../controllers/ratesController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route GET /api/rates/usd-ngn-rate
 * @desc Get current USD→NGN exchange rate from admin settings
 * @access Public
 */
router.get('/usd-ngn-rate', getExchangeRates);

/**
 * @route GET /api/admin/rates
 * @desc Get current exchange rates (admin view with metadata)
 * @access Private - Admin only
 */
router.get('/admin/rates', authenticate, requireAdmin, getExchangeRates);

/**
 * @route PUT /api/admin/rates
 * @desc Update exchange rates (admin only)
 * @access Private - Admin only
 */
router.put('/admin/rates', authenticate, requireAdmin, updateExchangeRates);

export default router;

