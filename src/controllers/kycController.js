import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import KycDocument from '../models/KycDocument.js';
import User from '../models/User.js';
import s3Client from '../config/s3Client.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate pre-signed URL for file upload to S3
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const generateUploadUrl = async (req, res) => {
  try {
    const { documentType, fileName, fileSize, mimeType, isReupload = false } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!documentType || !fileName || !fileSize || !mimeType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: documentType, fileName, fileSize, mimeType'
      });
    }

    // Validate document type
    const validTypes = ['bvn', 'cac', 'proofOfAddress', 'tin', 'directorInfo', 'passport'];
    if (!validTypes.includes(documentType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document type'
      });
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (fileSize > maxSize) {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds maximum limit of 10MB'
      });
    }

    // Validate MIME type
    const validMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!validMimeTypes.includes(mimeType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only PDF, JPEG, PNG, and JPG files are allowed'
      });
    }

    // Check if user already has a document of this type (allow multiple for directorInfo and reuploads)
    if (documentType !== 'directorInfo' && !isReupload) {
      const existingPending = await KycDocument.findOne({
        userId,
        documentType,
        status: 'pending'
      });

      if (existingPending) {
        return res.status(400).json({
          success: false,
          message: `You already have a ${documentType} document pending approval. Please wait for it to be reviewed before uploading a new one.`
        });
      }

      // Allow uploading even if there's an approved document, as it's a replacement
    }

    // Generate unique S3 key
    const fileExtension = fileName.split('.').pop();
    const s3Key = `kyc/${userId}/${documentType}/${uuidv4()}.${fileExtension}`;
    const bucketName = process.env.S3_BUCKET_NAME;

    // Create S3 command for pre-signed URL
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      ContentType: mimeType,
      Metadata: {
        userId: userId.toString(),
        documentType,
        originalFileName: fileName
      }
    });

    // Generate pre-signed URL (expires in 15 minutes)
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    res.status(200).json({
      success: true,
      message: 'Upload URL generated successfully',
      data: {
        uploadUrl,
        s3Key,
        bucketName,
        expiresIn: 900 // 15 minutes
      }
    });

  } catch (error) {
    console.error('Generate upload URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating upload URL'
    });
  }
};

/**
 * Confirm file upload and save document metadata
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const confirmUpload = async (req, res) => {
  try {
    const { s3Key, bucketName, documentType, fileName, fileSize, mimeType } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!s3Key || !bucketName || !documentType || !fileName || !fileSize || !mimeType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Create document record
    const document = new KycDocument({
      userId,
      documentType,
      fileName: s3Key.split('/').pop(), // Extract filename from S3 key
      originalFileName: fileName,
      s3Key,
      s3Bucket: bucketName,
      fileSize,
      mimeType,
      status: 'pending'
    });

    await document.save();

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully and is pending approval',
      data: {
        documentId: document._id,
        status: document.status,
        uploadedAt: document.uploadedAt
      }
    });

  } catch (error) {
    console.error('Confirm upload error:', error);

    if (error.code === 11000) { // Duplicate key error
      return res.status(400).json({
        success: false,
        message: 'Document already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while confirming upload'
    });
  }
};

/**
 * Get user's KYC documents
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserDocuments = async (req, res) => {
  try {
    const userId = req.user._id;

    const documents = await KycDocument.find({ userId })
      .sort({ uploadedAt: -1 })
      .select('-__v');

    // Generate pre-signed URLs for each document
    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => {
        const command = new GetObjectCommand({
          Bucket: doc.s3Bucket,
          Key: doc.s3Key
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour

        return {
          ...doc.toObject(),
          fileUrl: url
        };
      })
    );

    res.status(200).json({
      success: true,
      data: documentsWithUrls
    });

  } catch (error) {
    console.error('Get user documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving documents'
    });
  }
};

/**
 * Get all pending KYC documents (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPendingDocuments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const documents = await KycDocument.find({ status: 'pending' })
      .populate('userId', 'name email')
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v');

    const total = await KycDocument.countDocuments({ status: 'pending' });

    // Generate pre-signed URLs for each document
    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => {
        const command = new GetObjectCommand({
          Bucket: doc.s3Bucket,
          Key: doc.s3Key
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour

        return {
          ...doc.toObject(),
          fileUrl: url
        };
      })
    );

    res.status(200).json({
      success: true,
      data: documentsWithUrls,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get pending documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving pending documents'
    });
  }
};

/**
 * Approve or reject KYC document (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const reviewDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { action, rejectionReason } = req.body;
    const adminId = req.user._id;

    // Validate action
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "approve" or "reject"'
      });
    }

    // Validate rejection reason if rejecting
    if (action === 'reject' && (!rejectionReason || rejectionReason.trim().length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required when rejecting a document'
      });
    }

    // Find and update document
    const document = await KycDocument.findById(documentId);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    if (document.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Document has already been reviewed'
      });
    }

    // Update document
    document.status = action === 'approve' ? 'approved' : 'rejected';
    document.approvedBy = adminId;
    document.approvedAt = new Date();

    if (action === 'reject') {
      document.rejectionReason = rejectionReason.trim();
    }

    await document.save();

    // If document was approved, check if all required documents are approved
    if (action === 'approve') {
      await checkAndApproveUser(document.userId);
    }

    res.status(200).json({
      success: true,
      message: `Document ${action}d successfully`,
      data: {
        documentId: document._id,
        status: document.status,
        approvedAt: document.approvedAt,
        rejectionReason: document.rejectionReason
      }
    });

  } catch (error) {
    console.error('Review document error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while reviewing document'
    });
  }
};



/**
 * Check if all required documents are approved and approve user
 * @param {ObjectId} userId - User ID
 */
const checkAndApproveUser = async (userId) => {
  try {
    // Check if all required documents are approved
    const requiredTypes = ['bvn', 'cac', 'proofOfAddress', 'tin', 'passport'];

    for (const docType of requiredTypes) {
      const approvedDoc = await KycDocument.findOne({
        userId,
        documentType: docType,
        status: 'approved'
      });

      if (!approvedDoc) {
        // Not all documents are approved yet
        return;
      }
    }

    // All required documents are approved, update user status
    await User.findByIdAndUpdate(userId, {
      isVerified: true,
      verifiedAt: new Date()
    });

    console.log(`User ${userId} has been automatically verified after all documents were approved`);

  } catch (error) {
    console.error('Error in checkAndApproveUser:', error);
  }
};

export {
  generateUploadUrl,
  confirmUpload,
  getUserDocuments,
  getPendingDocuments,
  reviewDocument,
  checkAndApproveUser
};
