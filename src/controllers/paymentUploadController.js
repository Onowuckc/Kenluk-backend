import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import Payment from '../models/Payment.js';
import Beneficiary from '../models/Beneficiary.js';
import PlatformSettings from '../models/PlatformSettings.js';
import s3Client from '../config/s3Client.js';
import { v4 as uuidv4 } from 'uuid';
import fetch, { Blob, FormData } from 'node-fetch';

const readEnvValue = (name) => {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim().replace(/^["']|["']$/g, '') : value;
};

const maskValue = (value) => {
  if (!value) return '[MISSING]';
  return value.length > 8 ? `***${value.slice(-4)}` : '[PRESENT]';
};

const getReapApiBaseUrl = () => {
  const configuredUrl = readEnvValue('REAP_PAYMENT_API_URL') || 'https://payments.reap.global/api/payments';
  return configuredUrl.replace(/\/payments\/?$/, '').replace(/\/$/, '');
};

const defaultInvoiceDetails = {
  originalPayerName: 'Your Company Name',
  originalPayerAddress: {
    streetAddress: '123 Main St',
    city: 'Hong Kong',
    state: 'HK',
    country: 'HK',
    postalCode: '000000'
  }
};

const normalizeInvoiceDetails = (invoiceDetails = {}) => ({
  originalPayerName:
    invoiceDetails?.originalPayerName?.trim?.() ||
    defaultInvoiceDetails.originalPayerName,
  originalPayerAddress: {
    streetAddress:
      invoiceDetails?.originalPayerAddress?.streetAddress?.trim?.() ||
      defaultInvoiceDetails.originalPayerAddress.streetAddress,
    city:
      invoiceDetails?.originalPayerAddress?.city?.trim?.() ||
      defaultInvoiceDetails.originalPayerAddress.city,
    state:
      invoiceDetails?.originalPayerAddress?.state?.trim?.() ||
      defaultInvoiceDetails.originalPayerAddress.state,
    country:
      invoiceDetails?.originalPayerAddress?.country?.trim?.() ||
      defaultInvoiceDetails.originalPayerAddress.country,
    postalCode:
      invoiceDetails?.originalPayerAddress?.postalCode?.trim?.() ||
      defaultInvoiceDetails.originalPayerAddress.postalCode
  }
});

const getReapTraceHeaders = (headers) => {
  const names = [
    'x-request-id',
    'x-correlation-id',
    'x-reap-request-id',
    'request-id',
    'cf-ray'
  ];

  return names.reduce((traceHeaders, name) => {
    const value = headers.get(name);
    if (value) {
      traceHeaders[name] = value;
    }
    return traceHeaders;
  }, {});
};

const bodyToBuffer = async (body) => {
  if (!body) return Buffer.alloc(0);
  if (typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray());
  }

  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const uploadInvoiceToReapPayment = async (payment, reapPaymentId, apiKey, entityId) => {
  if (!payment.invoiceS3Key || !payment.invoiceS3Bucket || !reapPaymentId) {
    console.warn('[REAP DEBUG] Skipping Reap invoice upload - missing invoice S3 data or Reap payment ID');
    return null;
  }

  const command = new GetObjectCommand({
    Bucket: payment.invoiceS3Bucket,
    Key: payment.invoiceS3Key
  });

  const s3Object = await s3Client.send(command);
  const invoiceBuffer = await bodyToBuffer(s3Object.Body);
  const invoiceBlob = new Blob([invoiceBuffer], {
    type: payment.invoiceMimeType || s3Object.ContentType || 'application/octet-stream'
  });

  const formData = new FormData();
  formData.append('files', invoiceBlob, payment.invoiceOriginalFileName || payment.invoiceFileName || 'invoice');

  const documentsUrl = `${getReapApiBaseUrl()}/payments/${reapPaymentId}/documents`;
  const headers = {
    Accept: 'application/json',
    'x-reap-api-key': apiKey,
    'x-reap-entity-id': entityId
  };

  console.log('[REAP DEBUG] Reap invoice upload URL:', documentsUrl);
  console.log('[REAP DEBUG] Reap invoice upload headers (API key masked):', {
    Accept: headers.Accept,
    'x-reap-api-key': maskValue(apiKey),
    'x-reap-entity-id': entityId
  });
  console.log('[REAP DEBUG] Reap invoice upload file:', {
    fileName: payment.invoiceOriginalFileName || payment.invoiceFileName,
    mimeType: payment.invoiceMimeType || s3Object.ContentType,
    size: invoiceBuffer.length
  });

  const response = await fetch(documentsUrl, {
    method: 'POST',
    headers,
    body: formData
  });

  let data;
  try {
    data = await response.json();
  } catch (parseError) {
    data = {
      parseError: parseError.message,
      rawText: await response.text().catch(() => '')
    };
  }

  const result = {
    status: response.status,
    statusText: response.statusText,
    traceHeaders: getReapTraceHeaders(response.headers),
    data,
    timestamp: new Date().toISOString()
  };

  console.log('[REAP DEBUG] Reap invoice upload response status:', response.status);
  console.log('[REAP DEBUG] Reap invoice upload response data:', JSON.stringify(data, null, 2));

  if (!response.ok) {
    throw new Error(data?.message || `Invoice upload failed with HTTP ${response.status}`);
  }

  return result;
};

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
      exchangeRate,
      invoiceDetails
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

    // CRITICAL: Validate exchange rate matches admin-configured rate
    // Only validate for USD→NGN conversions
    if (foreignCurrency === 'USD') {
      let adminSettings = await PlatformSettings.findOne();
      
      if (!adminSettings) {
        return res.status(400).json({
          success: false,
          message: 'Exchange rates not configured by platform admin'
        });
      }

      // Allow 1% tolerance for floating point differences
      const tolerance = adminSettings.usdToNgnRate * 0.01;
      const expectedRate = adminSettings.usdToNgnRate;
      
      if (Math.abs(exchangeRate - expectedRate) > tolerance) {
        return res.status(400).json({
          success: false,
          message: `Exchange rate mismatch. Expected rate: ${expectedRate.toFixed(2)}, Provided rate: ${exchangeRate.toFixed(2)}. Rates are set by platform admin and cannot be modified.`,
          data: {
            expectedRate: expectedRate,
            providedRate: exchangeRate
          }
        });
      }
    }

    const normalizedInvoiceDetails = normalizeInvoiceDetails(invoiceDetails);

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
        invoiceDetails: normalizedInvoiceDetails,
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
      invoiceDetails: normalizedInvoiceDetails,
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
const sendToReapPaymentAPI = async (payment, options = {}) => {
  const { updatePaymentStatus = false } = options;
  console.log(`[REAP DEBUG] Starting Reap API call for payment ${payment._id}`);

  try {
    // Log environment variables presence (not values)
    const envVars = {
      REAP_PAYMENT_API_URL: !!process.env.REAP_PAYMENT_API_URL,
      REAP_PAYMENT_API_KEY: !!process.env.REAP_PAYMENT_API_KEY,
      REAP_ENTITY_ID: !!process.env.REAP_ENTITY_ID
    };
    console.log('[REAP DEBUG] Environment variables check:', envVars);

    const reapPaymentUrl = readEnvValue('REAP_PAYMENT_API_URL') || 'https://payments.reap.global/api/payments';
    const apiKey = readEnvValue('REAP_PAYMENT_API_KEY');
    const entityId = readEnvValue('REAP_ENTITY_ID');

    if (!apiKey || !entityId) {
      console.error('[REAP DEBUG] Reap Payment API configuration missing - REAP_PAYMENT_API_KEY or REAP_ENTITY_ID not set');
      throw new Error('Missing Reap API configuration');
    }

    // Convert country name to alpha-2 code for Reap API
    const countryCodeMap = {
      'china': 'CN',
      'hong kong': 'HK',
      'hongkong': 'HK',
      'hong kong sar': 'HK',
      'nigeria': 'NG',
      'united states': 'US',
      'united states of america': 'US',
      'united kingdom': 'GB',
      'great britain': 'GB',
      'england': 'GB',
      'germany': 'DE',
      'france': 'FR',
      'japan': 'JP',
      'canada': 'CA',
      'australia': 'AU',
      'switzerland': 'CH'
    };

    const rawProviderCountry = (payment.recipientBankCountry || '').trim();
    const normalizedProviderCountryKey = rawProviderCountry.toLowerCase();
    const providerCountry =
      countryCodeMap[normalizedProviderCountryKey] ||
      (rawProviderCountry.length === 2 ? rawProviderCountry.toUpperCase() : rawProviderCountry);
    const receivingCurrency = payment.foreignCurrency;
    const isHongKong = providerCountry === 'HK';
    const network = isHongKong && ['HKD', 'GBP'].includes(receivingCurrency) ? 'FPS' : 'SWIFT';

    if (isHongKong && !['HKD', 'GBP'].includes(receivingCurrency)) {
      console.warn(`[REAP DEBUG] Hong Kong recipient currency ${receivingCurrency} is not FPS-compatible, falling back to SWIFT`);
    }

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
              country: providerCountry,
            networkIdentifier: network === 'FPS' ? (payment.bankCode || '004') : payment.recipientBankSwiftCode
            },
            addresses: [
              {
                type: 'postal',
                street: payment.recipientBankAddress,
                city: payment.recipientAddress.split(',')[0]?.trim() || payment.recipientAddress,
                state: providerCountry,
                country: providerCountry,
                postalCode: '00000' // Default since we don't collect this
              }
            ]
          }
        ]
      },
      payment: {
        receivingAmount: payment.foreignAmount,
        receivingCurrency: receivingCurrency,
        senderCurrency: 'USDC', // Use USDC as sender currency (stablecoin)
        description: `Payment to ${payment.recipientCompany}`,
        purposeOfPayment: 'payment_for_goods',
        invoiceDetails: normalizeInvoiceDetails(payment.invoiceDetails),
        metadata: {
          key: `Invoice: ${payment.invoiceOriginalFileName}`
        }
      }
    };

    // Store payload snapshot for debugging
    payment.reapPayloadSnapshot = payload;
    await payment.save();

    const outboundHeaders = {
      'Content-Type': 'application/json;schema=PAAS',
      'Accept': 'application/vnd.api+json; version=1.0.0',
      'x-reap-api-key': apiKey,
      'x-reap-entity-id': entityId
    };

    console.log('[REAP DEBUG] Reap API URL:', reapPaymentUrl);
    console.log('[REAP DEBUG] Request headers (API key masked):', {
      'Content-Type': outboundHeaders['Content-Type'],
      'Accept': outboundHeaders['Accept'],
      'x-reap-api-key': maskValue(apiKey),
      'x-reap-entity-id': outboundHeaders['x-reap-entity-id']
    });
    console.log('[REAP DEBUG] Payload snapshot:', JSON.stringify(payload, null, 2));

    const timeoutMs = 15000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetch(reapPaymentUrl, {
        method: 'POST',
        headers: outboundHeaders,
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
      const text = await response.text().catch(() => '');
      responseData = {
        parseError: parseError.message,
        rawText: text
      };
    }

    // Store response snapshot
    const traceHeaders = getReapTraceHeaders(response.headers);
    payment.reapResponseSnapshot = {
      status: response.status,
      statusText: response.statusText,
      traceHeaders,
      data: responseData,
      timestamp: new Date().toISOString()
    };
    await payment.save();

    console.log('[REAP DEBUG] Reap API response status:', response.status);
    console.log('[REAP DEBUG] Reap API trace headers:', JSON.stringify(traceHeaders, null, 2));
    console.log('[REAP DEBUG] Reap API response data:', JSON.stringify(responseData, null, 2));

    if (response.ok) {
      // Update payment with API response
      payment.reapPaymentId = responseData.paymentId;
      payment.reapStatus = 'sent';
      payment.reapErrorMessage = undefined;
      payment.reapRawResponse = responseData;
      if (updatePaymentStatus) {
        payment.status = 'submitted_to_reap';
      }
      await payment.save();
      console.log('[REAP DEBUG] Payment successfully sent to Reap API:', payment.reapPaymentId);

      const reapQuoteStatus = responseData.status?.toLowerCase();
      if (reapQuoteStatus === 'draft') {
        payment.reapDocumentUploadResponse = {
          skipped: 'Invoice upload skipped because Reap payment is still draft. Approve the payment quote before uploading documents.',
          reapQuoteStatus,
          timestamp: new Date().toISOString()
        };
        await payment.save();
        console.log('[REAP DEBUG] Reap invoice upload skipped: payment quote is draft; approve quote before uploading documents.');
      } else {
        try {
          const documentUploadResult = await uploadInvoiceToReapPayment(payment, payment.reapPaymentId, apiKey, entityId);
          if (documentUploadResult) {
            payment.reapDocumentUploadResponse = documentUploadResult;
            await payment.save();
          }
        } catch (documentError) {
          payment.reapDocumentUploadResponse = {
            error: documentError.message,
            timestamp: new Date().toISOString()
          };
          await payment.save();
          console.error('[REAP DEBUG] Reap invoice upload failed:', documentError.message);
        }
      }
    } else {
      // Handle API error
      let errorMessage = responseData.message || `HTTP ${response.status}: ${response.statusText}`;
      if (response.status === 403) {
        errorMessage = `${errorMessage}. Reap rejected the production credentials; verify the API key belongs to REAP_ENTITY_ID, the entity is enabled for payments, and any production IP allowlist includes this server.`;
      }
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

const performReapPaymentAction = async (payment, action, message, apiKey, entityId) => {
  if (!payment.reapPaymentId) {
    throw new Error('Payment does not have a Reap payment ID');
  }

  const actionUrl = `${getReapApiBaseUrl()}/payments/${payment.reapPaymentId}/action`;
  const payload = {
    type: 'payment',
    action
  };

  if (message) {
    payload.message = message;
  }

  const outboundHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-reap-api-key': apiKey,
    'x-reap-entity-id': entityId
  };

  console.log('[REAP DEBUG] Reap payment action URL:', actionUrl);
  console.log('[REAP DEBUG] Reap payment action headers (API key masked):', {
    'Content-Type': outboundHeaders['Content-Type'],
    Accept: outboundHeaders['Accept'],
    'x-reap-api-key': maskValue(apiKey),
    'x-reap-entity-id': entityId
  });
  console.log('[REAP DEBUG] Reap payment action payload:', JSON.stringify(payload, null, 2));

  const response = await fetch(actionUrl, {
    method: 'PUT',
    headers: outboundHeaders,
    body: JSON.stringify(payload)
  });

  let data;
  try {
    data = await response.json();
  } catch (parseError) {
    data = {
      parseError: parseError.message,
      rawText: await response.text().catch(() => '')
    };
  }

  const result = {
    status: response.status,
    statusText: response.statusText,
    traceHeaders: getReapTraceHeaders(response.headers),
    data,
    timestamp: new Date().toISOString()
  };

  console.log('[REAP DEBUG] Reap payment action response status:', response.status);
  console.log('[REAP DEBUG] Reap payment action response data:', JSON.stringify(data, null, 2));

  if (!response.ok) {
    throw new Error(data?.message || `Reap payment action failed with HTTP ${response.status}`);
  }

  return result;
};

const reapPaymentAction = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { action, message } = req.body;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment request not found'
      });
    }

    if (!payment.reapPaymentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment has not been submitted to Reap yet'
      });
    }

    const apiKey = readEnvValue('REAP_PAYMENT_API_KEY');
    const entityId = readEnvValue('REAP_ENTITY_ID');

    if (!apiKey || !entityId) {
      return res.status(500).json({
        success: false,
        message: 'Reap API configuration is missing'
      });
    }

    const actionResult = await performReapPaymentAction(payment, action, message, apiKey, entityId);
    payment.reapActionResponse = actionResult;

    let uploadResult = null;
    let uploadError = null;
    if (['approve', 'accept_quote'].includes(action)) {
      try {
        uploadResult = await uploadInvoiceToReapPayment(payment, payment.reapPaymentId, apiKey, entityId);
        if (uploadResult) {
          payment.reapDocumentUploadResponse = uploadResult;
        }
      } catch (documentError) {
        uploadError = documentError.message;
        payment.reapDocumentUploadResponse = {
          error: documentError.message,
          timestamp: new Date().toISOString()
        };
      }
    }

    await payment.save();

    return res.status(200).json({
      success: true,
      message: 'Reap payment action completed successfully',
      data: {
        paymentId: payment._id,
        action,
        reapActionResponse: actionResult,
        invoiceUploadResponse: uploadResult,
        invoiceUploadError: uploadError || undefined
      }
    });
  } catch (error) {
    console.error('Reap payment action error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while performing Reap payment action'
    });
  }
};

