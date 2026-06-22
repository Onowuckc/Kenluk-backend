import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();
import User from './src/models/User.js';

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kenluk');
  const user = await User.findOne({ email: 'user@kenluk.com' });
  console.log('USER OBJECT:', JSON.stringify(user, null, 2));
  process.exit(0);
};

run().catch(console.error);
