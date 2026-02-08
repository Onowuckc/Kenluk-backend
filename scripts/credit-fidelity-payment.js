import 'dotenv/config';
﻿import mongoose from 'mongoose';
import WalletService from '../src/services/walletService.js';
import FidelityPayment from '../src/models/FidelityPayment.js';
import WalletTransaction from '../src/models/WalletTransaction.js';

const PAYMENT_ID = '6987d1e44accc89095a6446b';

const run = async () => {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI (or MONGO_URI) not set');
  }

  await mongoose.connect(mongoUri);

  const payment = await FidelityPayment.findById(PAYMENT_ID);
  if (!payment) throw new Error('Payment not found');

  if (payment.status !== 'COMPLETED') {
    throw new Error(`Payment status is ${payment.status}, expected COMPLETED`);
  }

  const existing = await WalletTransaction.findOne({
    reference: PAYMENT_ID,
    type: 'credit'
  });

  if (existing) {
    console.log('Already credited:', existing._id.toString());
    process.exit(0);
  }

  const result = await WalletService.processFidelityPaymentCompletion(
    payment._id,
    payment.userId
  );

  console.log('Wallet credited:', result);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
