import express from 'express';
import {
  simulateFundAccount,
  simulatePaymentLifecycle,
  simulateTrackingLifecycle,
  getAccountBalance
} from '../controllers/simulationController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// All simulation routes require authentication and admin access
router.use(authenticate);
router.use(requireAdmin);

// Fund account simulation
router.post('/fund-account', simulateFundAccount);

// Get account balance
router.get('/account-balance', getAccountBalance);

// Payment lifecycle simulation
router.post('/payments/:paymentId/lifecycle', simulatePaymentLifecycle);

// Tracking lifecycle simulation
router.post('/payments/:paymentId/tracking', simulateTrackingLifecycle);

export default router;
