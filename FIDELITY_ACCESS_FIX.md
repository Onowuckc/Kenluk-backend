# Fidelity Payment Access Fix - Based on Feedback

## Issue Summary
The application was receiving "Application does not have access to PayGatePlusCardService" and "Application does not have access to PaywithAccount" errors.

## Root Cause
According to Fidelity's feedback, the application was using the wrong service configuration. The payment method is determined by the `auth.type` field, not by a separate `payment_method` parameter or `auth_provider`.

## Changes Made

### 1. Updated FidelityPaymentService.js
- [x] Changed `auth.type` from `null` to `"bank.account"`
- [x] Set `auth_provider` to `"PaywithAccount"` (fixed value)
- [x] Removed `paymentMethod` parameter from `sendInvoice()` method
- [x] Removed `resolvePaymentConfig()` method (no longer needed)

### 2. Updated FidelityPaymentController.js
- [x] Removed `paymentMethod` parameter from request body destructuring
- [x] Updated `retryPayment()` function to remove `paymentMethod` usage

## Key Technical Changes

### Before (Incorrect)
```json
{
  "auth": {
    "type": null,
    "secure": null,
    "auth_provider": "PayGatePlusCardService" // or "PaywithAccount"
  }
}
```

### After (Correct)
```json
{
  "auth": {
    "type": "bank.account",
    "secure": null,
    "auth_provider": "PaywithAccount"
  }
}
```

## Fidelity's Explanation
> "The payment method is NOT a separate field like payment_method: card | bank | momo.
> Instead, the payment method is inferred from the auth.type field in the request.
> In your case, all the flows you referenced use:
> auth.type = 'bank.account' → Bank (Direct Debit / Open Account)
> There is no default payment method. If auth.type is missing or incorrect → request fails"

## Testing Required
- [ ] Test invoice sending with the corrected auth configuration
- [ ] Verify that the "Application does not have access" errors are resolved
- [ ] Test payment flow end-to-end

## Files Modified
- `Kenluk-Backend/src/services/FidelityPaymentService.js`
- `Kenluk-Backend/src/controllers/fidelityPaymentController.js`
