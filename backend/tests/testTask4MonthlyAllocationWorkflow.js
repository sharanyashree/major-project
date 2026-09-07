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

async function testTask4MonthlyAllocationWorkflow() {
  console.log('===========================================================');
  console.log('🧪 TESTING TASK 4: DISTRIBUTOR MONTHLY ALLOCATION WORKFLOW');
  console.log('===========================================================\n');

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
    // 1. Setup Admin, Distributor A (Bangalore Urban), and Distributor B (Mysore)
    const adminHash = await bcrypt.hash('AdminPass123', 10);
    const admin = await Admin.create({
      name: 'Central Admin',
      adminId: 'ADMIN-01',
      email: 'admin@gov.in',
      password: adminHash,
      role: 'Admin',
    });

    const adminLoginRes = await request(app)
      .post('/api/auth/admin/login')
      .send({ adminId: 'ADMIN-01', password: 'AdminPass123' });
    const adminToken = adminLoginRes.body.token;

    const distHash = await bcrypt.hash('DistPass123', 10);
    const distA = await Distributor.create({
      name: 'Bangalore FPS Shop',
      distributorId: 'DIST-BLR-01',
      fpsCode: 'FPS-BLR-01',
      storeName: 'Fair Price Shop Bangalore',
      mobileNumber: '9845011111',
      password: distHash,
      district: 'Bangalore Urban',
      taluk: 'Bangalore North',
      status: 'Active',
    });

    const distB = await Distributor.create({
      name: 'Mysore FPS Shop',
      distributorId: 'DIST-MYS-02',
      fpsCode: 'FPS-MYS-02',
      storeName: 'Fair Price Shop Mysore',
      mobileNumber: '9845022222',
      password: distHash,
      district: 'Mysore',
      taluk: 'Mysore South',
      status: 'Active',
    });

    // Seed stock inventory for Distributor A
    await Inventory.create({
      distributor: distA._id,
      distributorId: distA._id,
      riceStock: 1000,
      oilStock: 500,
    });

    const distALogin = await request(app)
      .post('/api/auth/distributor/login')
      .send({ distributorId: 'DIST-BLR-01', password: 'DistPass123' });
    const distAToken = distALogin.body.token;

    const distBLogin = await request(app)
      .post('/api/auth/distributor/login')
      .send({ distributorId: 'DIST-MYS-02', password: 'DistPass123' });
    const distBToken = distBLogin.body.token;

    assert('1. Admin and Distributors authenticated successfully', !!adminToken && !!distAToken && !!distBToken);

    // 2. BENEFICIARY 1 REGISTRATION (User in Bangalore Urban)
    const ben1Payload = {
      fullName: 'Ramesh Kumar',
      rationCardNumber: 'KA-BLR-1001',
      mobileNumber: '9888800001',
      password: 'UserPass@123',
      district: 'Bangalore Urban',
      taluk: 'Bangalore North',
      village: 'Yelahanka',
      address: '1st Cross, Yelahanka New Town',
      familyMemberCount: 4,
    };

    const ben1RegRes = await request(app)
      .post('/api/auth/beneficiary/register')
      .send(ben1Payload);

    assert('2. Beneficiary 1 registration succeeds (HTTP 201)', ben1RegRes.status === 201);
    const ben1Data = ben1RegRes.body.data;
    assert('3. Newly registered beneficiary has status = Pending', ben1Data.status === 'Pending');
    assert('4. Newly registered beneficiary starts with unallocated quota (Rice=0, Oil=0)', ben1Data.riceQuota === 0 && ben1Data.oilQuota === 0);
    assert('5. Correctly linked to Distributor A in Bangalore Urban', ben1Data.assignedDistributor === distA._id.toString());

    // 3. VERIFY IN DISTRIBUTOR A'S LISTS
    // In Beneficiary Details list (all assigned beneficiaries)
    const distABeneficiaries = await request(app)
      .get('/api/distributor/beneficiaries')
      .set('Authorization', `Bearer ${distAToken}`);

    assert('6. Distributor A can fetch assigned beneficiaries (HTTP 200)', distABeneficiaries.status === 200);
    const hasBen1InAssigned = distABeneficiaries.body.data.some((b) => b._id === ben1Data._id);
    assert('7. Newly registered beneficiary appears in Distributor A Beneficiary Details', hasBen1InAssigned);

    // In Monthly Allocation eligible list (eligibleForAllocation=true)
    const distAEligibleBeforeApprove = await request(app)
      .get('/api/distributor/beneficiaries?eligibleForAllocation=true')
      .set('Authorization', `Bearer ${distAToken}`);

    const hasBen1InAllocationBeforeApprove = distAEligibleBeforeApprove.body.data.some((b) => b._id === ben1Data._id);
    assert('8. Pending beneficiary is NOT included in Monthly Allocation eligible list', !hasBen1InAllocationBeforeApprove);

    // Attempting to allocate ration to Pending beneficiary must fail with HTTP 400
    const allocAttemptBeforeApprove = await request(app)
      .post('/api/distributor/allocations')
      .set('Authorization', `Bearer ${distAToken}`)
      .send({
        beneficiaryId: ben1Data._id,
        month: 'August',
        year: 2026,
        riceAllocated: 10,
        oilAllocated: 2,
      });

    assert('9. Allocation rejected for Pending beneficiary (HTTP 400)', allocAttemptBeforeApprove.status === 400);

    // 4. DISTRIBUTOR SUBMITS BENEFICIARY 1 TO ADMIN
    const submitRes = await request(app)
      .patch(`/api/distributor/beneficiaries/${ben1Data._id}/submit-to-admin`)
      .set('Authorization', `Bearer ${distAToken}`);

    assert('10. Distributor submits beneficiary to Admin (HTTP 200)', submitRes.status === 200);
    assert('11. Submission status is "Submitted for Admin Review"', submitRes.body.data.submissionStatus === 'Submitted for Admin Review');
    assert('12. Status remains Pending while under Admin review', submitRes.body.data.status === 'Pending');

    // Still excluded from Monthly Allocation while under review
    const distAEligibleUnderReview = await request(app)
      .get('/api/distributor/beneficiaries?eligibleForAllocation=true')
      .set('Authorization', `Bearer ${distAToken}`);

    const hasBen1UnderReview = distAEligibleUnderReview.body.data.some((b) => b._id === ben1Data._id);
    assert('13. Beneficiary under Admin Review remains excluded from Monthly Allocation list', !hasBen1UnderReview);

    // 5. TEST REJECTION WORKFLOW
    // Register Beneficiary 2, submit and reject
    const ben2RegRes = await request(app)
      .post('/api/auth/beneficiary/register')
      .send({
        fullName: 'Anand Verma',
        rationCardNumber: 'KA-BLR-1002',
        mobileNumber: '9888800002',
        password: 'UserPass@123',
        district: 'Bangalore Urban',
        taluk: 'Bangalore North',
        village: 'Hebbal',
        address: '2nd Main, Hebbal',
        familyMemberCount: 3,
      });
    const ben2Data = ben2RegRes.body.data;

    await request(app)
      .patch(`/api/distributor/beneficiaries/${ben2Data._id}/submit-to-admin`)
      .set('Authorization', `Bearer ${distAToken}`);

    // Admin rejects ben2
    const rejectRes = await request(app)
      .patch(`/api/admin/beneficiaries/${ben2Data._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert('14. Admin rejects beneficiary (HTTP 200)', rejectRes.status === 200);
    assert('15. Rejected beneficiary status is Rejected', rejectRes.body.data.status === 'Rejected');

    // Verify rejected beneficiary cannot receive allocation
    const allocAttemptRejected = await request(app)
      .post('/api/distributor/allocations')
      .set('Authorization', `Bearer ${distAToken}`)
      .send({
        beneficiaryId: ben2Data._id,
        month: 'August',
        year: 2026,
        riceAllocated: 10,
        oilAllocated: 2,
      });

    assert('16. Allocation rejected for Rejected beneficiary (HTTP 400)', allocAttemptRejected.status === 400);

    // 6. ADMIN APPROVES BENEFICIARY 1
    const approveRes = await request(app)
      .patch(`/api/admin/beneficiaries/${ben1Data._id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert('17. Admin approves Beneficiary 1 (HTTP 200)', approveRes.status === 200);
    assert('18. Approved beneficiary status is Active', approveRes.body.data.status === 'Active');
    assert('19. Submission status is Reviewed', approveRes.body.data.submissionStatus === 'Reviewed');

    // Document in MongoDB was updated in place (no duplicates)
    const ben1DocCount = await Beneficiary.countDocuments({ rationCardNumber: 'KA-BLR-1001' });
    assert('20. Beneficiary record was updated in place without duplicate documents (Count = 1)', ben1DocCount === 1);

    // 7. VERIFY APPROVED BENEFICIARY NOW APPEARS IN MONTHLY ALLOCATION
    const distAEligibleAfterApprove = await request(app)
      .get('/api/distributor/beneficiaries?eligibleForAllocation=true')
      .set('Authorization', `Bearer ${distAToken}`);

    const hasBen1AfterApprove = distAEligibleAfterApprove.body.data.some((b) => b._id === ben1Data._id);
    assert('21. Approved beneficiary now appears in Distributor A Monthly Allocation eligible list', hasBen1AfterApprove);

    // Check actual unallocated quota values
    const approvedBen1 = distAEligibleAfterApprove.body.data.find((b) => b._id === ben1Data._id);
    assert('22. Unallocated beneficiary correctly displays Rice=0 and Oil=0', approvedBen1.riceQuota === 0 && approvedBen1.oilQuota === 0);

    // 8. DISTRIBUTOR A AUTHORIZES MONTHLY ALLOCATION
    const allocRes = await request(app)
      .post('/api/distributor/allocations')
      .set('Authorization', `Bearer ${distAToken}`)
      .send({
        beneficiaryId: ben1Data._id,
        month: 'August',
        year: 2026,
        riceAllocated: 15,
        oilAllocated: 2.5,
      });

    assert('23. Monthly Allocation authorization succeeds (HTTP 201)', allocRes.status === 201);
    assert('24. Allocation record created with Rice=15 and Oil=2.5', allocRes.body.data.riceAllocated === 15 && allocRes.body.data.oilAllocated === 2.5);

    // Verify beneficiary record now reflects stored quota values
    const updatedBen1 = await Beneficiary.findById(ben1Data._id);
    assert('25. Beneficiary record stored quota updated to Rice=15, Oil=2.5', updatedBen1.riceQuota === 15 && updatedBen1.oilQuota === 2.5);

    // Re-query eligible beneficiaries: now shows stored quota
    const distAEligibleAfterAlloc = await request(app)
      .get('/api/distributor/beneficiaries?eligibleForAllocation=true')
      .set('Authorization', `Bearer ${distAToken}`);

    const allocatedBen1InList = distAEligibleAfterAlloc.body.data.find((b) => b._id === ben1Data._id);
    assert('26. Allocated beneficiary reflects stored quota in distributor list (Rice=15, Oil=2.5)', allocatedBen1InList.riceQuota === 15 && allocatedBen1InList.oilQuota === 2.5);

    // 9. JURISDICTION ISOLATION CHECK: DISTRIBUTOR B (Mysore)
    // Distributor B must NOT see Beneficiary 1 (Bangalore Urban)
    const distBBeneficiaries = await request(app)
      .get('/api/distributor/beneficiaries')
      .set('Authorization', `Bearer ${distBToken}`);

    const distBHasBen1 = distBBeneficiaries.body.data.some((b) => b._id === ben1Data._id);
    assert('27. Beneficiary assigned to Distributor A does NOT appear in Distributor B list', !distBHasBen1);

    // Distributor B cannot allocate to Beneficiary 1
    const distBAllocAttempt = await request(app)
      .post('/api/distributor/allocations')
      .set('Authorization', `Bearer ${distBToken}`)
      .send({
        beneficiaryId: ben1Data._id,
        month: 'August',
        year: 2026,
        riceAllocated: 15,
        oilAllocated: 2.5,
      });

    assert('28. Distributor B allocation to Distributor A beneficiary is rejected (HTTP 404)', distBAllocAttempt.status === 404);

    console.log('\n===========================================================');
    console.log(`🏁 TASK 4 WORKFLOW TEST SUMMARY: ${passedTests} / ${totalTests} Passed!`);
    console.log('===========================================================');

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

testTask4MonthlyAllocationWorkflow();
