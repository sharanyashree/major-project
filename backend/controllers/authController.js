const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Distributor = require('../models/Distributor');
const Beneficiary = require('../models/Beneficiary');

const JWT_SECRET = process.env.JWT_SECRET || 'ration_distribution_jwt_secret_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT Token helper
 */
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

/**
 * @desc    Admin Login
 * @route   POST /api/auth/admin/login
 * @access  Public
 */
const adminLogin = async (req, res) => {
  try {
    const rawAdminId = req.body.adminId || req.body.username || req.body.email || req.body.id;
    const { password } = req.body;

    if (!rawAdminId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both Admin ID and password',
      });
    }

    const trimmedAdminId = String(rawAdminId).trim().toUpperCase();

    // Find admin by adminId (case-insensitive search / uppercase format)
    const admin = await Admin.findOne({
      adminId: trimmedAdminId,
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Admin ID or password',
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Admin ID or password',
      });
    }

    // Generate JWT Token
    const token = generateToken({
      id: admin._id,
      adminId: admin.adminId,
      role: 'Admin',
      subRole: admin.role,
    });

    return res.status(200).json({
      success: true,
      message: 'Admin authentication successful',
      token,
      data: {
        _id: admin._id,
        adminId: admin.adminId,
        name: admin.name,
        role: admin.role,
        createdAt: admin.createdAt,
      },
    });
  } catch (error) {
    console.error('Error in Admin Login:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during authentication',
      error: error.message,
    });
  }
};

/**
 * @desc    Distributor Login
 * @route   POST /api/auth/distributor/login
 * @access  Public
 */
const distributorLogin = async (req, res) => {
  try {
    const rawDistributorId =
      req.body.distributorId ||
      req.body.distributor_id ||
      req.body.identifier ||
      req.body.username ||
      req.body.mobileNumber ||
      req.body.mobile ||
      req.body.phone ||
      req.body.fpsCode ||
      req.body.fps_code;
    const { password } = req.body;

    if (!rawDistributorId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both Distributor ID and password',
      });
    }

    const trimmedId = String(rawDistributorId).trim();
    const formattedDistributorId = trimmedId.toUpperCase();

    // Find distributor by distributorId, mobileNumber, or fpsCode
    const distributor = await Distributor.findOne({
      $or: [
        { distributorId: formattedDistributorId },
        { mobileNumber: trimmedId },
        { fpsCode: trimmedId },
      ],
    });

    if (!distributor) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Distributor ID or password',
      });
    }

    // Check account status
    if (distributor.status !== 'Active') {
      return res.status(403).json({
        success: false,
        message: `Account is currently ${distributor.status}. Please contact the Admin.`,
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, distributor.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Distributor ID or password',
      });
    }

    // Generate JWT Token
    const token = generateToken({
      id: distributor._id,
      distributorId: distributor.distributorId,
      role: 'Distributor',
    });

    return res.status(200).json({
      success: true,
      message: 'Distributor authentication successful',
      token,
      data: {
        _id: distributor._id,
        distributorId: distributor.distributorId,
        name: distributor.name,
        mobileNumber: distributor.mobileNumber,
        fpsCode: distributor.fpsCode,
        district: distributor.district,
        taluk: distributor.taluk,
        status: distributor.status,
        createdAt: distributor.createdAt,
      },
    });
  } catch (error) {
    console.error('Error in Distributor Login:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during authentication',
      error: error.message,
    });
  }
};

/**
 * @desc    Beneficiary Login
 * @route   POST /api/auth/beneficiary/login
 * @access  Public
 */