/**
 * Admin: Check whether Reap credentials are accepted before sending a payment.
 */
const checkReapHealth = async (req, res) => {
  try {
    const apiKey = readEnvValue('REAP_PAYMENT_API_KEY');
    const entityId = readEnvValue('REAP_ENTITY_ID');
    const reapUrl = `${getReapApiBaseUrl()}/account-info`;

    if (!apiKey || !entityId) {
      return res.status(500).json({
        success: false,
        message: 'Missing Reap API configuration',
        data: {
          apiKey: maskValue(apiKey),
          entityId: maskValue(entityId)
        }
      });
    }

    const response = await fetch(reapUrl, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-reap-api-key': apiKey,
        'x-reap-entity-id': entityId
      }
    });

    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
      responseData = {
        parseError: parseError.message,
        rawText: await response.text().catch(() => '')
      };
    }

    return res.status(response.ok ? 200 : response.status).json({
      success: response.ok,
      message: response.ok
        ? 'Reap credentials accepted'
        : 'Reap credentials check failed',
      data: {
        url: reapUrl,
        status: response.status,
        statusText: response.statusText,
        traceHeaders: getReapTraceHeaders(response.headers),
        apiKey: maskValue(apiKey),
        entityId: maskValue(entityId),
        response: responseData
      }
    });
  } catch (error) {
    console.error('Reap health check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while checking Reap credentials',
      error: error.message
    });
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

