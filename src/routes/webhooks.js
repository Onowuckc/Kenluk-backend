import express from 'express';
import { handleFidelityWebhook } from '../controllers/webhookController.js';

const router = express.Router();

/**
 * @route   POST /api/webhooks/fidelity
 * @desc    Receive payment notification from Fidelity Bank
 * @access  Public (but signature-verified)
 */
router.post('/fidelity', handleFidelityWebhook);

export default router;
