const express = require('express');
const router = express.Router();
const fidelityPaymentController = require('../controllers/fidelityPaymentController');
const { verifyToken } = require('../middleware/auth'); // Adjust path based on your auth middleware

/**
 * Initialize a payment collection request
 * POST /api/payments/fidelity/initialize
 */
router.post('/initialize', verifyToken, fidelityPaymentController.initializePayment);

/**
 * Get payment status
 * GET /api/payments/fidelity/:transactionRef/status
 */
router.get('/:transactionRef/status', verifyToken, fidelityPaymentController.getPaymentStatus);

/**
 * Get payment history
 * GET /api/payments/fidelity/history
 */
router.get('/history', verifyToken, fidelityPaymentController.getPaymentHistory);

/**
 * Retry payment
 * POST /api/payments/fidelity/:paymentId/retry
 */
router.post('/:paymentId/retry', verifyToken, fidelityPaymentController.retryPayment);

/**
 * Webhook handler for Fidelity notifications
 * POST /api/payments/fidelity/webhook
 * NOTE: This should NOT require authentication as it's called by Fidelity servers
 */
router.post('/webhook', fidelityPaymentController.handleWebhook);

module.exports = router;
