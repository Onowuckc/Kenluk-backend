const express = require('express');
const router = express.Router();

// Import controllers
const { deleteUnverifiedUsers } = require('../controllers/adminController');

// Import middleware
const { authenticate } = require('../middleware/auth');

/**
 * @route   DELETE /api/admin/delete-unverified-users
 * @desc    Delete all unverified users
 * @access  Private (Admin only)
 */
router.delete('/delete-unverified-users', authenticate, deleteUnverifiedUsers);

module.exports = router;
