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

const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

const fixAdminProduction = async () => {
  try {
    console.log('🔧 Starting admin login fix for production...\n');

    // Step 1: Check if admin exists
    let admin = await User.findOne({ email: ADMIN_EMAIL });

    if (!admin) {
      console.log('📝 Admin user not found. Creating new admin user...');
      const hashedPassword = await hashPassword(ADMIN_PASSWORD);

      admin = new User({
        name: 'Admin User',
        email: ADMIN_EMAIL,
        password: hashedPassword,
        isAdmin: true,
        isVerified: true
      });

      await admin.save();
      console.log('✅ Admin user created successfully');
    } else {
      console.log('📝 Admin user found. Updating properties...');

      // Ensure admin properties are correct
      admin.isAdmin = true;
      admin.isVerified = true;

      // Reset password with proper hashing
      admin.password = await hashPassword(ADMIN_PASSWORD);

      await admin.save();
      console.log('✅ Admin user updated successfully');
    }

    // Step 2: Verify admin properties
    console.log('\n🔍 Verifying admin user properties:');
    console.log(`- Email: ${admin.email}`);
    console.log(`- Name: ${admin.name}`);
    console.log(`- isAdmin: ${admin.isAdmin}`);
    console.log(`- isVerified: ${admin.isVerified}`);
    console.log(`- Created: ${admin.createdAt}`);
    console.log(`- Last Login: ${admin.lastLogin || 'Never'}`);

    // Step 3: Test password comparison
    console.log('\n🔐 Testing password comparison...');
    const testUser = await User.findOne({ email: ADMIN_EMAIL }).select('+password');
    const passwordMatches = await testUser.comparePassword(ADMIN_PASSWORD);

    if (passwordMatches) {
      console.log('✅ Password comparison: SUCCESS');
    } else {
      console.log('❌ Password comparison: FAILED');
      throw new Error('Password hashing/comparison failed');
    }

    console.log('\n🎉 Admin login fix completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`- Admin Email: ${ADMIN_EMAIL}`);
    console.log(`- Admin Password: ${ADMIN_PASSWORD}`);
    console.log('- Admin is verified and has admin privileges');
    console.log('- Password is properly hashed and verified');

  } catch (error) {
    console.error('❌ Error during admin fix:', error);
    process.exit(1);
  }
};

const run = async () => {
  await connectDB();
  await fixAdminProduction();
  await mongoose.disconnect();
  console.log('\n🔌 Database connection closed');
  process.exit(0);
};

run();
