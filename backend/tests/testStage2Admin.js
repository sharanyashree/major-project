const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const request = require('supertest');
const Admin = require('../models/Admin');
const Distributor = require('../models/Distributor');
const Beneficiary = require('../models/Beneficiary');
const Inventory = require('../models/Inventory');

async function runStage2AdminTests() {
  console.log('--- Starting Stage 2 Admin Frontend-Backend Integration Tests ---');
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
    // 1. Seed Admin
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);
    await Admin.create({
      adminId: 'ADMIN-01',
      password: hashedAdminPassword,
      name: 'Central Admin',
      role: 'Super Admin'
    });

    // Login Admin to obtain JWT Token
    const adminLoginRes = await request(app)
      .post('/api/auth/admin/login')
      .send({ adminId: 'ADMIN-01', password: 'admin123' });
    const adminToken = adminLoginRes.body.token;
    assert('0. Admin Login & JWT Acquisition', !!adminToken);

    const authHeader = `Bearer ${adminToken}`;

    // Seed Distributor
    const hashedDistPassword = await bcrypt.hash('dist1234', 10);
    const dist1 = await Distributor.create({
      name: 'Ramesh FPS Depot',
      distributorId: 'DIST-501',
      fpsCode: 'FPS-501',
      mobileNumber: '9876543210',
      password: hashedDistPassword,
      district: 'Bangalore Urban',
      taluk: 'North Taluk',
      status: 'Pending'
    });

    const dist2 = await Distributor.create({
      name: 'Suresh Fair Price',
      distributorId: 'DIST-502',
      fpsCode: 'FPS-502',
      mobileNumber: '9845012345',
      password: hashedDistPassword,
      district: 'Mysore',
      taluk: 'Mysore South',
      status: 'Active'
    });

    // Seed Beneficiary
    const hashedBenPassword = await bcrypt.hash('user1234', 10);
    const ben1 = await Beneficiary.create({
      fullName: 'Anita Devi',
      rationCardNumber: 'RC55667788',
      mobileNumber: '9123456780',
      password: hashedBenPassword,
      familyMemberCount: 4,
      district: 'Bangalore Urban',
      taluk: 'North Taluk',
      status: 'Active'
    });

    // ----------------------------------------------------
    // 1. Distributor Management
    // ----------------------------------------------------
    // Load real distributors
    const getDistsRes = await request(app)
      .get('/api/admin/distributors')
      .set('Authorization', authHeader);
    assert('1.1. Load all distributors (GET /api/admin/distributors)', getDistsRes.status === 200 && getDistsRes.body.data.length >= 2);

    // Load pending distributors
    const getPendingRes = await request(app)
      .get('/api/admin/distributors/pending')
      .set('Authorization', authHeader);
    assert('1.2. Load pending distributors (GET /api/admin/distributors/pending)', getPendingRes.status === 200 && getPendingRes.body.data.some(d => d.distributorId === 'DIST-501'));

    // Approve distributor
    const approveRes = await request(app)
      .patch(`/api/admin/distributors/${dist1._id}/approve`)
      .set('Authorization', authHeader);
    assert('1.3. Approve distributor (PATCH /api/admin/distributors/:id/approve)', approveRes.status === 200 && approveRes.body.data.status === 'Active');

    // Suspend distributor
    const suspendRes = await request(app)
      .patch(`/api/admin/distributors/${dist1._id}/suspend`)
      .set('Authorization', authHeader);
    assert('1.4. Suspend distributor (PATCH /api/admin/distributors/:id/suspend)', suspendRes.status === 200 && suspendRes.body.data.status === 'Suspended');

    // Activate distributor
    const activateRes = await request(app)
      .patch(`/api/admin/distributors/${dist1._id}/activate`)
      .set('Authorization', authHeader);
    assert('1.5. Activate distributor (PATCH /api/admin/distributors/:id/activate)', activateRes.status === 200 && activateRes.body.data.status === 'Active');

    // Reject distributor (create a temporary one to test reject)
    const distTemp = await Distributor.create({
      name: 'Temp Reject Store',
      distributorId: 'DIST-999',
      fpsCode: 'FPS-999',
      mobileNumber: '9999988888',
      password: hashedDistPassword,
      district: 'Belagavi',
      taluk: 'Chikodi',
      status: 'Pending'
    });
    const rejectRes = await request(app)
      .patch(`/api/admin/distributors/${distTemp._id}/reject`)
      .set('Authorization', authHeader);
    assert('1.6. Reject distributor (PATCH /api/admin/distributors/:id/reject)', rejectRes.status === 200 && (rejectRes.body.data.status === 'Inactive' || rejectRes.body.data.status === 'Rejected'));

    // ----------------------------------------------------
    // 2. Central Inventory
    // ----------------------------------------------------
    // Load inventory
    const getInvRes = await request(app)
      .get('/api/admin/inventory')
      .set('Authorization', authHeader);
    assert('2.1. Load central inventory (GET /api/admin/inventory)', getInvRes.status === 200 && getInvRes.body.data.centralInventory !== undefined);

    // Add Rice stock
    const addRiceRes = await request(app)
      .post('/api/admin/inventory/rice')
      .set('Authorization', authHeader)
      .send({ quantity: 5000 });
    assert('2.2. Add Rice stock (POST /api/admin/inventory/rice)', addRiceRes.status === 200 && addRiceRes.body.data.riceStock >= 5000);

    // Add Oil stock
    const addOilRes = await request(app)
      .post('/api/admin/inventory/oil')
      .set('Authorization', authHeader)
      .send({ quantity: 2000 });
    assert('2.3. Add Oil stock (POST /api/admin/inventory/oil)', addOilRes.status === 200 && addOilRes.body.data.oilStock >= 2000);

    // Update central inventory
    const updateInvRes = await request(app)
      .put('/api/admin/inventory')
      .set('Authorization', authHeader)
      .send({ riceStock: 10000, oilStock: 4000, minimumStock: { rice: 300, oil: 100 } });
    assert('2.4. Update inventory (PUT /api/admin/inventory)', updateInvRes.status === 200 && updateInvRes.body.data.riceStock === 10000 && updateInvRes.body.data.oilStock === 4000);

    // ----------------------------------------------------
    // 3. Stock Dispatch
    // ----------------------------------------------------
    // Dispatch Rice to Distributor
    const dispatchRiceRes = await request(app)
      .post('/api/admin/dispatch/rice')
      .set('Authorization', authHeader)
      .send({ distributorId: dist1._id.toString(), quantity: 1500, vehicleNumber: 'KA-01-PDS-1001' });
    assert('3.1. Dispatch Rice to Distributor (POST /api/admin/dispatch/rice)', dispatchRiceRes.status === 200 && dispatchRiceRes.body.data.riceDispatched === 1500 && dispatchRiceRes.body.data.dispatchRecord.riceQuantity === 1500);

    // Dispatch Oil to Distributor
    const dispatchOilRes = await request(app)
      .post('/api/admin/dispatch/oil')
      .set('Authorization', authHeader)
      .send({ distributorId: dist1._id.toString(), quantity: 400, vehicleNumber: 'KA-01-PDS-1002' });
    assert('3.2. Dispatch Oil to Distributor (POST /api/admin/dispatch/oil)', dispatchOilRes.status === 200 && dispatchOilRes.body.data.oilDispatched === 400 && dispatchOilRes.body.data.dispatchRecord.oilQuantity === 400);

    // Display dispatch history
    const historyRes = await request(app)
      .get('/api/admin/dispatch/history')
      .set('Authorization', authHeader);
    assert('3.3. Get dispatch history (GET /api/admin/dispatch/history)', historyRes.status === 200 && historyRes.body.data.dispatchRecords.length >= 2);

    // ----------------------------------------------------
    // 4. Reports
    // ----------------------------------------------------
    // Summary Report
    const summaryRes = await request(app)
      .get('/api/admin/reports/summary')
      .set('Authorization', authHeader);
    assert('4.1. Load summary report (GET /api/admin/reports/summary)', summaryRes.status === 200 && summaryRes.body.data.totalDistributors >= 2 && summaryRes.body.data.centralInventoryStock !== undefined);

    // Daily Transactions Report
    const dailyRes = await request(app)
      .get('/api/admin/reports/transactions/daily')
      .set('Authorization', authHeader);
    assert('4.2. Load daily transactions report (GET /api/admin/reports/transactions/daily)', dailyRes.status === 200 && Array.isArray(dailyRes.body.data));

    // Monthly Transactions Report
    const monthlyRes = await request(app)
      .get('/api/admin/reports/transactions/monthly?month=8&year=2026')
      .set('Authorization', authHeader);
    assert('4.3. Load monthly transactions report (GET /api/admin/reports/transactions/monthly)', monthlyRes.status === 200 && Array.isArray(monthlyRes.body.data));

    // ----------------------------------------------------
    // 5. Notifications
    // ----------------------------------------------------
    // Broadcast to all distributors
    const notifAllDistRes = await request(app)
      .post('/api/admin/notifications/distributors/all')
      .set('Authorization', authHeader)
      .send({ title: 'Monthly Allocation Released', message: 'Please collect quotas.' });
    assert('5.1. Broadcast to all distributors (POST /api/admin/notifications/distributors/all)', notifAllDistRes.status === 201);

    // Send to single distributor
    const notifSingleDistRes = await request(app)
      .post('/api/admin/notifications/distributor')
      .set('Authorization', authHeader)
      .send({ distributorId: dist1._id.toString(), title: 'Inspection Notice', message: 'Routine audit on Friday.' });
    assert('5.2. Send to single distributor (POST /api/admin/notifications/distributor)', notifSingleDistRes.status === 201);

    // Broadcast to all beneficiaries
    const notifAllBenRes = await request(app)
      .post('/api/admin/notifications/beneficiaries/all')
      .set('Authorization', authHeader)
      .send({ title: 'Ration Window Open', message: 'Rations available from 1st to 20th.' });
    assert('5.3. Broadcast to all beneficiaries (POST /api/admin/notifications/beneficiaries/all)', notifAllBenRes.status === 201);

    // Send to single beneficiary
    const notifSingleBenRes = await request(app)
      .post('/api/admin/notifications/beneficiary')
      .set('Authorization', authHeader)
      .send({ beneficiaryId: ben1._id.toString(), title: 'Card Verified', message: 'Your ration card has been verified.' });
    assert('5.4. Send to single beneficiary (POST /api/admin/notifications/beneficiary)', notifSingleBenRes.status === 201);

    console.log(`\n======================================================`);
    console.log(`Stage 2 Admin Integration Results: ${passed}/${total} assertions passed.`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error('Test Execution Error:', err);
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
    process.exit(passed === total ? 0 : 1);
  }
}

runStage2AdminTests();
