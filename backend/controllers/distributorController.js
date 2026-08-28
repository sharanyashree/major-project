const bcrypt = require('bcrypt');
const Distributor = require('../models/Distributor');
const Beneficiary = require('../models/Beneficiary');
const Inventory = require('../models/Inventory');
const Allocation = require('../models/Allocation');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');

// ==========================================
// 1. DASHBOARD APIs
// ==========================================

/**
 * @desc    View distributor profile
 * @route   GET /api/distributor/profile
 * @access  Private (Distributor)
 */
const getProfile = async (req, res) => {
  try {
    const distributor = await Distributor.findById(req.user.id).select('-password');
    if (!distributor) {
      return res.status(404).json({
        success: false,
        message: 'Distributor profile not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: distributor,
    });
  } catch (error) {
    console.error('Error fetching distributor profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile',
      error: error.message,
    });
  }
};

/**
 * @desc    View assigned inventory (Rice & Oil)
 * @route   GET /api/distributor/inventory
 * @access  Private (Distributor)
 */
const getInventory = async (req, res) => {
  try {
    let inventory = await Inventory.findOne({
      $or: [{ distributor: req.user.id }, { distributorId: req.user.id }],
    });
    if (!inventory) {
      inventory = await Inventory.create({
        distributor: req.user.id,
        riceStock: 0,
        oilStock: 0,
        minimumStock: { rice: 50, oil: 20 },
      });
    }

    return res.status(200).json({
      success: true,
      data: inventory,
      inventory,
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve inventory',
      error: error.message,
    });
  }
};

/**
 * @desc    Get distributor dashboard summary
 * @route   GET /api/distributor/dashboard
 * @access  Private (Distributor)
 */
const getDashboardSummary = async (req, res) => {
  try {
    const distributorId = req.user.id;

    // Profile & Inventory
    const distributor = await Distributor.findById(distributorId).select('-password');
    let inventory = await Inventory.findOne({
      $or: [{ distributor: distributorId }, { distributorId: distributorId }],
    });
    if (!inventory) {
      inventory = { riceStock: 0, oilStock: 0 };
    }

    // Assigned beneficiaries count
    const totalBeneficiaries = await Beneficiary.countDocuments({
      assignedDistributor: distributorId,
      status: 'Active',
    });

    // Today's Date range
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Today's transactions
    const todayTransactions = await Transaction.find({
      distributor: distributorId,
      date: { $gte: todayStart, $lte: todayEnd },
    });

    const todayCollectionsCount = todayTransactions.filter((t) => t.status === 'Successful').length;
    const todayRiceDistributed = todayTransactions.reduce(
      (acc, t) => acc + (t.status === 'Successful' ? t.riceDispensed : 0),
      0
    );
    const todayOilDistributed = todayTransactions.reduce(
      (acc, t) => acc + (t.status === 'Successful' ? t.oilDispensed : 0),
      0
    );

    // Unread Notifications Count
    const unreadNotificationsCount = await Notification.countDocuments({
      receiverId: distributorId,
      readStatus: false,
    });

    return res.status(200).json({
      success: true,
      data: {
        profile: distributor,
        inventory: {
          riceStock: inventory.riceStock,
          oilStock: inventory.oilStock,
        },
        totalBeneficiaries,
        assignedBeneficiariesCount: totalBeneficiaries,
        metrics: {
          totalBeneficiaries,
          assignedBeneficiariesCount: totalBeneficiaries,
          todayCollectionsCount,
          todayRiceDistributed,
          todayOilDistributed,
          unreadNotificationsCount,
        },
      },
    });
  } catch (error) {
    console.error('Error generating distributor dashboard summary:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard summary',
      error: error.message,
    });
  }
};

// ==========================================
// 2. BENEFICIARY MANAGEMENT
// ==========================================

/**
 * @desc    View assigned beneficiaries only
 * @route   GET /api/distributor/beneficiaries
 * @access  Private (Distributor)
 */
const getAssignedBeneficiaries = async (req, res) => {
  try {
    const beneficiaries = await Beneficiary.find({
      assignedDistributor: req.user.id,
    })
      .select('-password')
      .sort({ fullName: 1 });

    return res.status(200).json({
      success: true,
      count: beneficiaries.length,
      data: beneficiaries,
    });
  } catch (error) {
    console.error('Error fetching assigned beneficiaries:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve assigned beneficiaries',
      error: error.message,
    });
  }
};

