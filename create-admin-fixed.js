import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
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

const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

const createAdmin = async () => {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ isAdmin: true });
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      // Update password with proper hashing
      const hashedPassword = await hashPassword(process.env.REACT_APP_ADMIN_PASSWORD || 'Admin123!');
      existingAdmin.password = hashedPassword;
      await existingAdmin.save();
      console.log('Admin password updated and hashed.');
      return;
    }

    // Create admin user
    const plainPassword = process.env.REACT_APP_ADMIN_PASSWORD || 'Admin123!';
    const hashedPassword = await hashPassword(plainPassword);

    const adminData = {
      name: 'Admin User',
      email: process.env.REACT_APP_ADMIN_EMAIL || 'admin@kenlukapp.com',
      password: hashedPassword,
      isAdmin: true,
      isVerified: true
    };

    const admin = new User(adminData);
    await admin.save();

    console.log('Admin user created successfully!');
    console.log('Email:', adminData.email);
    console.log('Password:', plainPassword);
    console.log('Please change the password after first login.');

  } catch (error) {
    console.error('Error creating admin:', error);
  }
};

const run = async () => {
  await connectDB();
  await createAdmin();
  process.exit(0);
};

run();
