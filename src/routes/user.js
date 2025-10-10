import express from 'express';
const router = express.Router();

// Import controllers
import {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  getAllUsers,
  getUserById,
  updateUserById,
  deleteUserById
} from '../controllers/userController.js';

// Import middleware
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validateProfileUpdate } from '../middleware/validation.js';

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticate, getProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authenticate, validateProfileUpdate, updateProfile);

/**
 * @route   PUT /api/users/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put('/change-password', authenticate, changePassword);

/**
 * @route   DELETE /api/users/account
 * @desc    Delete user account
 * @access  Private
 */
router.delete('/account', authenticate, deleteAccount);

/**
 * @route   GET /api/users
 * @desc    Get all users (admin only)
 * @access  Private/Admin
 */
router.get('/', authenticate, requireAdmin, getAllUsers);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID (admin only)
 * @access  Private/Admin
 */
router.get('/:id', authenticate, requireAdmin, getUserById);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user by ID (admin only)
 * @access  Private/Admin
 */
router.put('/:id', authenticate, requireAdmin, updateUserById);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user by ID (admin only)
 * @access  Private/Admin
 */
router.delete('/:id', authenticate, requireAdmin, deleteUserById);

export default router; // ✅ changed to ESM export