/**
 * @desc    Search beneficiary by Ration Card Number (among assigned)
 * @route   GET /api/distributor/beneficiaries/search
 * @access  Private (Distributor)
 */
const searchBeneficiaryByRationCard = async (req, res) => {
  try {
    const rawRationCard =
      req.query.rationCardNumber ||
      req.query.rationCard ||
      req.query.q ||
      req.query.cardNo ||
      req.query.card;

    if (!rawRationCard || !String(rawRationCard).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide rationCardNumber query parameter',
      });
    }

    const beneficiary = await Beneficiary.findOne({
      assignedDistributor: req.user.id,
      rationCardNumber: String(rawRationCard).trim().toUpperCase(),
    }).select('-password');

    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'No assigned beneficiary found with this Ration Card Number',
      });
    }

    return res.status(200).json({
      success: true,
      data: beneficiary,
    });
  } catch (error) {
    console.error('Error searching beneficiary:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search beneficiary',
      error: error.message,
    });
  }
};

/**
 * @desc    View beneficiary details
 * @route   GET /api/distributor/beneficiaries/:id
 * @access  Private (Distributor)
 */
const getBeneficiaryDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const beneficiary = await Beneficiary.findOne({
      _id: id,
      assignedDistributor: req.user.id,
    }).select('-password');

    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found or not assigned to your FPS center',
      });
    }

    // Get active allocations & transaction history
    const allocations = await Allocation.find({ beneficiary: id }).sort({ year: -1, month: -1 });
    const transactions = await Transaction.find({ beneficiary: id }).sort({ date: -1 }).limit(10);

    return res.status(200).json({
      success: true,
      data: {
        beneficiary,
        allocations,
        recentTransactions: transactions,
      },
    });
  } catch (error) {
    console.error('Error fetching beneficiary details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve beneficiary details',
      error: error.message,
    });
  }
};

// ==========================================
// 3. MONTHLY ALLOCATION
// ==========================================

/**
 * @desc    Allocate monthly Rice & Oil to beneficiary
 * @route   POST /api/distributor/allocations
 * @access  Private (Distributor)
 */
const allocateRation = async (req, res) => {
  try {
    const {
      beneficiaryId,
      beneficiary: beneficiaryAlias,
      riceAllocated,
      rice,
      oilAllocated,
      oil,
      month,
      year,
      collectionStatus,
      status,
    } = req.body;

    const targetBeneficiaryId = beneficiaryId || beneficiaryAlias;
    const finalRice = riceAllocated !== undefined ? Number(riceAllocated) : (rice !== undefined ? Number(rice) : undefined);
    const finalOil = oilAllocated !== undefined ? Number(oilAllocated) : (oil !== undefined ? Number(oil) : undefined);

    if (!targetBeneficiaryId || finalRice === undefined || finalOil === undefined || isNaN(finalRice) || isNaN(finalOil) || finalRice < 0 || finalOil < 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid non-negative numbers for riceAllocated and oilAllocated',
      });
    }

    // Check available inventory for this distributor
    const inv = await Inventory.findOne({
      $or: [{ distributor: req.user.id }, { distributorId: req.user.id }],
    });
    if (inv && (finalRice > inv.riceStock || finalOil > inv.oilStock)) {
      return res.status(400).json({
        success: false,
        message: `Allocated quantity exceeds available inventory. Available: ${inv.riceStock}kg Rice, ${inv.oilStock}L Oil`,
      });
    }

    // Ensure beneficiary is assigned to this distributor
    const beneficiary = await Beneficiary.findOne({
      _id: targetBeneficiaryId,
      assignedDistributor: req.user.id,
    });

    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found or not assigned to you',
      });
    }

    const currentMonth = month ? month.trim() : new Date().toLocaleString('en-US', { month: 'long' });
    const currentYear = year ? Number(year) : new Date().getFullYear();
    const finalStatus = collectionStatus || status || 'Pending';

    // Check if allocation already exists for this month/year
    let allocation = await Allocation.findOne({
      beneficiary: targetBeneficiaryId,
      month: currentMonth,
      year: currentYear,
    });

    let isNew = false;
    if (allocation) {
      // Update existing allocation
      allocation.riceAllocated = finalRice;
      allocation.oilAllocated = finalOil;
      allocation.allocatedBy = req.user.id;
      allocation.distributor = req.user.id;
      if (collectionStatus || status) {
        allocation.collectionStatus = finalStatus;
      }
      await allocation.save();
    } else {
      // Create new allocation
      isNew = true;
      allocation = await Allocation.create({
        beneficiary: targetBeneficiaryId,
        distributor: req.user.id,
        allocatedBy: req.user.id,
        riceAllocated: finalRice,
        oilAllocated: finalOil,
        month: currentMonth,
        year: currentYear,
        collectionStatus: finalStatus,
      });
    }

    // Deduct stock from Inventory and record transaction only if explicitly collected
    if (finalStatus === 'Collected') {
      const inv = await Inventory.findOne({
        $or: [{ distributor: req.user.id }, { distributorId: req.user.id }],
      });
      if (inv) {
        inv.riceStock = Math.max(0, inv.riceStock - finalRice);
        inv.oilStock = Math.max(0, inv.oilStock - finalOil);
        inv.lastUpdated = new Date();
        await inv.save();
      }

      // Record distribution transaction
      await Transaction.create({
        beneficiary: targetBeneficiaryId,
        distributor: req.user.id,
        riceDispensed: finalRice,
        oilDispensed: finalOil,
        date: new Date(),
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        status: 'Successful',
        otpVerified: true,
      });
    }

    return res.status(isNew ? 201 : 200).json({
      success: true,
      message: `Monthly allocation saved for beneficiary ${beneficiary.fullName} (${currentMonth} ${currentYear})`,
      data: allocation,
    });
  } catch (error) {
    console.error('Error allocating monthly ration:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save monthly allocation',
      error: error.message,
    });
  }
};

