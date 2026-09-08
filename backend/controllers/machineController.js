const Beneficiary = require('../models/Beneficiary');
const Distributor = require('../models/Distributor');
const Allocation = require('../models/Allocation');
const Inventory = require('../models/Inventory');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const OTP = require('../models/OTP');

/**
 * Reusable Helper: Get current month name and year
 */
const getCurrentMonthAndYear = () => {
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'long' });
  const year = now.getFullYear();
  return { month, year };
};

/**
 * Reusable Helper: Get total rice and oil dispensed to a beneficiary in the current month
 */
const getBeneficiaryMonthlyDispensed = async (beneficiaryId, month, year) => {
  const startDate = new Date(year, new Date(`${month} 1, ${year}`).getMonth(), 1);
  const endDate = new Date(year, new Date(`${month} 1, ${year}`).getMonth() + 1, 0, 23, 59, 59, 999);

  const transactions = await Transaction.find({
    beneficiary: beneficiaryId,
    status: 'Successful',
    date: { $gte: startDate, $lte: endDate },
  });

  const riceDispensed = transactions.reduce((acc, t) => acc + (t.riceDispensed || 0), 0);
  const oilDispensed = transactions.reduce((acc, t) => acc + (t.oilDispensed || 0), 0);

  return {
    riceDispensed: Math.round(riceDispensed * 1000) / 1000,
    oilDispensed: Math.round(oilDispensed * 1000) / 1000,
  };
};

// ==========================================
// 1. RFID SCAN & BENEFICIARY CHECK
// ==========================================

/**
 * @desc    Scan RFID UID and fetch beneficiary & allocation status
 * @route   POST /api/machine/rfid
 * @access  Public / Machine
 */
const checkRfid = async (req, res) => {
  try {
    const rawRfid = req.body.rfidUid || req.body.rfidTag || req.body.rfid || req.body.uid;

    if (!rawRfid) {
      return res.status(400).json({
        success: false,
        message: 'Please provide rfidUid',
      });
    }

    const rfidUid = String(rawRfid).trim();

    // 1. Find beneficiary by RFID UID
    const beneficiary = await Beneficiary.findOne({ rfidUid })
      .select('-password')
      .populate('assignedDistributor', 'name distributorId fpsCode district taluk status');

    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'No beneficiary found associated with this RFID UID',
      });
    }

    // 2. Check beneficiary account status
    if (beneficiary.status !== 'Active' && beneficiary.status !== 'Approved') {
      return res.status(403).json({
        success: false,
        message: `Beneficiary account is currently ${beneficiary.status}. Ration collection is disallowed.`,
        beneficiaryStatus: beneficiary.status,
      });
    }

    // 3. Check current month allocation
    const { month, year } = getCurrentMonthAndYear();
    const allocation = await Allocation.findOne({
      beneficiary: beneficiary._id,
      month,
      year,
    });

    if (!allocation) {
      const benRice = beneficiary.riceQuota != null ? beneficiary.riceQuota : 0;
      const benOil = beneficiary.oilQuota != null ? beneficiary.oilQuota : 0;
      return res.status(200).json({
        success: true,
        message: `Beneficiary identified, but no allocation issued for ${month} ${year}`,
        data: {
          beneficiary: {
            _id: beneficiary._id,
            fullName: beneficiary.fullName,
            rationCardNumber: beneficiary.rationCardNumber,
            riceQuota: benRice,
            oilQuota: benOil,
            mobileNumber: beneficiary.mobileNumber,
            assignedDistributor: beneficiary.assignedDistributor,
            status: beneficiary.status,
            rfidUid: beneficiary.rfidUid,
          },
          riceAllocated: 0,
          oilAllocated: 0,
          availableRice: 0,
          availableOil: 0,
          hasAllocatedQuota: false,
          collectionStatus: 'No Allocation',
        },
      });
    }

    // 4. Calculate remaining stock for current month
    const { riceDispensed, oilDispensed } = await getBeneficiaryMonthlyDispensed(beneficiary._id, month, year);

    const availableRice = Math.max(0, Math.round((allocation.riceAllocated - riceDispensed) * 1000) / 1000);
    const availableOil = Math.max(0, Math.round((allocation.oilAllocated - oilDispensed) * 1000) / 1000);

    let collectionStatus = allocation.collectionStatus;
    if (availableRice <= 0 && availableOil <= 0) {
      collectionStatus = 'Collected';
    } else if (riceDispensed > 0 || oilDispensed > 0) {
      collectionStatus = 'Partially Collected';
    }

    return res.status(200).json({
      success: true,
      message: 'Beneficiary authenticated successfully via RFID',
      data: {
        beneficiary: {
          _id: beneficiary._id,
          fullName: beneficiary.fullName,
          rationCardNumber: beneficiary.rationCardNumber,
          riceQuota: allocation.riceAllocated,
          oilQuota: allocation.oilAllocated,
          mobileNumber: beneficiary.mobileNumber,
          assignedDistributor: beneficiary.assignedDistributor,
          status: beneficiary.status,
          rfidUid: beneficiary.rfidUid,
        },
        allocation: {
          month: allocation.month,
          year: allocation.year,
          riceAllocated: allocation.riceAllocated,
          oilAllocated: allocation.oilAllocated,
        },
        availableRice,
        availableOil,
        hasAllocatedQuota: availableRice > 0 || availableOil > 0,
        collectionStatus,
      },
    });
  } catch (error) {
    console.error('Error checking RFID UID:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to authenticate RFID UID',
      error: error.message,
    });
  }
};

