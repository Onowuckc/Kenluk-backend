import express from 'express';
import { handleWebhook as handleFidelityWebhook } from '../controllers/fidelityPaymentController.js';
import { handleReapWebhook } from '../controllers/webhookController.js';

const router = express.Router();

/**
 * @route   POST /api/webhooks/fidelity
 * @desc    Receive payment notification from Fidelity Bank
 * @access  Public (but signature-verified)
 */
router.post('/fidelity', handleFidelityWebhook);

/**
 * @route   POST /api/webhooks/reap
 * @desc    Receive payment status notifications from Reap Payments API
 * @access  Public (RSA-SHA512 signature-verified via reap-signature header)
 */
router.post('/reap', handleReapWebhook);

export default router;
