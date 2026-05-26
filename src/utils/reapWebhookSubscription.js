import fetch from 'node-fetch';

/**
 * Subscribe to Reap Payments webhook events.
 *
 * Called once on server startup (see server.js). It will attempt to register
 * your webhook URL for the relevant event types. If the combination already
 * exists Reap returns a 400 — we treat that as a no-op so the server still
 * boots normally.
 *
 * Required env vars (set these in Railway):
 *   REAP_PAYMENT_API_KEY   — your Reap API key
 *   REAP_ENTITY_ID         — your Reap entity/business ID
 *   BACKEND_URL            — publicly reachable root URL of this server
 *                            e.g. https://kenluk-backend-production.up.railway.app
 *
 * Webhook event format confirmed from Reap Postman collection:
 *   eventType: "payment"  + eventName: "payment_status_update"
 *   - Triggered for statuses: payout_completed, requires_action, failed, cancelled
 */

const REAP_WEBHOOK_API_URL = 'https://payments.reap.global/api/webhooks';

/**
 * Build the webhook URL from the BACKEND_URL env var, falling back to the
 * known Railway production URL so it works even if the env var is not yet set.
 */
const getWebhookUrl = () => {
  const base =
    process.env.BACKEND_URL ||
    'https://kenluk-backend-production.up.railway.app';
  return `${base.replace(/\/$/, '')}/api/webhooks/reap`;
};

/**
 * Register (or silently skip if already registered) the Reap webhook subscription.
 *
 * We subscribe to:
 *   - eventType: "payment" / eventName: "payment_status_update"
 *     → covers payout_completed, failed, cancelled, requires_action
 *
 * @returns {Promise<void>}
 */
export const subscribeReapWebhooks = async () => {
  const PREFIX = '[REAP WEBHOOK SUBSCRIBE]';

  const apiKey   = process.env.REAP_PAYMENT_API_KEY;
  const entityId = process.env.REAP_ENTITY_ID;

  if (!apiKey || !entityId) {
    console.warn(
      `${PREFIX} Skipping — REAP_PAYMENT_API_KEY or REAP_ENTITY_ID not set in environment.`
    );
    return;
  }

  const webhookUrl = getWebhookUrl();
  console.log(`${PREFIX} Registering webhook URL: ${webhookUrl}`);

  // Subscription payload — matches Reap's confirmed Postman collection format:
  // { eventType, eventName, url, enabled }
  const body = {
    webhooks: [
      {
        eventType: 'payment',
        eventName: 'payment_status_update',
        url: webhookUrl,
        enabled: true
      }
    ]
  };

  try {
    const response = await fetch(REAP_WEBHOOK_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json;schema=PAAS',
        'x-reap-api-key': apiKey,
        'x-reap-entity-id': entityId,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`${PREFIX} ✅ Webhook subscription registered:`, JSON.stringify(data));
    } else if (response.status === 400) {
      // Reap returns 400 when the eventType + eventName + URL combo already exists.
      // Expected after the first successful boot — log and move on.
      console.log(
        `${PREFIX} ℹ️  Subscription already exists (Reap 400) — no action needed.`,
        JSON.stringify(data)
      );
    } else {
      console.error(
        `${PREFIX} ⚠️  Unexpected response from Reap (${response.status}):`,
        JSON.stringify(data)
      );
    }
  } catch (err) {
    // Network error — log but don't crash the server.
    console.error(`${PREFIX} ❌ Failed to call Reap webhook API:`, err.message);
  }
};