// ==========================================
// 2. GENERATE OTP
// ==========================================

/**
 * @desc    Generate OTP for beneficiary ration collection
 * @route   POST /api/machine/generate-otp
 * @access  Public / Machine
 */
const generateOtp = async (req, res) => {
  try {
    const rawId = req.body.beneficiaryId || req.body.id || req.body.userId;
    const rawRfid = req.body.rfidUid || req.body.rfidTag || req.body.rfid;

    let beneficiary = null;
    if (rawId) {
      beneficiary = await Beneficiary.findById(rawId);
    } else if (rawRfid) {
      beneficiary = await Beneficiary.findOne({ rfidUid: String(rawRfid).trim() });
    }

    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found. Please provide valid beneficiaryId or rfidUid',
      });
    }

    // Check beneficiary status
    if (beneficiary.status !== 'Active' && beneficiary.status !== 'Approved') {
      return res.status(403).json({
        success: false,
        message: `Beneficiary account is currently ${beneficiary.status}. OTP generation disallowed.`,
      });
    }

    // Check if beneficiary has zero unallocated quota
    const { month, year } = getCurrentMonthAndYear();
    const allocation = await Allocation.findOne({ beneficiary: beneficiary._id, month, year });
    const hasAllocQuota = allocation && (allocation.riceAllocated > 0 || allocation.oilAllocated > 0);
    const hasDocQuota = (beneficiary.riceQuota > 0 || beneficiary.oilQuota > 0);

    if (!hasAllocQuota && !hasDocQuota) {
      return res.status(400).json({
        success: false,
        message: 'No ration quota allocated for this beneficiary. OTP generation disallowed.',
      });
    }

    // Generate 6-digit OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    // Save OTP record
    const otpRecord = await OTP.create({
      beneficiary: beneficiary._id,
      mobileNumber: beneficiary.mobileNumber,
      otp: generatedOtp,
      expiryTime,
      verified: false,
      otpPurpose: 'Collection',
    });

    return res.status(201).json({
      success: true,
      message: `OTP generated successfully for ${beneficiary.fullName}. Valid for 5 minutes.`,
      otp: generatedOtp, // Included for testing and direct access
      expiryTime,
      beneficiaryId: beneficiary._id,
      mobileNumber: beneficiary.mobileNumber,
      data: {
        otp: generatedOtp,
        expiryTime,
        beneficiaryId: beneficiary._id,
        mobileNumber: beneficiary.mobileNumber,
      },
    });
  } catch (error) {
    console.error('Error generating OTP:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate OTP',
      error: error.message,
    });
  }
};

