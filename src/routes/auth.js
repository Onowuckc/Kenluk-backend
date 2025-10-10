import express from 'express';
const router = express.Router();

// Import controllers
import {
  register,
  login,
  verifyEmail,
  resendVerificationCode,
  requestPasswordReset,
  resetPassword,
  logout,
  refreshToken
} from '../controllers/authController.js';

// Import middleware
import {
  validateRegistration,
  validateLogin,
  validateEmailVerification,
  validateResendVerificationCode,
  validatePasswordResetRequest,
  validatePasswordReset
} from '../middleware/validation.js';

import { authenticate } from '../middleware/auth.js';

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', validateRegistration, register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', validateLogin, login);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify user email
 * @access  Public
 */
router.post('/verify-email', validateEmailVerification, verifyEmail);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend verification code
 * @access  Public
 */
router.post('/resend-verification', validateResendVerificationCode, resendVerificationCode);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', validatePasswordResetRequest, requestPasswordReset);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset user password
 * @access  Public
 */
router.post('/reset-password', validatePasswordReset, resetPassword);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticate, logout);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh-token', refreshToken);

export default router; // ✅ changed to ESM export
