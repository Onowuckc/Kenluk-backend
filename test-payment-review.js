import mongoose from 'mongoose';
import Payment from './src/models/Payment.js';
import User from './src/models/User.js';
import dotenv from 'dotenv';

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

const testPaymentReview = async () => {
  try {
    await connectDB();

    // Find an admin user
    const admin = await User.findOne({ isAdmin: true });
    if (!admin) {
      console.log('No admin user found. Creating one...');
      const newAdmin = new User({
        name: 'Admin User',
        email: 'admin@kenluk.com',
        password: '$2a$10$hashedpassword', // This would be properly hashed
        isAdmin: true,
        isVerified: true
      });
      await newAdmin.save();
      console.log('Admin user created');
    }

    // Find a payment with pending_admin_approval status
    let payment = await Payment.findOne({ status: 'pending_admin_approval' });
    if (!payment) {
      console.log('No payment with pending_admin_approval status found. Creating one...');
      payment = new Payment({
        userId: admin._id,
        recipientCompany: 'Test Company',
        recipientBank: 'Test Bank',
        recipientBankSwiftCode: 'TEST1234',
        accountNumber: '1234567890',
        recipientBankCountry: 'US',
        recipientAddress: '123 Test St',
        recipientBankAddress: '456 Bank St',
        bankCode: '001',
        branchCode: '001',
        invoiceFileName: 'test.pdf',
        invoiceOriginalFileName: 'test.pdf',
        invoiceS3Key: 'test-key',
        invoiceS3Bucket: 'test-bucket',
        invoiceFileSize: 1000,
        invoiceMimeType: 'application/pdf',
        foreignAmount: 1000,
        foreignCurrency: 'USD',
        localAmount: 1000,
        exchangeRate: 1,
        status: 'pending_admin_approval'
      });
      await payment.save();
      console.log('Test payment created');
    }

    console.log('Test payment ID:', payment._id);
    console.log('Test payment status:', payment.status);

    // Simulate the reviewPayment function
    console.log('Testing reviewPayment function...');

    const paymentId = payment._id;
    const action = 'approve';
    const adminId = admin._id;

    console.log('Finding payment...');
    const foundPayment = await Payment.findById(paymentId);
    console.log('Payment found:', !!foundPayment);

    if (!foundPayment) {
      console.log('Payment not found');
      return;
    }

    console.log('Payment status:', foundPayment.status);

    if (foundPayment.status !== 'pending_admin_approval') {
      console.log('Payment status check failed');
      return;
    }

    console.log('Updating payment...');
    foundPayment.status = action === 'approve' ? 'approved' : 'rejected';
    foundPayment.approvedBy = adminId;
    foundPayment.approvedAt = new Date();

    await foundPayment.save();
    console.log('Payment updated successfully');

    console.log('Final payment status:', foundPayment.status);

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
};

testPaymentReview();