// ==========================================
// 3. VERIFY OTP
// ==========================================

/**
 * @desc    Verify OTP entered at Smart Ration Machine
 * @route   POST /api/machine/verify-otp
 * @access  Public / Machine
 */
const verifyOtp = async (req, res) => {
  try {
    const rawId = req.body.beneficiaryId || req.body.id || req.body.userId;
    const rawRfid = req.body.rfidUid || req.body.rfidTag;
    const rawOtp = req.body.otp || req.body.otpCode || req.body.code;

    if ((!rawId && !rawRfid) || !rawOtp) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both beneficiaryId (or rfidUid) and otp',
      });
    }

    let targetBeneficiaryId = rawId;
    if (!targetBeneficiaryId && rawRfid) {
      const b = await Beneficiary.findOne({ rfidUid: String(rawRfid).trim() });
      if (b) targetBeneficiaryId = b._id;
    }

    if (!targetBeneficiaryId) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found',
      });
    }

    // Find latest active OTP for beneficiary & purpose Collection
    const otpRecord = await OTP.findOne({
      beneficiary: targetBeneficiaryId,
      otpPurpose: 'Collection',
      otp: String(rawOtp).trim(),
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP provided',
      });
    }

    // Check expiry
    if (new Date() > new Date(otpRecord.expiryTime)) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new OTP.',
      });
    }

    // Mark OTP as verified
    otpRecord.verified = true;
    await otpRecord.save();

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      beneficiaryId: targetBeneficiaryId,
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify OTP',
      error: error.message,
    });
  }
};

// ==========================================
// 4. CHECK ALLOCATION
// ==========================================

/**
 * @desc    Check detailed monthly allocation & remaining quota for beneficiary
 * @route   POST /api/machine/check-allocation
 * @access  Public / Machine
 */
const checkAllocation = async (req, res) => {
  try {
    const rawId = req.body.beneficiaryId || req.body.id || req.body.userId;
    const rawRfid = req.body.rfidUid || req.body.rfidTag;

    let targetBeneficiaryId = rawId;
    if (!targetBeneficiaryId && rawRfid) {
      const b = await Beneficiary.findOne({ rfidUid: String(rawRfid).trim() });
      if (b) targetBeneficiaryId = b._id;
    }

    if (!targetBeneficiaryId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide beneficiaryId or rfidUid',
      });
    }

    const beneficiary = await Beneficiary.findById(targetBeneficiaryId);
    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found',
      });
    }

    const { month, year } = getCurrentMonthAndYear();
    const allocation = await Allocation.findOne({
      beneficiary: targetBeneficiaryId,
      month,
      year,
    });

    if (!allocation) {
      return res.status(200).json({
        success: true,
        message: `No allocation found for ${month} ${year}`,
        data: {
          riceAllocated: 0,
          oilAllocated: 0,
          riceRemaining: 0,
          oilRemaining: 0,
          collectionStatus: 'No Allocation',
        },
      });
    }

    const { riceDispensed, oilDispensed } = await getBeneficiaryMonthlyDispensed(targetBeneficiaryId, month, year);

    const riceRemaining = Math.max(0, Math.round((allocation.riceAllocated - riceDispensed) * 1000) / 1000);
    const oilRemaining = Math.max(0, Math.round((allocation.oilAllocated - oilDispensed) * 1000) / 1000);

    let collectionStatus = allocation.collectionStatus;
    if (riceRemaining <= 0 && oilRemaining <= 0) {
      collectionStatus = 'Collected';
    } else if (riceDispensed > 0 || oilDispensed > 0) {
      collectionStatus = 'Partially Collected';
    }

    return res.status(200).json({
      success: true,
      data: {
        riceAllocated: allocation.riceAllocated,
        oilAllocated: allocation.oilAllocated,
        riceRemaining,
        oilRemaining,
        collectionStatus,
      },
    });
  } catch (error) {
    console.error('Error checking allocation:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check allocation',
      error: error.message,
    });
  }
};

