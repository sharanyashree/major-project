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

async function testTask5QuotaSynchronization() {
  console.log('======================================================================');
  console.log('🧪 TESTING TASK 5: END-TO-END RICE & OIL QUOTA SYNCHRONIZATION');
  console.log('======================================================================\n');

  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  let totalTests = 0;
  let passedTests = 0;

  function assert(title, condition, details = '') {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ [PASS] ${title} ${details ? '(' + details + ')' : ''}`);
    } else {
      console.error(`❌ [FAIL] ${title} ${details ? '(' + details + ')' : ''}`);
    }
  }

  try {
    // 1. SETUP ACTORS
    // Admin
    const adminHash = await bcrypt.hash('AdminPass123', 10);
    const admin = await Admin.create({
      name: 'PDS Central Admin',
      adminId: 'ADMIN-PDS-01',
      email: 'admin@pds.gov.in',
      password: adminHash,
      role: 'Admin',
    });

    const adminLoginRes = await request(app)
      .post('/api/auth/admin/login')
      .send({ adminId: 'ADMIN-PDS-01', password: 'AdminPass123' });
    const adminToken = adminLoginRes.body.token;

    // Distributor A (Bangalore Urban)
    const distHash = await bcrypt.hash('DistPass123', 10);
    const distA = await Distributor.create({
      name: 'Indiranagar FPS Center',
      distributorId: 'DIST-BLR-01',
      fpsCode: 'FPS-KA-BLR-101',
      storeName: 'Fair Price Shop Indiranagar',
      mobileNumber: '9845011111',
      password: distHash,
      district: 'Bangalore Urban',
      taluk: 'Bangalore East',
      status: 'Active',
    });

    // Distributor Inventory (sufficient stock for decimal allocations)
    await Inventory.create({
      distributor: distA._id,
      distributorId: distA._id,
      riceStock: 1000,
      oilStock: 500,
    });

    const distLoginRes = await request(app)
      .post('/api/auth/distributor/login')
      .send({ distributorId: 'DIST-BLR-01', password: 'DistPass123' });
    const distToken = distLoginRes.body.token;

    assert('1. Actors (Admin, Distributor) created and authenticated', !!adminToken && !!distToken);

    // =========================================================================
    // STEP A: BENEFICIARY WITH 0 QUOTA (REGISTERED AND APPROVED)
    // =========================================================================
    const benPassword = 'UserSecret@123';
    const benRegRes = await request(app)
      .post('/api/auth/beneficiary/register')
      .send({
        fullName: 'Suresh Gowda',
        rationCardNumber: 'KA-BLR-8801',
        mobileNumber: '9876543210',
        password: benPassword,
        district: 'Bangalore Urban',
        taluk: 'Bangalore East',
        village: 'Indiranagar',
        address: '4th Cross, Indiranagar',
        familyMemberCount: 4,
      });

    assert('A1. Beneficiary registration successful (HTTP 201)', benRegRes.status === 201);
    const benId = benRegRes.body.data._id;
    assert('A2. Initial beneficiary has 0 Rice quota and 0 Oil quota', benRegRes.body.data.riceQuota === 0 && benRegRes.body.data.oilQuota === 0);

    // Approve beneficiary through workflow: Distributor submits -> Admin approves
    await request(app)
      .patch(`/api/distributor/beneficiaries/${benId}/submit-to-admin`)
      .set('Authorization', `Bearer ${distToken}`);

    const approveRes = await request(app)
      .patch(`/api/admin/beneficiaries/${benId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert('A3. Beneficiary approved by Admin (Status = Active)', approveRes.status === 200 && approveRes.body.data.status === 'Active');

    // Authenticate Beneficiary
    const benLoginRes = await request(app)
      .post('/api/auth/beneficiary/login')
      .send({ rationCardNumber: 'KA-BLR-8801', password: benPassword });
    const benToken = benLoginRes.body.token;
    assert('A4. Beneficiary authenticated successfully', !!benToken);

    // =========================================================================
    // STEP B & C: DISTRIBUTOR MONTHLY ALLOCATION OPENS & BENEFICIARY SELECTED
    // =========================================================================
    const eligibleRes1 = await request(app)
      .get('/api/distributor/beneficiaries?eligibleForAllocation=true')
      .set('Authorization', `Bearer ${distToken}`);

    assert('B1. Distributor Monthly Allocation eligible beneficiaries loaded', eligibleRes1.status === 200);
    const benInEligible1 = eligibleRes1.body.data.find(b => b._id === benId);
    assert('C1. Beneficiary appears in Distributor eligible list', !!benInEligible1);

    // =========================================================================
    // STEP D: PRE-FILL SHOWS 0 OR UNALLOCATED STATUS
    // =========================================================================
    assert('D1. Pre-fill quota values are 0 (Rice=0, Oil=0)', benInEligible1.riceQuota === 0 && benInEligible1.oilQuota === 0);

    // =========================================================================
    // STEP E & F: DISTRIBUTOR ENTERS DECIMAL QUANTITIES AND SAVES ALLOCATION
    // =========================================================================
    const decimalRice = 17.5;
    const decimalOil = 2.75;
    const allocMonth = 'August';
    const allocYear = 2026;

    const allocRes = await request(app)
      .post('/api/distributor/allocations')
      .set('Authorization', `Bearer ${distToken}`)
      .send({
        beneficiaryId: benId,
        month: allocMonth,
        year: allocYear,
        riceAllocated: decimalRice,
        oilAllocated: decimalOil,
      });

    assert('F1. Distributor allocates ration with decimal quantities (HTTP 201)', allocRes.status === 201);
    assert('F2. Allocation response confirms riceAllocated = 17.5 and oilAllocated = 2.75',
      allocRes.body.data.riceAllocated === 17.5 && allocRes.body.data.oilAllocated === 2.75);

    // =========================================================================
    // STEP G & H: MONGODB BENEFICIARY RECORD CHECKED DIRECTLY
    // =========================================================================
    const mongoBenDocs = await Beneficiary.find({ rationCardNumber: 'KA-BLR-8801' });
    assert('G1. Direct MongoDB Check: Exactly 1 Beneficiary document exists (No duplicates)', mongoBenDocs.length === 1);

    const directMongoBen = mongoBenDocs[0];
    assert('H1. Direct MongoDB Check: riceQuota is exactly 17.5 (Type: Number)', directMongoBen.riceQuota === 17.5);
    assert('H2. Direct MongoDB Check: oilQuota is exactly 2.75 (Type: Number)', directMongoBen.oilQuota === 2.75);

    // =========================================================================
    // STEP I: ALLOCATION RECORD CREATED/UPDATED CORRECTLY IN MONGODB
    // =========================================================================
    const mongoAllocDocs = await Allocation.find({ beneficiary: benId, month: allocMonth, year: allocYear });
    assert('I1. Direct MongoDB Check: Exactly 1 Allocation record for August 2026', mongoAllocDocs.length === 1);
    const directMongoAlloc = mongoAllocDocs[0];
    assert('I2. Direct MongoDB Check: Allocation riceAllocated = 17.5', directMongoAlloc.riceAllocated === 17.5);
    assert('I3. Direct MongoDB Check: Allocation oilAllocated = 2.75', directMongoAlloc.oilAllocated === 2.75);
    assert('I4. Direct MongoDB Check: Allocation distributor matches Distributor A', directMongoAlloc.distributor.toString() === distA._id.toString());

    // =========================================================================
    // STEP J: BENEFICIARY DASHBOARD CHECKED
    // =========================================================================
    // J1: Profile API
    const benProfileRes = await request(app)
      .get('/api/beneficiary/profile')
      .set('Authorization', `Bearer ${benToken}`);

    assert('J1. Beneficiary Profile API returns HTTP 200', benProfileRes.status === 200);
    assert('J2. Beneficiary Profile reflects riceQuota = 17.5', benProfileRes.body.data.riceQuota === 17.5);
    assert('J3. Beneficiary Profile reflects oilQuota = 2.75', benProfileRes.body.data.oilQuota === 2.75);

    // J2: Current Allocation API
    const benCurrAllocRes = await request(app)
      .get('/api/beneficiary/allocation/current')
      .set('Authorization', `Bearer ${benToken}`);

    assert('J4. Beneficiary Current Allocation API returns HTTP 200', benCurrAllocRes.status === 200);
    assert('J5. Beneficiary Current Allocation returns riceAllocated = 17.5', benCurrAllocRes.body.data.riceAllocated === 17.5);
    assert('J6. Beneficiary Current Allocation returns oilAllocated = 2.75', benCurrAllocRes.body.data.oilAllocated === 2.75);

    // J3: Dashboard Summary API
    const benDashRes = await request(app)
      .get('/api/beneficiary/dashboard/summary')
      .set('Authorization', `Bearer ${benToken}`);

    assert('J7. Beneficiary Dashboard Summary returns HTTP 200', benDashRes.status === 200);
    const dashData = benDashRes.body.data;
    assert('J8. Dashboard Summary currentMonthAllocation has riceAllocated = 17.5', dashData.currentMonthAllocation.riceAllocated === 17.5);
    assert('J9. Dashboard Summary currentMonthAllocation has oilAllocated = 2.75', dashData.currentMonthAllocation.oilAllocated === 2.75);
    assert('J10. Dashboard Summary profile has riceQuota = 17.5', dashData.profile.riceQuota === 17.5);
    assert('J11. Dashboard Summary profile has oilQuota = 2.75', dashData.profile.oilQuota === 2.75);

    // J4: Allocation History API
    const benHistoryRes = await request(app)
      .get('/api/beneficiary/allocation/history')
      .set('Authorization', `Bearer ${benToken}`);

    assert('J12. Beneficiary Allocation History returns HTTP 200', benHistoryRes.status === 200);
    const benHistoryList = benHistoryRes.body.data;
    assert('J13. History contains August 2026 allocation', benHistoryList.length >= 1 && benHistoryList.some(a => a.month === 'August' && a.year === 2026));
    const histItem = benHistoryList.find(a => a.month === 'August' && a.year === 2026);
    assert('J14. History item has riceAllocated = 17.5 and oilAllocated = 2.75', histItem.riceAllocated === 17.5 && histItem.oilAllocated === 2.75);

    // =========================================================================
    // STEP K: ADMIN PORTAL → USER MANAGEMENT CHECKED
    // =========================================================================
    const adminBensRes = await request(app)
      .get('/api/admin/beneficiaries')
      .set('Authorization', `Bearer ${adminToken}`);

    assert('K1. Admin Portal User Management loads all beneficiaries (HTTP 200)', adminBensRes.status === 200);
    const adminBenRecord = adminBensRes.body.data.find(b => b._id === benId);
    assert('K2. Admin Beneficiary record found in User Management list', !!adminBenRecord);
    assert('K3. Admin User Management displays riceQuota = 17.5 KG', adminBenRecord.riceQuota === 17.5);
    assert('K4. Admin User Management displays oilQuota = 2.75 L', adminBenRecord.oilQuota === 2.75);

    // =========================================================================
    // STEP L: ADMIN PORTAL → BENEFICIARY DETAILS CHECKED
    // =========================================================================
    const adminBenDetailRes = await request(app)
      .get(`/api/admin/beneficiaries/${benId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert('L1. Admin Portal Beneficiary Details endpoint returns HTTP 200', adminBenDetailRes.status === 200);
    const adminDetailData = adminBenDetailRes.body.data;
    assert('L2. Beneficiary Details displays riceQuota = 17.5 KG', adminDetailData.riceQuota === 17.5);
    assert('L3. Beneficiary Details displays oilQuota = 2.75 Litres', adminDetailData.oilQuota === 2.75);
    assert('L4. Beneficiary Details contains allocations list with 17.5 and 2.75',
      Array.isArray(adminDetailData.allocations) && adminDetailData.allocations[0].riceAllocated === 17.5);

    // =========================================================================
    // STEP M & N: DISTRIBUTOR MONTHLY ALLOCATION RE-OPENED & RE-SELECTED
    // =========================================================================
    const distRequeryEligible = await request(app)
      .get('/api/distributor/beneficiaries?eligibleForAllocation=true')
      .set('Authorization', `Bearer ${distToken}`);

    assert('M1. Distributor Monthly Allocation re-opened: eligible list loaded', distRequeryEligible.status === 200);
    const reselectedBen = distRequeryEligible.body.data.find(b => b._id === benId);
    assert('N1. Re-selected beneficiary has riceQuota = 17.5 in eligible list', reselectedBen.riceQuota === 17.5);
    assert('N2. Re-selected beneficiary has oilQuota = 2.75 in eligible list', reselectedBen.oilQuota === 2.75);

    const distBenDetailsRes = await request(app)
      .get(`/api/distributor/beneficiaries/${benId}`)
      .set('Authorization', `Bearer ${distToken}`);

    assert('N3. Distributor GET /beneficiaries/:id returns HTTP 200', distBenDetailsRes.status === 200);
    const distBenData = distBenDetailsRes.body.data.beneficiary;
    assert('N4. Distributor Beneficiary Details has riceQuota = 17.5', distBenData.riceQuota === 17.5);
    assert('N5. Distributor Beneficiary Details has oilQuota = 2.75', distBenData.oilQuota === 2.75);

    // =========================================================================
    // STEP O: RE-ALLOCATION / UPDATE ALLOCATION TO NEW DECIMAL VALUES
    // =========================================================================
    const updatedRice = 21.25;
    const updatedOil = 3.5;

    // Call allocateRation again for the same beneficiary (updates existing allocation and syncs quotas)
    const reallocRes = await request(app)
      .post('/api/distributor/allocations')
      .set('Authorization', `Bearer ${distToken}`)
      .send({
        beneficiaryId: benId,
        month: allocMonth,
        year: allocYear,
        riceAllocated: updatedRice,
        oilAllocated: updatedOil,
      });

    assert('O1. Distributor updates allocation with new decimals 21.25 & 3.5 (HTTP 200 or 201)', reallocRes.status === 200 || reallocRes.status === 201);
    assert('O2. Returned allocation has riceAllocated = 21.25 and oilAllocated = 3.5',
      reallocRes.body.data.riceAllocated === 21.25 && reallocRes.body.data.oilAllocated === 3.5);

    // Verify still only 1 allocation document in MongoDB
    const allocCountAfterUpdate = await Allocation.countDocuments({ beneficiary: benId, month: allocMonth, year: allocYear });
    assert('O3. No duplicate allocation created: exactly 1 allocation document persists', allocCountAfterUpdate === 1);

    // Direct MongoDB check on Beneficiary
    const updatedMongoBen = await Beneficiary.findById(benId);
    assert('O4. Beneficiary document riceQuota synchronized to 21.25 in MongoDB', updatedMongoBen.riceQuota === 21.25);
    assert('O5. Beneficiary document oilQuota synchronized to 3.5 in MongoDB', updatedMongoBen.oilQuota === 3.5);

    // Check Beneficiary Dashboard again
    const recheckBenDash = await request(app)
      .get('/api/beneficiary/dashboard/summary')
      .set('Authorization', `Bearer ${benToken}`);

    assert('O6. Beneficiary Dashboard reflects new riceAllocated = 21.25', recheckBenDash.body.data.currentMonthAllocation.riceAllocated === 21.25);
    assert('O7. Beneficiary Dashboard reflects new oilAllocated = 3.5', recheckBenDash.body.data.currentMonthAllocation.oilAllocated === 3.5);

    // Check Admin Portal again
    const recheckAdmin = await request(app)
      .get(`/api/admin/beneficiaries/${benId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert('O8. Admin Portal reflects updated riceQuota = 21.25', recheckAdmin.body.data.riceQuota === 21.25);
    assert('O9. Admin Portal reflects updated oilQuota = 3.5', recheckAdmin.body.data.oilQuota === 3.5);

    console.log('\n======================================================================');
    console.log(`🏁 TASK 5 SYNCHRONIZATION TEST SUMMARY: ${passedTests} / ${totalTests} Passed!`);
    console.log('======================================================================');

    await mongoose.disconnect();
    await mongoServer.stop();

    if (passedTests === totalTests) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed:', err);
    await mongoose.disconnect();
    await mongoServer.stop();
    process.exit(1);
  }
}

testTask5QuotaSynchronization();
