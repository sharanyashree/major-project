const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../app');
const Admin = require('../models/Admin');
const Distributor = require('../models/Distributor');
const Beneficiary = require('../models/Beneficiary');
const Inventory = require('../models/Inventory');
const Allocation = require('../models/Allocation');
const Transaction = require('../models/Transaction');
const OTP = require('../models/OTP');
const Notification = require('../models/Notification');
const DispatchRecord = require('../models/DispatchRecord');

async function runAllTests() {
  console.log('====================================================');
  console.log('🚀 STARTING COMPREHENSIVE BACKEND API & WORKFLOW TESTS');
  console.log('====================================================\n');

  let mongoServer;
  const testResults = [];

  function recordResult(num, description, passed, details = '') {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} [Test ${num}] ${description} ${details ? '(' + details + ')' : ''}`);
    testResults.push({ num, description, passed, details });
  }

  try {
    // 1. MongoDB Connection
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    recordResult(1, 'MongoDB connection established successfully', mongoose.connection.readyState === 1);

    // 2. Admin Seed and Admin Login
    const adminPassword = 'AdminPassword123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const seededAdmin = await Admin.create({
      name: 'Central System Admin',
      adminId: 'ADMIN001',
      email: 'admin@ration.gov.in',
      password: hashedPassword,
      role: 'Admin',
      department: 'Civil Supplies and Consumer Affairs',
      designation: 'Director of Food Distribution',
      phoneNumber: '9876543210',
    });

    const adminLoginRes = await request(app)
      .post('/api/auth/admin/login')
      .send({ adminId: 'ADMIN001', password: 'AdminPassword123' });

    const adminToken = adminLoginRes.body.token;
    recordResult(
      2,
      'Admin seed and Admin login',
      adminLoginRes.status === 200 && !!adminToken && adminLoginRes.body.data.adminId === 'ADMIN001',
      `Status: ${adminLoginRes.status}`
    );

    // 3. Distributor Registration and Login
    const distRegRes = await request(app)
      .post('/api/auth/distributor/register')
      .send({
        name: 'Bengaluru South Fair Price Shop',
        mobileNumber: '9845012345',
        distributorId: 'DIST001',
        password: 'DistributorPass123',
        fpsCode: 'FPS-KA-560001',
        district: 'Bengaluru Urban',
        taluk: 'Bengaluru South',
      });

    recordResult(
      3,
      'Distributor registration (starts as Pending)',
      distRegRes.status === 201 && distRegRes.body.data.status === 'Pending',
      `Status: ${distRegRes.status}`
    );

    // Approve distributor first so login succeeds
    await Distributor.findByIdAndUpdate(distRegRes.body.data._id, { status: 'Active' });

    const distLoginRes = await request(app)
      .post('/api/auth/distributor/login')
      .send({ distributorId: 'DIST001', password: 'DistributorPass123' });

    const distributorToken = distLoginRes.body.token;
    const distributorId = distLoginRes.body.data._id;
    recordResult(
      3,
      'Distributor login (after activation)',
      distLoginRes.status === 200 && !!distributorToken,
      `Status: ${distLoginRes.status}`
    );

    // 4. Beneficiary Registration and Login
    const benRegRes = await request(app)
      .post('/api/auth/beneficiary/register')
      .send({
        fullName: 'Ramesh Kumar',
        rationCardNumber: 'KA-RC-987654321',
        mobileNumber: '9123456780',
        password: 'BeneficiaryPass123',
        district: 'Bengaluru Urban',
        taluk: 'Bengaluru South',
        village: 'Jayanagar',
        address: '123, 4th Cross, 5th Main',
        familyMemberCount: 4,
        rfidUid: 'E28011700000020',
        assignedDistributor: distributorId,
      });

    recordResult(
      4,
      'Beneficiary registration',
      benRegRes.status === 201 && benRegRes.body.data.status === 'Active',
      `Status: ${benRegRes.status}`
    );

    const benLoginRes = await request(app)
      .post('/api/auth/beneficiary/login')
      .send({ rationCardNumber: 'KA-RC-987654321', password: 'BeneficiaryPass123' });

    const beneficiaryToken = benLoginRes.body.token;
    const beneficiaryId = benLoginRes.body.data._id;
    recordResult(
      4,
      'Beneficiary login',
      benLoginRes.status === 200 && !!beneficiaryToken,
      `Status: ${benLoginRes.status}`
    );

    // 5. JWT Authentication and Role Authorization
    const unauthRes = await request(app).get('/api/admin/distributors');
    const wrongRoleRes = await request(app)
      .get('/api/admin/distributors')
      .set('Authorization', `Bearer ${beneficiaryToken}`);
    const correctRoleRes = await request(app)
      .get('/api/admin/distributors')
      .set('Authorization', `Bearer ${adminToken}`);

    recordResult(
      5,
      'JWT Authentication & Role Authorization (401 unauth, 403 forbidden role, 200 authorized)',
      unauthRes.status === 401 && wrongRoleRes.status === 403 && correctRoleRes.status === 200,
      `401: ${unauthRes.status}, 403: ${wrongRoleRes.status}, 200: ${correctRoleRes.status}`
    );

    // 6. Admin Distributor Management APIs
    const pendingDistRes = await request(app)
      .get('/api/admin/distributors/pending')
      .set('Authorization', `Bearer ${adminToken}`);

    const suspendDistRes = await request(app)
      .patch(`/api/admin/distributors/${distributorId}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`);

    const activateDistRes = await request(app)
      .patch(`/api/admin/distributors/${distributorId}/activate`)
      .set('Authorization', `Bearer ${adminToken}`);

    recordResult(
      6,
      'Admin distributor management APIs (List, Pending, Suspend, Activate)',
      pendingDistRes.status === 200 && suspendDistRes.status === 200 && activateDistRes.status === 200,
      `Suspend: ${suspendDistRes.body.data.status}, Activate: ${activateDistRes.body.data.status}`
    );

    // 7. Admin Inventory APIs
    const addRiceRes = await request(app)
      .post('/api/admin/inventory/rice')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 5000 });

    const addOilRes = await request(app)
      .post('/api/admin/inventory/oil')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 2000 });

    const getInvRes = await request(app)
      .get('/api/admin/inventory')
      .set('Authorization', `Bearer ${adminToken}`);

    recordResult(
      7,
      'Admin Central Inventory APIs (Add Rice, Add Oil, View Inventory)',
      addRiceRes.status === 200 &&
        addOilRes.status === 200 &&
        getInvRes.body.data.centralInventory.riceStock === 5000 &&
        getInvRes.body.data.centralInventory.oilStock === 2000,
      `Rice: ${getInvRes.body.data.centralInventory.riceStock}kg, Oil: ${getInvRes.body.data.centralInventory.oilStock}L`
    );

    // 8. Admin Stock Dispatch APIs
    const dispatchRiceRes = await request(app)
      .post('/api/admin/dispatch/rice')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ distributorId: 'DIST001', quantity: 1000 });

    const dispatchOilRes = await request(app)
      .post('/api/admin/dispatch/oil')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ distributorId: 'DIST001', quantity: 500 });

    recordResult(
      8,
      'Admin Stock Dispatch APIs (Dispatch 1000kg Rice & 500L Oil)',
      dispatchRiceRes.status === 200 &&
        dispatchOilRes.status === 200 &&
        dispatchRiceRes.body.data.remainingCentralRiceStock === 4000 &&
        dispatchOilRes.body.data.remainingCentralOilStock === 1500,
      `Central Rice left: ${dispatchRiceRes.body.data.remainingCentralRiceStock}, Central Oil left: ${dispatchOilRes.body.data.remainingCentralOilStock}`
    );

    // 9. DispatchRecord Creation and History
    const dispatchHistRes = await request(app)
      .get('/api/admin/dispatch/history')
      .set('Authorization', `Bearer ${adminToken}`);

    const dispatchRecordsCount = await DispatchRecord.countDocuments();
    recordResult(
      9,
      'DispatchRecord creation and history tracking',
      dispatchHistRes.status === 200 && dispatchRecordsCount === 2,
      `Records in DB: ${dispatchRecordsCount}`
    );

    // 10. Admin Reports APIs
    const summaryRepRes = await request(app)
      .get('/api/admin/reports/summary')
      .set('Authorization', `Bearer ${adminToken}`);

    const dailyRepRes = await request(app)
      .get('/api/admin/reports/transactions/daily')
      .set('Authorization', `Bearer ${adminToken}`);

    const monthlyRepRes = await request(app)
      .get('/api/admin/reports/transactions/monthly')
      .set('Authorization', `Bearer ${adminToken}`);

    recordResult(
      10,
      'Admin Reports APIs (Summary, Daily Transactions, Monthly Transactions)',
      summaryRepRes.status === 200 && dailyRepRes.status === 200 && monthlyRepRes.status === 200,
      `Total Dist: ${summaryRepRes.body.data.totalDistributors}, Total Ben: ${summaryRepRes.body.data.totalBeneficiaries}`
    );

    // 11. Admin Notification APIs
    const adminNotifDistRes = await request(app)
      .post('/api/admin/notifications/distributor')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ distributorId: 'DIST001', title: 'Monthly Quota', message: 'Please collect quotas.' });

    const adminNotifBenRes = await request(app)
      .post('/api/admin/notifications/beneficiary')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ beneficiaryId, title: 'Ration Available', message: 'Your ration is ready for collection.' });

    recordResult(
      11,
      'Admin Notification APIs (Direct to Distributor & Direct to Beneficiary)',
      adminNotifDistRes.status === 201 && adminNotifBenRes.status === 201,
      `Dist Notif: ${adminNotifDistRes.status}, Ben Notif: ${adminNotifBenRes.status}`
    );

    // 12. Distributor Dashboard API
    const distDashRes = await request(app)
      .get('/api/distributor/dashboard')
      .set('Authorization', `Bearer ${distributorToken}`);

    recordResult(
      12,
      'Distributor Dashboard API',
      distDashRes.status === 200 && distDashRes.body.data.assignedBeneficiariesCount >= 1,
      `Assigned Beneficiaries: ${distDashRes.body.data.assignedBeneficiariesCount}`
    );

    // 13. Distributor Inventory API
    const distInvRes = await request(app)
      .get('/api/distributor/inventory')
      .set('Authorization', `Bearer ${distributorToken}`);

    const invData = distInvRes.body.data || {};
    recordResult(
      13,
      'Distributor Inventory API',
      distInvRes.status === 200 && (invData.riceStock === 1000 || invData.inventory?.riceStock === 1000) && (invData.oilStock === 500 || invData.inventory?.oilStock === 500),
      `Distributor Rice Stock: ${invData.riceStock}kg, Oil: ${invData.oilStock}L`
    );

    // 14. Distributor Beneficiary APIs
    const distBenListRes = await request(app)
      .get('/api/distributor/beneficiaries')
      .set('Authorization', `Bearer ${distributorToken}`);

    const distBenSearchRes = await request(app)
      .get('/api/distributor/beneficiaries/search?rationCardNumber=KA-RC-987654321')
      .set('Authorization', `Bearer ${distributorToken}`);

    recordResult(
      14,
      'Distributor Beneficiary APIs (List & Search by Ration Card)',
      distBenListRes.status === 200 && distBenSearchRes.status === 200 && distBenSearchRes.body.data.fullName === 'Ramesh Kumar',
      `Found Beneficiary: ${distBenSearchRes.body.data.fullName}`
    );

    // 15. Distributor Allocation APIs
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
    const currentYear = new Date().getFullYear();

    const allocateRes = await request(app)
      .post('/api/distributor/allocations')
      .set('Authorization', `Bearer ${distributorToken}`)
      .send({
        beneficiaryId,
        riceAllocated: 20,
        oilAllocated: 2,
        month: currentMonth,
        year: currentYear,
      });

    const allocHistRes = await request(app)
      .get('/api/distributor/allocations/history')
      .set('Authorization', `Bearer ${distributorToken}`);

    recordResult(
      15,
      'Distributor Allocation APIs (Create/Update Allocation & View History)',
      (allocateRes.status === 200 || allocateRes.status === 201) && allocHistRes.status === 200 && allocHistRes.body.data.length === 1,
      `Allocated: Rice ${allocateRes.body.data.riceAllocated}kg, Oil ${allocateRes.body.data.oilAllocated}L`
    );

    // 16. Distributor Transaction APIs
    const distTodayTxRes = await request(app)
      .get('/api/distributor/transactions/today')
      .set('Authorization', `Bearer ${distributorToken}`);

    const distMonthlyTxRes = await request(app)
      .get('/api/distributor/transactions/monthly')
      .set('Authorization', `Bearer ${distributorToken}`);

    recordResult(
      16,
      'Distributor Transaction APIs (Today Transactions & Monthly Transactions)',
      distTodayTxRes.status === 200 && distMonthlyTxRes.status === 200,
      `Today Count: ${distTodayTxRes.body.count}, Monthly Count: ${distMonthlyTxRes.body.count}`
    );

    // 17. Beneficiary Dashboard/Profile APIs
    const benDashRes = await request(app)
      .get('/api/beneficiary/dashboard')
      .set('Authorization', `Bearer ${beneficiaryToken}`);

    const benProfileRes = await request(app)
      .get('/api/beneficiary/profile')
      .set('Authorization', `Bearer ${beneficiaryToken}`);

    recordResult(
      17,
      'Beneficiary Dashboard and Profile APIs',
      benDashRes.status === 200 &&
        benProfileRes.status === 200 &&
        benDashRes.body.data.currentMonthAllocation.riceAllocated === 20,
      `Allocated Rice in Dashboard: ${benDashRes.body.data.currentMonthAllocation.riceAllocated}kg`
    );

    // 18. Beneficiary Allocation APIs
    const benCurrAllocRes = await request(app)
      .get('/api/beneficiary/allocation/current')
      .set('Authorization', `Bearer ${beneficiaryToken}`);

    const benAllocHistRes = await request(app)
      .get('/api/beneficiary/allocation/history')
      .set('Authorization', `Bearer ${beneficiaryToken}`);

    recordResult(
      18,
      'Beneficiary Allocation APIs (Current Month & Historical Allocations)',
      benCurrAllocRes.status === 200 && benAllocHistRes.status === 200 && benCurrAllocRes.body.data.riceAllocated === 20,
      `Current month rice: ${benCurrAllocRes.body.data.riceAllocated}kg`
    );

    // 19. Beneficiary Transaction APIs
    const benTxHistRes = await request(app)
      .get('/api/beneficiary/transactions')
      .set('Authorization', `Bearer ${beneficiaryToken}`);

    const benTodayLatestRes = await request(app)
      .get('/api/beneficiary/transactions/today/latest')
      .set('Authorization', `Bearer ${beneficiaryToken}`);

    recordResult(
      19,
      'Beneficiary Transaction APIs (History & Today Latest)',
      benTxHistRes.status === 200 && benTodayLatestRes.status === 200,
      `History count: ${benTxHistRes.body.count}`
    );

    // 20. Beneficiary Notification APIs
    const benNotifsRes = await request(app)
      .get('/api/beneficiary/notifications')
      .set('Authorization', `Bearer ${beneficiaryToken}`);

    const benUnreadNotifsRes = await request(app)
      .get('/api/beneficiary/notifications/unread')
      .set('Authorization', `Bearer ${beneficiaryToken}`);

    const markAllReadRes = await request(app)
      .patch('/api/beneficiary/notifications/read-all')
      .set('Authorization', `Bearer ${beneficiaryToken}`);

    recordResult(
      20,
      'Beneficiary Notification APIs (All, Unread, Mark All Read)',
      benNotifsRes.status === 200 && benUnreadNotifsRes.status === 200 && markAllReadRes.status === 200,
      `Initial unread count: ${benUnreadNotifsRes.body.count}`
    );

    // 21. RFID Verification
    const rfidCheckRes = await request(app)
      .post('/api/machine/rfid')
      .send({ rfidUid: 'E28011700000020' });

    recordResult(
      21,
      'Machine RFID verification',
      rfidCheckRes.status === 200 && rfidCheckRes.body.success === true && rfidCheckRes.body.data.beneficiary.fullName === 'Ramesh Kumar',
      `Identified Beneficiary: ${rfidCheckRes.body.data.beneficiary.fullName}`
    );

    // 22. OTP Generation
    const otpGenRes = await request(app)
      .post('/api/machine/generate-otp')
      .send({ beneficiaryId });

    const otpVal = otpGenRes.body.otp || otpGenRes.body.data?.otp;
    recordResult(
      22,
      'Machine OTP generation',
      (otpGenRes.status === 200 || otpGenRes.status === 201) && otpGenRes.body.success === true && !!otpVal,
      `Generated OTP: ${otpVal}`
    );

    const generatedOtp = otpVal;

    // 23. OTP Expiry and Verification
    // Test invalid OTP
    const invalidOtpRes = await request(app)
      .post('/api/machine/verify-otp')
      .send({ beneficiaryId, otp: '999999' });

    // Test valid OTP
    const validOtpRes = await request(app)
      .post('/api/machine/verify-otp')
      .send({ beneficiaryId, otp: generatedOtp });

    recordResult(
      23,
      'Machine OTP Expiry & Verification (Invalid rejected 400, Valid accepted 200)',
      invalidOtpRes.status === 400 && validOtpRes.status === 200,
      `Invalid OTP rejection: ${invalidOtpRes.status}, Valid OTP verification: ${validOtpRes.status}`
    );

    // 24. Allocation Checking
    const checkAllocRes = await request(app)
      .post('/api/machine/check-allocation')
      .send({ beneficiaryId });

    recordResult(
      24,
      'Machine Allocation checking (Remaining balance calculation)',
      checkAllocRes.status === 200 &&
        checkAllocRes.body.data.riceRemaining === 20 &&
        checkAllocRes.body.data.oilRemaining === 2,
      `Remaining: Rice ${checkAllocRes.body.data.riceRemaining}kg, Oil ${checkAllocRes.body.data.oilRemaining}L`
    );

    // 25. Dispense Validation
    const excessDispenseRes = await request(app)
      .post('/api/machine/dispense')
      .send({
        beneficiaryId,
        riceQuantity: 50, // exceeds 20kg allocated
        oilQuantity: 10,
        machineId: 'SRM-CENTER-001',
      });

    const validDispenseRes = await request(app)
      .post('/api/machine/dispense')
      .send({
        beneficiaryId,
        riceQuantity: 20,
        oilQuantity: 2,
        machineId: 'SRM-CENTER-001',
      });

    recordResult(
      25,
      'Machine Dispense validation (Excess quantity rejected 400, Valid quantity approved 200)',
      excessDispenseRes.status === 400 && validDispenseRes.status === 200,
      `Excess status: ${excessDispenseRes.status}, Valid status: ${validDispenseRes.status}`
    );

    // 26. Complete Transaction Workflow
    const completeRes = await request(app)
      .post('/api/machine/complete')
      .send({
        beneficiaryId,
        riceQuantity: 20,
        oilQuantity: 2,
        machineId: 'SRM-CENTER-001',
        distributorId,
      });

    recordResult(
      26,
      'Complete Dispensing Transaction Execution',
      (completeRes.status === 200 || completeRes.status === 201) && completeRes.body.success === true,
      `Transaction ID: ${completeRes.body.data.transaction.transactionId}`
    );

    // 27. Inventory Deduction after Dispensing
    const distInvAfterRes = await request(app)
      .get('/api/distributor/inventory')
      .set('Authorization', `Bearer ${distributorToken}`);

    const afterInvData = distInvAfterRes.body.data || {};
    const afterRice = afterInvData.riceStock ?? afterInvData.inventory?.riceStock;
    const afterOil = afterInvData.oilStock ?? afterInvData.inventory?.oilStock;

    recordResult(
      27,
      'Inventory deduction after dispensing (1000 - 20 = 980kg Rice, 500 - 2 = 498L Oil)',
      distInvAfterRes.status === 200 && afterRice === 980 && afterOil === 498,
      `New Rice Stock: ${afterRice}kg, New Oil Stock: ${afterOil}L`
    );

    // 28. Allocation Status Update after Dispensing
    const allocAfter = await Allocation.findOne({ beneficiary: beneficiaryId, month: currentMonth, year: currentYear });
    recordResult(
      28,
      'Allocation status update after dispensing (Updated to "Collected")',
      allocAfter.collectionStatus === 'Collected',
      `Allocation Status: ${allocAfter.collectionStatus}`
    );

    // 29. Transaction Creation after Dispensing
    const txInDb = await Transaction.findOne({ beneficiary: beneficiaryId });
    recordResult(
      29,
      'Transaction record persistence with complete metadata',
      txInDb && txInDb.status === 'Successful' && txInDb.riceDispensed === 20 && txInDb.oilDispensed === 2,
      `TxID: ${txInDb.transactionId}, Rice: ${txInDb.riceDispensed}kg, Oil: ${txInDb.oilDispensed}L`
    );

    // 30. Notification/Receipt Creation after Successful Collection
    const latestBenNotif = await Notification.findOne({ receiverId: beneficiaryId, receiverRole: 'Beneficiary' }).sort({ createdAt: -1 });
    recordResult(
      30,
      'Receipt and Confirmation Notification generation for Beneficiary',
      latestBenNotif && (latestBenNotif.title.includes('Ration') || latestBenNotif.title.includes('Collected') || latestBenNotif.title.includes('Dispensed')),
      `Notification Title: ${latestBenNotif ? latestBenNotif.title : 'None'}`
    );

    console.log('\n====================================================');
    const passedCount = testResults.filter((r) => r.passed).length;
    console.log(`🏁 TEST SUMMARY: ${passedCount} / ${testResults.length} Tests Passed!`);
    console.log('====================================================');

    return { success: passedCount === testResults.length, results: testResults };
  } catch (error) {
    console.error('❌ Test suite fatal error:', error);
    return { success: false, error: error.message };
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
}

runAllTests().then((res) => {
  if (!res.success) {
    process.exit(1);
  } else {
    process.exit(0);
  }
});
