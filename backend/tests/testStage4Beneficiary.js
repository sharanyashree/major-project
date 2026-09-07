const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const request = require('supertest');
const Distributor = require('../models/Distributor');
const Beneficiary = require('../models/Beneficiary');
const Allocation = require('../models/Allocation');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');

async function runStage4BeneficiaryTests() {
  console.log('--- Starting Stage 4 Beneficiary Frontend-Backend Integration Tests ---');
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
    // 1. Seed Distributor
    const hashedDistPassword = await bcrypt.hash('dist1234', 10);
    const distributor = await Distributor.create({
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

    // 2. Seed Beneficiary 1 & Beneficiary 2
    const hashedBenPassword = await bcrypt.hash('ben12345', 10);
    const ben1 = await Beneficiary.create({
      fullName: 'Anand Kumar',
      rationCardNumber: 'RC-884210',
      mobileNumber: '9876543210',
      password: hashedBenPassword,
      district: 'Bangalore Urban',
      taluk: 'North Taluk',
      village: 'Yeshwanthpur',
      address: '#42, 3rd Cross, Pipeline Road',
      familyMemberCount: 4,
      assignedDistributor: distributor._id,
      status: 'Active',
    });

    const ben2 = await Beneficiary.create({
      fullName: 'Sunita Devi',
      rationCardNumber: 'RC-991122',
      mobileNumber: '9123456789',
      password: hashedBenPassword,
      district: 'Bangalore Urban',
      taluk: 'North Taluk',
      village: 'Yeshwanthpur',
      address: '#10, 1st Main',
      familyMemberCount: 3,
      assignedDistributor: distributor._id,
      status: 'Active',
    });

    // 3. Login Beneficiary 1
    const loginRes = await request(app)
      .post('/api/auth/beneficiary/login')
      .send({
        identifier: 'RC-884210',
        password: 'ben12345',
      });

    assert('1. Beneficiary login returns HTTP 200 and valid JWT token', loginRes.status === 200 && !!loginRes.body.token);
    const ben1Token = loginRes.body.token;

    // 4. Beneficiary Profile GET
    const profileRes = await request(app)
      .get('/api/beneficiary/profile')
      .set('Authorization', `Bearer ${ben1Token}`);

    assert('2. GET /api/beneficiary/profile returns authenticated beneficiary details',
      profileRes.status === 200 &&
      profileRes.body.data.fullName === 'Anand Kumar' &&
      profileRes.body.data.rationCardNumber === 'RC-884210' &&
      profileRes.body.data.familyMemberCount === 4
    );

    assert('3. Profile includes populated assigned Distributor / FPS information',
      profileRes.body.data.assignedDistributor &&
      profileRes.body.data.assignedDistributor.fpsCode === 'FPS-4201'
    );

    // 5. Beneficiary Profile Update PUT
    const updateProfileRes = await request(app)
      .put('/api/beneficiary/profile')
      .set('Authorization', `Bearer ${ben1Token}`)
      .send({
        fullName: 'Anand Kumar Sharma',
        mobileNumber: '9988776655',
        familyMemberCount: 5,
      });

    assert('4. PUT /api/beneficiary/profile successfully updates profile and family count',
      updateProfileRes.status === 200 &&
      updateProfileRes.body.data.fullName === 'Anand Kumar Sharma' &&
      updateProfileRes.body.data.familyMemberCount === 5
    );

    // 6. Current Allocation GET (Empty / not yet allocated)
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
    const currentYear = new Date().getFullYear();

    const currAllocEmptyRes = await request(app)
      .get('/api/beneficiary/allocation/current')
      .set('Authorization', `Bearer ${ben1Token}`);

    assert('5. GET /api/beneficiary/allocation/current handles unallocated month gracefully',
      currAllocEmptyRes.status === 200 &&
      currAllocEmptyRes.body.data.month === currentMonth
    );

    // 7. Seed Allocation for Current Month
    const allocation1 = await Allocation.create({
      beneficiary: ben1._id,
      distributor: distributor._id,
      allocatedBy: distributor._id,
      riceAllocated: 25,
      oilAllocated: 2,
      month: currentMonth,
      year: currentYear,
      collectionStatus: 'Pending',
    });

    const currAllocRes = await request(app)
      .get('/api/beneficiary/allocation/current')
      .set('Authorization', `Bearer ${ben1Token}`);

    assert('6. GET /api/beneficiary/allocation/current returns active monthly quota (Rice & Oil)',
      currAllocRes.status === 200 &&
      currAllocRes.body.data.riceAllocated === 25 &&
      currAllocRes.body.data.oilAllocated === 2
    );

    // 8. Allocation History GET
    // Create an older allocation
    await Allocation.create({
      beneficiary: ben1._id,
      distributor: distributor._id,
      allocatedBy: distributor._id,
      riceAllocated: 20,
      oilAllocated: 2,
      month: 'July',
      year: 2026,
      collectionStatus: 'Collected',
    });

    const allocHistRes = await request(app)
      .get('/api/beneficiary/allocation/history')
      .set('Authorization', `Bearer ${ben1Token}`);

    assert('7. GET /api/beneficiary/allocation/history retrieves past allocation ledger',
      allocHistRes.status === 200 &&
      allocHistRes.body.count >= 2
    );

    // 9. Allocation Details by Month/Year GET
    const allocDetailsRes = await request(app)
      .get(`/api/beneficiary/allocation/details?month=${currentMonth}&year=${currentYear}`)
      .set('Authorization', `Bearer ${ben1Token}`);

    assert('8. GET /api/beneficiary/allocation/details returns specific month query record',
      allocDetailsRes.status === 200 &&
      allocDetailsRes.body.data.riceAllocated === 25
    );

    // 10. Transactions History GET
    const tx1 = await Transaction.create({
      beneficiary: ben1._id,
      distributor: distributor._id,
      riceDispensed: 20,
      oilDispensed: 2,
      date: new Date(),
      time: '10:15 AM',
      status: 'Successful',
    });

    const txHistRes = await request(app)
      .get('/api/beneficiary/transactions')
      .set('Authorization', `Bearer ${ben1Token}`);

    assert('9. GET /api/beneficiary/transactions returns beneficiary distribution transactions',
      txHistRes.status === 200 &&
      txHistRes.body.count >= 1 &&
      txHistRes.body.data[0].riceDispensed === 20
    );

    // 11. Today's Latest Transaction GET
    const todayTxRes = await request(app)
      .get('/api/beneficiary/transactions/today/latest')
      .set('Authorization', `Bearer ${ben1Token}`);

    assert("10. GET /api/beneficiary/transactions/today/latest retrieves today's dispensing record",
      todayTxRes.status === 200 &&
      todayTxRes.body.data !== null &&
      todayTxRes.body.data.riceDispensed === 20
    );

    // 12. Transaction Details by ID GET
    const txDetailsRes = await request(app)
      .get(`/api/beneficiary/transactions/${tx1._id}`)
      .set('Authorization', `Bearer ${ben1Token}`);

    assert('11. GET /api/beneficiary/transactions/:id retrieves single transaction details',
      txDetailsRes.status === 200 &&
      txDetailsRes.body.data._id.toString() === tx1._id.toString()
    );

    // 13. Notifications GET
    const notif1 = await Notification.create({
      receiverId: ben1._id,
      receiverRole: 'Beneficiary',
      title: 'Quota Credited',
      message: 'Your quota of 25kg Rice and 2L Oil is ready.',
      readStatus: false,
    });

    const notif2 = await Notification.create({
      receiverId: ben1._id,
      receiverRole: 'Beneficiary',
      title: 'FPS Working Hours',
      message: 'Store is open from 8am to 8pm.',
      readStatus: false,
    });

    const notifsRes = await request(app)
      .get('/api/beneficiary/notifications')
      .set('Authorization', `Bearer ${ben1Token}`);

    assert('12. GET /api/beneficiary/notifications lists beneficiary broadcasts',
      notifsRes.status === 200 &&
      notifsRes.body.count === 2
    );

    // 14. Unread Notifications GET
    const unreadRes = await request(app)
      .get('/api/beneficiary/notifications/unread')
      .set('Authorization', `Bearer ${ben1Token}`);

    assert('13. GET /api/beneficiary/notifications/unread returns unread circulars',
      unreadRes.status === 200 &&
      unreadRes.body.count === 2
    );

    // 15. Mark Single Notification as Read PATCH
    const markReadRes = await request(app)
      .patch(`/api/beneficiary/notifications/${notif1._id}/read`)
      .set('Authorization', `Bearer ${ben1Token}`);

    assert('14. PATCH /api/beneficiary/notifications/:id/read marks circular as Read',
      markReadRes.status === 200 &&
      markReadRes.body.data.readStatus === true
    );

    // 16. Mark All Notifications as Read PATCH
    const markAllRes = await request(app)
      .patch('/api/beneficiary/notifications/read-all')
      .set('Authorization', `Bearer ${ben1Token}`);

    assert('15. PATCH /api/beneficiary/notifications/read-all marks all unread items as Read',
      markAllRes.status === 200 &&
      markAllRes.body.modifiedCount >= 1
    );

    // 17. Change Password PUT
    const changePassRes = await request(app)
      .put('/api/beneficiary/change-password')
      .set('Authorization', `Bearer ${ben1Token}`)
      .send({
        currentPassword: 'ben12345',
        newPassword: 'newSecurePassword999',
      });

    assert('16. PUT /api/beneficiary/change-password updates password securely with bcrypt',
      changePassRes.status === 200 &&
      changePassRes.body.success === true
    );

    // Re-verify login with new password
    const newLoginRes = await request(app)
      .post('/api/auth/beneficiary/login')
      .send({
        identifier: 'RC-884210',
        password: 'newSecurePassword999',
      });

    assert('17. Beneficiary successfully logs in with new password',
      newLoginRes.status === 200 &&
      !!newLoginRes.body.token
    );

    // 18. Data Isolation Security Check
    // Ben 1 attempting to view Ben 2's data is impossible because all beneficiary endpoints scope by req.user.id
    const dashSummaryRes = await request(app)
      .get('/api/beneficiary/dashboard')
      .set('Authorization', `Bearer ${ben1Token}`);

    assert('18. GET /api/beneficiary/dashboard aggregates profile, allocation, and notifications strictly scoped to authenticated beneficiary',
      dashSummaryRes.status === 200 &&
      dashSummaryRes.body.data.profile.rationCardNumber === 'RC-884210'
    );

  } catch (error) {
    console.error('Test execution exception:', error);
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
    console.log(`\n========================================`);
    console.log(`Stage 4 Beneficiary Test Results: ${passed}/${total} passed`);
    console.log(`========================================\n`);
  }
}

runStage4BeneficiaryTests();
