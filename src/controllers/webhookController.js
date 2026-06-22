import crypto from 'crypto';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import PlatformSettings from '../models/PlatformSettings.js';
import FidelityPayment from '../models/FidelityPayment.js';
import { sendEmail } from '../config/mailer.js';
import {
  generatePaymentSuccessEmail,
  generatePaymentFailedEmail
} from '../utils/emailTemplates.js';
import {
  pushPaymentSuccess,
  pushPaymentFailed
} from '../services/pushNotificationService.js';

// ─── Reap Payments — Production public key (RSA-SHA512 verification) ──────────
// This is NOT a secret — it is Reap's published public key used to verify
// the reap-signature header on incoming webhook payloads.
const REAP_PUBLIC_KEY_PROD = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA5JUURpniA359qJLwB9JW
6tFAhc4ChqBiGSBaFTkgmK/XCrV8e/N7q57qq4DwymDk5+ALw8D6cKeG2QkWPDeB
n3ly96sR14+8+2GfS7z82A194V9xEpZQfjF6DeMhidFjhINAAzJHPDiM7QCk9Dh4
/Ny065vzZb0O3ek9Ivs6sbmOKXa/pGACN3k30XLkPu2XxBfeZN1rCFhdwE/wa7Bf
h5AKiA104ais19ct5uf4vNkjG5DwevFK9WiqRVxwzadOyXCk4AdksdFx8ZkOuYWh
rCdIt3Dc+pErfKIHloJ7kqA/8kiWWOP6fWbSSWrEtpLX5ieVsXnqhOYq8xA5WvEo
HwIDAQAB
-----END PUBLIC KEY-----`;

// Sandbox key — set REAP_PUBLIC_KEY_SANDBOX env var to override for testing
const REAP_PUBLIC_KEY_SANDBOX = process.env.REAP_PUBLIC_KEY_SANDBOX || REAP_PUBLIC_KEY_PROD;

const getReapPublicKey = () =>
  process.env.NODE_ENV === 'production' ? REAP_PUBLIC_KEY_PROD : REAP_PUBLIC_KEY_SANDBOX;


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

// ─── Reap Payments Webhook Handler ───────────────────────────────────────────

/**
 * Verify the reap-signature header using RSA-SHA512 and Reap's public key.
 * @param {string} rawBody - The raw JSON string of the request body
 * @param {string} signature - Base64-encoded signature from reap-signature header
 * @returns {boolean}
 */
const verifyReapSignature = (rawBody, signature) => {
  try {
    const publicKey = getReapPublicKey();
    const verifier = crypto.createVerify('RSA-SHA512');
    verifier.write(rawBody);
    verifier.end();
    return verifier.verify(publicKey, signature, 'base64');
  } catch (err) {
    console.error('[REAP WEBHOOK] Signature verification threw:', err.message);
    return false;
  }
};

/**
 * Map a Reap payment status to local Payment model statuses.
 *
 * Confirmed Reap status values (from Postman "Simulate Payment Lifecycle"):
 *   payout_completed   — funds successfully sent to recipient  → completed
 *   requires_action    — payment needs an action (documents etc.) → processing
 *   failed             — payment failed                         → failed
 *   cancelled          — payment was cancelled                  → failed
 *
 * Internal Reap statuses that may appear before payout:
 *   draft / awaiting_funds / processing → keep as processing
 *
 * @param {string} payloadStatus - The 'status' field from the Reap webhook payload
 * @returns {{ status: string|null, reapStatus: string }}
 */
const mapReapStatus = (payloadStatus = '') => {
  switch (payloadStatus.toLowerCase()) {
    case 'payout_completed':
      return { status: 'completed', reapStatus: 'completed' };

    case 'failed':
      return { status: 'failed', reapStatus: 'failed' };

    case 'cancelled':
    case 'canceled':
      return { status: 'failed', reapStatus: 'failed' };

    case 'requires_action':
      // Payment needs action (e.g. document upload). Keep local status as-is
      // but record the reapStatus so admin can see it.
      return { status: null, reapStatus: 'processing' };

    case 'draft':
    case 'awaiting_funds':
    case 'processing':
      return { status: null, reapStatus: 'processing' };

    default:
      // Unknown status — log but don't overwrite local status
      return { status: null, reapStatus: 'processing' };
  }
};

/**
 * Handle inbound webhook from Reap Payments.
 * POST /api/webhooks/reap
 *
 * Reap signs every POST with RSA-SHA512 using their private key.
 * We verify with their public key before touching any DB records.
 */
const handleReapWebhook = async (req, res) => {
  const PREFIX = '[REAP WEBHOOK]';

  try {
    // ── 1. Signature verification ────────────────────────────────────────────
    const signature = req.headers['reap-signature'];

    if (!signature) {
      console.warn(`${PREFIX} Missing reap-signature header — rejecting request`);
      // Return 200 anyway so Reap doesn't keep retrying a misconfigured call;
      // but log it clearly.
      return res.status(200).json({
        success: false,
        message: 'Missing reap-signature header'
      });
    }

    // express.json() already parsed the body; we need to re-serialize to the
    // exact string Reap signed (JSON.stringify of what they sent).
    let rawBody = req.body;
    if (Buffer.isBuffer(rawBody)) {
      rawBody = rawBody.toString('utf8');
    } else if (typeof rawBody !== 'string') {
      rawBody = JSON.stringify(rawBody);
    }

    const isValid = verifyReapSignature(rawBody, signature);

    if (!isValid) {
      console.warn(`${PREFIX} Signature verification FAILED — possible spoofed request`);
      return res.status(200).json({
        success: false,
        message: 'Signature verification failed'
      });
    }

    // ── 2. Parse payload ─────────────────────────────────────────────────────
    let payload;
    if (Buffer.isBuffer(req.body)) {
      payload = JSON.parse(rawBody);
    } else if (typeof req.body === 'string') {
      payload = JSON.parse(req.body);
    } else {
      payload = req.body;
    }

    console.log(`${PREFIX} Verified payload received:`, JSON.stringify(payload));

    // Reap webhook payload shape (confirmed from Postman collection):
    // {
    //   eventType: "payment",
    //   eventName: "payment_status_update",
    //   paymentId: "pid_xxx",          ← may also be nested in data
    //   status:    "payout_completed", ← may also be nested in data
    //   data: { paymentId, status, ... }
    // }
    const eventType     = payload.eventType  || payload.event_type  || '';
    const eventName     = payload.eventName  || payload.event_name  || '';
    const reapPaymentId =
      payload.paymentId  ||
      payload.payment_id ||
      payload?.data?.paymentId ||
      payload?.data?.payment_id ||
      '';
    const payloadStatus =
      payload.status ||
      payload?.data?.status ||
      '';

    console.log(`${PREFIX} eventType=${eventType} eventName=${eventName} paymentId=${reapPaymentId} status=${payloadStatus}`);

    if (!reapPaymentId) {
      console.warn(`${PREFIX} No paymentId in payload — ignoring:`, payload);
      return res.status(200).json({ success: true, message: 'Webhook received — no paymentId, ignored' });
    }

    // ── 3. Find the Payment record ───────────────────────────────────────────
    const payment = await Payment.findOne({ reapPaymentId });

    if (!payment) {
      console.warn(`${PREFIX} No Payment found for reapPaymentId: ${reapPaymentId}`);
      return res.status(200).json({ success: true, message: 'Webhook received — payment record not found' });
    }

    // ── 4. Idempotency guard ─────────────────────────────────────────────────
    if (payment.status === 'completed') {
      console.log(`${PREFIX} Payment ${reapPaymentId} already completed — skipping`);
      return res.status(200).json({ success: true, message: 'Payment already completed' });
    }

    // ── 5. Map status and persist ────────────────────────────────────────────
    const { status: newStatus, reapStatus: newReapStatus } = mapReapStatus(payloadStatus);

    payment.reapStatus      = newReapStatus;
    payment.reapRawResponse = payload;         // store full event for audit

    if (newStatus) {
      payment.status = newStatus;
    }

    if (newStatus === 'completed') {
      payment.completedAt = new Date();
    }

    if (newStatus === 'failed') {
      // Capture whatever error/reason Reap provides
      payment.reapErrorMessage =
        payload?.data?.message ||
        payload?.data?.failureReason ||
        payload?.message ||
        `Reap status: ${payloadStatus}`;
    }

    await payment.save();

    // ── Send email and push notification based on the new Reap status ──────────────
    if (newStatus === 'completed' || newStatus === 'failed') {
      try {
        const paymentUser = await User.findById(payment.userId).select('name email');
        if (paymentUser?.email) {
          if (newStatus === 'completed') {
            await sendEmail(
              paymentUser.email,
              '✅ Payment Successful – Official Receipt – Reap by Kenluk',
              generatePaymentSuccessEmail(paymentUser.name, payment)
            );
            console.log(`${PREFIX} [EMAIL] Payment success/receipt email sent to ${paymentUser.email}`);
            
            // Trigger success push notification
            pushPaymentSuccess(payment.userId, payment).catch((e) =>
              console.error(`${PREFIX} [PUSH] Success push error:`, e.message)
            );
          } else {
            await sendEmail(
              paymentUser.email,
              '✖ Payment Failed – Reap by Kenluk',
              generatePaymentFailedEmail(paymentUser.name, payment)
            );
            console.log(`${PREFIX} [EMAIL] Payment failure email sent to ${paymentUser.email}`);
            
            // Trigger failure push notification
            pushPaymentFailed(payment.userId, payment, payment.reapErrorMessage).catch((e) =>
              console.error(`${PREFIX} [PUSH] Failure push error:`, e.message)
            );
          }
        }
      } catch (emailError) {
        // Email/Push errors must not affect webhook response to Reap
        console.error(`${PREFIX} [NOTIFICATION] Failed to send status notification:`, emailError.message);
      }
    }

    console.log(
      `${PREFIX} Payment ${payment._id} (reapId: ${reapPaymentId}) → status: ${payment.status}, reapStatus: ${payment.reapStatus}`
    );

    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      data: { paymentId: payment._id, status: payment.status, reapStatus: payment.reapStatus }
    });

  } catch (error) {
    console.error(`${PREFIX} Unhandled error:`, error.message);
    // Always return 200 so Reap doesn't retry endlessly
    return res.status(200).json({
      success: false,
      message: 'Internal error while processing webhook',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export { handleFidelityWebhook, verifyFidelitySignature, convertNgnToUsdt, handleReapWebhook };
