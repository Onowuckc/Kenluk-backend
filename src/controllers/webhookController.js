import crypto from 'crypto';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import PlatformSettings from '../models/PlatformSettings.js';
import FidelityPayment from '../models/FidelityPayment.js';

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
 * Handle PayGate Plus webhook for NGN payment notifications
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const handleFidelityWebhook = async (req, res) => {
  try {
    // Extract webhook data from PayGate Plus
    const {
      status,             // 'successful', 'failed', 'pending'
      transaction_ref,    // Transaction reference we sent
      amount,             // Amount in kobo
      customer,           // Customer details
      metadata            // Additional data
    } = req.body;

    console.log(`💰 Processing PayGate Plus webhook: ${transaction_ref} - Status: ${status}`);

    // Only process successful payments
    if (status !== 'successful') {
      console.log(`⚠️ Ignoring non-successful webhook status: ${status}`);
      return res.status(200).json({
        success: true,
        message: 'Webhook received but not processed (non-success status)'
      });
    }

    // Find the Fidelity payment record
    const fidelityPayment = await FidelityPayment.findOne({ paygateTransactionRef: transaction_ref });

    if (!fidelityPayment) {
        console.warn(`⚠️ Fidelity payment not found for paygateTransactionRef: ${transaction_ref}`);
        return res.status(200).json({
            success: true,
            message: 'Webhook received but payment record not found'
        });
    }

    // Check if already processed
    if (fidelityPayment.status === 'Successful') {
        console.log(`⚠️ Payment already processed: ${transaction_ref}`);
        return res.status(200).json({
            success: true,
            message: 'Payment already processed'
        });
    }

    // Update payment record
    fidelityPayment.status = 'Successful';
    fidelityPayment.completedAt = new Date();
    fidelityPayment.fidelityResponse = {
        statusFromAPI: status,
        message: 'Payment completed successfully',
        amount: amount / 100, // Convert from kobo to NGN
        customer,
        metadata
    };

    await fidelityPayment.save();

    // Credit wallet with NGN amount ONLY when status === "Successful"
    const { processFidelityPaymentCompletion } = await import('../services/walletService.js');
    const creditAmount = amount / 100; // Convert from kobo to NGN

    await processFidelityPaymentCompletion(fidelityPayment._id, fidelityPayment.userId);

    console.log(`✅ Wallet credited: User ${fidelityPayment.userId} - ₦${creditAmount}`);

    // Acknowledge successful webhook processing
    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      data: {
        transactionRef: transaction_ref,
        status: 'successful',
        amount: creditAmount,
        userId: fidelityPayment.userId
      }
    });

  } catch (error) {
    console.error('❌ Webhook processing error:', error.message);

    // Always return 200 to acknowledge webhook receipt
    res.status(200).json({
      success: false,
      message: 'Webhook processing error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export { handleFidelityWebhook, verifyFidelitySignature, convertNgnToUsdt };
