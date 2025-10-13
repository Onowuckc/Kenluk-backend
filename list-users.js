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

const listUsers = async () => {
  try {
    const users = await User.find({}, 'name email isAdmin isVerified createdAt');
    console.log('All users in database:');
    users.forEach(user => {
      console.log(`- Name: ${user.name}, Email: ${user.email}, Admin: ${user.isAdmin}, Verified: ${user.isVerified}, Created: ${user.createdAt}`);
    });

    const adminCount = users.filter(user => user.isAdmin).length;
    console.log(`\nTotal users: ${users.length}`);
    console.log(`Admin users: ${adminCount}`);
  } catch (error) {
    console.error('Error listing users:', error);
  }
};

const run = async () => {
  await connectDB();
  await listUsers();
  process.exit(0);
};

run();
