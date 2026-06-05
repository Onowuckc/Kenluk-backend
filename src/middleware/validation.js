import { body, validationResult } from 'express-validator';

/**
 * Handle validation errors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.param,
        message: error.msg,
        value: error.value
      }))
    });
  }

  next();
};

/**
 * Validation rules for user registration
 */
const validateRegistration = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),

  handleValidationErrors
];

/**
 * Validation rules for user login
 */
const validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  handleValidationErrors
];

/**
 * Validation rules for email verification
 */
const validateEmailVerification = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('otp')
    .notEmpty()
    .withMessage('Verification code is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('Verification code must be 6 digits')
    .matches(/^\d{6}$/)
    .withMessage('Verification code must contain only digits'),

  handleValidationErrors
];

/**
 * Validation rules for resend verification code
 */
const validateResendVerificationCode = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  handleValidationErrors
];

/**
 * Validation rules for password reset request
 */
const validatePasswordResetRequest = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  handleValidationErrors
];

/**
 * Validation rules for password reset
 */
const validatePasswordReset = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),

  body('password')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),

  handleValidationErrors
];

/**
 * Validation rules for user profile update
 */
const validateProfileUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  handleValidationErrors
];

/**
 * Validation rules for KYC document upload URL generation
 */
const validateKycUploadUrl = [
  body('documentType')
    .notEmpty()
    .withMessage('Document type is required')
    .isIn(['bvn', 'cac', 'proofOfAddress', 'tin', 'directorInfo', 'passport'])
    .withMessage('Invalid document type'),

  body('fileName')
    .notEmpty()
    .withMessage('File name is required')
    .matches(/\.(pdf|jpeg|jpg|png)$/i)
    .withMessage('File must be PDF, JPEG, PNG, or JPG'),

  body('fileSize')
    .isInt({ min: 1, max: 10 * 1024 * 1024 }) // 10MB max
    .withMessage('File size must be between 1 byte and 10MB'),

  body('mimeType')
    .isIn(['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'])
    .withMessage('Invalid MIME type'),

  handleValidationErrors
];

/**
 * Validation rules for KYC document upload confirmation
 */
const validateKycConfirmUpload = [
  body('s3Key')
    .notEmpty()
    .withMessage('S3 key is required'),

  body('bucketName')
    .notEmpty()
    .withMessage('Bucket name is required'),

  body('documentType')
    .notEmpty()
    .withMessage('Document type is required')
    .isIn(['bvn', 'cac', 'proofOfAddress', 'tin', 'directorInfo', 'passport'])
    .withMessage('Invalid document type'),

  body('fileName')
    .notEmpty()
    .withMessage('File name is required'),

  body('fileSize')
    .isInt({ min: 1, max: 10 * 1024 * 1024 }) // 10MB max
    .withMessage('File size must be between 1 byte and 10MB'),

  body('mimeType')
    .isIn(['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'])
    .withMessage('Invalid MIME type'),

  handleValidationErrors
];

/**
 * Validation rules for document review
 */
const validateDocumentReview = [
  body('action')
    .isIn(['approve', 'reject'])
    .withMessage('Action must be either "approve" or "reject"'),

  body('rejectionReason')
    .if(body('action').equals('reject'))
    .notEmpty()
    .withMessage('Rejection reason is required when rejecting')
    .isLength({ min: 10, max: 500 })
    .withMessage('Rejection reason must be between 10 and 500 characters'),

  handleValidationErrors
];

/**
 * Validation rules for invoice upload URL generation
 */
const validateInvoiceUploadUrl = [
  body('fileName')
    .notEmpty()
    .withMessage('File name is required')
    .matches(/\.(pdf|jpeg|jpg|png)$/i)
    .withMessage('File must be PDF, JPEG, PNG, or JPG'),

  body('fileSize')
    .isInt({ min: 1, max: 10 * 1024 * 1024 }) // 10MB max
    .withMessage('File size must be between 1 byte and 10MB'),

  body('mimeType')
    .isIn(['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'])
    .withMessage('Invalid MIME type'),

  handleValidationErrors
];

