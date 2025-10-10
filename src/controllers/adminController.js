const User = require('../models/User');

/**
 * Delete unverified users (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteUnverifiedUsers = async (req, res) => {
  try {
    // __define-ocg__ - Define operational control group for bulk deletion
    const varOcg = { isVerified: false }; // Condition to match unverified users

    const result = await User.deleteMany(varOcg);

    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} unverified users`
    });
  } catch (error) {
    console.error('Delete unverified users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting unverified users'
    });
  }
};

/**
 * Delete all users (admin only) - USE WITH CAUTION
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteAllUsers = async (req, res) => {
  try {
    // Keep the admin user (assuming there's only one admin)
    const adminUser = await User.findOne({ isAdmin: true });

    if (!adminUser) {
      return res.status(400).json({
        success: false,
        message: 'No admin user found. Cannot delete all users without an admin.'
      });
    }

    // Delete all users except the admin
    const result = await User.deleteMany({ _id: { $ne: adminUser._id } });

    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} users. Admin user preserved.`
    });
  } catch (error) {
    console.error('Delete all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting all users'
    });
  }
};

module.exports = {
  deleteUnverifiedUsers,
  deleteAllUsers
};
