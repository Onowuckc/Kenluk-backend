import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

import User from './models/User.js';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error.message);
    process.exit(1);
  }
};

const createCompanyPaymentAccount = async () => {
  const email = (process.env.COMPANY_PAYMENT_EMAIL || 'payments@kenluk.com').toLowerCase();
  const password = process.env.COMPANY_PAYMENT_PASSWORD || 'kenluk';
  const name = process.env.COMPANY_PAYMENT_NAME || 'Kenluk Payment Account';

  const existingUser = await User.findOne({ email }).select('+password');

  if (existingUser) {
    existingUser.name = existingUser.name || name;
    existingUser.password = password;
    existingUser.isVerified = true;
    existingUser.isAdmin = false;
    existingUser.accountType = 'company';
    existingUser.accountStatus = 'approved';
    existingUser.verificationToken = undefined;
    existingUser.verificationCode = undefined;
    existingUser.verificationCodeExpire = undefined;
    await existingUser.save();

    console.log(`Company payment account updated: ${email}`);
    return;
  }

  await User.create({
    name,
    email,
    password,
    isVerified: true,
    isAdmin: false,
    accountType: 'company',
    accountStatus: 'approved'
  });

  console.log(`Company payment account created: ${email}`);
};

const run = async () => {
  await connectDB();
  await createCompanyPaymentAccount();
  await mongoose.connection.close();
};

run().catch(async (error) => {
  console.error('Company payment account setup failed:', error.message);
  await mongoose.connection.close();
  process.exit(1);
});
