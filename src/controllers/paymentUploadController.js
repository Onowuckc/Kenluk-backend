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
      bankCode,
      branchCode,
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
      'recipientBankCountry', 'recipientAddress', 'recipientBankAddress', 'bankCode', 'branchCode',
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
      bankCode: bankCode.trim(),
      branchCode: branchCode.trim(),
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
      status: 'pending',
      reapPaymentStatus: 'not_sent'
    });

    await payment.save();

    // Attempt to send to Reap Payment API
    try {
      await sendToReapPaymentAPI(payment);
    } catch (apiError) {
      console.error('Failed to send to Reap Payment API:', apiError);
      // Don't fail the request, just log the error
    }

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
  try {
    const reapPaymentUrl = process.env.REAP_PAYMENT_API_URL;
    const apiKey = process.env.REAP_PAYMENT_API_KEY;

    if (!reapPaymentUrl || !apiKey) {
      console.warn('Reap Payment API configuration missing');
      return;
    }

    const payload = {
      paymentId: payment._id.toString(),
      userId: payment.userId.toString(),
      recipientCompany: payment.recipientCompany,
      recipientBank: payment.recipientBank,
      recipientBankSwiftCode: payment.recipientBankSwiftCode,
      accountNumber: payment.accountNumber,
      recipientBankCountry: payment.recipientBankCountry,
      recipientAddress: payment.recipientAddress,
      recipientBankAddress: payment.recipientBankAddress,
      bankCode: payment.bankCode,
      branchCode: payment.branchCode,
      foreignAmount: payment.foreignAmount,
      foreignCurrency: payment.foreignCurrency,
      localAmount: payment.localAmount,
      exchangeRate: payment.exchangeRate,
      invoiceUrl: await generateInvoiceUrl(payment.invoiceS3Key, payment.invoiceS3Bucket)
    };

    const response = await fetch(reapPaymentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();

    if (response.ok) {
      // Update payment with API response
      payment.reapPaymentId = responseData.paymentId || responseData.id;
      payment.reapPaymentStatus = 'sent';
      payment.reapPaymentResponse = responseData;
      await payment.save();
    } else {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

  } catch (error) {
    console.error('Send to Reap Payment API error:', error);

    // Update payment status to failed
    payment.reapPaymentStatus = 'failed';
    payment.reapPaymentResponse = { error: error.message };
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
  try {
    const { paymentId } = req.params;
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
        message: 'Rejection reason is required when rejecting a payment'
      });
    }

    // Find and update payment
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment request not found'
      });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Payment request has already been reviewed'
      });
    }

    // Update payment
    payment.status = action === 'approve' ? 'approved' : 'rejected';
    payment.approvedBy = adminId;
    payment.approvedAt = new Date();

    if (action === 'reject') {
      payment.rejectionReason = rejectionReason.trim();
    }

    await payment.save();

    res.status(200).json({
      success: true,
      message: `Payment request ${action}d successfully`,
      data: {
        paymentId: payment._id,
        status: payment.status,
        approvedAt: payment.approvedAt,
        rejectionReason: payment.rejectionReason
      }
    });

  } catch (error) {
    console.error('Review payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while reviewing payment'
    });
  }
};

export {
  generateInvoiceUploadUrl,
  submitPaymentRequest,
  getUserPayments,
  getAllPayments,
  reviewPayment
};
