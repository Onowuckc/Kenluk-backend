import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import Payment from '../models/Payment.js';
import s3Client from '../config/s3Client.js';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';

/**
 * Generate pre-signed URL for invoice upload to S3
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const generateInvoiceUploadUrl = async (req, res) => {
  try {
    const { fileName, fileSize, mimeType } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!fileName || !fileSize || !mimeType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: fileName, fileSize, mimeType'
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

    // Generate unique S3 key
    const fileExtension = fileName.split('.').pop();
    const s3Key = `invoices/${userId}/${uuidv4()}.${fileExtension}`;
    const bucketName = process.env.S3_BUCKET_NAME;

    // Create S3 command for pre-signed URL
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      ContentType: mimeType,
      Metadata: {
        userId: userId.toString(),
        documentType: 'invoice',
        originalFileName: fileName
      }
    });

    // Generate pre-signed URL (expires in 15 minutes)
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    res.status(200).json({
      success: true,
      message: 'Invoice upload URL generated successfully',
      data: {
        uploadUrl,
        s3Key,
        bucketName,
        expiresIn: 900 // 15 minutes
      }
    });

  } catch (error) {
    console.error('Generate invoice upload URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating upload URL'
    });
  }
};

/**
 * Submit payment request with invoice
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const submitPaymentRequest = async (req, res) => {
  try {
    const {
      recipientCompany,
      recipientBank,
      recipientBankSwiftCode,
      accountNumber,
      recipientBankCountry,
      recipientAddress,
      recipientBankAddress,
      invoiceS3Key,
      invoiceBucketName,
      invoiceFileName,
      invoiceFileSize,
      invoiceMimeType,
      foreignAmount,
      foreignCurrency,
      localAmount,
      exchangeRate
    } = req.body;

    const userId = req.user._id;

    // Validate required fields
    const requiredFields = [
      'recipientCompany', 'recipientBank', 'recipientBankSwiftCode', 'accountNumber',
      'recipientBankCountry', 'recipientAddress', 'recipientBankAddress',
      'invoiceS3Key', 'invoiceBucketName', 'invoiceFileName', 'invoiceFileSize', 'invoiceMimeType',
      'foreignAmount', 'foreignCurrency', 'localAmount', 'exchangeRate'
    ];

    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate amounts
    if (foreignAmount <= 0 || localAmount <= 0 || exchangeRate <= 0) {
      return res.status(400).json({
        success: false,
        message: 'All amounts and exchange rate must be positive numbers'
      });
    }

    // Validate supported currencies
    const supportedCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'JPY', 'CNY', 'NGN'];
    if (!supportedCurrencies.includes(foreignCurrency)) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported foreign currency'
      });
    }

    // Build Reap payload for snapshot
    const reapPayload = {
      receivingParty: {
        type: 'company',
        name: {
          name: recipientCompany.trim()
        },
        accounts: [{
          type: 'bank',
          identifier: {
            standard: 'account_number',
            value: accountNumber.trim()
          },
          network: 'SWIFT',
          currencies: [foreignCurrency],
          provider: {
            name: recipientBank.trim(),
            country: recipientBankCountry.trim(),
            networkIdentifier: recipientBankSwiftCode.trim()
          },
          addresses: [{
            type: 'postal',
            street: recipientBankAddress.trim(),
            city: recipientAddress.split(',')[0]?.trim() || recipientAddress.trim(),
            state: recipientBankCountry.trim(),
            country: recipientBankCountry.trim(),
            postalCode: '00000'
          }]
        }]
      },
      payment: {
        receivingAmount: foreignAmount,
        receivingCurrency: foreignCurrency,
        senderCurrency: foreignCurrency,
        description: `Payment to ${recipientCompany.trim()}`,
        purposeOfPayment: 'payment_for_goods',
        metadata: {
          key: `Invoice: ${invoiceFileName}`
        }
      }
    };

    // Create payment record
    const payment = new Payment({
      userId,
      recipientCompany: recipientCompany.trim(),
      recipientBank: recipientBank.trim(),
      recipientBankSwiftCode: recipientBankSwiftCode.trim(),
      accountNumber: accountNumber.trim(),
      recipientBankCountry: recipientBankCountry.trim(),
      recipientAddress: recipientAddress.trim(),
      recipientBankAddress: recipientBankAddress.trim(),
      invoiceFileName: invoiceS3Key.split('/').pop(),
      invoiceOriginalFileName: invoiceFileName,
      invoiceS3Key,
      invoiceS3Bucket: invoiceBucketName,
      invoiceFileSize,
      invoiceMimeType,
      foreignAmount,
      foreignCurrency,
      localAmount,
      exchangeRate,
      status: 'pending_admin_approval',
      reapPayloadSnapshot: reapPayload
    });

    await payment.save();

    res.status(201).json({
      success: true,
      message: 'Payment request submitted successfully',
      data: {
        paymentId: payment._id,
        status: payment.status,
        submittedAt: payment.submittedAt
      }
    });

  } catch (error) {
    console.error('Submit payment request error:', error);

    if (error.code === 11000) { // Duplicate key error
      return res.status(400).json({
        success: false,
        message: 'Duplicate payment request'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while submitting payment request'
    });
  }
};

/**
 * Send payment details to Reap Payment API
 * @param {Object} payment - Payment document
 */
