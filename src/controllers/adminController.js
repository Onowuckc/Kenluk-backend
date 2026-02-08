import User from '../models/User.js';
import KycDocument from '../models/KycDocument.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import s3Client from '../config/s3Client.js';

/**
 * Get pending KYC submissions grouped by user (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPendingKycSubmissions = async (req, res) => {
  try {
    // Get all pending KYC documents with user details
    const pendingDocuments = await KycDocument.find({ status: 'pending' })
      .populate('userId', 'name email companyName')
      .sort({ uploadedAt: -1 });

    // Group documents by user
    const groupedSubmissions = {};

    for (const doc of pendingDocuments) {
      const userId = doc.userId._id.toString();

      if (!groupedSubmissions[userId]) {
        groupedSubmissions[userId] = {
          user: {
            _id: doc.userId._id,
            name: doc.userId.name,
            email: doc.userId.email,
            companyName: doc.userId.companyName
          },
          documents: [],
          submittedAt: doc.uploadedAt
        };
      }

      // Generate presigned URL for the document
      const command = new GetObjectCommand({
        Bucket: doc.s3Bucket,
        Key: doc.s3Key
      });

      const fileUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour

      groupedSubmissions[userId].documents.push({
        _id: doc._id,
        documentType: doc.documentType,
        fileName: doc.fileName,
        originalFileName: doc.originalFileName,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        uploadedAt: doc.uploadedAt,
        fileUrl
      });
    }

    // Convert to array format
    const submissions = Object.values(groupedSubmissions);

    res.status(200).json({
      success: true,
      data: submissions
    });

  } catch (error) {
    console.error('Get pending KYC submissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving pending KYC submissions'
    });
  }
};

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

/**
 * Get admin dashboard statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getDashboardStats = async (req, res) => {
  try {
    // Get total users count
    const totalUsers = await User.countDocuments();

    // Get pending registrations (unverified users)
    const pendingRegistrations = await User.countDocuments({ isVerified: false });

    // Get pending KYC documents
    const pendingDocuments = await KycDocument.countDocuments({ status: 'pending' });

    // Get pending payments (assuming Payment model exists)
    let pendingPayments = 0;
    try {
      const Payment = (await import('../models/Payment.js')).default;
      pendingPayments = await Payment.countDocuments({ status: 'pending' });
    } catch (error) {
      // Payment model might not exist yet, continue with 0
      console.log('Payment model not available for dashboard stats');
    }

    // Get recent activity (last 10 activities)
    const recentUsers = await User.find({ isVerified: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email createdAt');

    const recentDocuments = await KycDocument.find({ status: 'approved' })
      .populate('userId', 'name')
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('documentType userId updatedAt');

    // Format recent activity
    const recentActivity = [
      ...recentUsers.map(user => ({
        type: 'registration',
        message: `${user.name} completed registration`,
        time: user.createdAt
      })),
      ...recentDocuments.map(doc => ({
        type: 'document',
        message: `${doc.userId?.name || 'User'} document approved`,
        time: doc.updatedAt
      }))
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 10);

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalUsers,
          pendingRegistrations,
          pendingDocuments,
          pendingPayments
        },
        recentActivity
      }
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving dashboard statistics'
    });
  }
};

/**
 * Get all users (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select('-password -__v')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalUsers = await User.countDocuments();
    const totalPages = Math.ceil(totalUsers / limit);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: page,
          totalPages,
          totalUsers,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving users'
    });
  }
};

/**
 * Get user by ID (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password -__v');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving user'
    });
  }
};

/**
 * Update user (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Prevent updating sensitive fields
    delete updates.password;
    delete updates.isAdmin;
    delete updates.__v;

    const user = await User.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).select('-password -__v');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user,
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating user'
    });
  }
};

/**
 * Approve user account (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const approveAccount = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.accountStatus === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Account is already approved'
      });
    }

    user.accountStatus = 'approved';
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Account approved successfully',
      data: {
        userId: user._id,
        accountStatus: user.accountStatus
      }
    });
  } catch (error) {
    console.error('Approve account error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while approving account'
    });
  }
};

/**
 * Reject user account (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const rejectAccount = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason must be at least 10 characters long'
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.accountStatus === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Account is already rejected'
      });
    }

    user.accountStatus = 'rejected';
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Account rejected successfully',
      data: {
        userId: user._id,
        accountStatus: user.accountStatus,
        rejectionReason: reason.trim()
      }
    });
  } catch (error) {
    console.error('Reject account error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while rejecting account'
    });
  }
};

/**
 * Delete user (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is admin
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete admin user'
      });
    }

    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting user'
    });
  }
};

/**
 * Get virtual accounts for admin (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getVirtualAccounts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    const skip = (page - 1) * limit;

    // Import FidelityPayment model
    const FidelityPayment = (await import('../models/FidelityPayment.js')).default;

    // Build query
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const virtualAccounts = await FidelityPayment.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('userId virtualAccount amount status createdAt updatedAt');

    const totalRecords = await FidelityPayment.countDocuments(query);
    const totalPages = Math.ceil(totalRecords / limit);

    // Format response
    const formattedAccounts = virtualAccounts.map(account => ({
      _id: account._id,
      userId: account.userId?._id,
      userEmail: account.userId?.email || 'N/A',
      userName: account.userId?.name || 'N/A',
      accountNumber: account.virtualAccount?.accountNumber,
      accountName: account.virtualAccount?.accountName,
      bankName: account.virtualAccount?.bankName,
      reference: account.virtualAccount?.reference,
      amount: account.amount,
      status: account.status,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt
    }));

    res.status(200).json({
      success: true,
      data: {
        virtualAccounts: formattedAccounts,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get virtual accounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving virtual accounts'
    });
  }
};

/**
 * Cleanup stale virtual accounts (admin only)
 * POST /api/admin/virtual-accounts/cleanup-stale
 */
