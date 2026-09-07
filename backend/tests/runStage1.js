const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const request = require('supertest');
const Admin = require('../models/Admin');
const Distributor = require('../models/Distributor');
const Beneficiary = require('../models/Beneficiary');

async function runStage1Test() {
  console.log('--- Starting Stage 1 Direct Auth & Registration Runner ---');
  const mongoServer = await MongoMemoryServer.create();
  await mongoose.disconnect();
  await mongoose.connect(mongoServer.getUri());

  let passed = 0;
  let total = 0;

  function assert(name, condition) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}`);
    }
  }

  try {
    // Seed test Admin
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);
    await Admin.create({
      adminId: 'A1001',
      password: hashedAdminPassword,
      name: 'System Admin',
      role: 'Super Admin'
    });

    // Seed test Distributor
    const hashedDistPassword = await bcrypt.hash('dist1234', 10);
    await Distributor.create({
      name: 'Ramesh FPS Store',
      distributorId: 'DIST-101',
      fpsCode: 'FPS-101',
      mobileNumber: '9876543210',
      password: hashedDistPassword,
      district: 'Bangalore Urban',
      taluk: 'North Taluk',
      status: 'Active'
    });

    // Seed test Beneficiary
    const hashedBenPassword = await bcrypt.hash('user1234', 10);
    await Beneficiary.create({
      fullName: 'Suresh Kumar',
      rationCardNumber: 'RC98765432',
      mobileNumber: '9123456780',
      password: hashedBenPassword,
      familyMemberCount: 4,
      district: 'Bangalore Urban',
      taluk: 'North Taluk',
      status: 'Active'
    });

    // 1. Admin Login (POST /api/auth/admin/login)
    const adminRes = await request(app)
      .post('/api/auth/admin/login')
      .send({ adminId: 'A1001', password: 'admin123' });
    assert('1. Admin Login (adminId + password)', adminRes.status === 200 && adminRes.body.token && adminRes.body.data.adminId === 'A1001');

    // 2. Distributor Login (POST /api/auth/distributor/login)
    const distRes = await request(app)
      .post('/api/auth/distributor/login')
      .send({ distributorId: 'DIST-101', password: 'dist1234' });
    assert('2. Distributor Login (distributorId + password)', distRes.status === 200 && distRes.body.token && distRes.body.data.distributorId === 'DIST-101');

    // 3. Beneficiary Login (POST /api/auth/beneficiary/login)
    const benRes = await request(app)
      .post('/api/auth/beneficiary/login')
      .send({ rationCardNumber: 'RC98765432', password: 'user1234' });
    assert('3. Beneficiary Login (rationCardNumber + password)', benRes.status === 200 && benRes.body.token && benRes.body.data.rationCardNumber === 'RC98765432');

    // 4. Distributor Registration (POST /api/auth/distributor/register)
    const distRegRes = await request(app)
      .post('/api/auth/distributor/register')
      .send({
        name: 'Ganesh Fair Price Shop',
        distributorId: 'DIST-202',
        fpsCode: 'FPS-202',
        mobileNumber: '9988776655',
        district: 'Bangalore Rural',
        taluk: 'Devanahalli',
        password: 'newdistpassword'
      });
    assert('4. Distributor Registration (POST /api/auth/distributor/register)', distRegRes.status === 201 && distRegRes.body.data.distributorId === 'DIST-202' && distRegRes.body.data.status === 'Pending');

    // 5. Beneficiary Registration (POST /api/auth/beneficiary/register)
    const benRegRes = await request(app)
      .post('/api/auth/beneficiary/register')
      .send({
        fullName: 'Anita Devi',
        rationCardNumber: 'RC11223344',
        mobileNumber: '9765432109',
        familyMemberCount: 3,
        district: 'Bangalore Rural',
        taluk: 'Devanahalli',
        village: 'Kodigehalli',
        address: 'House #45, Main Road',
        password: 'newuserpassword'
      });
    assert('5. Beneficiary Registration (POST /api/auth/beneficiary/register)', benRegRes.status === 201 && benRegRes.body.data.rationCardNumber === 'RC11223344' && benRegRes.body.data.status === 'Active');

    console.log(`\nResults: ${passed}/${total} assertions passed.`);
  } catch (err) {
    console.error('Test Execution Error:', err);
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
    process.exit(passed === total ? 0 : 1);
  }
}

runStage1Test();
