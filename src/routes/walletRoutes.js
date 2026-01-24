import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import walletController from '../controllers/walletController.js';

const router = express.Router();

// Initialize wallet
router.post('/initialize', verifyToken, walletController.initializeWallet);

// Get wallet balance
router.get('/balance', verifyToken, walletController.getWalletBalance);

// Get wallet summary
router.get('/summary', verifyToken, walletController.getWalletSummary);

// Get transaction history
router.get('/transactions', verifyToken, walletController.getTransactionHistory);

// Get funding history
router.get('/funding-history', verifyToken, walletController.getFundingHistory);

// Validate balance
router.post('/validate-balance', verifyToken, walletController.validateBalance);

// Process Fidelity payment
router.post('/process-fidelity-payment', verifyToken, walletController.processFidelityPayment);

// Admin approve payment with wallet debit
router.post('/approve-payment/:paymentId', verifyToken, walletController.approvePaymentWithWalletDebit);

export default router;
