import crypto from 'crypto';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import PlatformSettings from '../models/PlatformSettings.js';
import fetch from 'node-fetch';

/**
 * Verify Fidelity webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - Signature from request headers
 * @returns {boolean}
 */
const verifyFidelitySignature = (payload, signature) => {
  const webhookSecret = process.env.FIDELITY_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error('⚠️ FIDELITY_WEBHOOK_SECRET not configured');
    return false;
  }

  // Create HMAC SHA256 signature
  const computedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  // Compare signatures (timing-safe comparison)
  return crypto.timingSafeEqual(
    Buffer.from(computedSignature),
    Buffer.from(signature)
  );
};

/**
 * Convert NGN to USDT using current exchange rate
 * @param {number} ngnAmount - Amount in NGN
 * @returns {Promise<{usdtAmount: number, exchangeRate: number}>}
 */
const convertNgnToUsdt = async (ngnAmount) => {
  try {
    // Get current NGN to USD exchange rate
    const settings = await PlatformSettings.findOne();
    
    if (!settings || !settings.usdNgnRate) {
      throw new Error('Exchange rate not configured');
    }

    // Calculate: NGN → USD → USDT
    // USDT ≈ USD for pricing purposes
    const usdAmount = ngnAmount / settings.usdNgnRate;
    
    return {
      usdtAmount: parseFloat(usdAmount.toFixed(2)),
      exchangeRate: settings.usdNgnRate
    };
  } catch (error) {
    console.error('❌ Exchange rate conversion error:', error.message);
    throw error;
  }
};

/**
 * Fund Reap account with USDT (via simulation API)
 * @param {number} usdtAmount - Amount in USDT
 * @returns {Promise<{success: boolean, data: Object}>}
 */
const fundReapAccount = async (usdtAmount) => {
  try {
    const reapUrl = 'https://sandbox.payments.reap.global/api/simulate/balances';
    const apiKey = process.env.REAP_PAYMENT_API_KEY;
    const entityId = process.env.REAP_ENTITY_ID;

    if (!apiKey || !entityId) {
      throw new Error('Reap Payment API configuration missing');
    }

    const payload = {
      currency: 'USDT',
      amount: usdtAmount,
      network: 'Polygon PoS' // Default network for USDT
    };

    const response = await fetch(reapUrl, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-reap-api-key': apiKey,
        'x-reap-entity-id': entityId
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(responseData.message || 'Failed to fund Reap account');
    }

    return {
      success: true,
      data: responseData
    };
  } catch (error) {
    console.error('❌ Reap funding error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Handle Fidelity Bank webhook for NGN payment notifications
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const handleFidelityWebhook = async (req, res) => {
  try {
    // Get raw body for signature verification
    const rawBody = JSON.stringify(req.body);
    const signature = req.headers['x-fidelity-signature'];

    // Verify webhook signature
    if (!signature || !verifyFidelitySignature(rawBody, signature)) {
      console.warn('⚠️ Invalid webhook signature');
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }

    // Extract webhook data
    const {
      transactionId,      // Unique transaction ID from Fidelity
      amount,             // NGN amount received
      currency,           // Should be 'NGN'
      status,             // 'success', 'failed', 'pending'
      customerReference,  // Link to user/payment (custom field)
      timestamp,          // When transaction occurred
      description         // Payment description
    } = req.body;

    // Validate required fields
    if (!transactionId || !amount || status !== 'success') {
      console.warn('⚠️ Invalid webhook payload or non-success status');
      return res.status(200).json({
        success: true,
        message: 'Webhook received but not processed'
      });
    }

    if (currency !== 'NGN') {
      console.warn('⚠️ Non-NGN currency received:', currency);
      return res.status(400).json({
        success: false,
        message: 'Only NGN transactions are supported'
      });
    }

    console.log(`💰 Processing Fidelity webhook: ${transactionId} - ${amount} NGN`);

    // Parse customerReference to find user/payment
    // Format: paymentId or userId
    let paymentRecord = null;
    let user = null;

    if (customerReference) {
      // Try to find payment record first
      paymentRecord = await Payment.findById(customerReference);
      if (!paymentRecord) {
        // Try to find user
        user = await User.findById(customerReference);
      } else {
        user = await User.findById(paymentRecord.userId);
      }
    }

    // If no payment/user found, this might be a direct funding request
    if (!user) {
      console.warn('⚠️ Could not identify user from webhook data');
      return res.status(200).json({
        success: true,
        message: 'Webhook received but user not identified'
      });
    }

    // Step 1: Convert NGN to USDT
    const { usdtAmount, exchangeRate } = await convertNgnToUsdt(amount);
    console.log(`📊 Converted: ${amount} NGN → ${usdtAmount} USDT (Rate: ${exchangeRate})`);

    // Step 2: Fund Reap account
    const reapFunding = await fundReapAccount(usdtAmount);
    
    if (!reapFunding.success) {
      console.error('❌ Reap funding failed:', reapFunding.error);
      
      // Log the failed funding attempt but acknowledge webhook
      if (paymentRecord) {
        paymentRecord.status = 'failed';
        paymentRecord.reapErrorMessage = reapFunding.error;
        await paymentRecord.save();
      }

      return res.status(200).json({
        success: true,
        message: 'Webhook processed but Reap funding failed'
      });
    }

    // Step 3: Update payment record if it exists
    if (paymentRecord) {
      paymentRecord.status = 'completed';
      paymentRecord.processedAt = new Date();
      paymentRecord.completedAt = new Date();
      paymentRecord.reapStatus = 'completed';
      paymentRecord.reapRawResponse = reapFunding.data;
      await paymentRecord.save();

      console.log(`✅ Payment record updated: ${paymentRecord._id}`);
    }

    // Log the successful funding event
    console.log(`✅ NGN Funding Complete:
      Transaction ID: ${transactionId}
      User: ${user._id}
      NGN Amount: ${amount}
      USDT Funded: ${usdtAmount}
      Exchange Rate: ${exchangeRate}
      Timestamp: ${timestamp}`);

    // Acknowledge successful webhook processing
    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      data: {
        transactionId,
        ngnAmount: amount,
        usdtFunded: usdtAmount,
        exchangeRate,
        reapResponse: reapFunding.data
      }
    });

  } catch (error) {
    console.error('❌ Webhook processing error:', error.message);
    
    // Always return 200 to acknowledge webhook receipt
    // (Fidelity will retry on non-200 responses)
    res.status(200).json({
      success: false,
      message: 'Webhook processing error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export { handleFidelityWebhook, verifyFidelitySignature, convertNgnToUsdt, fundReapAccount };