// ==========================================
// 5. DISPENSE VALIDATION
// ==========================================

/**
 * @desc    Validate dispense request before physical release
 * @route   POST /api/machine/dispense
 * @access  Public / Machine
 */
const validateDispense = async (req, res) => {
  try {
    const rawId = req.body.beneficiaryId || req.body.id || req.body.userId;
    const rawRfid = req.body.rfidUid || req.body.rfidTag || req.body.rfid;
    const rawRice = req.body.riceQuantity !== undefined ? req.body.riceQuantity : (req.body.rice !== undefined ? req.body.rice : req.body.requestedRice);
    const rawOil = req.body.oilQuantity !== undefined ? req.body.oilQuantity : (req.body.oil !== undefined ? req.body.oil : req.body.requestedOil);
    const machineId = req.body.machineId || 'SRM-CENTER-001';
    const distributorId = req.body.distributorId;

    if (!rawId && !rawRfid) {
      return res.status(400).json({
        success: false,
        message: 'Please provide beneficiaryId or rfidUid',
        valid: false,
      });
    }

    let beneficiary = null;
    if (rawId) {
      beneficiary = await Beneficiary.findById(rawId);
    } else if (rawRfid) {
      beneficiary = await Beneficiary.findOne({ rfidUid: String(rawRfid).trim() });
    }

    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found',
        valid: false,
      });
    }

    // Verify RFID UID if provided
    if (rawRfid) {
      const cleanRfid = String(rawRfid).trim();
      if (!beneficiary.rfidUid || beneficiary.rfidUid.toUpperCase() !== cleanRfid.toUpperCase()) {
        return res.status(400).json({
          success: false,
          message: 'RFID UID does not match beneficiary record',
          valid: false,
        });
      }
    }

    // Check beneficiary status
    if (beneficiary.status !== 'Active' && beneficiary.status !== 'Approved') {
      return res.status(403).json({
        success: false,
        message: `Beneficiary account is currently ${beneficiary.status}. Ration collection is disallowed.`,
        beneficiaryStatus: beneficiary.status,
        valid: false,
      });
    }

    if (rawRice === undefined && rawOil === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide riceQuantity or oilQuantity',
        valid: false,
      });
    }

    const reqRice = Number(rawRice !== undefined ? rawRice : 0);
    const reqOil = Number(rawOil !== undefined ? rawOil : 0);

    if (isNaN(reqRice) || isNaN(reqOil) || !isFinite(reqRice) || !isFinite(reqOil)) {
      return res.status(400).json({
        success: false,
        message: 'Requested quantities must be valid finite numbers',
        valid: false,
      });
    }

    if (reqRice < 0 || reqOil < 0 || (reqRice === 0 && reqOil === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid positive quantities for rice or oil (must be greater than 0)',
        valid: false,
      });
    }

    const { month, year } = getCurrentMonthAndYear();
    const allocation = await Allocation.findOne({
      beneficiary: beneficiary._id,
      month,
      year,
    });

    if (!allocation) {
      return res.status(400).json({
        success: false,
        message: `No active ration allocation found for ${month} ${year}. Beneficiary has 0 unallocated quota.`,
        valid: false,
      });
    }

    const { riceDispensed, oilDispensed } = await getBeneficiaryMonthlyDispensed(beneficiary._id, month, year);

    const riceRemaining = Math.max(0, Math.round((allocation.riceAllocated - riceDispensed) * 1000) / 1000);
    const oilRemaining = Math.max(0, Math.round((allocation.oilAllocated - oilDispensed) * 1000) / 1000);

    if (reqRice > allocation.riceAllocated || reqRice > riceRemaining) {
      return res.status(400).json({
        success: false,
        message: `Requested rice quantity (${reqRice} kg) exceeds available monthly quota (${riceRemaining} kg remaining of ${allocation.riceAllocated} kg allocated)`,
        valid: false,
        riceAllocated: allocation.riceAllocated,
        riceRemaining,
      });
    }

    if (reqOil > allocation.oilAllocated || reqOil > oilRemaining) {
      return res.status(400).json({
        success: false,
        message: `Requested oil quantity (${reqOil} L) exceeds available monthly quota (${oilRemaining} L remaining of ${allocation.oilAllocated} L allocated)`,
        valid: false,
        oilAllocated: allocation.oilAllocated,
        oilRemaining,
      });
    }

    // Check machine/distributor inventory if distributor is specified or assigned
    const activeDistributorId = distributorId || beneficiary.assignedDistributor;
    if (activeDistributorId) {
      const inventory = await Inventory.findOne({
        $or: [{ distributor: activeDistributorId }, { distributorId: activeDistributorId }],
      });
      if (inventory) {
        if (reqRice > inventory.riceStock) {
          return res.status(400).json({
            success: false,
            message: `Requested rice quantity (${reqRice} kg) exceeds available distributor stock (${inventory.riceStock} kg)`,
            valid: false,
          });
        }
        if (reqOil > inventory.oilStock) {
          return res.status(400).json({
            success: false,
            message: `Requested oil quantity (${reqOil} L) exceeds available distributor stock (${inventory.oilStock} L)`,
            valid: false,
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Dispense validation successful. Machine authorized to dispense.',
      valid: true,
      data: {
        beneficiaryId: beneficiary._id,
        riceQuantity: reqRice,
        oilQuantity: reqOil,
        riceRemaining,
        oilRemaining,
        machineId,
      },
    });
  } catch (error) {
    console.error('Error validating dispense:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate dispense request',
      error: error.message,
    });
  }
};

