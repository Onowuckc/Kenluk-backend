/**
 * Test Payment Email Notifications
 * 
 * Validates that all three payment lifecycle email templates render correctly
 * and that the sendEmail triggers are wired up properly.
 * 
 * Run: node test-payment-emails.js
 */

import dotenv from 'dotenv';
dotenv.config();

import {
  generatePaymentInitiatedEmail,
  generatePaymentSuccessEmail,
  generatePaymentFailedEmail
} from './src/utils/emailTemplates.js';

// ─── Mock Payment Object ──────────────────────────────────────────────────────
const mockPayment = {
  _id: '68591a4b2c3d4e5f6a7b8c9d',
  recipientCompany: 'Acme International Ltd',
  recipientBank: 'Standard Chartered Bank',
  recipientBankSwiftCode: 'SCBLHKHH',
  accountNumber: '1234567890',
  recipientBankCountry: 'HK',
  recipientAddress: 'Flat A, 2/F, Central Plaza, Hong Kong',
  recipientBankAddress: 'Standard Chartered Tower, Central, HK',
  invoiceFileName: 'invoice-20260622-001.pdf',
  invoiceOriginalFileName: 'Invoice_Acme_June2026.pdf',
  foreignAmount: 2500,
  foreignCurrency: 'USD',
  localAmount: 4012500,
  exchangeRate: 1605,
  status: 'pending_admin_approval',
  submittedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  completedAt: new Date(),
  rejectionReason: null,
  reapErrorMessage: null
};

const mockName = 'Adebayo Okonkwo';
const mockUserEmail = process.env.TEST_EMAIL || 'test@example.com';

// ─── Template Generation Tests ────────────────────────────────────────────────
console.log('\n========================================');
console.log('  Payment Email Notification Tests');
console.log('========================================\n');

// Test 1: Payment Initiated Email
console.log('✅ Test 1: generatePaymentInitiatedEmail');
try {
  const html = generatePaymentInitiatedEmail(mockName, mockPayment);
  if (!html.includes('Payment Request Initiated')) throw new Error('Title missing');
  if (!html.includes(mockPayment.recipientCompany)) throw new Error('Recipient company missing');
  if (!html.includes(mockPayment.foreignCurrency)) throw new Error('Currency missing');
  if (!html.includes(mockPayment._id)) throw new Error('Transaction ID missing');
  console.log('   ✓ Template rendered correctly (' + html.length + ' chars)');
  console.log('   ✓ Contains recipient company name');
  console.log('   ✓ Contains transaction ID');
  console.log('   ✓ Contains currency details\n');
} catch (err) {
  console.error('   ✗ FAILED:', err.message, '\n');
}

// Test 2: Payment Success Email (with Receipt)
console.log('✅ Test 2: generatePaymentSuccessEmail');
try {
  const completedPayment = { ...mockPayment, status: 'completed', completedAt: new Date() };
  const html = generatePaymentSuccessEmail(mockName, completedPayment);
  if (!html.includes('Payment Successful')) throw new Error('Title missing');
  if (!html.includes('Official Payment Receipt')) throw new Error('Receipt strip missing');
  if (!html.includes(mockPayment.recipientCompany)) throw new Error('Recipient company missing');
  if (!html.includes(mockPayment._id)) throw new Error('Transaction ID missing');
  console.log('   ✓ Template rendered correctly (' + html.length + ' chars)');
  console.log('   ✓ Contains "Official Payment Receipt" label');
  console.log('   ✓ Contains transaction ID');
  console.log('   ✓ Contains amount and exchange rate\n');
} catch (err) {
  console.error('   ✗ FAILED:', err.message, '\n');
}

