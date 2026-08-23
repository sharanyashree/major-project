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

  return { riceDispensed, oilDispensed };
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
    const { rfidUid } = req.body;

    if (!rfidUid) {
      return res.status(400).json({
        success: false,
        message: 'Please provide rfidUid',
      });
    }

    // 1. Find beneficiary by RFID UID
    const beneficiary = await Beneficiary.findOne({ rfidUid: rfidUid.trim() })
      .select('-password')
      .populate('assignedDistributor', 'name distributorId fpsCode district taluk status');

    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'No beneficiary found associated with this RFID UID',
      });
    }

    // 2. Check beneficiary account status
    if (beneficiary.status !== 'Active') {
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
      return res.status(200).json({
        success: true,
        message: `Beneficiary found, but no allocation issued for ${month} ${year}`,
        data: {
          beneficiary: {
            _id: beneficiary._id,
            fullName: beneficiary.fullName,
            rationCardNumber: beneficiary.rationCardNumber,
            mobileNumber: beneficiary.mobileNumber,
            assignedDistributor: beneficiary.assignedDistributor,
            status: beneficiary.status,
            rfidUid: beneficiary.rfidUid,
          },
          riceAllocated: 0,
          oilAllocated: 0,
          availableRice: 0,
          availableOil: 0,
          collectionStatus: 'No Allocation',
        },
      });
    }

    // 4. Calculate remaining stock for current month
    const { riceDispensed, oilDispensed } = await getBeneficiaryMonthlyDispensed(beneficiary._id, month, year);

    const availableRice = Math.max(0, allocation.riceAllocated - riceDispensed);
    const availableOil = Math.max(0, allocation.oilAllocated - oilDispensed);

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
    const { beneficiaryId } = req.body;

    if (!beneficiaryId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide beneficiaryId',
      });
    }

    const beneficiary = await Beneficiary.findById(beneficiaryId);
    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found',
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
      otp: generatedOtp, // Included for software testing as required
      expiryTime,
      beneficiaryId: beneficiary._id,
      mobileNumber: beneficiary.mobileNumber,
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
    const { beneficiaryId, otp } = req.body;

    if (!beneficiaryId || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both beneficiaryId and otp',
      });
    }

    // Find latest active OTP for beneficiary & purpose Collection
    const otpRecord = await OTP.findOne({
      beneficiary: beneficiaryId,
      otpPurpose: 'Collection',
      otp: otp.toString().trim(),
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
      beneficiaryId,
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
    const { beneficiaryId } = req.body;

    if (!beneficiaryId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide beneficiaryId',
      });
    }

    const beneficiary = await Beneficiary.findById(beneficiaryId);
    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found',
      });
    }

    const { month, year } = getCurrentMonthAndYear();
    const allocation = await Allocation.findOne({
      beneficiary: beneficiaryId,
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

    const { riceDispensed, oilDispensed } = await getBeneficiaryMonthlyDispensed(beneficiaryId, month, year);

    const riceRemaining = Math.max(0, allocation.riceAllocated - riceDispensed);
    const oilRemaining = Math.max(0, allocation.oilAllocated - oilDispensed);

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
    const { beneficiaryId, riceQuantity, oilQuantity, machineId } = req.body;

    const reqRice = Number(riceQuantity || 0);
    const reqOil = Number(oilQuantity || 0);

    if (!beneficiaryId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide beneficiaryId',
        valid: false,
      });
    }

    if (reqRice < 0 || reqOil < 0 || (reqRice === 0 && reqOil === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid positive quantities for rice or oil',
        valid: false,
      });
    }

    const beneficiary = await Beneficiary.findById(beneficiaryId);
    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found',
        valid: false,
      });
    }

    const { month, year } = getCurrentMonthAndYear();
    const allocation = await Allocation.findOne({
      beneficiary: beneficiaryId,
      month,
      year,
    });

    if (!allocation) {
      return res.status(400).json({
        success: false,
        message: `No active allocation found for ${month} ${year}`,
        valid: false,
      });
    }

    const { riceDispensed, oilDispensed } = await getBeneficiaryMonthlyDispensed(beneficiaryId, month, year);

    const riceRemaining = Math.max(0, allocation.riceAllocated - riceDispensed);
    const oilRemaining = Math.max(0, allocation.oilAllocated - oilDispensed);

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

    return res.status(200).json({
      success: true,
      message: 'Dispense validation successful. Machine authorized to dispense.',
      valid: true,
      data: {
        beneficiaryId,
        riceQuantity: reqRice,
        oilQuantity: reqOil,
        machineId: machineId || 'SRM-CENTER-001',
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
    const { beneficiaryId, riceQuantity, oilQuantity, machineId, distributorId } = req.body;

    const reqRice = Number(riceQuantity || 0);
    const reqOil = Number(oilQuantity || 0);

    if (!beneficiaryId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide beneficiaryId',
      });
    }

    const beneficiary = await Beneficiary.findById(beneficiaryId);
    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found',
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

    // 1. Create Transaction record
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const transaction = await Transaction.create({
      beneficiary: beneficiary._id,
      distributor: activeDistributorId,
      riceDispensed: reqRice,
      oilDispensed: reqOil,
      rfidUid: beneficiary.rfidUid,
      machineId: machineId || 'SRM-CENTER-001',
      otpVerified: true,
      date: now,
      time: timeStr,
      status: 'Successful',
    });

    // 2. Update Allocation Status
    let allocation = await Allocation.findOne({
      beneficiary: beneficiary._id,
      month,
      year,
    });

    if (allocation) {
      const { riceDispensed, oilDispensed } = await getBeneficiaryMonthlyDispensed(beneficiary._id, month, year);

      if (riceDispensed >= allocation.riceAllocated && oilDispensed >= allocation.oilAllocated) {
        allocation.collectionStatus = 'Collected';
      } else {
        allocation.collectionStatus = 'Partially Collected';
      }
      await allocation.save();
    }

    // 3. Reduce Distributor Inventory
    let inventory = await Inventory.findOne({ distributor: activeDistributorId });
    if (inventory) {
      inventory.riceStock = Math.max(0, inventory.riceStock - reqRice);
      inventory.oilStock = Math.max(0, inventory.oilStock - reqOil);
      inventory.lastUpdated = now;
      await inventory.save();
    }

    // 4. Create Notifications for Beneficiary and Distributor
    await Notification.create({
      receiverId: beneficiary._id,
      receiverRole: 'Beneficiary',
      title: 'Ration Collected',
      message: `Ration successfully collected: ${reqRice} kg Rice and ${reqOil} L Oil dispensed from Machine ${machineId || 'SRM-CENTER-001'}.`,
    });

    await Notification.create({
      receiverId: activeDistributorId,
      receiverRole: 'Distributor',
      title: 'Ration Dispensed',
      message: `${reqRice} kg Rice & ${reqOil} L Oil dispensed at Machine ${machineId || 'SRM-CENTER-001'} for beneficiary ${beneficiary.fullName}.`,
    });

    return res.status(200).json({
      success: true,
      message: 'Dispense transaction completed and recorded successfully',
      data: {
        transaction,
        updatedAllocationStatus: allocation ? allocation.collectionStatus : null,
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
