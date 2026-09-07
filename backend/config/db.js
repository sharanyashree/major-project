const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

let mongoMemoryServerInstance = null;

/**
 * Seed initial administrative and demo accounts if database is empty
 */
async function seedInitialData() {
  try {
    const Admin = require('../models/Admin');
    const Distributor = require('../models/Distributor');
    const Beneficiary = require('../models/Beneficiary');
    const Inventory = require('../models/Inventory');

    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      console.log('[Seed] Seeding initial admin and demo data...');
      const adminPasswordHash = await bcrypt.hash('admin123', 10);
      const admin2PasswordHash = await bcrypt.hash('AdminPassword123', 10);

      await Admin.create([
        {
          adminId: 'A1001',
          name: 'System Administrator',
          password: adminPasswordHash,
          role: 'Super Admin',
        },
        {
          adminId: 'ADMIN001',
          name: 'Central System Admin',
          password: admin2PasswordHash,
          role: 'Admin',
        },
      ]);
      console.log('[Seed] Initial Admin accounts seeded: A1001, ADMIN001');

      // Seed Distributor
      const distPasswordHash = await bcrypt.hash('dist123', 10);
      const distributor = await Distributor.create({
        name: 'City Central Ration Shop',
        fullName: 'City Central FPS Store',
        storeName: 'Central Fair Price Shop #42',
        distributorId: 'D1001',
        fpsCode: 'FPS-560001',
        mobileNumber: '9876543211',
        password: distPasswordHash,
        district: 'Bangalore Urban',
        taluk: 'Bangalore South',
        status: 'Active',
      });
      console.log('[Seed] Initial Distributor account seeded: D1001');

      // Seed Beneficiary
      const userPasswordHash = await bcrypt.hash('user123', 10);
      await Beneficiary.create({
        fullName: 'Ramesh Kumar',
        rationCardNumber: 'RC-987654321',
        mobileNumber: '9876543212',
        password: userPasswordHash,
        district: 'Bangalore Urban',
        taluk: 'Bangalore South',
        village: 'Koramangala',
        address: '123 Market Road, Ward 4',
        familyMemberCount: 4,
        status: 'Active',
        assignedDistributor: distributor._id,
        riceQuota: 20,
        oilQuota: 2,
      });
      console.log('[Seed] Initial Beneficiary account seeded: RC-987654321');

      // Seed Central Inventory
      await Inventory.create({
        distributor: null,
        distributorId: null,
        riceStock: 10000,
        oilStock: 5000,
        minimumStock: { rice: 1000, oil: 500 },
      });

      // Seed Distributor Inventory
      await Inventory.create({
        distributor: distributor._id,
        distributorId: distributor._id,
        riceStock: 2000,
        oilStock: 1000,
        minimumStock: { rice: 200, oil: 100 },
      });
      console.log('[Seed] Central & Distributor inventories seeded successfully');
    }
  } catch (err) {
    console.warn(`[Seed] Notice: Seeding skipped or encountered error: ${err.message}`);
  }
}

/**
 * Connects to MongoDB (MONGO_URI if provided, or MongoMemoryServer fallback)
 */
const connectDB = async () => {
  mongoose.set('bufferCommands', false);

  if (process.env.MONGO_URI) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 3000,
      });
      console.log(`[MongoDB] Connected to URI: ${conn.connection.host}/${conn.connection.name}`);
      await seedInitialData();
      return conn;
    } catch (error) {
      console.warn(`[MongoDB] Could not connect to process.env.MONGO_URI: ${error.message}`);
    }
  }

  // Fallback to in-memory MongoDB
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    if (!mongoMemoryServerInstance) {
      mongoMemoryServerInstance = await MongoMemoryServer.create();
    }
    const uri = mongoMemoryServerInstance.getUri();
    const conn = await mongoose.connect(uri);
    console.log(`[MongoDB] Connected to In-Memory MongoDB instance at ${uri}`);
    await seedInitialData();
    return conn;
  } catch (memError) {
    console.warn(`[MongoDB] In-Memory MongoDB warning: ${memError.message}`);
  }
};

module.exports = connectDB;

