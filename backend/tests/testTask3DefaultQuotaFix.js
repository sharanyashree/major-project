const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../app');

const Admin = require('../models/Admin');
const Distributor = require('../models/Distributor');
const Beneficiary = require('../models/Beneficiary');
const Allocation = require('../models/Allocation');
const Inventory = require('../models/Inventory');

async function runTask3DefaultQuotaTests() {
  console.log('========================================================================');
  console.log('🧪 TESTING TASK 3: FIX INCORRECT AUTOMATIC DEFAULT RICE & OIL QUOTAS');
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
    // 1. Seed Distributor
    const hashedDistPassword = await bcrypt.hash('DistPass123', 10);
    const distributor = await Distributor.create({
      distributorId: 'DIST-501',
      name: 'Ramesh FPS Store',
      storeName: 'Ramesh Fair Price Shop',
      fpsCode: 'FPS-5001',
      mobileNumber: '9845012345',
      password: hashedDistPassword,
      district: 'Bangalore Urban',
      taluk: 'Bangalore North',
      status: 'Active',
    });

    await Inventory.create({
      distributor: distributor._id,
      distributorId: distributor._id,
      fpsCode: 'FPS-5001',
      riceStock: 500,
      oilStock: 200,
    });

    // 2. Beneficiary Self-Registration with 5 family members (the case that previously generated 25 KG Rice & 2L Oil)
    const registrationPayload = {
      fullName: 'Aarav Kumar',
      rationCardNumber: 'KA-RC-998877',
      mobileNumber: '9876543210',
      password: 'UserPass@123',
      district: 'Bangalore Urban',
      taluk: 'Bangalore North',
      village: 'Hebbal',
      address: 'House #12, 3rd Cross',
      familyMemberCount: 5,
      cardCategory: 'PHH',
    };

    const regRes = await request(app)
      .post('/api/auth/beneficiary/register')
      .send(registrationPayload);

    assert('1. Beneficiary registration returns HTTP 201 Created', regRes.status === 201);
    assert('2. Registration response riceQuota is 0 (NOT 25 KG)', regRes.body.data.riceQuota === 0, `riceQuota: ${regRes.body.data?.riceQuota}`);
    assert('3. Registration response oilQuota is 0 (NOT 2 L)', regRes.body.data.oilQuota === 0, `oilQuota: ${regRes.body.data?.oilQuota}`);

    // 3. Verify in MongoDB directly
    const beneficiaryInDb = await Beneficiary.findOne({ mobileNumber: '9876543210' });
    assert('4. Beneficiary found in MongoDB', !!beneficiaryInDb);
    assert('5. MongoDB record riceQuota is strictly 0', beneficiaryInDb.riceQuota === 0, `Stored: ${beneficiaryInDb.riceQuota}`);
    assert('6. MongoDB record oilQuota is strictly 0', beneficiaryInDb.oilQuota === 0, `Stored: ${beneficiaryInDb.oilQuota}`);

    // 4. Beneficiary Login Quota Verification
    // First activate beneficiary to allow login
    beneficiaryInDb.status = 'Active';
    await beneficiaryInDb.save();

    const loginRes = await request(app)
      .post('/api/auth/beneficiary/login')
      .send({
        identifier: '9876543210',
        password: 'UserPass@123',
      });

    assert('7. Beneficiary login returns HTTP 200', loginRes.status === 200);
    const userToken = loginRes.body.token;
    assert('8. Login user session contains riceQuota = 0', loginRes.body.data.riceQuota === 0);
    assert('9. Login user session contains oilQuota = 0', loginRes.body.data.oilQuota === 0);

    // 5. Beneficiary Current Allocation Endpoint (No allocation issued yet)
    const currAllocRes = await request(app)
      .get('/api/beneficiary/allocation/current')
      .set('Authorization', `Bearer ${userToken}`);

    assert('10. Current allocation endpoint returns HTTP 200', currAllocRes.status === 200);
    assert('11. Current allocation riceAllocated is 0', currAllocRes.body.data.riceAllocated === 0, `riceAllocated: ${currAllocRes.body.data?.riceAllocated}`);
    assert('12. Current allocation oilAllocated is 0', currAllocRes.body.data.oilAllocated === 0, `oilAllocated: ${currAllocRes.body.data?.oilAllocated}`);

    // 6. Beneficiary Dashboard Summary Endpoint
    const dashRes = await request(app)
      .get('/api/beneficiary/dashboard')
      .set('Authorization', `Bearer ${userToken}`);

    assert('13. Beneficiary dashboard summary returns HTTP 200', dashRes.status === 200);
    assert('14. Dashboard currentMonthAllocation.riceAllocated is 0', dashRes.body.data.currentMonthAllocation.riceAllocated === 0);
    assert('15. Dashboard currentMonthAllocation.oilAllocated is 0', dashRes.body.data.currentMonthAllocation.oilAllocated === 0);

    // 7. Distributor Views Beneficiary
    const distLoginRes = await request(app)
      .post('/api/auth/distributor/login')
      .send({ distributorId: 'DIST-501', password: 'DistPass123' });

    const distToken = distLoginRes.body.token;
    const distBensRes = await request(app)
      .get('/api/distributor/beneficiaries')
      .set('Authorization', `Bearer ${distToken}`);

    assert('16. Distributor gets beneficiaries list returns HTTP 200', distBensRes.status === 200);
    const listedBen = distBensRes.body.data.find(b => b.mobileNumber === '9876543210');
    assert('17. Beneficiary listed under distributor has riceQuota = 0', listedBen && listedBen.riceQuota === 0);
    assert('18. Beneficiary listed under distributor has oilQuota = 0', listedBen && listedBen.oilQuota === 0);

    // 8. Distributor issues Monthly Allocation with Decimal Values (e.g. Rice: 1.5 KG, Oil: 2.5 L)
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
    const currentYear = new Date().getFullYear();

    const allocateRes = await request(app)
      .post('/api/distributor/allocate')
      .set('Authorization', `Bearer ${distToken}`)
      .send({
        beneficiaryId: beneficiaryInDb._id.toString(),
        month: currentMonth,
        year: currentYear,
        riceQuantity: 1.5,
        oilQuantity: 2.5,
        collectionStatus: 'Pending',
      });

    assert('19. Distributor allocates 1.5 KG Rice and 2.5 L Oil (HTTP 201)', allocateRes.status === 201);

    // 9. Verify Quota becomes real sanctioned value in Beneficiary Record
    const updatedBenInDb = await Beneficiary.findById(beneficiaryInDb._id);
    assert('20. Beneficiary record riceQuota is updated to 1.5 KG', updatedBenInDb.riceQuota === 1.5, `riceQuota: ${updatedBenInDb.riceQuota}`);
    assert('21. Beneficiary record oilQuota is updated to 2.5 L', updatedBenInDb.oilQuota === 2.5, `oilQuota: ${updatedBenInDb.oilQuota}`);

    // 10. Beneficiary retrieves updated allocation
    const updatedAllocRes = await request(app)
      .get('/api/beneficiary/allocation/current')
      .set('Authorization', `Bearer ${userToken}`);

    assert('22. Beneficiary sees updated riceAllocated = 1.5 KG', updatedAllocRes.body.data.riceAllocated === 1.5);
    assert('23. Beneficiary sees updated oilAllocated = 2.5 L', updatedAllocRes.body.data.oilAllocated === 2.5);

  } catch (error) {
    console.error('❌ Test execution error:', error);
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }

  console.log('\n========================================================================');
  console.log(`🏁 TASK 3 DEFAULT QUOTA TEST RESULT: ${passedTests} / ${totalTests} Passed!`);
  console.log('========================================================================\n');
}

runTask3DefaultQuotaTests();
