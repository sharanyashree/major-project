const bcrypt = require('bcrypt');
const Beneficiary = require('../models/Beneficiary');
const Allocation = require('../models/Allocation');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');

// Helper to get current month name in English (e.g. 'August')
const getCurrentMonthName = () => {
  return new Date().toLocaleString('en-US', { month: 'long' });
};

// ==========================================
// 1. DASHBOARD APIs
// ==========================================

/**
 * @desc    Get Beneficiary Dashboard Summary
 * @route   GET /api/beneficiary/dashboard
 * @access  Private (Beneficiary)
 */
const getDashboardSummary = async (req, res) => {
  try {
    const beneficiaryId = req.user.id;

    // Fetch Beneficiary Profile
    const beneficiary = await Beneficiary.findById(beneficiaryId)
      .select('-password')
      .populate('assignedDistributor', 'name distributorId fpsCode mobileNumber district taluk');

    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary profile not found',
      });
    }

    const currentMonth = getCurrentMonthName();
    const currentYear = new Date().getFullYear();

    // Fetch Current Month's Allocation
    const currentAllocation = await Allocation.findOne({
      beneficiary: beneficiaryId,
      month: currentMonth,
      year: currentYear,
    }).populate('distributor', 'name fpsCode mobileNumber');

    // Fetch Unread Notifications Count
    const unreadNotificationsCount = await Notification.countDocuments({
      receiverId: beneficiaryId,
      receiverRole: 'Beneficiary',
      readStatus: false,
    });

    // Check Today's Latest Transaction
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const latestTodayTransaction = await Transaction.findOne({
      beneficiary: beneficiaryId,
      date: { $gte: todayStart, $lte: todayEnd },
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: {
        profile: beneficiary,
        currentMonthAllocation: {
          month: currentMonth,
          year: currentYear,
          riceAllocated: currentAllocation ? currentAllocation.riceAllocated : 0,
          oilAllocated: currentAllocation ? currentAllocation.oilAllocated : 0,
          collectionStatus: currentAllocation ? currentAllocation.collectionStatus : 'Pending',
          allocationDetails: currentAllocation || null,
        },
        unreadNotificationsCount,
        latestTodayTransaction: latestTodayTransaction || null,
      },
    });
  } catch (error) {
    console.error('Error fetching beneficiary dashboard summary:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard summary',
      error: error.message,
    });
  }
};

// ==========================================
// 2. PROFILE APIs
// ==========================================

/**
 * @desc    View own profile
 * @route   GET /api/beneficiary/profile
 * @access  Private (Beneficiary)
 */
const getProfile = async (req, res) => {
  try {
    const beneficiary = await Beneficiary.findById(req.user.id)
      .select('-password')
      .populate('assignedDistributor', 'name distributorId fpsCode mobileNumber district taluk');

    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary profile not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: beneficiary,
    });
  } catch (error) {
    console.error('Error fetching beneficiary profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile',
      error: error.message,
    });
  }
};

/**
 * @desc    Update own profile
 * @route   PUT /api/beneficiary/profile
 * @access  Private (Beneficiary)
 */
const updateProfile = async (req, res) => {
  try {
    const { fullName, mobileNumber, district, taluk, village, address, familyMemberCount } = req.body;

    const beneficiary = await Beneficiary.findById(req.user.id);
    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary profile not found',
      });
    }

    if (fullName) beneficiary.fullName = fullName.trim();
    if (mobileNumber) beneficiary.mobileNumber = mobileNumber.trim();
    if (district) beneficiary.district = district.trim();
    if (taluk) beneficiary.taluk = taluk.trim();
    if (village !== undefined) beneficiary.village = village.trim();
    if (address !== undefined) beneficiary.address = address.trim();
    if (familyMemberCount !== undefined && !isNaN(Number(familyMemberCount))) {
      beneficiary.familyMemberCount = Math.max(1, Number(familyMemberCount));
    }

    await beneficiary.save();

    const updatedBeneficiary = await Beneficiary.findById(req.user.id)
      .select('-password')
      .populate('assignedDistributor', 'name distributorId fpsCode');

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedBeneficiary,
    });
  } catch (error) {
    console.error('Error updating beneficiary profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message,
    });
  }
};

/**
 * @desc    Change password using bcrypt verification
 * @route   PUT /api/beneficiary/profile/change-password
 * @access  Private (Beneficiary)
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both currentPassword and newPassword',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long',
      });
    }

    const beneficiary = await Beneficiary.findById(req.user.id);
    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found',
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, beneficiary.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Hash and save new password
    const saltRounds = 10;
    beneficiary.password = await bcrypt.hash(newPassword, saltRounds);
    await beneficiary.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Error changing password:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message,
    });
  }
};

// ==========================================
// 3. ALLOCATION APIs
// ==========================================

/**
 * @desc    View current month's allocation
 * @route   GET /api/beneficiary/allocation/current
 * @access  Private (Beneficiary)
 */
