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

const deleteUnverifiedUsers = async () => {
  try {
    // Delete all unverified users
    const result = await User.deleteMany({ isVerified: false, isAdmin: { $ne: true } });
    console.log(`Deleted ${result.deletedCount} unverified user records.`);

  } catch (error) {
    console.error('Error deleting unverified users:', error);
  }
};

const run = async () => {
  await connectDB();
  await deleteUnverifiedUsers();
  process.exit(0);
};

run();
