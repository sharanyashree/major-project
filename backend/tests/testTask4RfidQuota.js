const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../app');
const Beneficiary = require('../models/Beneficiary');

async function testTask4() {
  console.log('===========================================================');
  console.log('🧪 TESTING TASK 4: ESP32 RFID DATA & QUOTA INTEGRATION');
  console.log('===========================================================\n');

  let mongoServer;
  try {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    console.log('✅ Connected to in-memory MongoDB');

    const hashedPassword = await bcrypt.hash('Secret123', 10);

    // 1. Create Beneficiary 1 (Active, Rice: 15, Oil: 3)
    const ben1 = await Beneficiary.create({
      fullName: 'Amruta Patil',
      rationCardNumber: 'RC123456',
      mobileNumber: '9876543210',
      password: hashedPassword,
      district: 'Bangalore Urban',
      taluk: 'Bangalore North',
      village: 'Yelahanka',
      address: 'House #42, Main Road',
      rfidUid: 'A1B2C3D4',
      riceQuota: 15,
      oilQuota: 3,
      status: 'Active',
    });

    // 2. Create Beneficiary 2 (Active, Rice: 25, Oil: 5)
    const ben2 = await Beneficiary.create({
      fullName: 'Ramesh Kumar',
      rationCardNumber: 'RC789012',
      mobileNumber: '9876543211',
      password: hashedPassword,
      district: 'Mysore',
      taluk: 'Mysore South',
      village: 'Chamundi',
      address: 'Plot #15, Temple Street',
      rfidUid: 'E5F6A7B8',
      riceQuota: 25,
      oilQuota: 5,
      status: 'Active',
    });

    // 3. Create Beneficiary 3 (Pending, Rice: 10, Oil: 2)
    const ben3 = await Beneficiary.create({
      fullName: 'Pending Beneficiary',
      rationCardNumber: 'RC333333',
      mobileNumber: '9876543212',
      password: hashedPassword,
      district: 'Belagavi',
      taluk: 'Belagavi Rural',
      village: 'Sambara',
      address: 'Cross #3',
      rfidUid: 'PENDING_CARD_01',
      riceQuota: 10,
      oilQuota: 2,
      status: 'Pending',
    });

    // 4. Create Beneficiary 4 (Rejected, Rice: 8, Oil: 1)
    const ben4 = await Beneficiary.create({
      fullName: 'Rejected Beneficiary',
      rationCardNumber: 'RC444444',
      mobileNumber: '9876543213',
      password: hashedPassword,
      district: 'Kalaburagi',
      taluk: 'Kalaburagi City',
      village: 'Sector 5',
      address: 'House #88',
      rfidUid: 'REJECTED_CARD_01',
      riceQuota: 8,
      oilQuota: 1,
      status: 'Rejected',
    });

    console.log('✅ Seeded 4 test beneficiaries with distinct UIDs and quotas\n');

    // Test 1: Scan Card for Beneficiary 1 (Amruta Patil, UID: A1B2C3D4)
    console.log('--- Test 1: Scan RFID for Beneficiary 1 (Amruta Patil) ---');
    const res1 = await request(app)
      .post('/api/machine/rfid')
      .send({ rfidUid: 'A1B2C3D4' });

    console.log('Response Status:', res1.status);
    console.log('Response Body Data:', JSON.stringify(res1.body.data, null, 2));

    if (
      res1.status === 200 &&
      res1.body.success === true &&
      res1.body.data.beneficiary.fullName === 'Amruta Patil' &&
      res1.body.data.beneficiary.rationCardNumber === 'RC123456' &&
      res1.body.data.beneficiary.riceQuota === 15 &&
      res1.body.data.beneficiary.oilQuota === 3
    ) {
      console.log('✅ PASS: Beneficiary 1 returned correct details & dynamic quotas (15 KG Rice, 3 L Oil)');
    } else {
      console.error('❌ FAIL: Beneficiary 1 mismatch');
      process.exit(1);
    }

    // Test OTP generation for Beneficiary 1
    const otpRes1 = await request(app)
      .post('/api/machine/generate-otp')
      .send({ beneficiaryId: res1.body.data.beneficiary._id });

    if (otpRes1.status === 201 && otpRes1.body.success === true) {
      console.log('✅ PASS: OTP generation succeeded for Beneficiary 1');
    } else {
      console.error('❌ FAIL: OTP generation failed for Beneficiary 1');
      process.exit(1);
    }

    // Test 2: Scan Card for Beneficiary 2 (Ramesh Kumar, UID: E5F6A7B8)
    console.log('\n--- Test 2: Scan RFID for Beneficiary 2 (Ramesh Kumar) ---');
    const res2 = await request(app)
      .post('/api/machine/rfid')
      .send({ rfidUid: 'E5F6A7B8' });

    console.log('Response Status:', res2.status);
    console.log('Response Body Data:', JSON.stringify(res2.body.data, null, 2));

    if (
      res2.status === 200 &&
      res2.body.success === true &&
      res2.body.data.beneficiary.fullName === 'Ramesh Kumar' &&
      res2.body.data.beneficiary.rationCardNumber === 'RC789012' &&
      res2.body.data.beneficiary.riceQuota === 25 &&
      res2.body.data.beneficiary.oilQuota === 5
    ) {
      console.log('✅ PASS: Beneficiary 2 returned distinct details & dynamic quotas (25 KG Rice, 5 L Oil)');
    } else {
      console.error('❌ FAIL: Beneficiary 2 mismatch');
      process.exit(1);
    }

    // Test 3: Scan Card for Pending Beneficiary (UID: PENDING_CARD_01)
    console.log('\n--- Test 3: Scan RFID for Pending Beneficiary ---');
    const res3 = await request(app)
      .post('/api/machine/rfid')
      .send({ rfidUid: 'PENDING_CARD_01' });

    console.log('Response Status:', res3.status);
    console.log('Response Body:', res3.body);

    if (res3.status === 403 && res3.body.success === false && res3.body.beneficiaryStatus === 'Pending') {
      console.log('✅ PASS: Pending beneficiary correctly rejected with HTTP 403');
    } else {
      console.error('❌ FAIL: Pending beneficiary was not rejected properly');
      process.exit(1);
    }

    // Test 4: Scan Card for Rejected Beneficiary (UID: REJECTED_CARD_01)
    console.log('\n--- Test 4: Scan RFID for Rejected Beneficiary ---');
    const res4 = await request(app)
      .post('/api/machine/rfid')
      .send({ rfidUid: 'REJECTED_CARD_01' });

    console.log('Response Status:', res4.status);
    console.log('Response Body:', res4.body);

    if (res4.status === 403 && res4.body.success === false && res4.body.beneficiaryStatus === 'Rejected') {
      console.log('✅ PASS: Rejected beneficiary correctly rejected with HTTP 403');
    } else {
      console.error('❌ FAIL: Rejected beneficiary was not rejected properly');
      process.exit(1);
    }

    // Test 5: Scan Non-Existent Card
    console.log('\n--- Test 5: Scan Non-Existent RFID Card ---');
    const res5 = await request(app)
      .post('/api/machine/rfid')
      .send({ rfidUid: 'NON_EXISTENT_UID' });

    console.log('Response Status:', res5.status);
    if (res5.status === 404 && res5.body.success === false) {
      console.log('✅ PASS: Non-existent RFID card returns HTTP 404');
    } else {
      console.error('❌ FAIL: Non-existent RFID card did not return 404');
      process.exit(1);
    }

    console.log('\n===========================================================');
    console.log('🎉 ALL TASK 4 BACKEND & RFID INTEGRATION TESTS PASSED!');
    console.log('===========================================================');
  } finally {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  }
}

testTask4();
