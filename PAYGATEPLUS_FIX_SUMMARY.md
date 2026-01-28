# PaygatePlus Payload Structure Fix

## Problem
The current implementation was sending a modern/modern payment payload structure that PaygatePlus v2 does NOT accept. PaygatePlus requires a strict legacy structure with specific required fields.

## What Was Wrong
❌ **Current Payload (Invalid for PaygatePlus)**
```json
{
  "request_ref": "...",
  "amount": 500000,
  "currency": "NGN",
  "customer": {...},
  "payment_methods": [...],
  "callback_url": "...",
  "redirect_url": "..."
}
```

## What Was Fixed
✅ **New Payload (Valid for PaygatePlus)**
```json
{
  "request_ref": "REQ-123456",
  "request_type": "send_invoice",
  "auth": {
    "type": null,
    "secure": null,
    "auth_provider": "PayGatePlusCardService"
  },
  "transaction": {
    "mock_mode": "Live",
    "transaction_ref": "TXN-123456",
    "transaction_desc": "Wallet funding",
    "transaction_ref_parent": "",
    "amount": 100000,
    "customer": {
      "customer_ref": "2348012345678",
      "firstname": "Chinaza",
      "surname": "Ijomah",
      "email": "ijomah3887@student.babcock.edu.ng",
      "mobile_no": "2348138267593"
    },
    "meta": {
      "send_email": true,
      "currency": "NGN"
    },
    "details": {
      "page_slug": "card"
    }
  }
}
```

## Changes Made

### 1. Updated Headers (Kenluk-Backend/src/services/FidelityPaymentService.js)
- Fixed signature generation: `md5(request_ref + secret)` instead of `md5(request_ref;secret)`
- Removed `request-ref` header (not needed)
- Updated comments to reflect PaygatePlus API

### 2. Updated Payload Structure (Kenluk-Backend/src/services/FidelityPaymentService.js)
- Added required `request_type: "send_invoice"`
- Added required `auth` object with `auth_provider` based on payment method
- Restructured `transaction` object with required fields:
  - `mock_mode: "Live"`
  - `transaction_ref_parent: ""`
  - `meta.currency: "NGN"`
  - `details.page_slug` based on payment method
- Changed API endpoint from `/transactions/collect` to `/send-invoice`

### 3. Added Payment Method Mapping (Kenluk-Backend/src/services/FidelityPaymentService.js)
- Added `resolvePaymentConfig()` method to map UI payment methods to PaygatePlus configuration
- Card → `PayGatePlusCardService` + `page_slug: "card"`
- Bank Account → `PaywithAccount` + `page_slug: "bank_account"`
- Mobile Money → `PayGatePlusMobileMoneyService` + `page_slug: "mobile_money"`

### 4. Updated Controller (Kenluk-Backend/src/controllers/fidelityPaymentController.js)
- Added `paymentMethod` parameter (defaults to "card")
- Updated service calls to pass `paymentMethod`

### 5. Added Signature Function (Kenluk-Backend/src/utils/fidelityEncryption.js)
- Added `generatePaygateSignature()` for PaygatePlus signature format

## Payment Method Mapping
| UI Option | auth_provider | page_slug |
|-----------|---------------|-----------|
| Card | PayGatePlusCardService | card |
| Bank Account | PaywithAccount | bank_account |
| Mobile Money | PayGatePlusMobileMoneyService | mobile_money |

## Required Fields Now Included
✅ `request_type` - Was missing
✅ `auth` - Was missing
✅ `transaction` - Was missing
✅ `transaction.meta.currency` - Was missing
✅ `transaction.details.page_slug` - Was missing

## Testing
The payload now matches PaygatePlus v2 documentation exactly. This should resolve the "Missing parameters" error (code 01) that was occurring before.

## Frontend Changes Required
The frontend needs to send a `paymentMethod` field in the request body:
```json
{
  "amount": 5000,
  "customerFirstName": "John",
  "customerLastName": "Doe",
  "customerEmail": "john@example.com",
  "customerMobile": "2348012345678",
  "paymentMethod": "card", // NEW: "card" | "bank_account" | "mobile_money"
  "description": "Wallet funding"
}
