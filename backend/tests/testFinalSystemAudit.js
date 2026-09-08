const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../app');
const Admin = require('../models/Admin');
const Distributor = require('../models/Distributor');
const Beneficiary = require('../models/Beneficiary');
const Allocation = require('../models/Allocation');
const Inventory = require('../models/Inventory');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');

async function runFinalSystemAudit() {
  console.log('======================================================================');
  console.log('🏁 COMPLETE END-TO-END SYSTEM AUDIT, VERIFICATION & REGRESSION SUITE');
  console.log('======================================================================\n');

  let mongoServer;
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition, message) {
    totalCount++;
    if (condition) {
      console.log(`✅ [PASS] ${totalCount}. ${message}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] ${totalCount}. ${message}`);
      process.exit(1);
    }
  }

  try {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    console.log('✅ Connected to isolated in-memory MongoDB\n');

    const hashedPassword = await bcrypt.hash('Password123', 10);
    const currentDate = new Date();
    const currentMonth = currentDate.toLocaleString('en-US', { month: 'long' });
    const currentYear = currentDate.getFullYear();

    // -----------------------------------------------------------------
    // PREPARATION: Create Admin and Distributor
    // -----------------------------------------------------------------
    const admin = await Admin.create({
      name: 'System Admin',
      adminId: 'ADMIN-001',
      password: hashedPassword,
      role: 'Super Admin',
    });

    const distributor = await Distributor.create({
      name: 'Ramesh FPS Shop',
      fullName: 'Ramesh FPS Shop',
      email: 'ramesh@fps.com',
      mobileNumber: '9888111222',
      distributorId: 'DIST-001',
      password: hashedPassword,
      fpsCode: 'FPS-BANG-01',
      district: 'Bangalore Urban',
      taluk: 'Bangalore North',
      village: 'Yelahanka',
      address: 'Shop #1, Main Bazaar',
      status: 'Active',
    });

    const distributorB = await Distributor.create({
      name: 'Suresh FPS Shop',
      fullName: 'Suresh FPS Shop',
      email: 'suresh@fps.com',
      mobileNumber: '9888111333',
      distributorId: 'DIST-002',
      password: hashedPassword,
      fpsCode: 'FPS-MYS-01',
      district: 'Mysore',
      taluk: 'Mysore South',
      village: 'Kuvempunagar',
      address: 'Shop #2, Mysore Bazaar',
      status: 'Active',
    });

    // Create Distributor inventory
    await Inventory.create({
      distributor: distributor._id,
      distributorId: distributor._id,
      riceStock: 1000.0,
      oilStock: 250.0,
      lastUpdated: new Date(),
    });

    // Login Admin & Distributor to get JWT tokens
    const adminLoginRes = await request(app)
      .post('/api/auth/admin/login')
      .send({ adminId: 'ADMIN-001', password: 'Password123' });
    assert(adminLoginRes.status === 200 && adminLoginRes.body.token, 'Admin login succeeds with JWT');
    const adminToken = adminLoginRes.body.token;

    const distLoginRes = await request(app)
      .post('/api/auth/distributor/login')
      .send({ distributorId: 'DIST-001', password: 'Password123' });
    assert(distLoginRes.status === 200 && distLoginRes.body.token, 'Distributor login succeeds with JWT');
    const distToken = distLoginRes.body.token;

    // -----------------------------------------------------------------
    // STEP A & B: Register Beneficiary A & B without Ration Card Number
    // -----------------------------------------------------------------
    console.log('\n--- Step A & B: Beneficiary Registration without Ration Card Number ---');
    const regResA = await request(app)
      .post('/api/auth/beneficiary/register')
      .send({
        fullName: 'Aarav Sharma',
        // rationCardNumber deliberately omitted!
        mobileNumber: '9900000001',
        password: 'Password123',
        district: 'Bangalore Urban',
        taluk: 'Bangalore North',
        village: 'Yelahanka',
        address: 'House #1, 2nd Cross',
        familyMemberCount: 3,
      });

    assert(regResA.status === 201, 'Beneficiary A registered without rationCardNumber returns HTTP 201');
    assert(regResA.body.data.rationCardNumber === undefined || regResA.body.data.rationCardNumber === null, 'Beneficiary A has no ration card number assigned yet');
    assert(regResA.body.data.riceQuota === 0 && regResA.body.data.oilQuota === 0, 'Beneficiary A initial quotas are strictly 0 KG Rice and 0 L Oil (no hardcoded defaults)');
    assert(regResA.body.data.status === 'Pending', 'Beneficiary A initial status is Pending');
    assert(regResA.body.data.submittedToAdmin === false, 'Beneficiary A starts with submittedToAdmin = false');
    const benAId = regResA.body.data._id;

    const regResB = await request(app)
      .post('/api/auth/beneficiary/register')
      .send({
        fullName: 'Bhavna Patel',
        // rationCardNumber also omitted!
        mobileNumber: '9900000002',
        password: 'Password123',
        district: 'Bangalore Urban',
        taluk: 'Bangalore North',
        village: 'Yelahanka',
        address: 'House #2, 3rd Cross',
        familyMemberCount: 4,
      });

    assert(regResB.status === 201, 'Beneficiary B registered without rationCardNumber returns HTTP 201 (no duplicate key collision on null/undefined)');
    const benBId = regResB.body.data._id;

    // -----------------------------------------------------------------
    // STEP C: Confirm both exist separately in MongoDB (count = 2)
    // -----------------------------------------------------------------
    console.log('\n--- Step C: MongoDB Document Isolation & Index Integrity ---');
    const benCount = await Beneficiary.countDocuments();
    assert(benCount === 2, `MongoDB has exactly 2 beneficiary records (Found: ${benCount})`);
    assert(benAId.toString() !== benBId.toString(), 'Beneficiary A and B have distinct ObjectIds');

    // -----------------------------------------------------------------
    // STEP D: Confirm both appear in Distributor & Admin workflow views
    // -----------------------------------------------------------------
    console.log('\n--- Step D: Workflow Visibility ---');
    const distBenRes = await request(app)
      .get('/api/distributor/beneficiaries')
      .set('Authorization', `Bearer ${distToken}`);
    assert(distBenRes.status === 200, 'Distributor gets assigned beneficiaries list');
    const distBenIds = distBenRes.body.data.map(b => b._id.toString());
    assert(distBenIds.includes(benAId.toString()) && distBenIds.includes(benBId.toString()), 'Both Beneficiary A and B appear in Distributor Bangalore Urban jurisdiction');

    // Verify Distributor B in Mysore CANNOT see Beneficiary A or B
    const distBLogin = await request(app)
      .post('/api/auth/distributor/login')
      .send({ distributorId: 'DIST-002', password: 'Password123' });
    const distBToken = distBLogin.body.token;

    const distBBenRes = await request(app)
      .get('/api/distributor/beneficiaries')
      .set('Authorization', `Bearer ${distBToken}`);
    const distBBenIds = distBBenRes.body.data.map(b => b._id.toString());
    assert(!distBBenIds.includes(benAId.toString()) && !distBBenIds.includes(benBId.toString()), 'Distributor B in Mysore CANNOT see Bangalore beneficiaries (jurisdiction isolation preserved)');

    // Verify Admin User Management shows both beneficiaries dynamically
    const adminBenRes = await request(app)
      .get('/api/admin/beneficiaries')
      .set('Authorization', `Bearer ${adminToken}`);
    assert(adminBenRes.status === 200, 'Admin GET /api/admin/beneficiaries returns HTTP 200');
    assert(adminBenRes.body.data.some(b => b._id.toString() === benAId.toString()), 'Admin sees Beneficiary A dynamically');
    assert(adminBenRes.body.data.some(b => b._id.toString() === benBId.toString()), 'Admin sees Beneficiary B dynamically');

    // -----------------------------------------------------------------
    // STEP E: Distributor reviews and submits Beneficiary A
    // -----------------------------------------------------------------
    console.log('\n--- Step E: Distributor Submits Beneficiary A to Admin ---');
    const submitRes = await request(app)
      .patch(`/api/distributor/beneficiaries/${benAId}/submit`)
      .set('Authorization', `Bearer ${distToken}`);
    assert(submitRes.status === 200, 'Distributor submits Beneficiary A to Admin with HTTP 200');
    assert(submitRes.body.data.submittedToAdmin === true, 'Beneficiary A submittedToAdmin is now true');
    assert(submitRes.body.data.submissionStatus === 'Submitted for Admin Review', 'Beneficiary A submissionStatus updated to "Submitted for Admin Review"');

    // Confirm no duplicate record created during submission
    const countAfterSubmit = await Beneficiary.countDocuments();
    assert(countAfterSubmit === 2, `Same MongoDB record reused on submit (Count = 2, Found: ${countAfterSubmit})`);

    // -----------------------------------------------------------------
    // STEP F: Admin approves Beneficiary A
    // -----------------------------------------------------------------
    console.log('\n--- Step F: Admin Approves Beneficiary A ---');
    const approveRes = await request(app)
      .patch(`/api/admin/beneficiaries/${benAId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert(approveRes.status === 200, 'Admin approves Beneficiary A with HTTP 200');
    assert(approveRes.body.data.status === 'Active', 'Beneficiary A status is now Active');
    assert(approveRes.body.data.submissionStatus === 'Reviewed', 'Beneficiary A submissionStatus is Reviewed');

    const countAfterApprove = await Beneficiary.countDocuments();
    assert(countAfterApprove === 2, `Same MongoDB record reused on approve (Count = 2, Found: ${countAfterApprove})`);

    // -----------------------------------------------------------------
    // STEP G: Admin rejects Beneficiary B
    // -----------------------------------------------------------------
    console.log('\n--- Step G: Admin Rejects Beneficiary B ---');
    const rejectRes = await request(app)
      .patch(`/api/admin/beneficiaries/${benBId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert(rejectRes.status === 200, 'Admin rejects Beneficiary B with HTTP 200');
    assert(rejectRes.body.data.status === 'Rejected', 'Beneficiary B status is Rejected');

    // -----------------------------------------------------------------
    // STEP H: Verify Beneficiary A is eligible for allocation and B is NOT
    // -----------------------------------------------------------------
    console.log('\n--- Step H: Monthly Allocation Eligibility ---');
    const eligibleRes = await request(app)
      .get('/api/distributor/beneficiaries?eligibleForAllocation=true')
      .set('Authorization', `Bearer ${distToken}`);
    const eligibleIds = eligibleRes.body.data.map(b => b._id.toString());
    assert(eligibleIds.includes(benAId.toString()), 'Approved Beneficiary A is eligible for monthly allocation');
    assert(!eligibleIds.includes(benBId.toString()), 'Rejected Beneficiary B is NOT eligible for monthly allocation');

    // Attempt allocation to rejected beneficiary should fail with 400
    const failAllocRes = await request(app)
      .post('/api/distributor/allocations')
      .set('Authorization', `Bearer ${distToken}`)
      .send({
        beneficiaryId: benBId,
        rice: 10,
        oil: 2,
      });
    assert(failAllocRes.status === 400, 'Allocation to rejected Beneficiary B is strictly rejected with HTTP 400');

    // -----------------------------------------------------------------
    // STEP I: Allocate decimal Rice and Oil quantities to Beneficiary A
    // -----------------------------------------------------------------
    console.log('\n--- Step I: Decimal Quota Allocation (1.5 KG Rice, 2.5 L Oil) ---');
    const allocRes = await request(app)
      .post('/api/distributor/allocations')
      .set('Authorization', `Bearer ${distToken}`)
      .send({
        beneficiaryId: benAId,
        riceAllocated: 1.5,
        oilAllocated: 2.5,
        month: currentMonth,
        year: currentYear,
      });
    assert(allocRes.status === 201 || allocRes.status === 200, 'Distributor allocates 1.5 KG Rice and 2.5 L Oil successfully');
    assert(allocRes.body.data.riceAllocated === 1.5, 'Returned allocation riceAllocated is exactly 1.5');
    assert(allocRes.body.data.oilAllocated === 2.5, 'Returned allocation oilAllocated is exactly 2.5');

    // -----------------------------------------------------------------
    // STEP J: Verify exact database values in MongoDB
    // -----------------------------------------------------------------
    console.log('\n--- Step J: MongoDB Direct Verification ---');
    const updatedBenA = await Beneficiary.findById(benAId);
    assert(updatedBenA.riceQuota === 1.5, `Beneficiary.riceQuota stored as 1.5 without truncation (Stored: ${updatedBenA.riceQuota})`);
    assert(updatedBenA.oilQuota === 2.5, `Beneficiary.oilQuota stored as 2.5 without truncation (Stored: ${updatedBenA.oilQuota})`);

    const storedAlloc = await Allocation.findOne({ beneficiary: benAId, month: currentMonth, year: currentYear });
    assert(storedAlloc && storedAlloc.riceAllocated === 1.5 && storedAlloc.oilAllocated === 2.5, 'Allocation document stored with exact decimal values');

    // -----------------------------------------------------------------
    // STEP K: Verify values in Distributor Portal
    // -----------------------------------------------------------------
    console.log('\n--- Step K: Distributor Portal Verification ---');
    const distCheckRes = await request(app)
      .get(`/api/distributor/beneficiaries/${benAId}`)
      .set('Authorization', `Bearer ${distToken}`);
    assert(distCheckRes.status === 200, 'Distributor GET /beneficiaries/:id returns HTTP 200');
    assert(distCheckRes.body.data.riceQuota === 1.5 && distCheckRes.body.data.oilQuota === 2.5, 'Distributor view reflects riceQuota: 1.5, oilQuota: 2.5');

    // -----------------------------------------------------------------
    // STEP L: Verify values in Admin Portal
    // -----------------------------------------------------------------
    console.log('\n--- Step L: Admin Portal Verification ---');
    const adminCheckRes = await request(app)
      .get(`/api/admin/beneficiaries/${benAId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert(adminCheckRes.status === 200, 'Admin GET /beneficiaries/:id returns HTTP 200');
    assert(adminCheckRes.body.data.riceQuota === 1.5 && adminCheckRes.body.data.oilQuota === 2.5, 'Admin view reflects riceQuota: 1.5, oilQuota: 2.5');

    // -----------------------------------------------------------------
    // STEP M & N: Admin Assigns Ration Card Number & Beneficiary A Login
    // -----------------------------------------------------------------
    console.log('\n--- Step M & N: Admin Assigns Ration Card Number ---');
    const assignCardRes = await request(app)
      .put(`/api/admin/beneficiaries/${benAId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        rationCardNumber: 'RC-KAR-889900',
        rfidUid: 'RFID-AARAV-001',
      });
    assert(assignCardRes.status === 200, 'Admin updates existing beneficiary record with Ration Card Number and RFID');
    assert(assignCardRes.body.data.rationCardNumber === 'RC-KAR-889900', 'Updated rationCardNumber is RC-KAR-889900');
    assert(assignCardRes.body.data.rfidUid === 'RFID-AARAV-001', 'Updated rfidUid is RFID-AARAV-001');

    // Ensure record count is still exactly 2 (updated in place, NO DUPLICATE)
    const countAfterCard = await Beneficiary.countDocuments();
    assert(countAfterCard === 2, `No duplicate record created during card assignment (Count = 2, Found: ${countAfterCard})`);

    // Beneficiary A Login using newly assigned Ration Card Number
    const benALogin = await request(app)
      .post('/api/auth/beneficiary/login')
      .send({
        identifier: 'RC-KAR-889900',
        password: 'Password123',
      });
    assert(benALogin.status === 200 && benALogin.body.token, 'Beneficiary A logs in with Ration Card Number');
    assert(benALogin.body.data.fullName === 'Aarav Sharma', 'Beneficiary A profile has fullName: Aarav Sharma');
    assert(benALogin.body.data.riceQuota === 1.5 && benALogin.body.data.oilQuota === 2.5, 'Beneficiary A login response reflects live quotas: 1.5 & 2.5');
    const benAToken = benALogin.body.token;

    // Beneficiary A Dashboard Summary API
    const benADash = await request(app)
      .get('/api/beneficiary/dashboard')
      .set('Authorization', `Bearer ${benAToken}`);
    assert(benADash.status === 200, 'Beneficiary A Dashboard API returns HTTP 200');
    assert(benADash.body.data.currentMonthAllocation.riceAllocated === 1.5, 'Dashboard reflects riceAllocated = 1.5');
    assert(benADash.body.data.currentMonthAllocation.oilAllocated === 2.5, 'Dashboard reflects oilAllocated = 2.5');
    assert(benADash.body.data.profile.fullName === 'Aarav Sharma', 'Dashboard belongs exclusively to Aarav Sharma');

    // -----------------------------------------------------------------
    // STEP O & P: Session Isolation - Beneficiary B Cannot Access A's Data
    // -----------------------------------------------------------------
    console.log('\n--- Step O & P: Session Isolation & Rejection Handling ---');
    // Beneficiary B is Rejected, login must be refused with 403
    const benBLogin = await request(app)
      .post('/api/auth/beneficiary/login')
      .send({
        identifier: '9900000002',
        password: 'Password123',
      });
    assert(benBLogin.status === 403, 'Rejected Beneficiary B is denied login with HTTP 403');
    assert(!benBLogin.body.token, 'No token issued to rejected beneficiary');

    // Beneficiary 3: Create a separate active Beneficiary C to test user switching
    const regResC = await request(app)
      .post('/api/auth/beneficiary/register')
      .send({
        fullName: 'Chitra Rao',
        mobileNumber: '9900000003',
        password: 'Password123',
        district: 'Bangalore Urban',
        taluk: 'Bangalore North',
        village: 'Yelahanka',
        address: 'House #3',
      });
    const benCId = regResC.body.data._id;
    // Approve Beneficiary C
    await Beneficiary.findByIdAndUpdate(benCId, { status: 'Active', submissionStatus: 'Reviewed' });

    // Login as Beneficiary C
    const benCLogin = await request(app)
      .post('/api/auth/beneficiary/login')
      .send({ identifier: '9900000003', password: 'Password123' });
    const benCToken = benCLogin.body.token;

    // Load Beneficiary C Dashboard
    const benCDash = await request(app)
      .get('/api/beneficiary/dashboard')
      .set('Authorization', `Bearer ${benCToken}`);
    assert(benCDash.status === 200, 'Beneficiary C Dashboard returns HTTP 200');
    assert(benCDash.body.data.profile.fullName === 'Chitra Rao', 'Beneficiary C profile is Chitra Rao');
    assert(benCDash.body.data.profile._id.toString() !== benAId.toString(), 'Beneficiary C does NOT see Beneficiary A data');
    assert(benCDash.body.data.currentMonthAllocation.riceAllocated === 0, 'Beneficiary C has 0 quota (unallocated, does NOT see Beneficiary A 1.5 KG)');

    // -----------------------------------------------------------------
    // STEP S & T & U: RFID Dispensing Verification for Beneficiary A
    // -----------------------------------------------------------------
    console.log('\n--- Step S, T, U: RFID Authentication for Beneficiary A ---');
    const rfidResA = await request(app)
      .post('/api/machine/rfid')
      .send({ rfidUid: 'RFID-AARAV-001' });

    assert(rfidResA.status === 200 && rfidResA.body.success === true, 'RFID scan for Beneficiary A returns HTTP 200');
    assert(rfidResA.body.data.beneficiary.fullName === 'Aarav Sharma', 'RFID scan identifies Aarav Sharma');
    assert(rfidResA.body.data.beneficiary.rationCardNumber === 'RC-KAR-889900', 'RFID returns assigned rationCardNumber RC-KAR-889900');
    assert(rfidResA.body.data.availableRice === 1.5, 'RFID response returns exact availableRice = 1.5 KG');
    assert(rfidResA.body.data.availableOil === 2.5, 'RFID response returns exact availableOil = 2.5 L');
    assert(rfidResA.body.data.hasAllocatedQuota === true, 'hasAllocatedQuota is true');

    // -----------------------------------------------------------------
    // STEP V: Test Rejected Beneficiary B RFID (Rejection)
    // -----------------------------------------------------------------
    console.log('\n--- Step V: RFID Rejection for Rejected / Ineligible Beneficiary ---');
    // Assign an RFID to B directly in DB
    await Beneficiary.findByIdAndUpdate(benBId, { rfidUid: 'RFID-BHAVNA-002' });
    const rfidResB = await request(app)
      .post('/api/machine/rfid')
      .send({ rfidUid: 'RFID-BHAVNA-002' });
    assert(rfidResB.status === 403, 'Rejected Beneficiary B RFID is rejected with HTTP 403');
    assert(rfidResB.body.beneficiaryStatus === 'Rejected', 'Rejection reason states status is Rejected');

    // Attempt OTP generation for Beneficiary B should fail
    const otpBRes = await request(app)
      .post('/api/machine/generate-otp')
      .send({ beneficiaryId: benBId });
    assert(otpBRes.status === 403 || otpBRes.status === 400, 'OTP generation for rejected Beneficiary B is rejected');

    // Attempt dispensing for Beneficiary B should fail
    const dispBRes = await request(app)
      .post('/api/machine/dispense')
      .send({
        beneficiaryId: benBId,
        distributorId: distributor._id,
        riceQuantity: 1.0,
        oilQuantity: 1.0,
        machineId: 'SRM-MACHINE-01',
      });
    assert(dispBRes.status === 403 || dispBRes.status === 400, 'Dispense execution for rejected Beneficiary B is rejected');

    // -----------------------------------------------------------------
    // STEP W: Zero-Quota Beneficiary Handling
    // -----------------------------------------------------------------
    console.log('\n--- Step W: Zero-Quota Beneficiary Handling ---');
    // Beneficiary C has 0 quota. Assign RFID.
    await Beneficiary.findByIdAndUpdate(benCId, { rfidUid: 'RFID-CHITRA-003' });
    const rfidResC = await request(app)
      .post('/api/machine/rfid')
      .send({ rfidUid: 'RFID-CHITRA-003' });
    assert(rfidResC.status === 200, 'Zero-quota beneficiary RFID scanned successfully');
    assert(rfidResC.body.data.availableRice === 0 && rfidResC.body.data.availableOil === 0, 'Zero quota strictly returns 0 available (no fallback 25/2)');
    assert(rfidResC.body.data.hasAllocatedQuota === false, 'hasAllocatedQuota is false');

    // Attempt OTP generation for Zero-Quota Beneficiary should fail
    const otpCRes = await request(app)
      .post('/api/machine/generate-otp')
      .send({ beneficiaryId: benCId });
    assert(otpCRes.status === 400, 'OTP generation disallowed for zero-quota beneficiary (HTTP 400)');

    // Attempt Dispensing for Zero-Quota Beneficiary should fail
    const dispCRes = await request(app)
      .post('/api/machine/dispense')
      .send({
        beneficiaryId: benCId,
        distributorId: distributor._id,
        riceQuantity: 1.0,
        oilQuantity: 0.5,
        machineId: 'SRM-MACHINE-01',
      });
    assert(dispCRes.status === 400, 'Dispensing disallowed for zero-quota beneficiary (HTTP 400)');

    // -----------------------------------------------------------------
    // STEP X, Y, Z: Valid Decimal Dispensing for Beneficiary A
    // -----------------------------------------------------------------
    console.log('\n--- Step X, Y, Z: Valid Decimal Dispensing ---');
    // OTP generation for Beneficiary A
    const otpARes = await request(app)
      .post('/api/machine/generate-otp')
      .send({ beneficiaryId: benAId });
    assert(otpARes.status === 201 || otpARes.status === 200, 'OTP generated successfully for eligible Beneficiary A');
    assert(otpARes.body.mobileNumber || otpARes.body.data.mobileNumber, 'Mobile number present in response');

    // Validate dispense: 0.5 KG Rice, 1.0 L Oil (within 1.5 KG & 2.5 L quota)
    const valRes = await request(app)
      .post('/api/machine/validate-dispense')
      .send({
        beneficiaryId: benAId,
        distributorId: distributor._id,
        riceQuantity: 0.5,
        oilQuantity: 1.0,
        rfidUid: 'RFID-AARAV-001',
      });
    if (valRes.status !== 200) {
      console.log('valRes error:', valRes.status, valRes.body);
    }
    assert(valRes.status === 200 && valRes.body.success === true, 'Decimal dispense validation succeeds (0.5 KG Rice, 1.0 L Oil)');

    // Complete Dispense Transaction with unique requestId
    const dispenseTxRes = await request(app)
      .post('/api/machine/complete')
      .send({
        beneficiaryId: benAId,
        distributorId: distributor._id,
        riceQuantity: 0.5,
        oilQuantity: 1.0,
        rfidUid: 'RFID-AARAV-001',
        machineId: 'SRM-MACHINE-01',
        requestId: 'REQ-AUDIT-001',
      });

    assert(dispenseTxRes.status === 200 && dispenseTxRes.body.success === true, 'Dispense transaction completes with HTTP 200');
    assert(dispenseTxRes.body.data.transaction.riceDispensed === 0.5, 'Transaction record stores riceDispensed = 0.5');
    assert(dispenseTxRes.body.data.transaction.oilDispensed === 1.0, 'Transaction record stores oilDispensed = 1.0');
    assert(dispenseTxRes.body.data.updatedAllocationStatus === 'Partially Collected', 'Allocation status updated to "Partially Collected"');
    assert(dispenseTxRes.body.data.remainingBeneficiaryQuota.riceRemaining === 1.0, 'Remaining rice quota calculated accurately (1.5 - 0.5 = 1.0)');
    assert(dispenseTxRes.body.data.remainingBeneficiaryQuota.oilRemaining === 1.5, 'Remaining oil quota calculated accurately (2.5 - 1.0 = 1.5)');

    // Check Inventory Deduction (1000 - 0.5 = 999.5 KG Rice, 250 - 1.0 = 249.0 L Oil)
    const updatedInv = await Inventory.findOne({ distributor: distributor._id });
    assert(updatedInv.riceStock === 999.5, `Distributor rice stock deducted to 999.5 (Found: ${updatedInv.riceStock})`);
    assert(updatedInv.oilStock === 249.0, `Distributor oil stock deducted to 249.0 (Found: ${updatedInv.oilStock})`);

    // -----------------------------------------------------------------
    // STEP AA: Replay Protection Verification
    // -----------------------------------------------------------------
    console.log('\n--- Step AA: Duplicate / Replay Protection ---');
    const repeatTxRes = await request(app)
      .post('/api/machine/complete')
      .send({
        beneficiaryId: benAId,
        distributorId: distributor._id,
        riceQuantity: 0.5,
        oilQuantity: 1.0,
        rfidUid: 'RFID-AARAV-001',
        machineId: 'SRM-MACHINE-01',
        requestId: 'REQ-AUDIT-001', // Exact same requestId!
      });

    assert(repeatTxRes.status === 200, 'Duplicate request with same requestId returns HTTP 200');
    assert(repeatTxRes.body.duplicateHandled === true, 'Response marks duplicateHandled = true');

    // Confirm inventory was NOT double-deducted
    const invAfterRepeat = await Inventory.findOne({ distributor: distributor._id });
    assert(invAfterRepeat.riceStock === 999.5, 'Inventory rice stock untouched on duplicate replay');
    assert(invAfterRepeat.oilStock === 249.0, 'Inventory oil stock untouched on duplicate replay');

    // Confirm transaction count is exactly 1
    const txCount = await Transaction.countDocuments({ beneficiary: benAId });
    assert(txCount === 1, `Exactly 1 transaction record exists in DB (Found: ${txCount})`);

    // -----------------------------------------------------------------
    // STEP AB & AC: Refresh All Dashboards & Verify Real Data
    // -----------------------------------------------------------------
    console.log('\n--- Step AB & AC: Dashboard Live Data Consistency ---');
    // Beneficiary A live dashboard check
    const liveBenADash = await request(app)
      .get('/api/beneficiary/dashboard')
      .set('Authorization', `Bearer ${benAToken}`);
    assert(liveBenADash.status === 200, 'Beneficiary live dashboard refreshed successfully');
    assert(liveBenADash.body.data.currentMonthAllocation.collectionStatus === 'Partially Collected', 'Dashboard reflects current live collectionStatus: Partially Collected');
    assert(liveBenADash.body.data.latestTodayTransaction.riceDispensed === 0.5, 'Dashboard reflects latest today transaction: 0.5 KG Rice');

    // Distributor Dashboard live check
    const distDashRes = await request(app)
      .get('/api/distributor/dashboard')
      .set('Authorization', `Bearer ${distToken}`);
    assert(distDashRes.status === 200, 'Distributor live dashboard refreshed successfully');
    assert(distDashRes.body.data.inventory.riceStock === 999.5, 'Distributor dashboard displays live deducted stock: 999.5 KG Rice');
    assert(distDashRes.body.data.inventory.oilStock === 249.0, 'Distributor dashboard displays live deducted stock: 249.0 L Oil');

    // Admin Summary Report live check
    const adminReportRes = await request(app)
      .get('/api/admin/reports/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    assert(adminReportRes.status === 200, 'Admin summary report refreshed successfully');
    assert(adminReportRes.body.data.totalRiceDistributed === 0.5, 'Admin report aggregates totalRiceDistributed = 0.5');
    assert(adminReportRes.body.data.totalOilDistributed === 1.0, 'Admin report aggregates totalOilDistributed = 1.0');

    // -----------------------------------------------------------------
    // STEP AD: Invalid / Expired Authentication Handling
    // -----------------------------------------------------------------
    console.log('\n--- Step AD: Security & Session Handling ---');
    // No token on protected route -> 401
    const unauthRes = await request(app).get('/api/beneficiary/dashboard');
    assert(unauthRes.status === 401, 'Request without token returns HTTP 401 Unauthorized');

    // Tampered / invalid token -> 401
    const invalidTokenRes = await request(app)
      .get('/api/beneficiary/dashboard')
      .set('Authorization', 'Bearer invalid_tampered_token_xyz');
    assert(invalidTokenRes.status === 401, 'Request with invalid token returns HTTP 401 Unauthorized');

    // Beneficiary trying to access Admin route -> 403 Forbidden
    const forbiddenAdminRes = await request(app)
      .get('/api/admin/reports/summary')
      .set('Authorization', `Bearer ${benAToken}`);
    assert(forbiddenAdminRes.status === 403, 'Beneficiary accessing Admin route returns HTTP 403 Forbidden');

    // Beneficiary trying to access Distributor route -> 403 Forbidden
    const forbiddenDistRes = await request(app)
      .get('/api/distributor/dashboard')
      .set('Authorization', `Bearer ${benAToken}`);
    assert(forbiddenDistRes.status === 403, 'Beneficiary accessing Distributor route returns HTTP 403 Forbidden');

    // Distributor trying to access Admin route -> 403 Forbidden
    const distAdminRes = await request(app)
      .get('/api/admin/reports/summary')
      .set('Authorization', `Bearer ${distToken}`);
    assert(distAdminRes.status === 403, 'Distributor accessing Admin route returns HTTP 403 Forbidden');

    console.log('\n======================================================================');
    console.log(`🎉 FINAL AUDIT COMPLETE: ${passedCount} / ${totalCount} Assertions Passed!`);
    console.log('======================================================================\n');
  } catch (error) {
    console.error('Audit execution error:', error);
    process.exit(1);
  } finally {
    if (mongoServer) {
      await mongoose.disconnect();
      await mongoServer.stop();
    }
  }
}

runFinalSystemAudit();