// ==========================================
// 6. COMPLETE DISPENSE & UPDATE SYSTEM
// ==========================================

/**
 * @desc    Record completion of dispense transaction and update inventories, allocations, and dashboards
 * @route   POST /api/machine/complete
 * @access  Public / Machine
 */
const completeDispense = async (req, res) => {
  try {
    const rawId = req.body.beneficiaryId || req.body.id || req.body.userId;
    const rawRfid = req.body.rfidUid || req.body.rfidTag || req.body.rfid;
    const rawRice = req.body.riceQuantity !== undefined ? req.body.riceQuantity : (req.body.rice !== undefined ? req.body.rice : req.body.dispensedRice);
    const rawOil = req.body.oilQuantity !== undefined ? req.body.oilQuantity : (req.body.oil !== undefined ? req.body.oil : req.body.dispensedOil);
    const machineId = req.body.machineId || 'SRM-CENTER-001';
    const distributorId = req.body.distributorId;
    const requestId = req.body.requestId || req.headers['x-request-id'] || req.headers['idempotency-key'] || req.body.idempotencyKey;

    if (!rawId && !rawRfid) {
      return res.status(400).json({
        success: false,
        message: 'Please provide beneficiaryId or rfidUid',
      });
    }

    // Check duplicate request ID / idempotency
    if (requestId) {
      const existingTx = await Transaction.findOne({ requestId: String(requestId).trim() });
      if (existingTx) {
        return res.status(200).json({
          success: true,
          duplicateHandled: true,
          message: 'Transaction already completed (idempotent request)',
          data: {
            transaction: existingTx,
          },
        });
      }
    }

    let beneficiary = null;
    if (rawId) {
      beneficiary = await Beneficiary.findById(rawId);
    } else if (rawRfid) {
      beneficiary = await Beneficiary.findOne({ rfidUid: String(rawRfid).trim() });
    }

    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found',
      });
    }

    // Verify RFID UID if provided
    if (rawRfid) {
      const cleanRfid = String(rawRfid).trim();
      if (!beneficiary.rfidUid || beneficiary.rfidUid.toUpperCase() !== cleanRfid.toUpperCase()) {
        return res.status(400).json({
          success: false,
          message: 'RFID UID does not match beneficiary record',
        });
      }
    }

    // Check beneficiary status
    if (beneficiary.status !== 'Active' && beneficiary.status !== 'Approved') {
      return res.status(403).json({
        success: false,
        message: `Beneficiary account is currently ${beneficiary.status}. Ration collection is disallowed.`,
        beneficiaryStatus: beneficiary.status,
      });
    }

    const reqRice = Number(rawRice !== undefined ? rawRice : 0);
    const reqOil = Number(rawOil !== undefined ? rawOil : 0);

    if (isNaN(reqRice) || isNaN(reqOil) || !isFinite(reqRice) || !isFinite(reqOil)) {
      return res.status(400).json({
        success: false,
        message: 'Requested quantities must be valid finite numbers',
      });
    }

    if (reqRice < 0 || reqOil < 0 || (reqRice === 0 && reqOil === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid positive quantities for rice or oil (greater than 0)',
      });
    }

    // Determine target distributor ID
    const activeDistributorId = distributorId || beneficiary.assignedDistributor;
    if (!activeDistributorId) {
      return res.status(400).json({
        success: false,
        message: 'No distributor assigned to this beneficiary or provided in payload',
      });
    }

    const { month, year } = getCurrentMonthAndYear();

    // Check monthly allocation and remaining quota
    const allocation = await Allocation.findOne({
      beneficiary: beneficiary._id,
      month,
      year,
    });

    if (!allocation) {
      return res.status(400).json({
        success: false,
        message: `No active ration allocation found for ${month} ${year}. Beneficiary has 0 unallocated quota.`,
      });
    }

    const { riceDispensed, oilDispensed } = await getBeneficiaryMonthlyDispensed(beneficiary._id, month, year);

    const riceRemaining = Math.max(0, Math.round((allocation.riceAllocated - riceDispensed) * 1000) / 1000);
    const oilRemaining = Math.max(0, Math.round((allocation.oilAllocated - oilDispensed) * 1000) / 1000);

    // Duplicate replay check: if quota has already been consumed and an identical transaction was made within 10 seconds
    const tenSecondsAgo = new Date(Date.now() - 10 * 1000);
    const recentDuplicate = await Transaction.findOne({
      beneficiary: beneficiary._id,
      machineId,
      riceDispensed: reqRice,
      oilDispensed: reqOil,
      status: 'Successful',
      createdAt: { $gte: tenSecondsAgo },
    });
    if (recentDuplicate && (reqRice > riceRemaining || reqOil > oilRemaining)) {
      return res.status(200).json({
        success: true,
        message: 'Transaction already completed (duplicate request filtered)',
        data: {
          transaction: recentDuplicate,
        },
      });
    }

    if (reqRice > allocation.riceAllocated || reqRice > riceRemaining) {
      return res.status(400).json({
        success: false,
        message: `Requested rice quantity (${reqRice} kg) exceeds available monthly quota (${riceRemaining} kg remaining of ${allocation.riceAllocated} kg allocated)`,
        riceAllocated: allocation.riceAllocated,
        riceRemaining,
      });
    }

    if (reqOil > allocation.oilAllocated || reqOil > oilRemaining) {
      return res.status(400).json({
        success: false,
        message: `Requested oil quantity (${reqOil} L) exceeds available monthly quota (${oilRemaining} L remaining of ${allocation.oilAllocated} L allocated)`,
        oilAllocated: allocation.oilAllocated,
        oilRemaining,
      });
    }

    // Check distributor inventory
    let inventory = await Inventory.findOne({
      $or: [{ distributor: activeDistributorId }, { distributorId: activeDistributorId }],
    });

    if (inventory) {
      if (reqRice > inventory.riceStock) {
        return res.status(400).json({
          success: false,
          message: `Requested rice quantity (${reqRice} kg) exceeds available distributor stock (${inventory.riceStock} kg)`,
        });
      }
      if (reqOil > inventory.oilStock) {
        return res.status(400).json({
          success: false,
          message: `Requested oil quantity (${reqOil} L) exceeds available distributor stock (${inventory.oilStock} L)`,
        });
      }
    }

    // 1. Create Transaction record
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const transaction = await Transaction.create({
      beneficiary: beneficiary._id,
      distributor: activeDistributorId,
      riceDispensed: reqRice,
      oilDispensed: reqOil,
      rfidUid: beneficiary.rfidUid,
      machineId,
      otpVerified: true,
      date: now,
      time: timeStr,
      status: 'Successful',
      ...(requestId ? { requestId: String(requestId).trim() } : {}),
    });

    // 2. Update Allocation Status
    const totalRiceDispensed = Math.round((riceDispensed + reqRice) * 1000) / 1000;
    const totalOilDispensed = Math.round((oilDispensed + reqOil) * 1000) / 1000;

    if (totalRiceDispensed >= allocation.riceAllocated && totalOilDispensed >= allocation.oilAllocated) {
      allocation.collectionStatus = 'Collected';
    } else {
      allocation.collectionStatus = 'Partially Collected';
    }
    await allocation.save();

    // 3. Reduce Distributor Inventory
    if (inventory) {
      inventory.riceStock = Math.max(0, Math.round((inventory.riceStock - reqRice) * 1000) / 1000);
      inventory.oilStock = Math.max(0, Math.round((inventory.oilStock - reqOil) * 1000) / 1000);
      inventory.lastUpdated = now;
      await inventory.save();
    }

    // 4. Create Notifications for Beneficiary and Distributor
    await Notification.create({
      receiverId: beneficiary._id,
      receiverRole: 'Beneficiary',
      title: 'Ration Collected',
      message: `Ration successfully collected: ${reqRice} kg Rice and ${reqOil} L Oil dispensed from Machine ${machineId}.`,
    });

    await Notification.create({
      receiverId: activeDistributorId,
      receiverRole: 'Distributor',
      title: 'Ration Dispensed',
      message: `${reqRice} kg Rice & ${reqOil} L Oil dispensed at Machine ${machineId} for beneficiary ${beneficiary.fullName}.`,
    });

    return res.status(200).json({
      success: true,
      message: 'Dispense transaction completed and recorded successfully',
      data: {
        transaction,
        updatedAllocationStatus: allocation ? allocation.collectionStatus : null,
        remainingBeneficiaryQuota: {
          riceRemaining: Math.max(0, Math.round((allocation.riceAllocated - totalRiceDispensed) * 1000) / 1000),
          oilRemaining: Math.max(0, Math.round((allocation.oilAllocated - totalOilDispensed) * 1000) / 1000),
        },
        remainingDistributorInventory: inventory
          ? { riceStock: inventory.riceStock, oilStock: inventory.oilStock }
          : null,
      },
    });
  } catch (error) {
    console.error('Error completing dispense transaction:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete dispense transaction',
      error: error.message,
    });
  }
};

// ==========================================
// 7. MACHINE STATUS
// ==========================================

/**
 * @desc    Get status of Smart Ration Machine and Backend
 * @route   GET /api/machine/status
 * @access  Public / Machine
 */
const getMachineStatus = async (req, res) => {
  try {
    const machineId = req.query.machineId || req.headers['x-machine-id'] || 'SRM-CENTER-001';

    return res.status(200).json({
      success: true,
      machineId,
      machineStatus: 'Online',
      backendStatus: 'Operational',
      currentTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching machine status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch machine status',
      error: error.message,
    });
  }
};

module.exports = {
  checkRfid,
  generateOtp,
  verifyOtp,
  checkAllocation,
  validateDispense,
  completeDispense,
  getMachineStatus,
};