/**
 * Validation rules for payment request submission
 */
const validatePaymentSubmission = [
  body('recipientCompany')
    .trim()
    .notEmpty()
    .withMessage('Recipient company is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Recipient company must be between 2 and 100 characters'),

  body('recipientBank')
    .trim()
    .notEmpty()
    .withMessage('Recipient bank is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Recipient bank must be between 2 and 100 characters'),

  body('recipientBankSwiftCode')
    .trim()
    .notEmpty()
    .withMessage('SWIFT code is required')
    .matches(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/)
    .withMessage('Invalid SWIFT code format'),

  body('accountNumber')
    .trim()
    .notEmpty()
    .withMessage('Account number is required')
    .isLength({ min: 8, max: 34 })
    .withMessage('Account number must be between 8 and 34 characters'),

  body('recipientBankCountry')
    .trim()
    .notEmpty()
    .withMessage('Recipient bank country is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Country must be between 2 and 50 characters'),

  body('recipientAddress')
    .trim()
    .notEmpty()
    .withMessage('Recipient address is required')
    .isLength({ min: 10, max: 200 })
    .withMessage('Address must be between 10 and 200 characters'),

  body('recipientBankAddress')
    .trim()
    .notEmpty()
    .withMessage('Recipient bank address is required')
    .isLength({ min: 10, max: 200 })
    .withMessage('Bank address must be between 10 and 200 characters'),



  body('invoiceS3Key')
    .notEmpty()
    .withMessage('Invoice S3 key is required'),

  body('invoiceBucketName')
    .notEmpty()
    .withMessage('Invoice bucket name is required'),

  body('invoiceFileName')
    .notEmpty()
    .withMessage('Invoice file name is required'),

  body('invoiceFileSize')
    .isInt({ min: 1, max: 10 * 1024 * 1024 }) // 10MB max
    .withMessage('Invoice file size must be between 1 byte and 10MB'),

  body('invoiceMimeType')
    .isIn(['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'])
    .withMessage('Invalid invoice MIME type'),

  body('foreignAmount')
    .isFloat({ min: 0.01 })
    .withMessage('Foreign amount must be greater than 0'),

  body('foreignCurrency')
    .isIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'JPY', 'CNY', 'NGN'])
    .withMessage('Invalid foreign currency'),

  body('localAmount')
    .isFloat({ min: 0.01 })
    .withMessage('Local amount must be greater than 0'),

  body('exchangeRate')
    .isFloat({ min: 0.01 })
    .withMessage('Exchange rate must be greater than 0'),

  handleValidationErrors
];

/**
 * Validation rules for payment review
 */
const validatePaymentReview = [
  body('action')
    .isIn(['approve', 'reject'])
    .withMessage('Action must be either "approve" or "reject"'),

  body('rejectionReason')
    .if(body('action').equals('reject'))
    .notEmpty()
    .withMessage('Rejection reason is required when rejecting')
    .isLength({ min: 10, max: 500 })
    .withMessage('Rejection reason must be between 10 and 500 characters'),

  handleValidationErrors
];

const validateReapAction = [
  body('action')
    .isIn(['approve', 'accept_quote', 'cancel'])
    .withMessage('Action must be one of "approve", "accept_quote", or "cancel"'),

  body('message')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Message must be 500 characters or less'),

  handleValidationErrors
];

export {
  handleValidationErrors,
  validateRegistration,
  validateLogin,
  validateEmailVerification,
  validateResendVerificationCode,
  validatePasswordResetRequest,
  validatePasswordReset,
  validateProfileUpdate,
  validateKycUploadUrl,
  validateKycConfirmUpload,
  validateDocumentReview,
  validateInvoiceUploadUrl,
  validatePaymentSubmission,
  validatePaymentReview,
  validateReapAction
};
