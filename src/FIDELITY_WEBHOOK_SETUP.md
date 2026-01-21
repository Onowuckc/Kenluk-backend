# Fidelity Bank NGN Webhook Integration

## Overview
This webhook endpoint receives payment notifications from Fidelity Bank when NGN transactions are completed. It automatically converts NGN to USDT and funds the Reap payment account.

## Webhook Endpoint
```
POST /api/webhooks/fidelity
```

### URL for Production
```
https://your-domain.com/api/webhooks/fidelity
```

### URL for Local Development (with ngrok)
```
ngrok http 5000  # Forward local port 5000 to public URL
```

## Webhook Payload

### Request Headers
```
X-Fidelity-Signature: <HMAC-SHA256 signature>
Content-Type: application/json
```

### Request Body
```json
{
  "transactionId": "FDL-2026-01-21-001",
  "amount": 50000,
  "currency": "NGN",
  "status": "success",
  "customerReference": "67890abc123def456",
  "timestamp": "2026-01-21T10:30:45Z",
  "description": "Payment for USDT funding"
}
```

### Field Descriptions
| Field | Type | Description |
|-------|------|-------------|
| `transactionId` | string | Unique transaction ID from Fidelity |
| `amount` | number | Amount received in NGN |
| `currency` | string | Should always be "NGN" |
| `status` | string | Transaction status: "success", "failed", or "pending" |
| `customerReference` | string | Optional - Payment ID or User ID to link transaction |
| `timestamp` | string | ISO 8601 timestamp when transaction occurred |
| `description` | string | Payment description/reference |

## Webhook Response

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "data": {
    "transactionId": "FDL-2026-01-21-001",
    "ngnAmount": 50000,
    "usdtFunded": 250.50,
    "exchangeRate": 1617.50,
    "reapResponse": {
      "balance": 250.50,
      "currency": "USDT",
      "network": "Polygon PoS"
    }
  }
}
```

## Environment Variables Required

Add these to your `.env` file:

```bash
# Fidelity Bank Webhook Configuration
FIDELITY_WEBHOOK_SECRET=your_webhook_secret_key_from_fidelity

# Reap Payment API (existing)
REAP_PAYMENT_API_KEY=your_reap_api_key
REAP_ENTITY_ID=your_reap_entity_id
```

## Setup Instructions

### 1. Get Webhook Secret from Fidelity
- Contact Fidelity Bank API support
- Request webhook credentials and secret key
- Store the secret in `.env` as `FIDELITY_WEBHOOK_SECRET`

### 2. Register Webhook URL with Fidelity
- Provide your webhook URL to Fidelity
- They will send a test webhook to verify
- Enable webhook notifications in Fidelity dashboard

### 3. Test the Webhook

Using curl:
```bash
# Generate signature
PAYLOAD='{"transactionId":"TEST-001","amount":10000,"currency":"NGN","status":"success","customerReference":"","timestamp":"2026-01-21T10:00:00Z","description":"Test"}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "your_webhook_secret" -hex | cut -d' ' -f2)

# Send webhook
curl -X POST http://localhost:5000/api/webhooks/fidelity \
  -H "Content-Type: application/json" \
  -H "X-Fidelity-Signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

## Flow Diagram

```
Fidelity Bank Transaction
         ↓
User makes NGN payment
         ↓
Fidelity processes payment
         ↓
Webhook POST to /api/webhooks/fidelity
         ↓
Signature verification (HMAC-SHA256)
         ↓
Convert NGN → USDT (using current exchange rate)
         ↓
Fund Reap account with USDT
         ↓
Update payment record status
         ↓
Return 200 OK acknowledgment
```

## Error Handling

### Invalid Signature
- Returns: 401 Unauthorized
- Action: Fidelity will retry the webhook
- Check: Verify `FIDELITY_WEBHOOK_SECRET` is correct

### Invalid Currency
- Returns: 400 Bad Request
- Issue: Only NGN is supported
- Check: Verify currency code in Fidelity settings

### User Not Found
- Returns: 200 OK (webhook acknowledged)
- Issue: `customerReference` doesn't match any payment/user
- Action: Check customer reference format

### Exchange Rate Not Configured
- Returns: 200 OK with error message
- Issue: Platform settings don't have `usdNgnRate`
- Action: Admin must set exchange rate in system

### Reap Funding Failed
- Returns: 200 OK (webhook acknowledged but processing failed)
- Issue: Reap API error or network issue
- Action: Admin notified, payment status marked as failed

## Webhook Security

### Signature Verification
All webhooks are signed with HMAC-SHA256. The signature is computed as:

```javascript
signature = HMAC_SHA256(
  webhook_payload,
  FIDELITY_WEBHOOK_SECRET
)
```

**Never process webhooks without verifying the signature.**

### Idempotency
- Each webhook includes a unique `transactionId`
- Duplicate notifications are silently acknowledged (200 OK)
- Prevents double-crediting of accounts

## Monitoring & Logs

Check server logs for webhook processing:

```bash
# Development
npm run dev  # Watch logs in console

# Production
tail -f logs/webhook.log
```

Look for messages like:
- `💰 Processing Fidelity webhook`
- `📊 Converted: X NGN → Y USDT`
- `✅ NGN Funding Complete`
- `❌ Webhook processing error`

## Testing Checklist

- [ ] Webhook endpoint accessible from public internet
- [ ] `FIDELITY_WEBHOOK_SECRET` configured
- [ ] `REAP_PAYMENT_API_KEY` and `REAP_ENTITY_ID` configured
- [ ] Exchange rate set in platform settings
- [ ] Test webhook signature verification
- [ ] Test successful payment flow
- [ ] Test error scenarios (invalid currency, user not found)
- [ ] Verify logs show expected messages

## Troubleshooting

### Webhook not being received
1. Check if endpoint is publicly accessible
2. Check firewall/network settings
3. Verify URL format in Fidelity dashboard
4. Test with ngrok for local development

### Signature verification fails
1. Check `FIDELITY_WEBHOOK_SECRET` is correct
2. Ensure request body is not modified
3. Check Fidelity documentation for exact signature format

### NGN to USDT conversion fails
1. Verify exchange rate is set in admin settings
2. Check if `PlatformSettings` document exists in database
3. Manually update rate if needed

### Reap funding fails
1. Verify `REAP_PAYMENT_API_KEY` and `REAP_ENTITY_ID`
2. Check Reap API status
3. Verify amount is valid (> 0)
4. Check network connectivity to Reap

## Future Enhancements

- [ ] Webhook retry logic with exponential backoff
- [ ] Batch processing for multiple webhooks
- [ ] Real-time notifications to frontend via WebSocket
- [ ] Admin dashboard for webhook monitoring
- [ ] Webhook signature rotation support
- [ ] Rate limiting on webhook endpoint
