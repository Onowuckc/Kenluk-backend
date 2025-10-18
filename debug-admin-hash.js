import mongoose from 'mongoose';
import User from './src/models/User.js';

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/kenluk');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Connection error:', error);
    process.exit(1);
  }
};

const debugAdmin = async () => {
  try {
    const user = await User.findOne({ email: 'admin@kenlukapp.com' }).select('+password');
    if (!user) {
      console.log('Admin user not found');
      return;
    }

    console.log('Admin user details:');
    console.log('- ID:', user._id);
    console.log('- Email:', user.email);
    console.log('- Name:', user.name);
    console.log('- isAdmin:', user.isAdmin);
    console.log('- isVerified:', user.isVerified);
    console.log('- Password hash length:', user.password ? user.password.length : 'null');
    console.log('- Password hash starts with:', user.password ? user.password.substring(0, 10) + '...' : 'null');

    // Check if password hash looks correct (bcrypt hashes start with $2a$ or $2b$ or $2y$)
    if (user.password && user.password.startsWith('$2')) {
      console.log('- Password hash format: Valid bcrypt hash');
    } else {
      console.log('- Password hash format: INVALID - not a bcrypt hash');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
};

connectDB().then(debugAdmin);
