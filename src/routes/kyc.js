import express from 'express';
import {
  generateUploadUrl,
  confirmUpload,
  getUserDocuments,
  getPendingDocuments,
  reviewDocument
} from '../controllers/kycController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import {
  validateKycUploadUrl,
  validateKycConfirmUpload,
  validateDocumentReview
} from '../middleware/validation.js';

const router = express.Router();

// All KYC routes require authentication
router.use(authenticate);

// User routes
router.post('/upload-url', validateKycUploadUrl, generateUploadUrl);
router.post('/confirm-upload', validateKycConfirmUpload, confirmUpload);
router.get('/my-documents', getUserDocuments);

// Admin routes
router.get('/pending', requireAdmin, getPendingDocuments);
router.put('/:documentId/review', requireAdmin, validateDocumentReview, reviewDocument);

export default router;