const beneficiaryLogin = async (req, res) => {
  try {
    const rawRationCard =
      req.body.identifier ||
      req.body.rationCardNumber ||
      req.body.rationCardNo ||
      req.body.cardNo ||
      req.body.username ||
      req.body.mobileNumber ||
      req.body.mobile ||
      req.body.phone ||
      req.body.rfidUid;
    const { password } = req.body;

    if (!rawRationCard || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both Ration Card Number and password',
      });
    }

    const trimmedIdentifier = String(rawRationCard).trim();

    // Find beneficiary by rationCardNumber, mobileNumber, or rfidUid
    const beneficiary = await Beneficiary.findOne({
      $or: [
        { rationCardNumber: trimmedIdentifier },
        { mobileNumber: trimmedIdentifier },
        { rfidUid: trimmedIdentifier },
      ],
    }).populate('assignedDistributor', 'name fpsCode district taluk');

    if (!beneficiary) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Ration Card Number or password',
      });
    }

    // Check account status
    if (beneficiary.status !== 'Active') {
      return res.status(403).json({
        success: false,
        message: `Account is currently ${beneficiary.status}. Please contact your distributor or admin.`,
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, beneficiary.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Ration Card Number or password',
      });
    }

    // Generate JWT Token
    const token = generateToken({
      id: beneficiary._id,
      rationCardNumber: beneficiary.rationCardNumber,
      role: 'Beneficiary',
    });

    return res.status(200).json({
      success: true,
      message: 'Beneficiary authentication successful',
      token,
      data: {
        _id: beneficiary._id,
        fullName: beneficiary.fullName,
        rationCardNumber: beneficiary.rationCardNumber,
        mobileNumber: beneficiary.mobileNumber,
        district: beneficiary.district,
        taluk: beneficiary.taluk,
        village: beneficiary.village,
        address: beneficiary.address,
        familyMemberCount: beneficiary.familyMemberCount,
        riceQuota: beneficiary.riceQuota !== undefined ? beneficiary.riceQuota : 0,
        oilQuota: beneficiary.oilQuota !== undefined ? beneficiary.oilQuota : 0,
        rfidUid: beneficiary.rfidUid,
        assignedDistributor: beneficiary.assignedDistributor,
        status: beneficiary.status,
        createdAt: beneficiary.createdAt,
      },
    });
  } catch (error) {
    console.error('Error in Beneficiary Login:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during authentication',
      error: error.message,
    });
  }
};

/**
 * @desc    Beneficiary Registration
 * @route   POST /api/auth/beneficiary/register
 * @access  Public
 */
const beneficiaryRegister = async (req, res) => {
  try {
    const rawFullName = req.body.fullName || req.body.name;
    const rawRationCardNumber = req.body.rationCardNumber || req.body.rationCardNo || req.body.cardNo;
    const rawMobileNumber = req.body.mobileNumber || req.body.phone || req.body.mobile;
    const { password, district, taluk, village, address } = req.body;
    const familyMemberCount = req.body.familyMemberCount || req.body.familyMembers || req.body.members || 1;
    const rfidUid = req.body.rfidUid || req.body.rfidTag || req.body.rfid;
    const assignedDistributor = req.body.assignedDistributor || req.body.distributorId || req.body.distributor;
    const riceQuota = Math.max(0, Number(req.body.riceQuota ?? req.body.riceAllowed ?? req.body.rice ?? 0) || 0);
    const oilQuota = Math.max(0, Number(req.body.oilQuota ?? req.body.oilAllowed ?? req.body.oil ?? 0) || 0);

    // Validate required fields
    if (
      !rawFullName ||
      !rawRationCardNumber ||
      !rawMobileNumber ||
      !password ||
      !district ||
      !taluk
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields (fullName, rationCardNumber, mobileNumber, password, district, taluk)',
      });
    }

    const trimmedRationCard = String(rawRationCardNumber).trim();

    // Check if duplicate Ration Card Number exists
    const existingBeneficiary = await Beneficiary.findOne({
      rationCardNumber: trimmedRationCard,
    });

    if (existingBeneficiary) {
      return res.status(400).json({
        success: false,
        message: 'Beneficiary with this Ration Card Number already exists',
      });
    }

    // Check if duplicate RFID UID exists (if provided)
    if (rfidUid && String(rfidUid).trim()) {
      const trimmedRfid = String(rfidUid).trim();
      const existingRfid = await Beneficiary.findOne({
        rfidUid: trimmedRfid,
      });
      if (existingRfid) {
        return res.status(400).json({
          success: false,
          message: 'RFID UID is already assigned to another beneficiary',
        });
      }
    }

    // Verify assigned distributor exists (if provided)
    let distributorToAssign = null;
    if (assignedDistributor) {
      let distributorExists = null;
      if (typeof assignedDistributor === 'string' && assignedDistributor.length === 24) {
        distributorExists = await Distributor.findById(assignedDistributor);
      }
      if (!distributorExists) {
        distributorExists = await Distributor.findOne({
          $or: [
            { distributorId: String(assignedDistributor).trim().toUpperCase() },
            { fpsCode: String(assignedDistributor).trim() },
          ],
        });
      }
      if (distributorExists) {
        distributorToAssign = distributorExists._id;
      }
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create beneficiary
    const beneficiary = await Beneficiary.create({
      fullName: String(rawFullName).trim(),
      rationCardNumber: trimmedRationCard,
      mobileNumber: String(rawMobileNumber).trim(),
      password: hashedPassword,
      district: String(district).trim(),
      taluk: String(taluk).trim(),
      village: village ? String(village).trim() : '',
      address: address ? String(address).trim() : '',
      familyMemberCount: Math.max(1, Number(familyMemberCount) || 1),
      rfidUid: rfidUid && String(rfidUid).trim() ? String(rfidUid).trim() : undefined,
      assignedDistributor: distributorToAssign,
      riceQuota: riceQuota,
      oilQuota: oilQuota,
      status: 'Pending',
    });

    return res.status(201).json({
      success: true,
      message: 'Beneficiary registered successfully',
      data: {
        _id: beneficiary._id,
        fullName: beneficiary.fullName,
        rationCardNumber: beneficiary.rationCardNumber,
        mobileNumber: beneficiary.mobileNumber,
        district: beneficiary.district,
        taluk: beneficiary.taluk,
        village: beneficiary.village,
        address: beneficiary.address,
        familyMemberCount: beneficiary.familyMemberCount,
        rfidUid: beneficiary.rfidUid,
        assignedDistributor: beneficiary.assignedDistributor,
        riceQuota: beneficiary.riceQuota,
        oilQuota: beneficiary.oilQuota,
        status: beneficiary.status,
        createdAt: beneficiary.createdAt,
      },
    });
  } catch (error) {
    console.error('Error in Beneficiary Registration:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during beneficiary registration',
      error: error.message,
    });
  }
};

