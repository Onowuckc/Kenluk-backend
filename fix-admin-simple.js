import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import User model
import User from './src/models/User.js';

const ADMIN_EMAIL = 'admin@kenlukapp.com';
const ADMIN_PASSWORD = 'Admin123!';

// Connect to production MongoDB Atlas
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB Atlas');
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
};

const fixAdminSimple = async () => {
  try {
    console.log('🔧 Starting simple admin fix...\n');

    // Delete existing admin if exists
    await User.deleteOne({ email: ADMIN_EMAIL });
    console.log('🗑️  Deleted existing admin user');

    // Create new admin with proper hashing
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

    const admin = new User({
      name: 'Admin User',
      email: ADMIN_EMAIL,
      password: hashedPassword,
      isAdmin: true,
      isVerified: true
    });

    await admin.save();
    console.log('✅ Admin user created successfully');

    // Verify the password works
    const testUser = await User.findOne({ email: ADMIN_EMAIL }).select('+password');
    const passwordMatches = await testUser.comparePassword(ADMIN_PASSWORD);

    if (passwordMatches) {
      console.log('✅ Password verification: SUCCESS');
    } else {
      console.log('❌ Password verification: FAILED');
      throw new Error('Password verification failed');
    }

    console.log('\n🎉 Admin fix completed successfully!');
    console.log('\n📋 Admin Credentials:');
    console.log(`- Email: ${ADMIN_EMAIL}`);
    console.log(`- Password: ${ADMIN_PASSWORD}`);

  } catch (error) {
    console.error('❌ Error during admin fix:', error);
    process.exit(1);
  }
};

const run = async () => {
  await connectDB();
  await fixAdminSimple();
  await mongoose.disconnect();
  console.log('\n🔌 Database connection closed');
  process.exit(0);
};

run();