const getCurrentAllocation = async (req, res) => {
  try {
    const currentMonth = getCurrentMonthName();
    const currentYear = new Date().getFullYear();

    const allocation = await Allocation.findOne({
      beneficiary: req.user.id,
      month: currentMonth,
      year: currentYear,
    }).populate('distributor', 'name distributorId fpsCode mobileNumber district taluk');

    if (!allocation) {
      return res.status(200).json({
        success: true,
        message: `No allocation issued yet for ${currentMonth} ${currentYear}`,
        data: {
          month: currentMonth,
          year: currentYear,
          riceAllocated: 0,
          oilAllocated: 0,
          collectionStatus: 'Pending',
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: allocation,
    });
  } catch (error) {
    console.error('Error fetching current allocation:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve current month allocation',
      error: error.message,
    });
  }
};

/**
 * @desc    View previous allocation history
 * @route   GET /api/beneficiary/allocation/history
 * @access  Private (Beneficiary)
 */
const getAllocationHistory = async (req, res) => {
  try {
    const allocations = await Allocation.find({
      beneficiary: req.user.id,
    })
      .populate('distributor', 'name fpsCode')
      .sort({ year: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: allocations.length,
      data: allocations,
    });
  } catch (error) {
    console.error('Error fetching allocation history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve allocation history',
      error: error.message,
    });
  }
};

/**
 * @desc    View allocation details by month and year
 * @route   GET /api/beneficiary/allocation/details
 * @access  Private (Beneficiary)
 */
const getAllocationDetailsByMonthYear = async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both month and year query parameters',
      });
    }

    const allocation = await Allocation.findOne({
      beneficiary: req.user.id,
      month: month.trim(),
      year: Number(year),
    }).populate('distributor', 'name distributorId fpsCode mobileNumber district taluk');

    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: `No allocation record found for ${month} ${year}`,
      });
    }

    return res.status(200).json({
      success: true,
      data: allocation,
    });
  } catch (error) {
    console.error('Error fetching allocation details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve allocation details',
      error: error.message,
    });
  }
};

// ==========================================
// 4. TRANSACTIONS APIs
// ==========================================

/**
 * @desc    View own transaction history
 * @route   GET /api/beneficiary/transactions
 * @access  Private (Beneficiary)
 */
const getTransactionHistory = async (req, res) => {
  try {
    const transactions = await Transaction.find({
      beneficiary: req.user.id,
    })
      .populate('distributor', 'name distributorId fpsCode')
      .sort({ date: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve transaction history',
      error: error.message,
    });
  }
};

/**
 * @desc    View transaction details
 * @route   GET /api/beneficiary/transactions/:id
 * @access  Private (Beneficiary)
 */
const getTransactionDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await Transaction.findOne({
      _id: id,
      beneficiary: req.user.id,
    }).populate('distributor', 'name distributorId fpsCode district taluk mobileNumber');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction record not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve transaction details',
      error: error.message,
    });
  }
};

/**
 * @desc    View today's latest transaction (if available)
 * @route   GET /api/beneficiary/transactions/today/latest
 * @access  Private (Beneficiary)
 */
const getTodayLatestTransaction = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const transaction = await Transaction.findOne({
      beneficiary: req.user.id,
      date: { $gte: todayStart, $lte: todayEnd },
    })
      .populate('distributor', 'name fpsCode mobileNumber')
      .sort({ createdAt: -1 });

    if (!transaction) {
      return res.status(200).json({
        success: true,
        message: 'No transactions recorded for today',
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error('Error fetching today latest transaction:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve today's latest transaction",
      error: error.message,
    });
  }
};

// ==========================================
// 5. NOTIFICATIONS APIs
// ==========================================

/**
 * @desc    View all notifications
 * @route   GET /api/beneficiary/notifications
 * @access  Private (Beneficiary)
 */
const getAllNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      receiverId: req.user.id,
      receiverRole: 'Beneficiary',
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve notifications',
      error: error.message,
    });
  }
};

/**
 * @desc    View unread notifications
 * @route   GET /api/beneficiary/notifications/unread
 * @access  Private (Beneficiary)
 */
const getUnreadNotifications = async (req, res) => {
  try {
    const unreadNotifications = await Notification.find({
      receiverId: req.user.id,
      receiverRole: 'Beneficiary',
      readStatus: false,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: unreadNotifications.length,
      data: unreadNotifications,
    });
  } catch (error) {
    console.error('Error fetching unread notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve unread notifications',
      error: error.message,
    });
  }
};

/**
 * @desc    Mark notification as Read
 * @route   PATCH /api/beneficiary/notifications/:id/read
 * @access  Private (Beneficiary)
 */
const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOne({
      _id: id,
      receiverId: req.user.id,
      receiverRole: 'Beneficiary',
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    notification.readStatus = true;
    await notification.save();

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification,
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update notification',
      error: error.message,
    });
  }
};

/**
 * @desc    Mark all notifications as Read
 * @route   PATCH /api/beneficiary/notifications/read-all
 * @access  Private (Beneficiary)
 */
const markAllNotificationsAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      {
        receiverId: req.user.id,
        receiverRole: 'Beneficiary',
        readStatus: false,
      },
      {
        $set: { readStatus: true },
      }
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message,
    });
  }
};

module.exports = {
  // Dashboard
  getDashboardSummary,

  // Profile
  getProfile,
  updateProfile,
  changePassword,

  // Allocation
  getCurrentAllocation,
  getAllocationHistory,
  getAllocationDetailsByMonthYear,

  // Transactions
  getTransactionHistory,
  getTransactionDetails,
  getTodayLatestTransaction,

  // Notifications
  getAllNotifications,
  getUnreadNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
