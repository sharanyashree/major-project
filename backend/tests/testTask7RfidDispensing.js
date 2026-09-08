const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../app');
const Beneficiary = require('../models/Beneficiary');
const Distributor = require('../models/Distributor');
const Allocation = require('../models/Allocation');
const Inventory = require('../models/Inventory');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');

async function testTask7() {
  console.log('===========================================================');
  console.log('🧪 TESTING TASK 7: RFID / ESP32 RATION DISPENSING & QUOTA');
  console.log('===========================================================\n');

  let mongoServer;
  try {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    console.log('✅ Connected to in-memory MongoDB');

    const hashedPassword = await bcrypt.hash('Password123', 10);
    const currentDate = new Date();
    const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
    const currentYear = currentDate.getFullYear();

    // 1. Create a Distributor and Stock Inventory
    const distributor = await Distributor.create({
      name: 'Suresh Distributor',
      fullName: 'Suresh Distributor',
      email: 'suresh@distributor.com',
      mobileNumber: '9988776655',
      distributorId: 'DIST-001',
      password: hashedPassword,
      fpsCode: 'FPS-7788',
      district: 'Bangalore Urban',
      taluk: 'Bangalore North',
      village: 'Yelahanka',
      address: 'Shop #12, Market Road',
      status: 'Active',
    });

    const inventory = await Inventory.create({
      distributor: distributor._id,
      distributorId: distributor._id,
      riceStock: 500.0,
      oilStock: 100.0,
      lastUpdated: new Date(),
    });

    // 2. Beneficiary 1: Active with Decimal Quota (15.5 kg Rice, 3.25 L Oil)
    const benDecimal = await Beneficiary.create({
      fullName: 'Savita Devi',
      rationCardNumber: 'RC-DEC-101',
      mobileNumber: '9876500001',
      password: hashedPassword,
      district: 'Bangalore Urban',
      taluk: 'Bangalore North',
      village: 'Yelahanka',
      address: 'House #1, Lane 2',
      rfidUid: 'CARD_DEC_01',
      riceQuota: 15.5,
      oilQuota: 3.25,
      assignedDistributor: distributor._id,
      status: 'Active',
    });

    await Allocation.create({
      beneficiary: benDecimal._id,
      distributor: distributor._id,
      month: currentMonth,
      year: currentYear,
      riceAllocated: 15.5,
      oilAllocated: 3.25,
      collectionStatus: 'Pending',
    });

    // 3. Beneficiary 2: Approved Status (Testing Approved status handling)
    const benApproved = await Beneficiary.create({
      fullName: 'Anand Kumar',
      rationCardNumber: 'RC-APP-102',
      mobileNumber: '9876500002',
      password: hashedPassword,
      district: 'Bangalore Urban',
      taluk: 'Bangalore North',
      village: 'Yelahanka',
      address: 'House #5',
      rfidUid: 'CARD_APP_02',
      riceQuota: 10.0,
      oilQuota: 2.0,
      assignedDistributor: distributor._id,
      status: 'Approved',
    });

    await Allocation.create({
      beneficiary: benApproved._id,
      distributor: distributor._id,
      month: currentMonth,
      year: currentYear,
      riceAllocated: 10.0,
      oilAllocated: 2.0,
      collectionStatus: 'Pending',
    });

    // 4. Beneficiary 3: Zero Quota Beneficiary (Rice: 0, Oil: 0)
    const benZero = await Beneficiary.create({
      fullName: 'Zero Quota User',
      rationCardNumber: 'RC-ZERO-103',
      mobileNumber: '9876500003',
      password: hashedPassword,
      district: 'Bangalore Urban',
      taluk: 'Bangalore North',
      village: 'Yelahanka',
      address: 'House #99',
      rfidUid: 'CARD_ZERO_03',
      riceQuota: 0,
      oilQuota: 0,
      assignedDistributor: distributor._id,
      status: 'Active',
    });

    await Allocation.create({
      beneficiary: benZero._id,
      distributor: distributor._id,
      month: currentMonth,
      year: currentYear,
      riceAllocated: 0,
      oilAllocated: 0,
      collectionStatus: 'Pending',
    });

    // 5. Beneficiary 4: Inactive Beneficiary
    const benSuspended = await Beneficiary.create({
      fullName: 'Inactive User',
      rationCardNumber: 'RC-INA-104',
      mobileNumber: '9876500004',
      password: hashedPassword,
      district: 'Bangalore Urban',
      taluk: 'Bangalore North',
      village: 'Yelahanka',
      address: 'House #10',
      rfidUid: 'CARD_INA_04',
      riceQuota: 20,
      oilQuota: 5,
      assignedDistributor: distributor._id,
      status: 'Inactive',
    });

    console.log('✅ Seeded distributor, inventory, and 4 test beneficiaries\n');

    // -----------------------------------------------------------------
    // TEST 1: Check RFID for Active Decimal Quota Beneficiary
    // -----------------------------------------------------------------
    console.log('--- Test 1: Check RFID with Decimal Quota ---');
    const rfidRes1 = await request(app)
      .post('/api/machine/rfid')
      .send({ rfidUid: 'CARD_DEC_01' });

    console.log('Status:', rfidRes1.status);
    console.log('Data:', rfidRes1.body.data);

    if (
      rfidRes1.status === 200 &&
      rfidRes1.body.success === true &&
      rfidRes1.body.data.beneficiary.riceQuota === 15.5 &&
      rfidRes1.body.data.beneficiary.oilQuota === 3.25 &&
      rfidRes1.body.data.allocation.riceAllocated === 15.5 &&
      rfidRes1.body.data.allocation.oilAllocated === 3.25 &&
      rfidRes1.body.data.availableRice === 15.5 &&
      rfidRes1.body.data.availableOil === 3.25 &&
      rfidRes1.body.data.hasAllocatedQuota === true
    ) {
      console.log('✅ PASS: Decimal quota preserved exactly without rounding or truncation');
    } else {
      console.error('❌ FAIL: Decimal quota check failed');
      process.exit(1);
    }

    // -----------------------------------------------------------------
    // TEST 2: Check RFID for Approved Status Beneficiary
    // -----------------------------------------------------------------
    console.log('\n--- Test 2: Check RFID with Approved Status ---');
    const rfidRes2 = await request(app)
      .post('/api/machine/rfid')
      .send({ rfidUid: 'CARD_APP_02' });

    if (
      rfidRes2.status === 200 &&
      rfidRes2.body.success === true &&
      rfidRes2.body.data.beneficiary.status === 'Approved'
    ) {
      console.log('✅ PASS: Approved status accepted for machine operations');
    } else {
      console.error('❌ FAIL: Approved status check failed');
      process.exit(1);
    }

    // -----------------------------------------------------------------
    // TEST 3: Zero Quota Beneficiary - Check RFID & Prevent Dispense
    // -----------------------------------------------------------------
    console.log('\n--- Test 3: Zero Quota Beneficiary Handling ---');
    const rfidRes3 = await request(app)
      .post('/api/machine/rfid')
      .send({ rfidUid: 'CARD_ZERO_03' });

    if (
      rfidRes3.status === 200 &&
      rfidRes3.body.data.availableRice === 0 &&
      rfidRes3.body.data.availableOil === 0 &&
      rfidRes3.body.data.hasAllocatedQuota === false
    ) {
      console.log('✅ PASS: Zero quota correctly returns 0 and hasAllocatedQuota=false (no default 25/2)');
    } else {
      console.error('❌ FAIL: Zero quota returned unexpected values');
      process.exit(1);
    }

    // Attempting OTP generation for zero-quota user must be rejected
    const otpResZero = await request(app)
      .post('/api/machine/generate-otp')
      .send({ beneficiaryId: benZero._id });

    if (otpResZero.status === 400 && otpResZero.body.success === false) {
      console.log('✅ PASS: OTP generation disallowed for zero-quota beneficiary');
    } else {
      console.error('❌ FAIL: OTP generation was not disallowed for zero quota');
      process.exit(1);
    }

    // Attempting dispense validation for zero quota must fail
    const valResZero = await request(app)
      .post('/api/machine/dispense')
      .send({
        beneficiaryId: benZero._id,
        riceQuantity: 5,
        oilQuantity: 1,
      });

    if (valResZero.status === 400 && valResZero.body.valid === false) {
      console.log('✅ PASS: Dispense validation rejected for zero-quota beneficiary');
    } else {
      console.error('❌ FAIL: Dispense validation was not rejected for zero quota');
      process.exit(1);
    }

    // -----------------------------------------------------------------
    // TEST 4: Inactive Beneficiary Rejection
    // -----------------------------------------------------------------
    console.log('\n--- Test 4: Inactive Beneficiary Access Rejection ---');
    const rfidRes4 = await request(app)
      .post('/api/machine/rfid')
      .send({ rfidUid: 'CARD_INA_04' });

    if (rfidRes4.status === 403 && rfidRes4.body.beneficiaryStatus === 'Inactive') {
      console.log('✅ PASS: Inactive beneficiary rejected with 403 on RFID scan');
    } else {
      console.error('❌ FAIL: Inactive beneficiary was not rejected with 403');
      process.exit(1);
    }

    // -----------------------------------------------------------------
    // TEST 5: Validate Partial Decimal Dispense
    // -----------------------------------------------------------------
    console.log('\n--- Test 5: Validate Partial Decimal Dispense (5.5 kg Rice, 1.25 L Oil) ---');
    const valRes1 = await request(app)
      .post('/api/machine/dispense')
      .send({
        beneficiaryId: benDecimal._id,
        rfidUid: 'CARD_DEC_01',
        riceQuantity: 5.5,
        oilQuantity: 1.25,
        machineId: 'SRM-CENTER-001',
      });

    if (valRes1.status === 200 && valRes1.body.valid === true) {
      console.log('✅ PASS: Decimal dispense validation approved');
    } else {
      console.error('❌ FAIL: Decimal dispense validation failed:', valRes1.body);
      process.exit(1);
    }

    // -----------------------------------------------------------------
    // TEST 6: Complete Decimal Dispense Transaction
    // -----------------------------------------------------------------
    console.log('\n--- Test 6: Complete Decimal Dispense Transaction ---');
    const compRes1 = await request(app)
      .post('/api/machine/complete')
      .send({
        beneficiaryId: benDecimal._id,
        rfidUid: 'CARD_DEC_01',
        riceQuantity: 5.5,
        oilQuantity: 1.25,
        machineId: 'SRM-CENTER-001',
        distributorId: distributor._id,
        requestId: 'REQ-DISPENSE-001',
      });

    console.log('Complete Response:', compRes1.body);

    if (
      compRes1.status === 200 &&
      compRes1.body.success === true &&
      compRes1.body.data.updatedAllocationStatus === 'Partially Collected' &&
      compRes1.body.data.remainingBeneficiaryQuota.riceRemaining === 10.0 &&
      compRes1.body.data.remainingBeneficiaryQuota.oilRemaining === 2.0 &&
      compRes1.body.data.remainingDistributorInventory.riceStock === 494.5 &&
      compRes1.body.data.remainingDistributorInventory.oilStock === 98.75
    ) {
      console.log('✅ PASS: Transaction completed with exact decimal calculations for quota & inventory');
    } else {
      console.error('❌ FAIL: Complete dispense mismatch:', compRes1.body);
      process.exit(1);
    }

    // -----------------------------------------------------------------
    // TEST 7: Duplicate Replay Protection with requestId
    // -----------------------------------------------------------------
    console.log('\n--- Test 7: Duplicate Replay Protection via requestId ---');
    const compResDup = await request(app)
      .post('/api/machine/complete')
      .send({
        beneficiaryId: benDecimal._id,
        rfidUid: 'CARD_DEC_01',
        riceQuantity: 5.5,
        oilQuantity: 1.25,
        machineId: 'SRM-CENTER-001',
        distributorId: distributor._id,
        requestId: 'REQ-DISPENSE-001',
      });

    if (
      compResDup.status === 200 &&
      compResDup.body.message.includes('already completed (idempotent request)')
    ) {
      console.log('✅ PASS: Duplicate request with same requestId returned existing transaction without double deduction');
    } else {
      console.error('❌ FAIL: Duplicate requestId replay protection failed:', compResDup.body);
      process.exit(1);
    }

    // Verify inventory wasn't deducted a second time
    const checkInv = await Inventory.findOne({ distributor: distributor._id });
    if (checkInv.riceStock === 494.5 && checkInv.oilStock === 98.75) {
      console.log('✅ PASS: Inventory verified untouched after duplicate request');
    } else {
      console.error('❌ FAIL: Inventory was deducted twice!');
      process.exit(1);
    }

    // -----------------------------------------------------------------
    // TEST 8: Exceeding Remaining Quota Rejection
    // -----------------------------------------------------------------
    console.log('\n--- Test 8: Exceeding Remaining Quota Rejection ---');
    // Remaining is 10.0 kg rice and 2.0 L oil. Request 11.0 kg rice.
    const exceedVal = await request(app)
      .post('/api/machine/dispense')
      .send({
        beneficiaryId: benDecimal._id,
        riceQuantity: 11.0,
        oilQuantity: 1.0,
      });

    if (exceedVal.status === 400 && exceedVal.body.valid === false) {
      console.log('✅ PASS: Request exceeding remaining quota rejected during validation (11.0 kg > 10.0 kg)');
    } else {
      console.error('❌ FAIL: Exceeding quota was not rejected during validation');
      process.exit(1);
    }

    const exceedComp = await request(app)
      .post('/api/machine/complete')
      .send({
        beneficiaryId: benDecimal._id,
        riceQuantity: 11.0,
        oilQuantity: 1.0,
        machineId: 'SRM-CENTER-001',
        distributorId: distributor._id,
      });

    if (exceedComp.status === 400 && exceedComp.body.success === false) {
      console.log('✅ PASS: Request exceeding remaining quota rejected during complete dispense');
    } else {
      console.error('❌ FAIL: Exceeding quota was not rejected during complete');
      process.exit(1);
    }

    // -----------------------------------------------------------------
    // TEST 9: Dispense Remaining Quota to Transition to 'Collected'
    // -----------------------------------------------------------------
    console.log('\n--- Test 9: Complete Remaining Quota (10.0 kg Rice, 2.0 L Oil) ---');
    const finalComp = await request(app)
      .post('/api/machine/complete')
      .send({
        beneficiaryId: benDecimal._id,
        rfidUid: 'CARD_DEC_01',
        riceQuantity: 10.0,
        oilQuantity: 2.0,
        machineId: 'SRM-CENTER-001',
        distributorId: distributor._id,
        requestId: 'REQ-DISPENSE-002',
      });

    if (
      finalComp.status === 200 &&
      finalComp.body.data.updatedAllocationStatus === 'Collected' &&
      finalComp.body.data.remainingBeneficiaryQuota.riceRemaining === 0 &&
      finalComp.body.data.remainingBeneficiaryQuota.oilRemaining === 0
    ) {
      console.log('✅ PASS: Allocation transitioned to "Collected" and remaining quota is exactly 0');
    } else {
      console.error('❌ FAIL: Final dispense status mismatch:', finalComp.body);
      process.exit(1);
    }

    // -----------------------------------------------------------------
    // TEST 10: Check Notifications & Transactions Created
    // -----------------------------------------------------------------
    console.log('\n--- Test 10: Verification of Database Records ---');
    const txCount = await Transaction.countDocuments({ beneficiary: benDecimal._id });
    const benNotifs = await Notification.countDocuments({ receiverId: benDecimal._id });
    const distNotifs = await Notification.countDocuments({ receiverId: distributor._id });

    if (txCount === 2 && benNotifs === 2 && distNotifs === 2) {
      console.log('✅ PASS: Exactly 2 transactions and corresponding notifications created');
    } else {
      console.error(`❌ FAIL: Expected 2 transactions/notifications, got tx=${txCount}, benNotifs=${benNotifs}, distNotifs=${distNotifs}`);
      process.exit(1);
    }

    console.log('\n===========================================================');
    console.log('🎉 ALL 10 TASK 7 RFID / ESP32 DISPENSING TESTS PASSED!');
    console.log('===========================================================');
  } finally {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  }
}

testTask7();
