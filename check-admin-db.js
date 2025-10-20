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
      throw new Error('MONGO_URI environment variable is not set');
    }
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB Atlas');
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
};

const checkAdminRecord = async () => {
  try {
    console.log('🔍 Checking admin record in database...\n');

    // Query for admin user
    const admin = await User.findOne({ email: ADMIN_EMAIL }).select('+password');

    if (!admin) {
      console.log('❌ Admin user not found in database');
      console.log('📝 Creating admin user...\n');

      // Create new admin with proper hashing
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

      const newAdmin = new User({
        name: 'Admin User',
        email: ADMIN_EMAIL,
        password: hashedPassword,
        isAdmin: true,
        isVerified: true
      });

      await newAdmin.save();
      console.log('✅ Admin user created successfully');
      console.log('📋 Admin Details:');
      console.log(`   - Email: ${ADMIN_EMAIL}`);
      console.log(`   - Password: ${ADMIN_PASSWORD}`);
      console.log(`   - isAdmin: ${newAdmin.isAdmin}`);
      console.log(`   - isVerified: ${newAdmin.isVerified}`);
    } else {
      console.log('✅ Admin user found in database');
      console.log('📋 Admin Details:');
      console.log(`   - Email: ${admin.email}`);
      console.log(`   - Name: ${admin.name}`);
      console.log(`   - isAdmin: ${admin.isAdmin}`);
      console.log(`   - isVerified: ${admin.isVerified}`);
      console.log(`   - Created: ${admin.createdAt}`);

      // Check password
      const passwordMatches = await admin.comparePassword(ADMIN_PASSWORD);
      if (passwordMatches) {
        console.log('✅ Password verification: SUCCESS');
      } else {
        console.log('❌ Password verification: FAILED');
        console.log('🔧 Updating password...\n');

        // Update password
        admin.password = await bcrypt.hash(ADMIN_PASSWORD, 12);
        await admin.save();
        console.log('✅ Password updated successfully');
      }

      // Ensure admin flags are correct
      if (!admin.isAdmin || !admin.isVerified) {
        console.log('🔧 Updating admin flags...\n');
        admin.isAdmin = true;
        admin.isVerified = true;
        await admin.save();
        console.log('✅ Admin flags updated successfully');
      }
    }

    console.log('\n🎉 Admin record verification completed!');

  } catch (error) {
    console.error('❌ Error during admin check:', error);
    process.exit(1);
  }
};

const run = async () => {
  await connectDB();
  await checkAdminRecord();
  await mongoose.disconnect();
  console.log('\n🔌 Database connection closed');
  process.exit(0);
};

run();
