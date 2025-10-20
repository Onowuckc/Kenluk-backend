import mongoose from 'mongoose';
import User from './src/models/User.js';

import connectDB from './src/config/database.js';

const findOriginalPassword = async () => {
  try {
    const user = await User.findOne({ email: 'admin@kenlukapp.com' }).select('+password');
    if (!user) {
      console.log('Admin user not found');
      return;
    }

    console.log('Stored hash:', user.password);

    // Try common passwords that might have been used
    const possiblePasswords = [
      'admin123',
      'Admin123!',
      'admin@123',
      'Admin123',
      'password',
      'admin',
      '123456',
      'Admin123!',
      'admin123!',
      'Admin@123'
    ];

    console.log('\nTesting possible passwords:');
    for (const pass of possiblePasswords) {
      const matches = await user.comparePassword(pass);
      if (matches) {
        console.log('✅ FOUND MATCHING PASSWORD:', pass);
        return;
      } else {
        console.log('❌', pass, '- no match');
      }
    }

    console.log('\nNo matching password found in common list.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
};

connectDB().then(findOriginalPassword);
