// __define-ocg__ keeping it clean & consistent (ESM)
import express from 'express';
const router = express.Router();

// Import controllers
import { getProfile, updateProfile, changePassword, deleteAccount } from '../controllers/userController.js';

// Import middleware
import { authenticate } from '../middleware/auth.js';

/**
 * @route   GET /api/user/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', authenticate, getProfile);

/**
 * @route   PUT /api/user/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authenticate, updateProfile);

/**
 * @route   PUT /api/user/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put('/change-password', authenticate, changePassword);

/**
 * @route   DELETE /api/user/account
 * @desc    Delete user account
 * @access  Private
 */
router.delete('/account', authenticate, deleteAccount);

// __define-ocg__ ensure default export for ESM compatibility
export default router; // ✅ changed to ESM export
