import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as fidelityPaymentController from '../controllers/fidelityPaymentController.js';

const router = express.Router();

/**
 * Create virtual account for wallet funding
 * POST /api/payments/fidelity/create-virtual-account
 */
router.post('/create-virtual-account', authenticate, fidelityPaymentController.createVirtualAccount);

/**
 * Get payment status
 * GET /api/payments/fidelity/:transactionRef/status
 */
router.get('/:transactionRef/status', authenticate, fidelityPaymentController.getPaymentStatus);

/**
 * Get payment history
 * GET /api/payments/fidelity/history
 */
router.get('/history', authenticate, fidelityPaymentController.getPaymentHistory);

/**
 * Retry payment
 * POST /api/payments/fidelity/:paymentId/retry
 */
router.post('/:paymentId/retry', authenticate, fidelityPaymentController.retryPayment);

/**
 * Webhook handler for Fidelity notifications
 * POST /api/payments/fidelity/webhook
 * NOTE: This should NOT require authentication as it's called by Fidelity servers
 */
router.post('/webhook', fidelityPaymentController.handleWebhook);

export default router;
