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

const makeUserAdmin = async () => {
  try {
    const email = 'admin@kenlukapp.com'; // The email that's trying to login as admin

    const user = await User.findOne({ email });
    if (!user) {
      console.log(`User with email ${email} not found.`);
      return;
    }

    user.isAdmin = true;
    await user.save();

    console.log(`User ${user.name} (${user.email}) has been made an admin.`);
    console.log(`Admin status: ${user.isAdmin}`);
  } catch (error) {
    console.error('Error making user admin:', error);
  }
};

const run = async () => {
  await connectDB();
  await makeUserAdmin();
  process.exit(0);
};

run();
