require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const connectDB = require('./config/db');
const Admin = require('./models/Admin');

/**
 * Seed Script: Inserts the initial Admin account
 * Admin ID: A1001
 * Password: admin123
 */
const seedAdmin = async () => {
  try {
    // Connect to database
    await connectDB();

    const adminId = 'A1001';
    const plainPassword = 'admin123';

    // Check if Admin already exists
    const existingAdmin = await Admin.findOne({ adminId });

    if (existingAdmin) {
      console.log(`ℹ️ Admin account [${adminId}] already exists in the database.`);
    } else {
      // Hash password using bcrypt
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

      // Create Admin record
      await Admin.create({
        adminId,
        password: hashedPassword,
        name: 'System Administrator',
        role: 'Super Admin',
      });

      console.log(`✅ Admin account [${adminId}] seeded successfully.`);
    }

    // Close database connection cleanly
    await mongoose.connection.close();
    console.log('🔒 Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error seeding admin account: ${error.message}`);
    process.exit(1);
  }
};

seedAdmin();