const sendToReapPaymentAPI = async (payment) => {
  console.log(`[REAP DEBUG] Starting Reap API call for payment ${payment._id}`);

  try {
    // Log environment variables presence (not values)
    const envVars = {
      REAP_PAYMENT_API_URL: !!process.env.REAP_PAYMENT_API_URL,
      REAP_PAYMENT_API_KEY: !!process.env.REAP_PAYMENT_API_KEY,
      REAP_ENTITY_ID: !!process.env.REAP_ENTITY_ID
    };
    console.log('[REAP DEBUG] Environment variables check:', envVars);

    const reapPaymentUrl = process.env.REAP_PAYMENT_API_URL || 'https://sandbox.payments.reap.global/api/payments';
    const apiKey = process.env.REAP_PAYMENT_API_KEY;
    const entityId = process.env.REAP_ENTITY_ID;

    if (!apiKey || !entityId) {
      console.error('[REAP DEBUG] Reap Payment API configuration missing - REAP_PAYMENT_API_KEY or REAP_ENTITY_ID not set');
      throw new Error('Missing Reap API configuration');
    }

    // Determine network and currency based on bank country
    const network = payment.recipientBankCountry === 'HK' ? 'FPS' : 'SWIFT';
    // FPS only supports HKD or GBP, so use HKD for Hong Kong payments
    const receivingCurrency = payment.recipientBankCountry === 'HK' ? 'HKD' : payment.foreignCurrency;

    // Build Reap API payload according to Postman collection
    const payload = {
      receivingParty: {
        type: 'company',
        name: {
          name: payment.recipientCompany
        },
        accounts: [
          {
            type: 'bank',
            identifier: {
              standard: 'account_number',
              value: payment.accountNumber
            },
            network: network,
            currencies: [receivingCurrency],
            provider: {
              name: payment.recipientBank,
              country: payment.recipientBankCountry,
            networkIdentifier: network === 'FPS' ? (payment.bankCode || '004') : payment.recipientBankSwiftCode
            },
            addresses: [
              {
                type: 'postal',
                street: payment.recipientBankAddress,
                city: payment.recipientAddress.split(',')[0]?.trim() || payment.recipientAddress,
                state: payment.recipientBankCountry,
                country: payment.recipientBankCountry,
                postalCode: '00000' // Default since we don't collect this
              }
            ]
          }
        ]
      },
      payment: {
        receivingAmount: payment.foreignAmount,
        receivingCurrency: receivingCurrency,
        senderCurrency: 'USDT', // Use USDT as sender currency (stablecoin)
        description: `Payment to ${payment.recipientCompany}`,
        purposeOfPayment: 'payment_for_goods',
        metadata: {
          key: `Invoice: ${payment.invoiceOriginalFileName}`
        }
      }
    };

    // Store payload snapshot for debugging
    payment.reapPayloadSnapshot = payload;
    await payment.save();

    console.log('[REAP DEBUG] Reap API URL:', reapPaymentUrl);
    console.log('[REAP DEBUG] Request headers (excluding secrets):', {
      'Content-Type': 'application/json;schema=PAAS',
      'Accept': 'application/vnd.api+json; version=1.0.0',
      'x-reap-api-key': '[PRESENT]',
      'x-reap-entity-id': '[PRESENT]'
    });
    console.log('[REAP DEBUG] Payload snapshot:', JSON.stringify(payload, null, 2));

    const response = await fetch(reapPaymentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;schema=PAAS',
        'Accept': 'application/vnd.api+json; version=1.0.0',
        'x-reap-api-key': apiKey,
        'x-reap-entity-id': entityId
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();

    // Store response snapshot
    payment.reapResponseSnapshot = {
      status: response.status,
      statusText: response.statusText,
      data: responseData,
      timestamp: new Date().toISOString()
    };
    await payment.save();

    console.log('[REAP DEBUG] Reap API response status:', response.status);
    console.log('[REAP DEBUG] Reap API response data:', JSON.stringify(responseData, null, 2));

    if (response.ok) {
      // Update payment with API response
      payment.reapPaymentId = responseData.paymentId;
      payment.reapStatus = 'sent';
      payment.reapRawResponse = responseData;
      payment.status = 'submitted_to_reap'; // Update status to reflect successful submission
      await payment.save();
      console.log('[REAP DEBUG] Payment successfully sent to Reap API:', payment.reapPaymentId);
    } else {
      // Handle API error
      const errorMessage = responseData.message || `HTTP ${response.status}: ${response.statusText}`;
      payment.reapStatus = 'failed';
      payment.reapErrorMessage = errorMessage;
      payment.reapRawResponse = responseData;
      await payment.save();
      console.error('[REAP DEBUG] Reap API error:', errorMessage);
      throw new Error(`Reap API error: ${errorMessage}`);
    }

  } catch (error) {
    console.error('[REAP DEBUG] Send to Reap Payment API error:', error.message);

    // Update payment status to failed
    payment.reapStatus = 'failed';
    payment.reapErrorMessage = error.message;
    payment.reapRawResponse = { error: error.message };
    await payment.save();

    throw error;
  }
};

/**
 * Generate pre-signed URL for invoice
 * @param {string} s3Key - S3 key
 * @param {string} bucketName - S3 bucket name
 * @returns {string} Pre-signed URL
 */
const generateInvoiceUrl = async (s3Key, bucketName) => {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: s3Key
  });

  return await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
};