/**
 * @desc    Distributor Registration
 * @route   POST /api/auth/distributor/register
 * @access  Public
 */
const distributorRegister = async (req, res) => {
  try {
    const rawName = req.body.name || req.body.distributorName || req.body.ownerName;
    const rawMobileNumber = req.body.mobileNumber || req.body.phone || req.body.mobile;
    const { distributorId, password, fpsCode, district, taluk } = req.body;

    // Validate required fields
    if (
      !rawName ||
      !rawMobileNumber ||
      !distributorId ||
      !password ||
      !fpsCode ||
      !district ||
      !taluk
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields (name, mobileNumber, distributorId, password, fpsCode, district, taluk)',
      });
    }

    const formattedDistributorId = String(distributorId).trim().toUpperCase();
    const formattedFpsCode = String(fpsCode).trim();

    // Check duplicate Distributor ID
    const existingDistributorId = await Distributor.findOne({
      distributorId: formattedDistributorId,
    });

    if (existingDistributorId) {
      return res.status(400).json({
        success: false,
        message: 'Distributor ID is already registered',
      });
    }

    // Check duplicate FPS Code
    const existingFpsCode = await Distributor.findOne({
      fpsCode: formattedFpsCode,
    });

    if (existingFpsCode) {
      return res.status(400).json({
        success: false,
        message: 'FPS Code is already registered',
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create distributor with Status = 'Pending'
    const distributor = await Distributor.create({
      name: String(rawName).trim(),
      mobileNumber: String(rawMobileNumber).trim(),
      distributorId: formattedDistributorId,
      password: hashedPassword,
      fpsCode: formattedFpsCode,
      district: String(district).trim(),
      taluk: String(taluk).trim(),
      status: 'Pending',
    });

    return res.status(201).json({
      success: true,
      message: 'Distributor registered successfully. Account status is Pending admin approval.',
      data: {
        _id: distributor._id,
        name: distributor.name,
        mobileNumber: distributor.mobileNumber,
        distributorId: distributor.distributorId,
        fpsCode: distributor.fpsCode,
        district: distributor.district,
        taluk: distributor.taluk,
        status: distributor.status,
        createdAt: distributor.createdAt,
      },
    });
  } catch (error) {
    console.error('Error in Distributor Registration:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during distributor registration',
      error: error.message,
    });
  }
};

/**
 * @desc    Logout User / Invalidate session
 * @route   POST /api/auth/logout
 * @access  Public / Private
 */
const logout = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

module.exports = {
  adminLogin,
  distributorLogin,
  beneficiaryLogin,
  beneficiaryRegister,
  distributorRegister,
  logout,
};
