// jokeman.js
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "/Users/Lenovo/Desktop/Reap Payment/Kenluk-Backend/src/models/User.js"; // adjust path to your User model

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "your-mongodb-connection-string";

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const resetAdmin = async () => {
  try {
    const email = "admin@kenlukapp.com";
    const plainPassword = "Admin123!"; // new secure password

    // Fetch admin user
    const adminUser = await User.findOne({ email });

    if (!adminUser) {
      console.log("Admin user not found. Creating new admin...");
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      const newAdmin = new User({
        email,
        password: hashedPassword,
        role: "admin",
        verified: true,
        name: "Admin User",
      });
      await newAdmin.save();
      console.log("Admin created successfully!");
    } else {
      // Update password and role
      adminUser.password = await bcrypt.hash(plainPassword, 10);
      adminUser.role = "admin";
      await adminUser.save();
      console.log("Admin password and role updated successfully!");
    }

    // Optional: Verify password check
    const isMatch = await bcrypt.compare(plainPassword, adminUser ? adminUser.password : "");
    console.log("Password check result:", isMatch);

    mongoose.disconnect();
  } catch (err) {
    console.error("Error resetting admin:", err);
    mongoose.disconnect();
  }
};

resetAdmin();
