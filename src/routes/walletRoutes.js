import express from 'express';
import { authenticate } from '../middleware/auth.js';
import walletController from '../controllers/walletController.js';

const router = express.Router();

// Initialize wallet
router.post('/initialize', authenticate, walletController.initializeWallet);

// Get wallet balance
router.get('/balance', authenticate, walletController.getWalletBalance);

// Get wallet summary
router.get('/summary', authenticate, walletController.getWalletSummary);

// Get transaction history
router.get('/transactions', authenticate, walletController.getTransactionHistory);

// Get funding history
router.get('/funding-history', authenticate, walletController.getFundingHistory);

// Validate balance
router.post('/validate-balance', authenticate, walletController.validateBalance);

// Process Fidelity payment
router.post('/process-fidelity-payment', authenticate, walletController.processFidelityPayment);

// Admin approve payment with wallet debit
router.post('/approve-payment/:paymentId', authenticate, walletController.approvePaymentWithWalletDebit);

export default router;
