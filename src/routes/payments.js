import express from 'express';
import {
  generateInvoiceUploadUrl,
  submitPaymentRequest,
  getUserPayments,
  getAllPayments,
  reviewPayment
} from '../controllers/paymentUploadController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import {
  validateInvoiceUploadUrl,
  validatePaymentSubmission,
  validatePaymentReview
} from '../middleware/validation.js';

const router = express.Router();

// All payment routes require authentication
router.use(authenticate);

// User routes
router.post('/upload-invoice-url', validateInvoiceUploadUrl, generateInvoiceUploadUrl);
router.post('/submit-request', validatePaymentSubmission, submitPaymentRequest);
router.get('/my-requests', getUserPayments);

// Admin routes
router.get('/all', requireAdmin, getAllPayments);
router.put('/:paymentId/review', requireAdmin, validatePaymentReview, reviewPayment);

export default router;
