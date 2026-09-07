const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../app');

// Database Models
const Admin = require('../models/Admin');
const Distributor = require('../models/Distributor');
const Beneficiary = require('../models/Beneficiary');
const Inventory = require('../models/Inventory');
const DispatchRecord = require('../models/DispatchRecord');
const Allocation = require('../models/Allocation');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');

async function runStage5E2ETests() {
  console.log('========================================================================');
  console.log('🚀 STAGE 5: COMPLETE FRONTEND END-TO-END WORKFLOW INTEGRATION SUITE');
  console.log('========================================================================\n');

  const mongoServer = await MongoMemoryServer.create();
  await mongoose.disconnect();
  await mongoose.connect(mongoServer.getUri());

  let totalTests = 0;
  let passedTests = 0;

  function assert(title, condition, extraInfo = '') {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${title} ${extraInfo ? '(' + extraInfo + ')' : ''}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${title} ${extraInfo ? '(' + extraInfo + ')' : ''}`);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // SEED INITIAL ADMIN
    // -------------------------------------------------------------------------
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);
    const adminUser = await Admin.create({
      fullName: 'Chief Supply Officer',
      name: 'Chief Supply Officer',
      adminId: 'ADM-001',
      email: 'admin@pds.gov.in',
      password: hashedAdminPassword,
      role: 'Admin',
    });

    // =========================================================================
    // WORKFLOW 1: BENEFICIARY REGISTRATION
    // =========================================================================
    console.log('\n--- 1. BENEFICIARY REGISTRATION WORKFLOW ---');
    const benRegisterPayload = {
      fullName: 'Meera Bai',
      rationCardNumber: 'RC-998877',
      mobileNumber: '9845012345',
      familyMemberCount: 4,
      district: 'Bangalore Urban',
      taluk: 'South Taluk',
      village: 'Jayanagar',
      address: '#14, 4th Main, 9th Block, Jayanagar',
      password: 'password123',
    };

    const benRegRes = await request(app)
      .post('/api/auth/beneficiary/register')
      .send(benRegisterPayload);

    assert('1.1 Beneficiary registers via frontend API endpoint', benRegRes.status === 201);
    
    // Verify stored in MongoDB
    const benInDb = await Beneficiary.findOne({ rationCardNumber: 'RC-998877' });
    assert('1.2 Beneficiary record properly persisted in MongoDB', benInDb !== null && benInDb.fullName === 'Meera Bai');

    // Duplicate Registration Validation
    const benDupRes = await request(app)
      .post('/api/auth/beneficiary/register')
      .send(benRegisterPayload);

    assert('1.3 Duplicate Beneficiary registration rejected with 400 Bad Request', benDupRes.status === 400);

    // Missing required fields validation
    const benInvalidRes = await request(app)
      .post('/api/auth/beneficiary/register')
      .send({ fullName: 'Incomplete User' });

    assert('1.4 Incomplete Beneficiary registration rejected with 400 Bad Request', benInvalidRes.status === 400);

    // =========================================================================
    // WORKFLOW 2: DISTRIBUTOR REGISTRATION
    // =========================================================================
    console.log('\n--- 2. DISTRIBUTOR REGISTRATION WORKFLOW ---');
    const distRegisterPayload = {
      name: 'Suresh Patil',
      distributorId: 'DIST-501',
      fpsCode: 'FPS-501',
      fpsName: 'Patil Seva Kendra',
      mobileNumber: '9880011223',
      email: 'suresh.fps501@gmail.com',
      district: 'Bangalore Urban',
      taluk: 'South Taluk',
      village: 'Jayanagar',
      address: '#88, Bazaar Road, Jayanagar',
      password: 'distPassword123',
    };

    const distRegRes = await request(app)
      .post('/api/auth/distributor/register')
      .send(distRegisterPayload);

    assert('2.1 Distributor registers via frontend API endpoint', distRegRes.status === 201);

    // Verify stored in MongoDB with 'Pending' status
    const distInDb = await Distributor.findOne({ distributorId: 'DIST-501' });
    assert('2.2 Distributor stored in MongoDB with initial "Pending" status', distInDb !== null && distInDb.status === 'Pending');

    // Duplicate Distributor Registration
    const distDupRes = await request(app)
      .post('/api/auth/distributor/register')
      .send(distRegisterPayload);

    assert('2.3 Duplicate Distributor registration rejected with 400 Bad Request', distDupRes.status === 400);

    // Distributor cannot login while status is Pending
    const pendingLoginRes = await request(app)
      .post('/api/auth/distributor/login')
      .send({
        distributorId: 'DIST-501',
        password: 'distPassword123',
      });

    assert('2.4 Pending Distributor login rejected with 403 Forbidden until Admin approval', pendingLoginRes.status === 403);

    // =========================================================================
    // WORKFLOW 3: ADMIN LOGIN & DASHBOARD DATA
    // =========================================================================
    console.log('\n--- 3. ADMIN LOGIN WORKFLOW ---');
    const adminLoginRes = await request(app)
      .post('/api/auth/admin/login')
      .send({
        adminId: 'ADM-001',
        password: 'admin123',
      });

    assert('3.1 Admin authenticates successfully with status 200', adminLoginRes.status === 200 && !!adminLoginRes.body.token);
    const adminToken = adminLoginRes.body.token;

    // Verify Admin Dashboard loads real metrics
    const adminMetricsRes = await request(app)
      .get('/api/admin/reports/summary')
      .set('Authorization', `Bearer ${adminToken}`);

    assert('3.2 Admin summary metrics load live database counts', adminMetricsRes.status === 200 && adminMetricsRes.body.data !== undefined);

    // =========================================================================
    // WORKFLOW 4: ADMIN DISTRIBUTOR MANAGEMENT & APPROVAL
    // =========================================================================
    console.log('\n--- 4. ADMIN DISTRIBUTOR MANAGEMENT WORKFLOW ---');
    // List all distributors
    const allDistRes = await request(app)
      .get('/api/admin/distributors')
      .set('Authorization', `Bearer ${adminToken}`);

    assert('4.1 Admin lists all distributors', allDistRes.status === 200 && Array.isArray(allDistRes.body.data));

    // List pending distributors
    const pendingDistRes = await request(app)
      .get('/api/admin/distributors/pending')
      .set('Authorization', `Bearer ${adminToken}`);

    assert('4.2 Admin retrieves pending distributor registrations', 
      pendingDistRes.status === 200 && 
      pendingDistRes.body.data.some(d => d.distributorId === 'DIST-501')
    );

    // Approve distributor
    const approveRes = await request(app)
      .patch(`/api/admin/distributors/${distInDb._id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert('4.3 Admin approves pending distributor', approveRes.status === 200);

    // Verify status updated in MongoDB
    const updatedDistInDb = await Distributor.findById(distInDb._id);
    assert('4.4 Distributor status updated to "Active" in MongoDB', updatedDistInDb.status === 'Active');

    // Newly approved distributor can now log in
    const activeLoginRes = await request(app)
      .post('/api/auth/distributor/login')
      .send({
        distributorId: 'DIST-501',
        password: 'distPassword123',
      });

    assert('4.5 Approved distributor logs in successfully with status 200 & JWT token', activeLoginRes.status === 200 && !!activeLoginRes.body.token);
    const distToken = activeLoginRes.body.token;

    // =========================================================================
    // WORKFLOW 5: ADMIN INVENTORY MANAGEMENT
    // =========================================================================
    console.log('\n--- 5. ADMIN INVENTORY MANAGEMENT WORKFLOW ---');
    // Add Rice stock
    const addRiceRes = await request(app)
      .post('/api/admin/inventory/rice')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 8000, notes: 'FCI Grain Hub Shipment' });

    assert('5.1 Admin adds Rice stock to Central Inventory', addRiceRes.status === 200);

    // Add Oil stock
    const addOilRes = await request(app)
      .post('/api/admin/inventory/oil')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 3000, notes: 'State Edible Oil Stock' });

    assert('5.2 Admin adds Oil stock to Central Inventory', addOilRes.status === 200);

    // Verify Central Inventory in MongoDB
    const centralInvRes = await request(app)
      .get('/api/admin/inventory')
      .set('Authorization', `Bearer ${adminToken}`);

    const centralInvData = centralInvRes.body.data?.centralInventory || centralInvRes.body.data;
    assert('5.3 Central Inventory verified (Rice >= 8000kg, Oil >= 3000L)',
      centralInvRes.status === 200 &&
      centralInvData.riceStock >= 8000 &&
      centralInvData.oilStock >= 3000
    );

    // =========================================================================
    // WORKFLOW 6: ADMIN STOCK DISPATCH
    // =========================================================================
    console.log('\n--- 6. ADMIN STOCK DISPATCH WORKFLOW ---');
    const initialCentralRice = centralInvData.riceStock;
    const initialCentralOil = centralInvData.oilStock;

    // Dispatch Rice to Distributor
    const dispatchRiceRes = await request(app)
      .post('/api/admin/dispatch/rice')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        distributorId: distInDb._id.toString(),
        quantity: 1500,
        remarks: 'Monthly Stock Allocation for FPS-501',
      });

    assert('6.1 Admin dispatches 1500kg Rice to Distributor', dispatchRiceRes.status === 200);

    // Dispatch Oil to Distributor
    const dispatchOilRes = await request(app)
      .post('/api/admin/dispatch/oil')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        distributorId: distInDb._id.toString(),
        quantity: 400,
        remarks: 'Monthly Stock Allocation for FPS-501',
      });

    assert('6.2 Admin dispatches 400L Oil to Distributor', dispatchOilRes.status === 200);

    // Verify Central inventory deducted
    const postDispatchInvRes = await request(app)
      .get('/api/admin/inventory')
      .set('Authorization', `Bearer ${adminToken}`);

    const postCentralInvData = postDispatchInvRes.body.data?.centralInventory || postDispatchInvRes.body.data;
    assert('6.3 Central Inventory deducted correctly',
      postCentralInvData.riceStock === initialCentralRice - 1500 &&
      postCentralInvData.oilStock === initialCentralOil - 400
    );

    // Verify Distributor Inventory increased in MongoDB
    const distInventoryDoc = await Inventory.findOne({ distributor: distInDb._id });
    assert('6.4 Distributor stock credited (1500kg Rice, 400L Oil)',
      distInventoryDoc !== null &&
      distInventoryDoc.riceStock === 1500 &&
      distInventoryDoc.oilStock === 400
    );

    // Verify DispatchRecord documents in MongoDB
    const dispatchRecords = await DispatchRecord.find({ distributor: distInDb._id });
    assert('6.5 DispatchRecords created and logged in MongoDB (count = 2)', dispatchRecords.length === 2);

    // =========================================================================
    // WORKFLOW 7: DISTRIBUTOR LOGIN & DATA ISOLATION
    // =========================================================================
    console.log('\n--- 7. DISTRIBUTOR LOGIN & DASHBOARD DATA WORKFLOW ---');
    const distDashRes = await request(app)
      .get('/api/distributor/dashboard')
      .set('Authorization', `Bearer ${distToken}`);

    assert('7.1 Distributor dashboard loads distributor-scoped profile & metrics',
      distDashRes.status === 200 &&
      distDashRes.body.data.profile.distributorId === 'DIST-501'
    );

    assert('7.2 Distributor dashboard reflects allocated inventory (1500kg Rice, 400L Oil)',
      distDashRes.body.data.inventory.riceStock === 1500 &&
      distDashRes.body.data.inventory.oilStock === 400
    );

    // =========================================================================
    // WORKFLOW 8: DISTRIBUTOR BENEFICIARY MANAGEMENT & SEARCH
    // =========================================================================
    console.log('\n--- 8. DISTRIBUTOR BENEFICIARY MANAGEMENT WORKFLOW ---');
    // Assign Beneficiary 1 to Distributor 1
    await Beneficiary.findByIdAndUpdate(benInDb._id, { assignedDistributor: distInDb._id });

    // Create a 2nd Distributor for data isolation verification
    const hashedDist2Password = await bcrypt.hash('dist2Pass', 10);
    const dist2 = await Distributor.create({
      fullName: 'Prakash Rao',
      name: 'Prakash Rao',
      distributorId: 'DIST-502',
      fpsCode: 'FPS-502',
      storeName: 'Rao PDS Store',
      mobileNumber: '9770022334',
      email: 'prakash.fps502@gmail.com',
      password: hashedDist2Password,
      district: 'Bangalore Urban',
      taluk: 'North Taluk',
      status: 'Active',
    });

    const dist2LoginRes = await request(app)
      .post('/api/auth/distributor/login')
      .send({ distributorId: 'DIST-502', password: 'dist2Pass' });
    const dist2Token = dist2LoginRes.body.token;

    // Get assigned beneficiaries for Distributor 1
    const dist1BensRes = await request(app)
      .get('/api/distributor/beneficiaries')
      .set('Authorization', `Bearer ${distToken}`);

    assert('8.1 Distributor 1 sees assigned beneficiary (Meera Bai)',
      dist1BensRes.status === 200 &&
      dist1BensRes.body.data.some(b => b.rationCardNumber === 'RC-998877')
    );

    // Search Beneficiary by Ration Card
    const searchBenRes = await request(app)
      .get('/api/distributor/beneficiaries/search?rationCard=RC-998877')
      .set('Authorization', `Bearer ${distToken}`);

    assert('8.2 Search beneficiary by Ration Card number works',
      searchBenRes.status === 200 &&
      searchBenRes.body.data.rationCardNumber === 'RC-998877'
    );

    // Data Isolation Check: Distributor 2 should NOT see Distributor 1's assigned beneficiaries
    const dist2BensRes = await request(app)
      .get('/api/distributor/beneficiaries')
      .set('Authorization', `Bearer ${dist2Token}`);

    assert('8.3 Distributor 2 does NOT see Distributor 1 beneficiaries (Data Isolation Enforced)',
      dist2BensRes.status === 200 &&
      !dist2BensRes.body.data.some(b => b.rationCardNumber === 'RC-998877')
    );

    // =========================================================================
    // WORKFLOW 9: DISTRIBUTOR ALLOCATION CREATION
    // =========================================================================
    console.log('\n--- 9. DISTRIBUTOR ALLOCATION WORKFLOW ---');
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
    const currentYear = new Date().getFullYear();

    const createAllocRes = await request(app)
      .post('/api/distributor/allocations')
      .set('Authorization', `Bearer ${distToken}`)
      .send({
        beneficiaryId: benInDb._id.toString(),
        riceAllocated: 20,
        oilAllocated: 2,
        month: currentMonth,
        year: currentYear,
      });

    assert('9.1 Distributor creates monthly allocation (20kg Rice, 2L Oil)', createAllocRes.status === 201);

    // Verify Allocation record in MongoDB
    const allocInDb = await Allocation.findOne({
      beneficiary: benInDb._id,
      month: currentMonth,
      year: currentYear,
    });

    assert('9.2 Allocation persisted in MongoDB with "Pending" collection status',
      allocInDb !== null &&
      allocInDb.riceAllocated === 20 &&
      allocInDb.oilAllocated === 2 &&
      allocInDb.collectionStatus === 'Pending'
    );

    // Excess Allocation Validation (Quantity exceeds distributor stock)
    const excessAllocRes = await request(app)
      .post('/api/distributor/allocations')
      .set('Authorization', `Bearer ${distToken}`)
      .send({
        beneficiaryId: benInDb._id.toString(),
        riceAllocated: 999999, // Exceeds available stock
        oilAllocated: 999999,
        month: 'December',
        year: currentYear,
      });

    assert('9.3 Excessive allocation exceeding inventory rejected with 400 Bad Request', excessAllocRes.status === 400);

    // =========================================================================
    // WORKFLOW 10: BENEFICIARY LOGIN & ALLOCATION DISPLAY
    // =========================================================================
    console.log('\n--- 10. BENEFICIARY LOGIN & DATA VERIFICATION WORKFLOW ---');
    const benLoginRes = await request(app)
      .post('/api/auth/beneficiary/login')
      .send({
        rationCardNumber: 'RC-998877',
        password: 'password123',
      });

    assert('10.1 Beneficiary logs in with status 200 & valid JWT token', benLoginRes.status === 200 && !!benLoginRes.body.token);
    const benToken = benLoginRes.body.token;

    // Verify Beneficiary Profile includes assigned FPS details
    const benProfileRes = await request(app)
      .get('/api/beneficiary/profile')
      .set('Authorization', `Bearer ${benToken}`);

    assert('10.2 Beneficiary profile loads with populated assigned Distributor / FPS shop',
      benProfileRes.status === 200 &&
      benProfileRes.body.data.assignedDistributor &&
      benProfileRes.body.data.assignedDistributor.fpsCode === 'FPS-501'
    );

    // Verify Current Month Allocation
    const benCurrAllocRes = await request(app)
      .get('/api/beneficiary/allocation/current')
      .set('Authorization', `Bearer ${benToken}`);

    assert('10.3 Beneficiary sees active monthly allocation (20kg Rice, 2L Oil, Pending status)',
      benCurrAllocRes.status === 200 &&
      benCurrAllocRes.body.data.riceAllocated === 20 &&
      benCurrAllocRes.body.data.oilAllocated === 2 &&
      benCurrAllocRes.body.data.collectionStatus === 'Pending'
    );

    // =========================================================================
    // WORKFLOW 11: NOTIFICATIONS SYSTEM
    // =========================================================================
    console.log('\n--- 11. NOTIFICATIONS SYSTEM WORKFLOW ---');
    // Admin broadcasts notification to all distributors
    const distBroadcastRes = await request(app)
      .post('/api/admin/notifications/distributors/all')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Monthly Distribution Timeline',
        message: 'All FPS centers must complete disbursement by 25th.',
      });

    assert('11.1 Admin broadcasts circular to distributors', distBroadcastRes.status === 201);

    // Admin sends notification to specific beneficiary
    const benDirectNotifRes = await request(app)
      .post('/api/admin/notifications/beneficiary')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        beneficiaryId: benInDb._id.toString(),
        title: 'Quota Available Notice',
        message: 'Your 20kg Rice & 2L Oil allocation is available at FPS-501.',
      });

    assert('11.2 Admin sends direct notification to Beneficiary', benDirectNotifRes.status === 201);

    // Beneficiary fetches notifications
    const benNotifsRes = await request(app)
      .get('/api/beneficiary/notifications')
      .set('Authorization', `Bearer ${benToken}`);

    assert('11.3 Beneficiary receives official notification in inbox',
      benNotifsRes.status === 200 &&
      benNotifsRes.body.data.some(n => n.title === 'Quota Available Notice')
    );

    const targetNotif = benNotifsRes.body.data.find(n => n.title === 'Quota Available Notice');
    assert('11.4 Notification initial status is Unread (readStatus = false)', targetNotif && targetNotif.readStatus === false);

    // Beneficiary marks notification as read
    const markReadRes = await request(app)
      .patch(`/api/beneficiary/notifications/${targetNotif._id}/read`)
      .set('Authorization', `Bearer ${benToken}`);

    assert('11.5 Mark notification as read returns success', markReadRes.status === 200);

    // Verify read status persists in MongoDB
    const notifInDb = await Notification.findById(targetNotif._id);
    assert('11.6 Read status persists in MongoDB (readStatus = true)', notifInDb.readStatus === true);

    // =========================================================================
    // WORKFLOW 12: TRANSACTION DISPLAY & LEDGER
    // =========================================================================
    console.log('\n--- 12. TRANSACTION DISPLAY & LEDGER WORKFLOW ---');
    // Create completed distribution transaction
    const tx = await Transaction.create({
      beneficiary: benInDb._id,
      distributor: distInDb._id,
      riceDispensed: 20,
      oilDispensed: 2,
      date: new Date(),
      time: '11:30 AM',
      status: 'Successful',
    });

    // Update allocation to Collected
    await Allocation.findByIdAndUpdate(allocInDb._id, { collectionStatus: 'Collected' });

    // Distributor queries transactions
    const distTxRes = await request(app)
      .get('/api/distributor/transactions/today')
      .set('Authorization', `Bearer ${distToken}`);

    assert('12.1 Distributor transaction ledger displays completed transaction',
      distTxRes.status === 200 &&
      distTxRes.body.data.some(t => t._id.toString() === tx._id.toString() && t.riceDispensed === 20)
    );

    // Beneficiary queries transaction history
    const benTxRes = await request(app)
      .get('/api/beneficiary/transactions')
      .set('Authorization', `Bearer ${benToken}`);

    assert('12.2 Beneficiary transaction history reflects dispensed quota and timestamp',
      benTxRes.status === 200 &&
      benTxRes.body.data.some(t => t._id.toString() === tx._id.toString() && t.oilDispensed === 2)
    );

    // =========================================================================
    // WORKFLOW 13: LOGOUT & SESSION SECURITY (RBAC)
    // =========================================================================
    console.log('\n--- 13. LOGOUT & SESSION SECURITY (RBAC) WORKFLOW ---');
    // 13.1 Missing token rejected with 401
    const noTokenRes = await request(app).get('/api/admin/distributors');
    assert('13.1 Request without JWT token rejected with 401 Unauthorized', noTokenRes.status === 401);

    // 13.2 Malformed / invalid token rejected with 401
    const badTokenRes = await request(app)
      .get('/api/admin/distributors')
      .set('Authorization', 'Bearer invalid.jwt.token.string');
    assert('13.2 Request with malformed JWT token rejected with 401 Unauthorized', badTokenRes.status === 401);

    // 13.3 Role escalation prevention: Beneficiary trying to call Admin endpoint
    const benToAdminRes = await request(app)
      .post('/api/admin/inventory/rice')
      .set('Authorization', `Bearer ${benToken}`)
      .send({ quantity: 500 });
    assert('13.3 Beneficiary token rejected from Admin endpoints with 403 Forbidden', benToAdminRes.status === 403);

    // 13.4 Role escalation prevention: Distributor trying to call Admin dispatch
    const distToAdminRes = await request(app)
      .post('/api/admin/dispatch/rice')
      .set('Authorization', `Bearer ${distToken}`)
      .send({ distributorId: distInDb._id.toString(), quantity: 100 });
    assert('13.4 Distributor token rejected from Admin dispatch with 403 Forbidden', distToAdminRes.status === 403);

    // 13.5 Role escalation prevention: Beneficiary trying to call Distributor allocation endpoint
    const benToDistRes = await request(app)
      .post('/api/distributor/allocations')
      .set('Authorization', `Bearer ${benToken}`)
      .send({ beneficiaryId: benInDb._id.toString(), riceAllocated: 10, oilAllocated: 1 });
    assert('13.5 Beneficiary token rejected from Distributor endpoints with 403 Forbidden', benToDistRes.status === 403);

    // 13.6 Logout API endpoint
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${benToken}`);
    assert('13.6 Logout endpoint responds with 200 OK', logoutRes.status === 200);

    // =========================================================================
    // WORKFLOW 14: REFRESH TEST (PERSISTENCE & REHYDRATION)
    // =========================================================================
    console.log('\n--- 14. REFRESH & STATE REHYDRATION WORKFLOW ---');
    // Re-verify that subsequent GET requests retrieve fresh database state without re-login
    const refreshAdminRes = await request(app)
      .get('/api/admin/inventory')
      .set('Authorization', `Bearer ${adminToken}`);
    const refreshAdminData = refreshAdminRes.body.data?.centralInventory || refreshAdminRes.body.data;
    assert('14.1 Admin dashboard rehydrates live state on simulated page refresh', refreshAdminRes.status === 200 && refreshAdminData.riceStock > 0);

    const refreshDistRes = await request(app)
      .get('/api/distributor/dashboard')
      .set('Authorization', `Bearer ${distToken}`);
    assert('14.2 Distributor dashboard rehydrates live state on simulated page refresh', refreshDistRes.status === 200 && refreshDistRes.body.data.inventory.riceStock > 0);

    const refreshBenRes = await request(app)
      .get('/api/beneficiary/dashboard')
      .set('Authorization', `Bearer ${benToken}`);
    assert('14.3 Beneficiary dashboard rehydrates live state on simulated page refresh', refreshBenRes.status === 200 && refreshBenRes.body.data.profile.rationCardNumber === 'RC-998877');

    // =========================================================================
    // WORKFLOW 15: UI / API ERROR HANDLING
    // =========================================================================
    console.log('\n--- 15. UI / API ERROR HANDLING WORKFLOW ---');
    // 15.1 Invalid login credentials
    const badLoginRes = await request(app)
      .post('/api/auth/beneficiary/login')
      .send({ rationCardNumber: 'RC-998877', password: 'wrongPassword99' });
    assert('15.1 Invalid password returns 401 and descriptive error message', badLoginRes.status === 401 && badLoginRes.body.message !== undefined);

    // 15.2 Non-existent user login
    const nonExistentLoginRes = await request(app)
      .post('/api/auth/beneficiary/login')
      .send({ rationCardNumber: 'RC-000000', password: 'password123' });
    assert('15.2 Non-existent user login returns 401 / 404', nonExistentLoginRes.status === 401 || nonExistentLoginRes.status === 404);

    // 15.3 Dispatching stock exceeding central inventory
    const excessDispatchRes = await request(app)
      .post('/api/admin/dispatch/rice')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ distributorId: distInDb._id.toString(), quantity: 9999999 });
    assert('15.3 Dispatch exceeding central stock rejected with 400 Bad Request', excessDispatchRes.status === 400);

    // 15.4 Non-existent entity lookup
    const nonExistentTxRes = await request(app)
      .get('/api/beneficiary/transactions/600000000000000000000000')
      .set('Authorization', `Bearer ${benToken}`);
    assert('15.4 Non-existent transaction ID handled gracefully with 404', nonExistentTxRes.status === 404);

    // 15.5 Empty search query handled gracefully
    const emptySearchRes = await request(app)
      .get('/api/distributor/beneficiaries/search?rationCard=NON_EXISTENT_CARD')
      .set('Authorization', `Bearer ${distToken}`);
    assert('15.5 Non-matching search query handled gracefully with 404', emptySearchRes.status === 404);

  } catch (err) {
    console.error('Stage 5 E2E Exception:', err);
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
    console.log('\n========================================================================');
    console.log(`🏁 STAGE 5 E2E TEST RESULTS: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
    console.log('========================================================================\n');
  }
}

runStage5E2ETests();
