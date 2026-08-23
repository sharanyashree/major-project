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
    const { adminId, password } = req.body;

    if (!adminId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both Admin ID and password',
      });
    }

    // Find admin by adminId (case-insensitive search / uppercase format)
    const admin = await Admin.findOne({
      adminId: adminId.trim().toUpperCase(),
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
    const { distributorId, password } = req.body;

    if (!distributorId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both Distributor ID and password',
      });
    }

    // Find distributor by distributorId
    const distributor = await Distributor.findOne({
      distributorId: distributorId.trim().toUpperCase(),
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
    const { rationCardNumber, password } = req.body;

    if (!rationCardNumber || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both Ration Card Number and password',
      });
    }

    // Find beneficiary by rationCardNumber
    const beneficiary = await Beneficiary.findOne({
      rationCardNumber: rationCardNumber.trim(),
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
    const {
      fullName,
      rationCardNumber,
      mobileNumber,
      password,
      district,
      taluk,
      village,
      address,
      familyMemberCount,
      rfidUid,
      assignedDistributor,
    } = req.body;

    // Validate required fields
    if (
      !fullName ||
      !rationCardNumber ||
      !mobileNumber ||
      !password ||
      !district ||
      !taluk
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields (fullName, rationCardNumber, mobileNumber, password, district, taluk)',
      });
    }

    // Check if duplicate Ration Card Number exists
    const existingBeneficiary = await Beneficiary.findOne({
      rationCardNumber: rationCardNumber.trim(),
    });

    if (existingBeneficiary) {
      return res.status(400).json({
        success: false,
        message: 'Beneficiary with this Ration Card Number already exists',
      });
    }

    // Check if duplicate RFID UID exists (if provided)
    if (rfidUid && rfidUid.trim()) {
      const existingRfid = await Beneficiary.findOne({
        rfidUid: rfidUid.trim(),
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
      const distributorExists = await Distributor.findById(assignedDistributor);
      if (!distributorExists) {
        return res.status(404).json({
          success: false,
          message: 'Assigned Distributor not found',
        });
      }
      distributorToAssign = assignedDistributor;
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create beneficiary
    const beneficiary = await Beneficiary.create({
      fullName: fullName.trim(),
      rationCardNumber: rationCardNumber.trim(),
      mobileNumber: mobileNumber.trim(),
      password: hashedPassword,
      district: district.trim(),
      taluk: taluk.trim(),
      village: village ? village.trim() : '',
      address: address ? address.trim() : '',
      familyMemberCount: familyMemberCount ? Number(familyMemberCount) : 1,
      rfidUid: rfidUid ? rfidUid.trim() : undefined,
      assignedDistributor: distributorToAssign,
      status: 'Active',
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
    const {
      name,
      mobileNumber,
      distributorId,
      password,
      fpsCode,
      district,
      taluk,
    } = req.body;

    // Validate required fields
    if (
      !name ||
      !mobileNumber ||
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

    const formattedDistributorId = distributorId.trim().toUpperCase();

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
      fpsCode: fpsCode.trim(),
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
      name: name.trim(),
      mobileNumber: mobileNumber.trim(),
      distributorId: formattedDistributorId,
      password: hashedPassword,
      fpsCode: fpsCode.trim(),
      district: district.trim(),
      taluk: taluk.trim(),
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

module.exports = {
  adminLogin,
  distributorLogin,
  beneficiaryLogin,
  beneficiaryRegister,
  distributorRegister,
};