const cleanupFailedVirtualAccounts = async (req, res) => {
  try {
    const FidelityPayment = (await import('../models/FidelityPayment.js')).default;

    const result = await FidelityPayment.updateMany(
      {
        status: 'WAITING_FOR_TRANSFER',
        $or: [
          { 'virtualAccount.status': { $in: ['FAILED', 'Failed'] } },
          { 'virtualAccount.accountNumber': { $exists: false } },
          { 'virtualAccount.accountNumber': null }
        ]
      },
      {
        $set: {
          status: 'FAILED',
          'virtualAccount.status': 'FAILED'
        }
      }
    );

    res.status(200).json({
      success: true,
      message: 'Stale virtual accounts cleaned up',
      data: {
        matched: result.matchedCount || result.n,
        modified: result.modifiedCount || result.nModified
      }
    });
  } catch (error) {
    console.error('Cleanup stale virtual accounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cleaning up virtual accounts'
    });
  }
};

/**
 * Manually complete a virtual account funding (admin only)
 * POST /api/admin/virtual-accounts/:paymentId/complete
 */
const completeVirtualAccountManually = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const FidelityPayment = (await import('../models/FidelityPayment.js')).default;

    const payment = await FidelityPayment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Virtual account payment not found'
      });
    }

    if (payment.status === 'COMPLETED') {
      return res.status(200).json({
        success: true,
        message: 'Payment already completed',
        data: {
          paymentId: payment._id,
          status: payment.status
        }
      });
    }

    if (payment.status !== 'WAITING_FOR_TRANSFER') {
      return res.status(400).json({
        success: false,
        message: `Cannot complete payment in status ${payment.status}`
      });
    }

    // Mark completed and credit wallet using existing service logic
    payment.status = 'COMPLETED';
    payment.completedAt = new Date();
    await payment.save();

    const { processFidelityPaymentCompletion } = await import('../services/walletService.js');
    await processFidelityPaymentCompletion(payment._id, payment.userId);

    return res.status(200).json({
      success: true,
      message: 'Payment completed and wallet credited',
      data: {
        paymentId: payment._id,
        status: payment.status
      }
    });
  } catch (error) {
    console.error('Manual completion error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while completing payment'
    });
  }
};

export {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  approveAccount,
  rejectAccount,
  getPendingKycSubmissions,
  deleteUnverifiedUsers,
  deleteAllUsers,
  getDashboardStats,
  getVirtualAccounts,
  cleanupFailedVirtualAccounts,
  completeVirtualAccountManually
};
