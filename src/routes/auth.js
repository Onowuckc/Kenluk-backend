import express from 'express';
const router = express.Router();

// Import controllers
import {
  register,
  login,
  adminLogin,
  verifyEmail,
  verifyTwoFactor,
  resendVerificationCode,
  requestPasswordReset,
  resetPassword,
  logout,
  verify,
  refreshToken,
  getUsdcNgnRate
} from '../controllers/authController.js';

// Import middleware
import {
  validateRegistration,
  validateLogin,
  validateEmailVerification,
  validateVerifyTwoFactor,
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
 * @route   POST /api/auth/verify-2fa
 * @desc    Verify user two-factor authentication code
 * @access  Public
 */
router.post('/verify-2fa', validateVerifyTwoFactor, verifyTwoFactor);

/**
 * @route   POST /api/auth/resend-2fa
 * @desc    Resend the two-factor authentication code
 * @access  Public
 */
router.post('/resend-2fa', validateResendVerificationCode, resendTwoFactorCode);

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

/**
 * @route   POST /api/auth/admin/login
 * @desc    Admin login
 * @access  Public
 */
router.post('/admin/login', validateLogin, adminLogin);

/**
 * @route   GET /api/auth/usdc-ngn
 * @desc    Get USDC to NGN exchange rate
 * @access  Public
 */
router.get('/usdc-ngn', getUsdcNgnRate);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify authentication token and return user data
 * @access  Public (for frontend token verification)
 */
router.get('/verify', verify);

export default router; // ✅ changed to ESM export
