import express from 'express';
import { handleWebhook as handleFidelityWebhook } from '../controllers/fidelityPaymentController.js';

const router = express.Router();

/**
 * @route   POST /api/webhooks/fidelity
 * @desc    Receive payment notification from Fidelity Bank
 * @access  Public (but signature-verified)
 */
router.post('/fidelity', handleFidelityWebhook);

export default router;
