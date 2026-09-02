const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../app');
const Admin = require('../models/Admin');
const Distributor = require('../models/Distributor');
const Beneficiary = require('../models/Beneficiary');

async function testTask3Workflow() {
  console.log('===========================================================');
  console.log('🧪 TESTING TASK 3: USER → DISTRIBUTOR → ADMIN APPROVAL WORKFLOW');
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
    // 1. Setup Admin & Distributor
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
    const distributor = await Distributor.create({
      name: 'North Bangalore FPS',
      distributorId: 'DIST-901',
      fpsCode: 'FPS-901',
      mobileNumber: '9845012345',
      password: distHash,
      district: 'Bangalore Urban',
      taluk: 'Bangalore North',
      status: 'Active',
    });

    const distLoginRes = await request(app)
      .post('/api/auth/distributor/login')
      .send({ distributorId: 'DIST-901', password: 'DistPass123' });
    const distToken = distLoginRes.body.token;

    assert('1. Admin & Distributor Authentication', !!adminToken && !!distToken);

    // 2. STEP 1: USER SELF-REGISTRATION
    const userRegPayload = {
      fullName: 'Suresh Patil',
      rationCardNumber: 'KA-RC-554433',
      mobileNumber: '9988776655',
      password: 'UserPass@123',
      district: 'Bangalore Urban',
      taluk: 'Bangalore North',
      village: 'Yelahanka',
      address: 'Plot 45, Sector 2',
      familyMemberCount: 4,
      cardCategory: 'PHH',
      riceQuota: 20,
      oilQuota: 3,
    };

    const userRegRes = await request(app)
      .post('/api/auth/beneficiary/register')
      .send(userRegPayload);

    assert('2. User self-registration returns HTTP 201', userRegRes.status === 201);
    const registeredUser = userRegRes.body.data;
    assert('3. Registered user has status = Pending', registeredUser.status === 'Pending');
    assert('4. Registered user has submittedToAdmin = false', registeredUser.submittedToAdmin === false);
    assert('5. Auto-assigned to distributor in same district/taluk', registeredUser.assignedDistributor === distributor._id.toString());

    const initialUserCount = await Beneficiary.countDocuments();
    assert('6. Initial user count in DB is exactly 1', initialUserCount === 1);

    // 3. STEP 2: USER APPEARS IN DISTRIBUTOR'S BENEFICIARY TABLE
    const distBenRes = await request(app)
      .get('/api/distributor/beneficiaries')
      .set('Authorization', `Bearer ${distToken}`);

    assert('7. Distributor gets assigned beneficiaries list (HTTP 200)', distBenRes.status === 200);
    const assignedList = distBenRes.body.data;
    const foundInDist = assignedList.find(b => b.rationCardNumber === 'KA-RC-554433');
    assert('8. User automatically appears in Distributor list', !!foundInDist && foundInDist.status === 'Pending');

    // 4. STEP 3: DISTRIBUTOR REVIEWS AND CLICKS SUBMIT
    const submitRes = await request(app)
      .patch(`/api/distributor/beneficiaries/${registeredUser._id}/submit`)
      .set('Authorization', `Bearer ${distToken}`)
      .send({});

    assert('9. Distributor submit to Admin endpoint returns HTTP 200', submitRes.status === 200);
    assert('10. Submitted user has submittedToAdmin = true', submitRes.body.data.submittedToAdmin === true);
    assert('11. SubmissionStatus updated to "Submitted for Admin Review"', submitRes.body.data.submissionStatus === 'Submitted for Admin Review');
    assert('12. submittedAt timestamp recorded', !!submitRes.body.data.submittedAt);

    const midUserCount = await Beneficiary.countDocuments();
    assert('13. No duplicate user record created on submit (Count = 1)', midUserCount === 1);

    // 5. STEP 4: ADMIN REVIEWS AND APPROVES USER
    const adminBenListRes = await request(app)
      .get('/api/admin/beneficiaries')
      .set('Authorization', `Bearer ${adminToken}`);

    assert('14. Admin gets beneficiaries list', adminBenListRes.status === 200);
    const foundInAdmin = adminBenListRes.body.data.find(b => b.rationCardNumber === 'KA-RC-554433');
    assert('15. Admin sees submittedToAdmin = true on user record', foundInAdmin && foundInAdmin.submittedToAdmin === true);

    const approveRes = await request(app)
      .patch(`/api/admin/beneficiaries/${registeredUser._id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    assert('16. Admin approval endpoint returns HTTP 200', approveRes.status === 200);
    assert('17. Approved user has status = Active', approveRes.body.data.status === 'Active');
    assert('18. Approved user has submissionStatus = Reviewed', approveRes.body.data.submissionStatus === 'Reviewed');

    const finalUserCount = await Beneficiary.countDocuments();
    assert('19. No duplicate user record created on Admin approve (Count = 1)', finalUserCount === 1);

    // 6. STEP 5: VERIFY APPROVED USER CAN LOGIN & HAS CORRECT QUOTA
    const userLoginRes = await request(app)
      .post('/api/auth/beneficiary/login')
      .send({
        identifier: 'KA-RC-554433',
        password: 'UserPass@123',
      });

    assert('20. Approved user login succeeds with HTTP 200 & JWT', userLoginRes.status === 200 && !!userLoginRes.body.token);
    assert('21. Approved user has correct Rice & Oil quota preserved', userLoginRes.body.data.riceQuota === 20 && userLoginRes.body.data.oilQuota === 3);

    console.log('\n===========================================================');
    console.log(`🏁 TASK 3 WORKFLOW TEST SUMMARY: ${passedTests} / ${totalTests} Passed!`);
    console.log('===========================================================');

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

testTask3Workflow();
