// __define-ocg__ keeping it clean & consistent (ESM)
import express from 'express';
const router = express.Router();

// Import controllers
import {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  startTwoFactorSetup,
  confirmTwoFactorSetup,
  disableTwoFactor,
  updateTwoFactorSetting,
  registerPushToken
} from '../controllers/userController.js';

// Import middleware
import { authenticate } from '../middleware/auth.js';
import { validateTwoFactorCode, validateTwoFactorUpdate } from '../middleware/validation.js';

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
 * @route   PUT /api/user/push-token
 * @desc    Register or update the user's Expo push notification token
 * @access  Private
 */
router.put('/push-token', authenticate, registerPushToken);

/**
 * @route   POST /api/users/2fa/setup
 * @desc    Start authenticator app setup
 * @access  Private
 */
router.post('/2fa/setup', authenticate, startTwoFactorSetup);

/**
 * @route   POST /api/users/2fa/confirm
 * @desc    Confirm authenticator app setup
 * @access  Private
 */
router.post('/2fa/confirm', authenticate, validateTwoFactorCode, confirmTwoFactorSetup);

/**
 * @route   POST /api/users/2fa/disable
 * @desc    Disable authenticator app 2FA
 * @access  Private
 */
router.post('/2fa/disable', authenticate, validateTwoFactorCode, disableTwoFactor);

/**
 * @route   PUT /api/users/2fa
 * @desc    Update two-factor authentication settings
 * @access  Private
 */
router.put('/2fa', authenticate, validateTwoFactorUpdate, updateTwoFactorSetting);

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
