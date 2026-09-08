const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const request = require('supertest');
const Distributor = require('../models/Distributor');
const Beneficiary = require('../models/Beneficiary');
const Inventory = require('../models/Inventory');
const Notification = require('../models/Notification');
const Allocation = require('../models/Allocation');
const Transaction = require('../models/Transaction');

async function runStage3DistributorTests() {
  console.log('--- Starting Stage 3 Distributor Frontend-Backend Integration Tests ---');
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
    // 1. Seed Two Distributors for data isolation verification
    const hashedDistPassword = await bcrypt.hash('dist1234', 10);

    const dist1 = await Distributor.create({
      fullName: 'Ramesh Chandra',
      name: 'Ramesh Chandra',
      distributorId: 'DIST-4201',
      fpsCode: 'FPS-4201',
      storeName: 'Sri Annapurna Ration Store',
      mobileNumber: '9876543210',
      email: 'ramesh.fps4201@gmail.com',
      password: hashedDistPassword,
      district: 'Bangalore Urban',
      taluk: 'North Taluk',
      status: 'Active',
    });

    const dist2 = await Distributor.create({
      fullName: 'Suresh Kumar',
      name: 'Suresh Kumar',
      distributorId: 'DIST-9999',
      fpsCode: 'FPS-9999',
      storeName: 'Kaveri Grameena FPS',
      mobileNumber: '9123456780',
      email: 'suresh.fps9999@gmail.com',
      password: hashedDistPassword,
      district: 'Bangalore Rural',
      taluk: 'Devanahalli',
      status: 'Active',
    });

    // Seed Inventory for Distributor 1 (200kg rice, 50L oil)
    await Inventory.create({
      distributor: dist1._id,
      distributorId: dist1._id,
      riceStock: 200,
      oilStock: 50,
    });

    // Seed Beneficiaries for Distributor 1
    const hashedBenPassword = await bcrypt.hash('ben12345', 10);

    const ben1 = await Beneficiary.create({
      fullName: 'Anand Kumar',
      rationCardNumber: 'RC-884210',
      mobileNumber: '9876543210',
      cardCategory: 'PHH',
      familyMemberCount: 4,
      district: 'Bangalore Urban',
      taluk: 'North Taluk',
      assignedDistributor: dist1._id,
      password: hashedBenPassword,
      status: 'Active',
    });

    const ben2 = await Beneficiary.create({
      fullName: 'Sunita Sharma',
      rationCardNumber: 'RC-990124',
      mobileNumber: '9845012345',
      cardCategory: 'AAY',
      familyMemberCount: 3,
      district: 'Bangalore Urban',
      taluk: 'North Taluk',
      assignedDistributor: dist1._id,
      password: hashedBenPassword,
      status: 'Active',
    });

    // Seed Beneficiary for Distributor 2 (Must NOT be accessible by Distributor 1)
    const ben3 = await Beneficiary.create({
      fullName: 'Other Beneficiary',
      rationCardNumber: 'RC-OTHER-001',
      mobileNumber: '9000000000',
      cardCategory: 'NPHH',
      familyMemberCount: 2,
      district: 'Bangalore Rural',
      taluk: 'Devanahalli',
      assignedDistributor: dist2._id,
      password: hashedBenPassword,
      status: 'Active',
    });

    // Seed Notifications for Distributor 1
    const notif1 = await Notification.create({
      senderRole: 'Admin',
      receiverId: dist1._id,
      receiverRole: 'Distributor',
      title: 'Stock Dispatch Authorized',
      message: 'Consignment DSP-2026-901 has been dispatched to your store.',
      readStatus: false,
    });

    const notif2 = await Notification.create({
      senderRole: 'Admin',
      receiverId: dist1._id,
      receiverRole: 'Distributor',
      title: 'August Ration Cycle Active',
      message: 'Monthly ration quota distribution is now open.',
      readStatus: true,
    });

    // 2. Authenticate Distributor 1
    const loginRes = await request(app)
      .post('/api/auth/distributor/login')
      .send({
        identifier: 'FPS-4201',
        password: 'dist1234',
      });

    const token = loginRes.body.token;
    assert('1. Distributor Login & JWT Generation', !!token && loginRes.body.success === true);
    const authHeader = `Bearer ${token}`;

    // 3. Distributor Profile & Dashboard Overview
    const profileRes = await request(app)
      .get('/api/distributor/profile')
      .set('Authorization', authHeader);
    assert(
      '2. Get Distributor Profile',
      profileRes.status === 200 &&
        (profileRes.body.data.fullName === 'Ramesh Chandra' || profileRes.body.data.name === 'Ramesh Chandra')
    );

    const dashRes = await request(app)
      .get('/api/distributor/dashboard')
      .set('Authorization', authHeader);
    assert(
      '3. Get Dashboard Summary (Metrics, Inventory, Profile)',
      dashRes.status === 200 && dashRes.body.success === true && dashRes.body.data.inventory.riceStock === 200
    );

    // 4. Beneficiary Management & Data Isolation
    const benListRes = await request(app)
      .get('/api/distributor/beneficiaries')
      .set('Authorization', authHeader);
    const bens = benListRes.body.data || [];
    const hasDist1Bens = bens.some((b) => b.rationCardNumber === 'RC-884210');
    const hasDist2Bens = bens.some((b) => b.rationCardNumber === 'RC-OTHER-001');
    assert(
      '4. Get Assigned Beneficiaries (Strict Distributor Data Isolation)',
      benListRes.status === 200 && bens.length === 2 && hasDist1Bens && !hasDist2Bens
    );

    const benSearchRes = await request(app)
      .get('/api/distributor/beneficiaries/search?rationCardNumber=RC-884210')
      .set('Authorization', authHeader);
    assert(
      '5. Search Beneficiary by Ration Card',
      benSearchRes.status === 200 && benSearchRes.body.data?.fullName === 'Anand Kumar'
    );

    // 5. Monthly Ration Allocation & Inventory Deduction
    const allocRes = await request(app)
      .post('/api/distributor/allocations')
      .set('Authorization', authHeader)
      .send({
        beneficiaryId: ben1._id.toString(),
        month: 'August',
        year: 2026,
        riceAllocated: 25,
        oilAllocated: 2,
        collectionStatus: 'Collected',
      });

    assert(
      '6. Create Monthly Ration Allocation',
      allocRes.status === 201 && allocRes.body.success === true
    );

    // Verify Inventory Deducted (200 - 25 = 175 kg Rice, 50 - 2 = 48 L Oil)
    const invRes = await request(app)
      .get('/api/distributor/inventory')
      .set('Authorization', authHeader);
    assert(
      '7. Inventory Real-Time Deduction Verification',
      invRes.status === 200 && invRes.body.data.riceStock === 175 && invRes.body.data.oilStock === 48
    );

    // 6. Allocation History
    const allocHistoryRes = await request(app)
      .get('/api/distributor/allocations/history')
      .set('Authorization', authHeader);
    assert(
      '8. Get Allocation History',
      allocHistoryRes.status === 200 &&
        allocHistoryRes.body.data.length >= 1 &&
        allocHistoryRes.body.data[0].riceAllocated === 25
    );

    // 7. Transactions
    const todayTxnRes = await request(app)
      .get('/api/distributor/transactions/today')
      .set('Authorization', authHeader);
    assert(
      '9. Get Today Transactions (Auto Created with Allocation)',
      todayTxnRes.status === 200 && todayTxnRes.body.data.length >= 1
    );

    const currentMonthName = new Date().toLocaleString('en-US', { month: 'long' });
    const currentYearVal = new Date().getFullYear();
    const monthlyTxnRes = await request(app)
      .get(`/api/distributor/transactions/monthly?month=${currentMonthName}&year=${currentYearVal}`)
      .set('Authorization', authHeader);
    assert(
      '10. Get Monthly Transactions',
      monthlyTxnRes.status === 200 && monthlyTxnRes.body.data.length >= 1
    );

    // 8. Notifications
    const notifListRes = await request(app)
      .get('/api/distributor/notifications')
      .set('Authorization', authHeader);
    assert(
      '11. Get Distributor Received Notifications',
      notifListRes.status === 200 && notifListRes.body.data.length >= 2
    );

    const unreadNotifRes = await request(app)
      .get('/api/distributor/notifications/unread')
      .set('Authorization', authHeader);
    assert(
      '12. Get Unread Notifications',
      unreadNotifRes.status === 200 && unreadNotifRes.body.data.length === 1
    );

    const markReadRes = await request(app)
      .patch(`/api/distributor/notifications/${notif1._id}/read`)
      .set('Authorization', authHeader);
    assert(
      '13. Mark Single Notification as Read',
      markReadRes.status === 200 && markReadRes.body.data.readStatus === true
    );

    const markAllReadRes = await request(app)
      .patch('/api/distributor/notifications/read-all')
      .set('Authorization', authHeader);
    assert(
      '14. Mark All Notifications as Read',
      markAllReadRes.status === 200 && markAllReadRes.body.success === true
    );

    // 9. Profile & Settings Update
    const updateProfileRes = await request(app)
      .put('/api/distributor/profile')
      .set('Authorization', authHeader)
      .send({
        fullName: 'Ramesh Chandra Gowda',
        storeName: 'Sri Annapurna Supreme PDS',
        mobileNumber: '9988776655',
      });
    assert(
      '15. Update Distributor Profile',
      updateProfileRes.status === 200 &&
        updateProfileRes.body.data.storeName === 'Sri Annapurna Supreme PDS'
    );

    const changePassRes = await request(app)
      .put('/api/distributor/profile/change-password')
      .set('Authorization', authHeader)
      .send({
        currentPassword: 'dist1234',
        newPassword: 'newSecurePassword4201',
      });
    assert(
      '16. Change Distributor Password',
      changePassRes.status === 200 && changePassRes.body.success === true
    );

    // Verify Login with New Password
    const newLoginRes = await request(app)
      .post('/api/auth/distributor/login')
      .send({
        identifier: 'FPS-4201',
        password: 'newSecurePassword4201',
      });
    assert(
      '17. Authenticate with Updated Password',
      newLoginRes.status === 200 && !!newLoginRes.body.token
    );
  } catch (error) {
    console.error('Test Execution Error:', error);
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }

  console.log(`\n========================================`);
  console.log(`Stage 3 Distributor Integration Test Results: ${passed} / ${total} Passed`);
  console.log(`========================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runStage3DistributorTests();
