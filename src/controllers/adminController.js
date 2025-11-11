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

export {
  getPendingKycSubmissions,
  deleteUnverifiedUsers,
  deleteAllUsers
};