/**
 * @desc    Update allocation
 * @route   PUT /api/distributor/allocations/:id
 * @access  Private (Distributor)
 */
const updateAllocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { riceAllocated, rice, oilAllocated, oil, collectionStatus, status } = req.body;

    const allocation = await Allocation.findById(id);

    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: 'Allocation record not found',
      });
    }

    // Verify distributor ownership
    if (allocation.distributor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this allocation record',
      });
    }

    if (riceAllocated !== undefined) allocation.riceAllocated = Number(riceAllocated);
    else if (rice !== undefined) allocation.riceAllocated = Number(rice);

    if (oilAllocated !== undefined) allocation.oilAllocated = Number(oilAllocated);
    else if (oil !== undefined) allocation.oilAllocated = Number(oil);

    if (collectionStatus) allocation.collectionStatus = collectionStatus;
    else if (status) allocation.collectionStatus = status;

    await allocation.save();

    return res.status(200).json({
      success: true,
      message: 'Allocation record updated successfully',
      data: allocation,
    });
  } catch (error) {
    console.error('Error updating allocation:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update allocation',
      error: error.message,
    });
  }
};

/**
 * @desc    View allocation history
 * @route   GET /api/distributor/allocations/history
 * @access  Private (Distributor)
 */
const getAllocationHistory = async (req, res) => {
  try {
    const { month, year, beneficiaryId } = req.query;
    const filter = { distributor: req.user.id };

    if (month) filter.month = month;
    if (year) filter.year = Number(year);
    if (beneficiaryId) filter.beneficiary = beneficiaryId;

    const allocations = await Allocation.find(filter)
      .populate('beneficiary', 'fullName rationCardNumber mobileNumber familyMemberCount')
      .sort({ year: -1, month: -1, createdAt: -1 });

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

// ==========================================
// 4. TRANSACTIONS
// ==========================================

/**
 * @desc    View today's collection transactions
 * @route   GET /api/distributor/transactions/today
 * @access  Private (Distributor)
 */
const getTodayTransactions = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const transactions = await Transaction.find({
      distributor: req.user.id,
      date: { $gte: todayStart, $lte: todayEnd },
    })
      .populate('beneficiary', 'fullName rationCardNumber mobileNumber')
      .sort({ createdAt: -1 });

    const totalRiceDispensed = transactions.reduce(
      (acc, t) => acc + (t.status === 'Successful' ? t.riceDispensed : 0),
      0
    );
    const totalOilDispensed = transactions.reduce(
      (acc, t) => acc + (t.status === 'Successful' ? t.oilDispensed : 0),
      0
    );

    return res.status(200).json({
      success: true,
      count: transactions.length,
      totals: {
        riceDispensed: totalRiceDispensed,
        oilDispensed: totalOilDispensed,
      },
      data: transactions,
    });
  } catch (error) {
    console.error('Error fetching today transactions:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve today's transactions",
      error: error.message,
    });
  }
};