const sanitizePaymentForUser = (payment) => {
  const safePayment = payment.toObject ? payment.toObject() : { ...payment };
  delete safePayment.reapPaymentId;
  delete safePayment.reapRawResponse;
  delete safePayment.reapStatus;
  delete safePayment.reapErrorMessage;
  delete safePayment.reapDocumentUploadResponse;
  delete safePayment.reapActionResponse;
  delete safePayment.reapError;
  delete safePayment.reapQuoteStatus;
  return safePayment;
};

const upsertBeneficiaryFromPayment = async (payment) => {
  await Beneficiary.findOneAndUpdate(
    {
      userId: payment.userId,
      recipientBankSwiftCode: payment.recipientBankSwiftCode,
      accountNumber: payment.accountNumber
    },
    {
      $set: {
      recipientCompany: payment.recipientCompany,
      recipientBank: payment.recipientBank,
      recipientBankSwiftCode: payment.recipientBankSwiftCode,
      accountNumber: payment.accountNumber,
      recipientBankCountry: payment.recipientBankCountry,
      recipientAddress: payment.recipientAddress,
      recipientBankAddress: payment.recipientBankAddress,
      lastUsedAt: new Date()
      },
      $inc: { useCount: 1 }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
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
          ...sanitizePaymentForUser(payment),
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

    if (payment.status !== 'pending_admin_approval') {
      return res.status(400).json({
        success: false,
        message: 'Payment request has already been reviewed'
      });
    }

    // Update payment
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    payment.status = newStatus;
    payment.approvedBy = adminId;
    payment.approvedAt = new Date();

    if (action === 'reject') {
      payment.rejectionReason = rejectionReason.trim();
    }

    await payment.save();
    try {
      await upsertBeneficiaryFromPayment(payment);
    } catch (beneficiaryError) {
      console.error('Beneficiary upsert warning:', beneficiaryError.message);
    }

    let reapStatus = payment.reapStatus;
    let reapError = payment.reapErrorMessage || null;
    if (action === 'approve') {
      try {
        await sendToReapPaymentAPI(payment, { updatePaymentStatus: true });
      reapStatus = payment.reapStatus || 'sent';
      reapError = null;
    } catch (error) {
      console.error('Failed to send approved payment to Reap:', error.message);
      reapStatus = payment.reapStatus || 'failed';
      reapError = payment.reapErrorMessage || error.message;
    }
  }

    res.status(200).json({
      success: true,
      message: `Payment request ${action}d successfully`,
      data: {
        paymentId: payment._id,
        status: payment.status,
        approvedAt: payment.approvedAt,
        rejectionReason: payment.rejectionReason,
        reapStatus,
        reapError
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

/**
 * Get a fresh invoice URL for view/download (user or admin)
 * @param {Object} req
 * @param {Object} res
 */
const getPaymentInvoiceUrl = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user?._id;

    const payment = await Payment.findById(paymentId).select(
      'userId invoiceS3Key invoiceS3Bucket invoiceOriginalFileName invoiceFileName'
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment request not found'
      });
    }

    if (payment.userId.toString() !== userId.toString() && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const invoiceUrl = await generateInvoiceUrl(payment.invoiceS3Key, payment.invoiceS3Bucket);

    return res.status(200).json({
      success: true,
      data: {
        invoiceUrl,
        fileName: payment.invoiceOriginalFileName || payment.invoiceFileName
      }
    });
  } catch (error) {
    console.error('Get payment invoice URL error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while generating invoice URL'
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

    const paymentData = req.user.isAdmin ? payment.toObject() : sanitizePaymentForUser(payment);

    res.status(200).json({
      success: true,
      data: {
        ...paymentData,
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
        await sendToReapPaymentAPI(payment, { updatePaymentStatus: true });
        reapStatus = payment.reapStatus || 'sent';
        reapError = null;
      } catch (error) {
        console.error('Failed to send to Reap API:', error);
        reapStatus = payment.reapStatus || 'failed';
        reapError = payment.reapErrorMessage || error.message;
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
 * Retry sending an approved payment to Reap (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const retryReapSubmission = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment request not found'
      });
    }

    if (!['approved', 'submitted_to_reap'].includes(payment.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only approved or previously submitted payments can be retried for Reap submission'
      });
    }

    let reapStatus = payment.reapStatus || 'not_sent';
    let reapError = null;

    try {
      await sendToReapPaymentAPI(payment, { updatePaymentStatus: true });
      reapStatus = payment.reapStatus || 'sent';
      reapError = null;
    } catch (error) {
      console.error('Retry Reap submission failed:', error.message);
      reapStatus = payment.reapStatus || 'failed';
      reapError = payment.reapErrorMessage || error.message;
    }

    return res.status(200).json({
      success: true,
      message:
        reapStatus === 'sent'
          ? 'Payment successfully submitted to Reap'
          : 'Reap submission failed. Check error details.',
      data: {
        paymentId: payment._id,
        status: payment.status,
        reapStatus,
        reapError
      }
    });
  } catch (error) {
    console.error('Retry Reap submission error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while retrying Reap submission'
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
      reapStatus = payment.reapStatus || 'sent';
      reapError = null;
    } catch (err) {
      console.error('Failed to send to Reap API:', err);
      reapStatus = payment.reapStatus || 'failed';
      reapError = payment.reapErrorMessage || err.message;
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

/**
 * Complete payment after "reap success"
 * Allows admins to manually mark payments as completed
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const completePayment = async (req, res) => {
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

    // Payment can only be completed if it's in processing status
    if (payment.status !== 'processing') {
      return res.status(400).json({
        success: false,
        message: 'Only payments in processing status can be marked as completed'
      });
    }

    // Update payment status to completed
    payment.status = 'completed';
    payment.completedBy = adminId;
    payment.completedAt = new Date();

    await payment.save();

    res.status(200).json({
      success: true,
      message: 'Payment marked as completed successfully',
      data: {
        paymentId: payment._id,
        status: payment.status,
        completedAt: payment.completedAt
      }
    });

  } catch (error) {
    console.error('Complete payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while completing payment'
    });
  }
};

/**
 * Get structured payment receipt (owner/admin)
 * GET /api/payments/:paymentId/receipt
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPaymentReceipt = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user._id;
    const isAdmin = req.user.role === 'admin';

    const payment = await Payment.findById(paymentId).populate('userId', 'name email');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment request not found'
      });
    }

    // Check authorization: only admin or the user who created it
    if (!isAdmin && payment.userId._id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const receiptData = {
      receiptId: payment._id,
      date: payment.completedAt || payment.updatedAt,
      status: payment.status,
      recipientCompany: payment.recipientCompany,
      accountNumber: payment.accountNumber,
      bankName: payment.recipientBank,
      foreignAmount: payment.foreignAmount,
      foreignCurrency: payment.foreignCurrency,
      localAmount: payment.localAmount,
      localCurrency: 'NGN',
      exchangeRate: payment.exchangeRate,
      user: {
        name: payment.userId.name,
        email: payment.userId.email
      }
    };

    if (isAdmin) {
      receiptData.reapPaymentId = payment.reapPaymentId;
      receiptData.reapStatus = payment.reapStatus;
      receiptData.reapErrorMessage = payment.reapErrorMessage || null;
    }

    res.status(200).json({
      success: true,
      data: receiptData
    });

  } catch (error) {
    console.error('Get payment receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving payment receipt',
      error: error.message
    });
  }
};

/**
 * Download payment receipt text file (owner/admin)
 * GET /api/payments/:paymentId/receipt/download
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const downloadPaymentReceipt = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user._id;
    const isAdmin = req.user.role === 'admin';

    const payment = await Payment.findById(paymentId).populate('userId', 'name email');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment request not found'
      });
    }

    // Check authorization: only admin or the user who created it
    if (!isAdmin && payment.userId._id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Generate receipt text
    const dateStr = new Date(payment.completedAt || payment.updatedAt).toLocaleString();
    const reapIdStr = isAdmin && payment.reapPaymentId ? `\nReap Payment ID:    ${payment.reapPaymentId}` : '';
    const reapStatusStr = isAdmin && payment.reapStatus ? `\nReap Status:        ${payment.reapStatus.toUpperCase()}` : '';
    const errorStr = isAdmin && payment.reapErrorMessage ? `\nReap Error:         ${payment.reapErrorMessage}` : '';
    
    const receiptText = `
======================================================
               KENLUK PAYMENT RECEIPT
======================================================

Transaction ID:     ${payment._id}${reapIdStr}
Date:               ${dateStr}
Status:             ${payment.status.toUpperCase()}${reapStatusStr}${errorStr}

------------------------------------------------------
SENDER INFORMATION
------------------------------------------------------
Name:               ${payment.userId.name}
Email:              ${payment.userId.email}

------------------------------------------------------
RECIPIENT INFORMATION
------------------------------------------------------
Company/Name:       ${payment.recipientCompany}
Bank Name:          ${payment.recipientBank}
Account Number:     ${payment.accountNumber}
SWIFT Code:         ${payment.recipientBankSwiftCode}
Country:            ${payment.recipientBankCountry}

------------------------------------------------------
TRANSACTION DETAILS
------------------------------------------------------
Sent Amount:        ${payment.foreignCurrency} ${payment.foreignAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Local Amount:       NGN ${payment.localAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Exchange Rate:      ${payment.exchangeRate}

======================================================
     Thank you for using Kenluk Payment Services
======================================================
`.trim();

    // Set headers for file download
    const fileName = `payment-receipt-${isAdmin && payment.reapPaymentId ? payment.reapPaymentId : payment._id}.txt`;
    res.setHeader('Content-disposition', `attachment; filename=${fileName}`);
    res.setHeader('Content-type', 'text/plain');
    
    res.send(receiptText);

  } catch (error) {
    console.error('Download payment receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading payment receipt',
      error: error.message
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
  getPaymentInvoiceUrl,
  actionPayment,
  retryReapSubmission,
  checkReapHealth,
  uploadPaymentDocuments,
  approvePayment,
  completePayment,
  sendToReapPaymentAPI,
  reapPaymentAction,
  getPaymentReceipt,
  downloadPaymentReceipt
};
