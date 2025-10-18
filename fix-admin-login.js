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

const fixAdminLogin = async () => {
  try {
    const adminEmail = process.env.REACT_APP_ADMIN_EMAIL || 'admin@kenlukapp.com';
    const adminPassword = process.env.REACT_APP_ADMIN_PASSWORD || 'admin123';

    console.log('Checking for admin user:', adminEmail);

    // Find existing admin user
    let admin = await User.findOne({ email: adminEmail });

    if (admin) {
      console.log('Admin user found. Checking and updating fields...');

      // Ensure admin has correct role and verification
      admin.isAdmin = true;
      admin.isVerified = true;

      // Always re-hash the password to ensure it's properly hashed
      const hashedPassword = await hashPassword(adminPassword);
      admin.password = hashedPassword;

      await admin.save();

      console.log('Admin user updated successfully!');
      console.log(`- Email: ${admin.email}`);
      console.log(`- Name: ${admin.name}`);
      console.log(`- isAdmin: ${admin.isAdmin}`);
      console.log(`- isVerified: ${admin.isVerified}`);
      console.log(`- Password: Properly hashed (use '${adminPassword}' to login)`);

    } else {
      console.log('Admin user not found. Creating new admin user...');

      // Create new admin user
      const hashedPassword = await hashPassword(adminPassword);

      const adminData = {
        name: 'Admin User',
        email: adminEmail,
        password: hashedPassword,
        isAdmin: true,
        isVerified: true
      };

      admin = new User(adminData);
      await admin.save();

      console.log('Admin user created successfully!');
      console.log(`- Email: ${admin.email}`);
      console.log(`- Name: ${admin.name}`);
      console.log(`- isAdmin: ${admin.isAdmin}`);
      console.log(`- isVerified: ${admin.isVerified}`);
      console.log(`- Password: Properly hashed (use '${adminPassword}' to login)`);
    }

    // Verify the admin can be found and has correct properties
    const verifyAdmin = await User.findOne({ email: adminEmail }).select('+password');
    if (verifyAdmin && verifyAdmin.isAdmin && verifyAdmin.isVerified) {
      console.log('\n✅ Admin user verification successful!');
      console.log('The admin login should now work.');
    } else {
      console.log('\n❌ Admin user verification failed!');
    }

  } catch (error) {
    console.error('Error fixing admin login:', error);
  }
};

const run = async () => {
  await connectDB();
  await fixAdminLogin();
  process.exit(0);
};

run();