/**
 * Get user's payment requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserPayments = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const payments = await Payment.find({ userId })
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v');

    const total = await Payment.countDocuments({ userId });

    // Generate pre-signed URLs for invoices
    const paymentsWithUrls = await Promise.all(
      payments.map(async (payment) => {
        const invoiceUrl = await generateInvoiceUrl(payment.invoiceS3Key, payment.invoiceS3Bucket);

        return {
          ...payment.toObject(),
          invoiceUrl
        };
      })
    );

    res.status(200).json({
      success: true,
      data: paymentsWithUrls,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get user payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving payments'
    });
  }
};

/**
 * Get all payment requests (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllPayments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status; // Optional status filter

    const query = status ? { status } : {};

    const payments = await Payment.find(query)
      .populate('userId', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v');

    const total = await Payment.countDocuments(query);

    // Generate pre-signed URLs for invoices
    const paymentsWithUrls = await Promise.all(
      payments.map(async (payment) => {
        const invoiceUrl = await generateInvoiceUrl(payment.invoiceS3Key, payment.invoiceS3Bucket);

        return {
          ...payment.toObject(),
          invoiceUrl
        };
      })
    );

    res.status(200).json({
      success: true,
      data: paymentsWithUrls,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get all payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving payments'
    });
  }
};

/**
 * Review payment request (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const reviewPayment = async (req, res) => {
  console.log(`[REVIEW DEBUG] Starting reviewPayment for paymentId: ${req.params.paymentId}, action: ${req.body.action}, adminId: ${req.user._id}`);

  try {
    const { paymentId } = req.params;
    const { action, rejectionReason } = req.body;
    const adminId = req.user._id;

    // Validate action
    if (!['approve', 'reject'].includes(action)) {
      console.log(`[REVIEW DEBUG] Invalid action: ${action}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "approve" or "reject"'
      });
    }

    // Validate rejection reason if rejecting
    if (action === 'reject' && (!rejectionReason || rejectionReason.trim().length === 0)) {
      console.log(`[REVIEW DEBUG] Missing rejection reason for reject action`);
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required when rejecting a payment'
      });
    }

    // Find and update payment
    console.log(`[REVIEW DEBUG] Finding payment ${paymentId}`);
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      console.log(`[REVIEW DEBUG] Payment ${paymentId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Payment request not found'
      });
    }

    console.log(`[REVIEW DEBUG] Payment found with status: ${payment.status}`);

    if (payment.status !== 'pending_admin_approval') {
      console.log(`[REVIEW DEBUG] Payment status is ${payment.status}, not pending_admin_approval`);
      return res.status(400).json({
        success: false,
        message: 'Payment request has already been reviewed'
      });
    }

    // Update payment
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    console.log(`[REVIEW DEBUG] Updating payment status from ${payment.status} to ${newStatus}`);
    payment.status = newStatus;
    payment.approvedBy = adminId;
    payment.approvedAt = new Date();

    if (action === 'reject') {
      payment.rejectionReason = rejectionReason.trim();
    }

    await payment.save();
    console.log(`[REVIEW DEBUG] Payment saved with new status: ${payment.status}`);

    // If approved, send to Reap Payment API
    let reapStatus = null;
    let reapError = null;
    if (action === 'approve') {
      console.log(`[REVIEW DEBUG] Action is approve, calling sendToReapPaymentAPI`);
      try {
        await sendToReapPaymentAPI(payment);
        reapStatus = 'success';
        console.log(`[REVIEW DEBUG] Reap API call successful`);
      } catch (error) {
        console.error('[REVIEW DEBUG] Failed to send to Reap API:', error);
        reapStatus = 'failed';
        reapError = error.message;
        // Don't fail the approval if Reap API fails
      }
    } else {
      console.log(`[REVIEW DEBUG] Action is ${action}, skipping Reap API call`);
    }

    console.log(`[REVIEW DEBUG] Sending response with reapStatus: ${reapStatus}, reapError: ${reapError ? 'present' : 'null'}`);

    res.status(200).json({
      success: true,
      message: `Payment request ${action}d successfully`,
      data: {
        paymentId: payment._id,
        status: payment.status,
        approvedAt: payment.approvedAt,
        rejectionReason: payment.rejectionReason,
        reapStatus: reapStatus,
        reapError: reapError
      }
    });

  } catch (error) {
    console.error('[REVIEW DEBUG] Review payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while reviewing payment'
    });
  }
};

/**
 * Get payment by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPaymentById = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user._id;

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment request not found'
      });
    }

    // Check if user owns this payment or is admin
    if (payment.userId.toString() !== userId.toString() && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Generate pre-signed URL for invoice
    const invoiceUrl = await generateInvoiceUrl(payment.invoiceS3Key, payment.invoiceS3Bucket);

    res.status(200).json({
      success: true,
      data: {
        ...payment.toObject(),
        invoiceUrl
      }
    });

  } catch (error) {
    console.error('Get payment by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving payment'
    });
  }
};

/**
 * Action payment (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const actionPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { action } = req.body;
    const adminId = req.user._id;

    // Validate action
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "approve" or "reject"'
      });
    }

    // Find payment
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment request not found'
      });
    }

    if (payment.status !== 'pending_admin_approval') {
      return res.status(400).json({
        success: false,
        message: 'Payment request has already been reviewed'
      });
    }

    // Update payment
    payment.status = action === 'approve' ? 'approved' : 'rejected';
    payment.approvedBy = adminId;
    payment.approvedAt = new Date();

    await payment.save();

    // If approved, send to Reap Payment API
    let reapStatus = null;
    let reapError = null;
    if (action === 'approve') {
      try {
        await sendToReapPaymentAPI(payment);
        reapStatus = 'success';
      } catch (error) {
        console.error('Failed to send to Reap API:', error);
        reapStatus = 'failed';
        reapError = error.message;
        // Don't fail the approval if Reap API fails
      }
    }

    res.status(200).json({
      success: true,
      message: `Payment request ${action}d successfully`,
      data: {
        paymentId: payment._id,
        status: payment.status,
        approvedAt: payment.approvedAt,
        reapStatus: reapStatus,
        reapError: reapError
      }
    });

  } catch (error) {
    console.error('Action payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing payment action'
    });
  }
};

/**
 * Upload payment documents
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const uploadPaymentDocuments = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { documentType, fileName, fileSize, mimeType } = req.body;
    const userId = req.user._id;

    // Find payment
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment request not found'
      });
    }

    // Check if user owns this payment
    if (payment.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
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

    // Generate unique S3 key
    const fileExtension = fileName.split('.').pop();
    const s3Key = `payment-documents/${userId}/${paymentId}/${uuidv4()}.${fileExtension}`;
    const bucketName = process.env.S3_BUCKET_NAME;

    // Create S3 command for pre-signed URL
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      ContentType: mimeType,
      Metadata: {
        userId: userId.toString(),
        paymentId: paymentId,
        documentType: documentType || 'additional',
        originalFileName: fileName
      }
    });

    // Generate pre-signed URL (expires in 15 minutes)
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    res.status(200).json({
      success: true,
      message: 'Document upload URL generated successfully',
      data: {
        uploadUrl,
        s3Key,
        bucketName,
        expiresIn: 900 // 15 minutes
      }
    });

  } catch (error) {
    console.error('Upload payment documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating upload URL'
    });
  }
};

/**
 * Approve payment (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const approvePayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const adminId = req.user._id;

    // Find payment
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment request not found'
      });
    }

    if (payment.status !== 'pending_admin_approval') {
      return res.status(400).json({
        success: false,
        message: 'Payment request has already been reviewed'
      });
    }

    // Update payment status to approved
    payment.status = 'approved';
    payment.approvedBy = adminId;
    payment.approvedAt = new Date();

    await payment.save();

    // Send to Reap Payment API
    let reapStatus = null;
    let reapError = null;
    try {
      await sendToReapPaymentAPI(payment);
      reapStatus = 'success';
    } catch (reapError) {
      console.error('Failed to send to Reap API:', reapError);
      reapStatus = 'failed';
      reapError = reapError.message;
      // Don't fail the approval if Reap API fails
    }

    res.status(200).json({
      success: true,
      message: 'Payment request approved successfully',
      data: {
        paymentId: payment._id,
        status: payment.status,
        approvedAt: payment.approvedAt,
        reapStatus: reapStatus,
        reapError: reapError
      }
    });

  } catch (error) {
    console.error('Approve payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while approving payment'
    });
  }
};

export {
  generateInvoiceUploadUrl,
  submitPaymentRequest,
  getUserPayments,
  getAllPayments,
  reviewPayment,
  getPaymentById,
  actionPayment,
  uploadPaymentDocuments,
  approvePayment
};
