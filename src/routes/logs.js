import express from 'express';
import {
  getClientErrorReportById,
  getClientErrorReports,
  submitClientErrorReport,
} from '../controllers/logController.js';
import { authenticate, optionalAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/client-errors', optionalAuth, submitClientErrorReport);
router.get('/client-errors', authenticate, requireAdmin, getClientErrorReports);
router.get('/client-errors/:reportId', authenticate, requireAdmin, getClientErrorReportById);

export default router;
