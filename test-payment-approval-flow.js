import mongoose from 'mongoose';
import Payment from './src/models/Payment.js';
import User from './src/models/User.js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kenluk');
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Test the full payment approval flow
const testPaymentApprovalFlow = async () => {
  try {
    await connectDB();

    console.log('=== TESTING PAYMENT APPROVAL FLOW ===\n');

    // Find or create an admin user
    let admin = await User.findOne({ isAdmin: true });
    if (!admin) {
      console.log('Creating admin user...');
      admin = new User({
        name: 'Admin User',
        email: 'admin@kenluk.com',
        password: '$2a$10$dummyhashedpassword', // This would be properly hashed
        isAdmin: true,
        isVerified: true,
        accountStatus: 'approved'
      });
      await admin.save();
      console.log('Admin user created');
    }

    // Find or create a regular user
    let user = await User.findOne({ isAdmin: false });
    if (!user) {
      console.log('Creating regular user...');
      user = new User({
        name: 'Test User',
        email: 'user@kenluk.com',
        password: '$2a$10$dummyhashedpassword',
        isAdmin: false,
        isVerified: true,
        accountStatus: 'approved'
      });
      await user.save();
      console.log('Regular user created');
    }

    // Create a test payment
    console.log('Creating test payment...');
    const payment = new Payment({
      userId: user._id,
      recipientCompany: 'Test Company Ltd',
      recipientBank: 'HSBC HK',
      recipientBankSwiftCode: 'HSBCHKHH',
      accountNumber: '888231234112',
      recipientBankCountry: 'HK',
      recipientAddress: 'Flat A, 2/F, Beauty Avenue, Quarry Bay',
      recipientBankAddress: 'HSBC Building, Central',
      bankCode: '004',
      branchCode: '004',
      invoiceFileName: 'test-invoice.pdf',
      invoiceOriginalFileName: 'test-invoice.pdf',
      invoiceS3Key: `invoices/${user._id}/test-invoice-${Date.now()}.pdf`,
      invoiceS3Bucket: 'test-bucket',
      invoiceFileSize: 1024000,
      invoiceMimeType: 'application/pdf',
      foreignAmount: 1000,
      foreignCurrency: 'USD',
      localAmount: 1000,
      exchangeRate: 1,
      status: 'pending_admin_approval',
      reapPayloadSnapshot: {
        receivingParty: {
          type: 'company',
          name: { name: 'Test Company Ltd' },
          accounts: [{
            type: 'bank',
            identifier: { standard: 'account_number', value: '888231234112' },
            network: 'SWIFT',
            currencies: ['USD'],
            provider: {
              name: 'HSBC HK',
              country: 'HK',
              networkIdentifier: 'HSBCHKHH'
            },
            addresses: [{
              type: 'postal',
              street: 'HSBC Building, Central',
              city: 'Central',
              state: 'HK',
              country: 'HK',
              postalCode: '00000'
            }]
          }]
        },
        payment: {
          receivingAmount: 1000,
          receivingCurrency: 'USD',
          senderCurrency: 'USD',
          description: 'Payment to Test Company Ltd',
          purposeOfPayment: 'payment_for_goods',
          metadata: { key: 'Invoice: test-invoice.pdf' }
        }
      }
    });

    await payment.save();
    console.log(`Test payment created with ID: ${payment._id}`);
    console.log(`Initial status: ${payment.status}\n`);

    // Now test the approval via API call (simulating frontend)
    console.log('=== TESTING APPROVAL VIA API ===');

    const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
    const approvalUrl = `${API_BASE_URL}/api/payments/${payment._id}/review`;

    console.log(`Making API call to: ${approvalUrl}`);

    // For this test, we'll need to authenticate. Let's create a simple test that calls the controller directly
    console.log('Testing reviewPayment controller directly...');

    // Import the controller
    const { reviewPayment } = await import('./src/controllers/paymentUploadController.js');

    // Create mock request/response objects
    const mockReq = {
      params: { paymentId: payment._id },
      body: { action: 'approve' },
      user: { _id: admin._id, isAdmin: true }
    };

    const mockRes = {
      status: (code) => ({
        json: (data) => {
          console.log(`Response status: ${code}`);
          console.log('Response data:', JSON.stringify(data, null, 2));
          return data;
        }
      })
    };

    // Call the controller
    await reviewPayment(mockReq, mockRes);

    // Check the payment status after approval
    const updatedPayment = await Payment.findById(payment._id);
    console.log('\n=== PAYMENT STATUS AFTER APPROVAL ===');
    console.log(`Status: ${updatedPayment.status}`);
    console.log(`Reap Status: ${updatedPayment.reapStatus}`);
    console.log(`Reap Payment ID: ${updatedPayment.reapPaymentId}`);
    console.log(`Reap Error: ${updatedPayment.reapErrorMessage}`);

    if (updatedPayment.reapPayloadSnapshot) {
      console.log('Reap Payload Snapshot exists');
    }

    if (updatedPayment.reapResponseSnapshot) {
      console.log('Reap Response Snapshot exists');
      console.log('Response status:', updatedPayment.reapResponseSnapshot.status);
    }

    console.log('\n=== TEST RESULTS ===');
    if (updatedPayment.status === 'submitted_to_reap' && updatedPayment.reapStatus === 'sent') {
      console.log('✅ SUCCESS: Payment approved and sent to Reap API');
    } else if (updatedPayment.status === 'approved' && updatedPayment.reapStatus === 'failed') {
      console.log('⚠️  PARTIAL: Payment approved but Reap API failed');
      console.log('Error:', updatedPayment.reapErrorMessage);
    } else {
      console.log('❌ FAILED: Payment approval did not work as expected');
    }

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
};

testPaymentApprovalFlow();
