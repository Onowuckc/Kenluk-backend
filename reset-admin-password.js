import mongoose from 'mongoose';
import User from './src/models/User.js';

import connectDB from './src/config/database.js';

const resetAdminPassword = async () => {
  try {
    const user = await User.findOne({ email: 'admin@kenlukapp.com' });
    if (!user) {
      console.log('Admin user not found');
      return;
    }

    // Set a known password
    user.password = 'Admin123!';
    await user.save();

    console.log('Admin password reset to: Admin123!');

    // Verify it works
    const testUser = await User.findOne({ email: 'admin@kenlukapp.com' }).select('+password');
    const matches = await testUser.comparePassword('Admin123!');
    console.log('Password verification:', matches ? 'SUCCESS' : 'FAILED');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
};

connectDB().then(resetAdminPassword);