/**
 * @desc    View monthly transactions
 * @route   GET /api/distributor/transactions/monthly
 * @access  Private (Distributor)
 */
const getMonthlyTransactions = async (req, res) => {
  try {
    const { month, year } = req.query;

    const currentYear = year ? parseInt(year, 10) : new Date().getFullYear();
    let currentMonth = new Date().getMonth();

    if (month !== undefined && month !== null && month !== '') {
      const parsedNum = parseInt(month, 10);
      if (!isNaN(parsedNum)) {
        currentMonth = parsedNum >= 1 && parsedNum <= 12 ? parsedNum - 1 : parsedNum;
      } else {
        const monthNames = [
          'january', 'february', 'march', 'april', 'may', 'june',
          'july', 'august', 'september', 'october', 'november', 'december'
        ];
        const idx = monthNames.indexOf(month.toString().toLowerCase().trim());
        if (idx !== -1) {
          currentMonth = idx;
        }
      }
    }

    const startDate = new Date(currentYear, currentMonth, 1);
    const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    const transactions = await Transaction.find({
      distributor: req.user.id,
      date: { $gte: startDate, $lte: endDate },
    })
      .populate('beneficiary', 'fullName rationCardNumber mobileNumber')
      .sort({ createdAt: -1 });

    const totalRice = transactions.reduce(
      (acc, t) => acc + (t.status === 'Successful' ? t.riceDispensed : 0),
      0
    );
    const totalOil = transactions.reduce(
      (acc, t) => acc + (t.status === 'Successful' ? t.oilDispensed : 0),
      0
    );

    return res.status(200).json({
      success: true,
      month: currentMonth + 1,
      year: currentYear,
      count: transactions.length,
      totals: {
        riceDispensed: totalRice,
        oilDispensed: totalOil,
      },
      data: transactions,
    });
  } catch (error) {
    console.error('Error fetching monthly transactions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve monthly transactions',
      error: error.message,
    });
  }
};

/**
 * @desc    Search transactions by beneficiary
 * @route   GET /api/distributor/transactions/search
 * @access  Private (Distributor)
 */
const searchTransactionsByBeneficiary = async (req, res) => {
  try {
    const { rationCardNumber, beneficiaryId } = req.query;

    let targetBeneficiaryId = beneficiaryId;

    if (!targetBeneficiaryId && rationCardNumber) {
      const beneficiary = await Beneficiary.findOne({
        assignedDistributor: req.user.id,
        rationCardNumber: rationCardNumber.trim(),
      });

      if (!beneficiary) {
        return res.status(404).json({
          success: false,
          message: 'No assigned beneficiary found with this Ration Card Number',
        });
      }
      targetBeneficiaryId = beneficiary._id;
    }

    if (!targetBeneficiaryId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either rationCardNumber or beneficiaryId',
      });
    }

    const transactions = await Transaction.find({
      distributor: req.user.id,
      beneficiary: targetBeneficiaryId,
    })
      .populate('beneficiary', 'fullName rationCardNumber mobileNumber')
      .sort({ date: -1 });

    return res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (error) {
    console.error('Error searching transactions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search transactions',
      error: error.message,
    });
  }
};

// ==========================================
// 5. NOTIFICATIONS
// ==========================================

/**
 * @desc    Send notification to assigned beneficiaries
 * @route   POST /api/distributor/notifications/beneficiaries
 * @access  Private (Distributor)
 */
const sendNotificationToAssignedBeneficiaries = async (req, res) => {
  try {
    const { beneficiaryId, title, message, sendToAll } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title and message',
      });
    }

    if (sendToAll) {
      // Broadcast to all assigned active beneficiaries
      const beneficiaries = await Beneficiary.find({
        assignedDistributor: req.user.id,
        status: 'Active',
      });

      if (beneficiaries.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No active assigned beneficiaries found',
        });
      }

      const notifications = beneficiaries.map((b) => ({
        receiverId: b._id,
        receiverRole: 'Beneficiary',
        title: title.trim(),
        message: message.trim(),
      }));

      await Notification.insertMany(notifications);

      return res.status(201).json({
        success: true,
        message: `Notification broadcasted to ${beneficiaries.length} assigned beneficiaries`,
        recipientCount: beneficiaries.length,
      });
    }

    if (!beneficiaryId) {
      return res.status(400).json({
        success: false,
        message: 'Please specify beneficiaryId or set sendToAll=true',
      });
    }

    // Verify assigned beneficiary
    const beneficiary = await Beneficiary.findOne({
      _id: beneficiaryId,
      assignedDistributor: req.user.id,
    });

    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found or not assigned to your center',
      });
    }

    const notification = await Notification.create({
      receiverId: beneficiary._id,
      receiverRole: 'Beneficiary',
      title: title.trim(),
      message: message.trim(),
    });

    return res.status(201).json({
      success: true,
      message: `Notification sent to beneficiary ${beneficiary.fullName}`,
      data: notification,
    });
  } catch (error) {
    console.error('Error sending notification to beneficiaries:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send notification',
      error: error.message,
    });
  }
};

