/**
 * pushNotificationService.js
 *
 * Sends push notifications to mobile devices via the Expo Push Notification API.
 * This is completely non-fatal — any failure is logged but never throws,
 * so it can never break payment processing.
 *
 * Expo Push API docs: https://docs.expo.dev/push-notifications/sending-notifications/
 */

import fetch from 'node-fetch';
import User from '../models/User.js';

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

/**
 * Validates that a string looks like a valid Expo push token.
 * @param {string} token
 * @returns {boolean}
 */
const isValidExpoPushToken = (token) => {
  return (
    typeof token === 'string' &&
    (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))
  );
};

/**
 * Send a push notification to a single user by their MongoDB userId.
 *
 * @param {string} userId       - The MongoDB ObjectId string of the target user
 * @param {string} title        - Notification title (shown in bold on device)
 * @param {string} body         - Notification body text
 * @param {Object} [data={}]    - Optional extra data payload (available in notification handler)
 * @returns {Promise<void>}
 */
export const sendPushToUser = async (userId, title, body, data = {}) => {
  try {
    // 1. Look up user's stored Expo push token
    const user = await User.findById(userId).select('expoPushToken name email');
    if (!user) {
      console.warn(`[PUSH] User ${userId} not found, skipping push notification.`);
      return;
    }

    const { expoPushToken } = user;

    if (!expoPushToken) {
      console.log(`[PUSH] User ${user.email} has no registered push token, skipping.`);
      return;
    }

    if (!isValidExpoPushToken(expoPushToken)) {
      console.warn(`[PUSH] User ${user.email} has an invalid push token format: ${expoPushToken}`);
      return;
    }

    // 2. Build the Expo push message
    const message = {
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data: {
        ...data,
        userId: userId.toString(),
      },
      // Android channel (matches channel created in notificationService.ts)
      channelId: 'payment-alerts',
      // Badge count increment (iOS)
      badge: 1,
    };

    // 3. POST to Expo Push API
    const response = await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[PUSH] Expo API returned ${response.status}: ${errorText}`);
      return;
    }

    const result = await response.json();
    const ticket = result?.data;

    if (ticket?.status === 'error') {
      console.error(`[PUSH] Expo delivery error for ${user.email}: ${ticket.message}`);

      // If the token is no longer valid, clear it from the user record
      if (ticket.details?.error === 'DeviceNotRegistered') {
        console.log(`[PUSH] Clearing invalid push token for ${user.email}`);
        await User.findByIdAndUpdate(userId, { expoPushToken: null });
      }
    } else {
      console.log(`[PUSH] Notification sent to ${user.email} — ticket: ${ticket?.id || 'ok'}`);
    }
  } catch (err) {
    // Non-fatal: log and swallow so payment processing is never affected
    console.error(`[PUSH] Failed to send push notification to user ${userId}:`, err.message);
  }
};

/**
 * Convenience wrappers for common payment notification scenarios.
 * All are non-fatal and safe to call from any controller.
 */

export const pushPaymentInitiated = (userId, payment) =>
  sendPushToUser(
    userId,
    '⏳ Payment Request Received',
    `Your transfer of ${payment.foreignCurrency} ${Number(payment.foreignAmount).toLocaleString()} to ${payment.recipientCompany} is pending admin review.`,
    { screen: 'history', paymentId: payment._id?.toString(), type: 'payment_initiated' }
  );

export const pushPaymentSuccess = (userId, payment) =>
  sendPushToUser(
    userId,
    '✅ Payment Successful!',
    `Your transfer of ${payment.foreignCurrency} ${Number(payment.foreignAmount).toLocaleString()} to ${payment.recipientCompany} has been completed.`,
    { screen: 'history', paymentId: payment._id?.toString(), type: 'payment_success' }
  );

export const pushPaymentFailed = (userId, payment, reason) =>
  sendPushToUser(
    userId,
    payment.status === 'rejected' ? '✖ Payment Request Rejected' : '✖ Payment Processing Failed',
    reason ||
      (payment.status === 'rejected'
        ? `Your payment to ${payment.recipientCompany} was rejected. Tap for details.`
        : `There was an issue processing your transfer to ${payment.recipientCompany}. Tap for details.`),
    { screen: 'history', paymentId: payment._id?.toString(), type: 'payment_failed' }
  );
