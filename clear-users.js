const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import User model
const User = require('./src/models/User');

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

const clearUsers = async () => {
  try {
    // Delete all users except admin
    const result = await User.deleteMany({ isAdmin: { $ne: true } });
    console.log(`Deleted ${result.deletedCount} user records.`);

    // Optionally, delete all users including admin (uncomment if needed)
    // const result = await User.deleteMany({});
    // console.log(`Deleted ${result.deletedCount} user records.`);

  } catch (error) {
    console.error('Error clearing users:', error);
  }
};

const run = async () => {
  await connectDB();
  await clearUsers();
  process.exit(0);
};

run();