/**
 * @desc    View notifications received from Admin
 * @route   GET /api/distributor/notifications
 * @access  Private (Distributor)
 */
const getReceivedNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      receiverId: req.user.id,
      receiverRole: 'Distributor',
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    console.error('Error fetching received notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve notifications',
      error: error.message,
    });
  }
};

/**
 * @desc    View unread notifications received
 * @route   GET /api/distributor/notifications/unread
 * @access  Private (Distributor)
 */
const getUnreadNotifications = async (req, res) => {
  try {
    const unreadNotifications = await Notification.find({
      receiverId: req.user.id,
      receiverRole: 'Distributor',
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
 * @route   PATCH /api/distributor/notifications/:id/read
 * @access  Private (Distributor)
 */
const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOne({
      _id: id,
      receiverId: req.user.id,
      receiverRole: 'Distributor',
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
 * @route   PATCH /api/distributor/notifications/read-all
 * @access  Private (Distributor)
 */
const markAllNotificationsAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      {
        receiverId: req.user.id,
        receiverRole: 'Distributor',
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

// ==========================================
// 6. PROFILE
// ==========================================

/**
 * @desc    Update own profile
 * @route   PUT /api/distributor/profile
 * @access  Private (Distributor)
 */
const updateProfile = async (req, res) => {
  try {
    const { name, fullName, storeName, email, mobileNumber, fpsCode, district, taluk } = req.body;

    const distributor = await Distributor.findById(req.user.id);
    if (!distributor) {
      return res.status(404).json({
        success: false,
        message: 'Distributor profile not found',
      });
    }

    if (fullName) {
      distributor.fullName = fullName.trim();
      distributor.name = fullName.trim();
    } else if (name) {
      distributor.name = name.trim();
      distributor.fullName = name.trim();
    }

    if (storeName) distributor.storeName = storeName.trim();
    if (email) distributor.email = email.trim();
    if (mobileNumber) distributor.mobileNumber = mobileNumber.trim();
    if (fpsCode) distributor.fpsCode = fpsCode.trim();
    if (district) distributor.district = district.trim();
    if (taluk) distributor.taluk = taluk.trim();

    await distributor.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        _id: distributor._id,
        name: distributor.name,
        fullName: distributor.fullName || distributor.name,
        storeName: distributor.storeName,
        email: distributor.email,
        distributorId: distributor.distributorId,
        mobileNumber: distributor.mobileNumber,
        fpsCode: distributor.fpsCode,
        district: distributor.district,
        taluk: distributor.taluk,
        status: distributor.status,
      },
    });
  } catch (error) {
    console.error('Error updating distributor profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message,
    });
  }
};

/**
 * @desc    Change password
 * @route   PUT /api/distributor/profile/change-password
 * @access  Private (Distributor)
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide currentPassword and newPassword',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long',
      });
    }

    const distributor = await Distributor.findById(req.user.id);
    if (!distributor) {
      return res.status(404).json({
        success: false,
        message: 'Distributor not found',
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, distributor.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Hash and save new password
    const saltRounds = 10;
    distributor.password = await bcrypt.hash(newPassword, saltRounds);
    await distributor.save();

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

module.exports = {
  // Dashboard
  getProfile,
  getInventory,
  getDashboardSummary,

  // Beneficiary Management
  getAssignedBeneficiaries,
  searchBeneficiaryByRationCard,
  getBeneficiaryDetails,

  // Monthly Allocation
  allocateRation,
  updateAllocation,
  getAllocationHistory,

  // Transactions
  getTodayTransactions,
  getMonthlyTransactions,
  searchTransactionsByBeneficiary,

  // Notifications
  sendNotificationToAssignedBeneficiaries,
  getReceivedNotifications,
  getUnreadNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,

  // Profile
  updateProfile,
  changePassword,
};
