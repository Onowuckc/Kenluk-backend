import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import User model
import User from './src/models/User.js';

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kenluk');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

const checkAdmin = async () => {
  try {
    const admin = await User.findOne({ isAdmin: true });
    if (admin) {
      console.log('Admin user found:');
      console.log(`- Name: ${admin.name}`);
      console.log(`- Email: ${admin.email}`);
      console.log(`- Verified: ${admin.isVerified}`);
      console.log(`- Created: ${admin.createdAt}`);
      console.log(`- Last Login: ${admin.lastLogin || 'Never'}`);
    } else {
      console.log('No admin user found in database.');
    }
  } catch (error) {
    console.error('Error checking admin:', error);
  }
};

const run = async () => {
  await connectDB();
  await checkAdmin();
  process.exit(0);
};

run();
