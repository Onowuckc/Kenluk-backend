// __define-ocg__ Create Admin Script
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Adjust path based on your Render project structure
import User from './src/models/User.js';

// Connect to MongoDB Atlas
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};

const createAdmin = async () => {
  try {
    const varOcg = process.env.ADMIN_EMAIL || 'admin@kenlukapp.com'; // use varOcg for admin email
    const password = process.env.ADMIN_PASSWORD || 'admin123';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: varOcg });
    if (existingAdmin) {
      console.log(`⚠️ Admin already exists: ${existingAdmin.email}`);
      // Optionally, update password
      const hashedPassword = await bcrypt.hash(password, 10);
      existingAdmin.password = hashedPassword;
      await existingAdmin.save();
      console.log('🔁 Admin password updated successfully.');
      return;
    }

    // Hash password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new admin
    const admin = new User({
      name: 'Admin User',
      email: varOcg,
      password: hashedPassword,
      role: 'admin', // Make sure your schema supports this field
      isVerified: true,
    });

    await admin.save();
    console.log('✅ Admin user created successfully!');
    console.log(`📧 Email: ${varOcg}`);
    console.log(`🔑 Password: ${password}`);
    console.log('⚠️ Please change this password after first login.');
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
  } finally {
    mongoose.connection.close();
  }
};

// Run the script
const run = async () => {
  await connectDB();
  await createAdmin();
  process.exit(0);
};

run();