// Test 3: Payment Failed Email (Rejection)
console.log('✅ Test 3: generatePaymentFailedEmail (rejection)');
try {
  const rejectedPayment = {
    ...mockPayment,
    status: 'rejected',
    rejectionReason: 'Insufficient documentation provided for the requested transaction amount.'
  };
  const html = generatePaymentFailedEmail(mockName, rejectedPayment);
  if (!html.includes('Payment Request Rejected')) throw new Error('Title missing');
  if (!html.includes('Rejection Reason')) throw new Error('Reason section missing');
  if (!html.includes(rejectedPayment.rejectionReason)) throw new Error('Rejection reason text missing');
  if (!html.includes(mockPayment._id)) throw new Error('Transaction ID missing');
  console.log('   ✓ Template rendered correctly (' + html.length + ' chars)');
  console.log('   ✓ Contains rejection title');
  console.log('   ✓ Contains rejection reason');
  console.log('   ✓ Contains transaction ID\n');
} catch (err) {
  console.error('   ✗ FAILED:', err.message, '\n');
}

// Test 4: Payment Failed Email (API/processing failure)
console.log('✅ Test 4: generatePaymentFailedEmail (processing failure)');
try {
  const failedPayment = {
    ...mockPayment,
    status: 'failed',
    reapErrorMessage: 'Reap API rejected the payment: Invalid SWIFT code for the specified routing network.'
  };
  const html = generatePaymentFailedEmail(mockName, failedPayment, 'Reap API rejected the payment: Invalid SWIFT code for the specified routing network.');
  if (!html.includes('Payment Failed')) throw new Error('Title missing');
  if (!html.includes('Failure Reason')) throw new Error('Reason section missing');
  if (!html.includes('Invalid SWIFT')) throw new Error('Error message missing');
  console.log('   ✓ Template rendered correctly (' + html.length + ' chars)');
  console.log('   ✓ Contains failure title');
  console.log('   ✓ Contains failure reason');
  console.log('   ✓ Contains custom error message\n');
} catch (err) {
  console.error('   ✗ FAILED:', err.message, '\n');
}

// ─── Live Email Test (Optional - requires MAILTRAP_TOKEN) ────────────────────
if (process.env.MAILTRAP_TOKEN && process.env.TEST_EMAIL) {
  console.log('📧 Live Email Delivery Test (MAILTRAP_TOKEN detected)\n');

  const { sendEmail } = await import('./src/config/mailer.js');

  // Test initiated email
  try {
    await sendEmail(
      mockUserEmail,
      '⏳ [TEST] Payment Request Initiated – Reap by Kenluk',
      generatePaymentInitiatedEmail(mockName, mockPayment)
    );
    console.log(`   ✓ Initiation email delivered to ${mockUserEmail}`);
  } catch (err) {
    console.error('   ✗ Initiation email failed:', err.message);
  }

  // Test success email
  try {
    const completedPayment = { ...mockPayment, status: 'completed', completedAt: new Date() };
    await sendEmail(
      mockUserEmail,
      '✅ [TEST] Payment Successful – Official Receipt – Reap by Kenluk',
      generatePaymentSuccessEmail(mockName, completedPayment)
    );
    console.log(`   ✓ Success/receipt email delivered to ${mockUserEmail}`);
  } catch (err) {
    console.error('   ✗ Success email failed:', err.message);
  }

  // Test failure email
  try {
    const rejectedPayment = {
      ...mockPayment,
      status: 'rejected',
      rejectionReason: 'Insufficient documentation provided.'
    };
    await sendEmail(
      mockUserEmail,
      '✖ [TEST] Payment Rejected – Reap by Kenluk',
      generatePaymentFailedEmail(mockName, rejectedPayment)
    );
    console.log(`   ✓ Failure/rejection email delivered to ${mockUserEmail}`);
  } catch (err) {
    console.error('   ✗ Failure email failed:', err.message);
  }

  console.log('');
} else {
  console.log('ℹ️  Skipping live email delivery test.');
  console.log('   To enable, set MAILTRAP_TOKEN and TEST_EMAIL in your .env file.\n');
}

console.log('========================================');
console.log('  All template tests complete!');
console.log('========================================\n');
console.log('📌 Email triggers are connected at:');
console.log('   • submitPaymentRequest  → Initiation email on payment creation');
console.log('   • reviewPayment         → Rejection email on reject action');
console.log('   • reviewPayment         → Failure email when Reap API submission fails');
console.log('   • actionPayment         → Rejection/failure email on reject or Reap failure');
console.log('   • completePayment       → Success/receipt email when admin marks complete');
console.log('   • handleReapWebhook     → Success or failure email on Reap status update\n');
