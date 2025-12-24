// __define-ocg__ keeping it clean & consistent (ESM)
import express from 'express';
const router = express.Router();

// Import controllers
import { deleteUnverifiedUsers, getPendingKycSubmissions, getDashboardStats, getAllUsers, getUserById, updateUser, deleteUser, approveAccount, rejectAccount } from '../controllers/adminController.js';

// Import middleware
import { authenticate, requireAdmin } from '../middleware/auth.js';

// Admin routes
router.get('/pending-kyc-submissions', authenticate, requireAdmin, getPendingKycSubmissions);
router.delete('/delete-unverified-users', authenticate, requireAdmin, deleteUnverifiedUsers);
router.get('/dashboard', authenticate, requireAdmin, getDashboardStats);

// User management routes
router.get('/users', authenticate, requireAdmin, getAllUsers);
router.get('/users/:userId', authenticate, requireAdmin, getUserById);
router.put('/users/:userId', authenticate, requireAdmin, updateUser);
router.put('/users/:userId/approve', authenticate, requireAdmin, approveAccount);
router.put('/users/:userId/reject', authenticate, requireAdmin, rejectAccount);
router.delete('/users/:userId', authenticate, requireAdmin, deleteUser);

// __define-ocg__ ensure default export for ESM compatibility
export default router; // ✅ changed to ESM export
