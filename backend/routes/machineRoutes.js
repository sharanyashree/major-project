const express = require('express');
const router = express.Router();
const {
  checkRfid,
  generateOtp,
  verifyOtp,
  checkAllocation,
  validateDispense,
  completeDispense,
  getMachineStatus,
} = require('../controllers/machineController');

// ==========================================
// SMART RATION MACHINE ROUTES
// ==========================================

// 1. RFID Scan
router.post('/rfid', checkRfid);

// 2. OTP Generation
router.post('/generate-otp', generateOtp);

// 3. OTP Verification
router.post('/verify-otp', verifyOtp);

// 4. Allocation Check
router.post('/check-allocation', checkAllocation);

// 5. Dispense Validation
router.post('/validate-dispense', validateDispense);
router.post('/dispense', validateDispense);

// 6. Complete Transaction
router.post('/complete', completeDispense);

// 7. Machine & Backend Status
router.get('/status', getMachineStatus);

module.exports = router;
