import mongoose from 'mongoose';
import User from './src/models/User.js';

import connectDB from './src/config/database.js';

const testAdminLogin = async () => {
  try {
    const user = await User.findOne({ email: 'admin@kenlukapp.com' }).select('+password');
    if (!user) {
      console.log('Admin user not found');
      return;
    }

    console.log('Admin user found:');
    console.log('- Email:', user.email);
    console.log('- isAdmin:', user.isAdmin);
    console.log('- isVerified:', user.isVerified);
    console.log('- Password hash exists:', !!user.password);

    // Test password comparison
    const isValid = await user.comparePassword('Admin123!');
    console.log('- Password comparison result:', isValid);

    // Test with different passwords
    const testPasswords = ['admin123', 'Admin123!', 'admin@123', 'Admin123'];
    for (const testPass of testPasswords) {
      const result = await user.comparePassword(testPass);
      console.log(`- Password '${testPass}' matches:`, result);
    }

    // Debug: Check what password was actually used to create the hash
    console.log('\nDebugging password hash creation...');
    const bcrypt = await import('bcryptjs');
    const saltRounds = 12;

    for (const testPass of testPasswords) {
      const hash = await bcrypt.default.hash(testPass, saltRounds);
      const matches = await bcrypt.default.compare(testPass, user.password);
      console.log(`- '${testPass}' hash matches stored hash:`, matches);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
};

connectDB().then(testAdminLogin);
