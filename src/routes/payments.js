import express from 'express';
import {
  generateInvoiceUploadUrl,
  submitPaymentRequest,
  getUserPayments,
  getAllPayments,
  reviewPayment,
  getPaymentById,
  getPaymentInvoiceUrl,
  actionPayment,
  retryReapSubmission,
  uploadPaymentDocuments,
  completePayment
} from '../controllers/paymentUploadController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { requireAccountApproval } from '../middleware/accountApproval.js';
import {
  validateInvoiceUploadUrl,
  validatePaymentSubmission,
  validatePaymentReview
} from '../middleware/validation.js';

const router = express.Router();

// All payment routes require authentication
router.use(authenticate);

// User routes
router.post('/upload-invoice-url', requireAccountApproval, validateInvoiceUploadUrl, generateInvoiceUploadUrl);
router.post('/submit-request', requireAccountApproval, validatePaymentSubmission, submitPaymentRequest);
router.get('/my-requests', requireAccountApproval, getUserPayments);

// Admin routes
router.get('/all', requireAdmin, getAllPayments);

// User routes (continued - must come after /all to avoid conflict)
router.get('/:paymentId/invoice-url', getPaymentInvoiceUrl);
router.get('/:paymentId', getPaymentById);
router.post('/:paymentId/documents', uploadPaymentDocuments);
router.put('/:paymentId/review', requireAdmin, validatePaymentReview, reviewPayment);
router.put('/:paymentId/action', requireAdmin, validatePaymentReview, actionPayment);
router.put('/:paymentId/retry-reap', requireAdmin, retryReapSubmission);
router.put('/:paymentId/complete', requireAdmin, completePayment);

export default router;
