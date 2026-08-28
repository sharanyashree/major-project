const mongoose = require('mongoose');
const Distributor = require('../models/Distributor');
const Beneficiary = require('../models/Beneficiary');
const Inventory = require('../models/Inventory');
const Allocation = require('../models/Allocation');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const DispatchRecord = require('../models/DispatchRecord');

/**
 * Helper: Get or initialize Central Inventory record (where distributor is null)
 */
const getOrCreateCentralInventory = async () => {
  let inventory = await Inventory.findOne({ distributor: null });
  if (!inventory) {
    inventory = await Inventory.create({
      distributor: null,
      riceStock: 0,
      oilStock: 0,
      minimumStock: {
        rice: 100,
        oil: 50,
      },
    });
  }
  return inventory;
};

// ==========================================
// 1. DISTRIBUTOR MANAGEMENT
// ==========================================

/**
 * @desc    View all distributors
 * @route   GET /api/admin/distributors
 * @access  Private (Admin)
 */
const getAllDistributors = async (req, res) => {
  try {
    const { status, district, taluk } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (district) filter.district = district;
    if (taluk) filter.taluk = taluk;

    const distributors = await Distributor.find(filter)
      .select('-password')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: distributors.length,
      data: distributors,
    });
  } catch (error) {
    console.error('Error fetching distributors:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve distributors',
      error: error.message,
    });
  }
};

/**
 * @desc    View pending distributors
 * @route   GET /api/admin/distributors/pending
 * @access  Private (Admin)
 */
const getPendingDistributors = async (req, res) => {
  try {
    const pendingDistributors = await Distributor.find({ status: 'Pending' })
      .select('-password')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: pendingDistributors.length,
      data: pendingDistributors,
    });
  } catch (error) {
    console.error('Error fetching pending distributors:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve pending distributors',
      error: error.message,
    });
  }
};

/**
 * @desc    Approve distributor
 * @route   PATCH /api/admin/distributors/:id/approve
 * @access  Private (Admin)
 */
const approveDistributor = async (req, res) => {
  try {
    const { id } = req.params;

    const distributor = await Distributor.findById(id);
    if (!distributor) {
      return res.status(404).json({
        success: false,
        message: 'Distributor not found',
      });
    }

    distributor.status = 'Active';
    await distributor.save();

    // Ensure an inventory record exists for the approved distributor
    let inventory = await Inventory.findOne({ distributor: distributor._id });
    if (!inventory) {
      await Inventory.create({
        distributor: distributor._id,
        riceStock: 0,
        oilStock: 0,
        minimumStock: { rice: 50, oil: 20 },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Distributor approved successfully',
      data: {
        _id: distributor._id,
        distributorId: distributor.distributorId,
        name: distributor.name,
        status: distributor.status,
      },
    });
  } catch (error) {
    console.error('Error approving distributor:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve distributor',
      error: error.message,
    });
  }
};

/**
 * @desc    Reject distributor
 * @route   PATCH /api/admin/distributors/:id/reject
 * @access  Private (Admin)
 */
const rejectDistributor = async (req, res) => {
  try {
    const { id } = req.params;

    const distributor = await Distributor.findById(id);
    if (!distributor) {
      return res.status(404).json({
        success: false,
        message: 'Distributor not found',
      });
    }

    distributor.status = 'Inactive';
    await distributor.save();

    return res.status(200).json({
      success: true,
      message: 'Distributor registration rejected',
      data: {
        _id: distributor._id,
        distributorId: distributor.distributorId,
        name: distributor.name,
        status: distributor.status,
      },
    });
  } catch (error) {
    console.error('Error rejecting distributor:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject distributor',
      error: error.message,
    });
  }
};

/**
 * @desc    Suspend distributor
 * @route   PATCH /api/admin/distributors/:id/suspend
 * @access  Private (Admin)
 */
const suspendDistributor = async (req, res) => {
  try {
    const { id } = req.params;

    const distributor = await Distributor.findById(id);
    if (!distributor) {
      return res.status(404).json({
        success: false,
        message: 'Distributor not found',
      });
    }

    distributor.status = 'Suspended';
    await distributor.save();

    return res.status(200).json({
      success: true,
      message: 'Distributor suspended successfully',
      data: {
        _id: distributor._id,
        distributorId: distributor.distributorId,
        name: distributor.name,
        status: distributor.status,
      },
    });
  } catch (error) {
    console.error('Error suspending distributor:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to suspend distributor',
      error: error.message,
    });
  }
};

/**
 * @desc    Activate distributor
 * @route   PATCH /api/admin/distributors/:id/activate
 * @access  Private (Admin)
 */
const activateDistributor = async (req, res) => {
  try {
    const { id } = req.params;

    const distributor = await Distributor.findById(id);
    if (!distributor) {
      return res.status(404).json({
        success: false,
        message: 'Distributor not found',
      });
    }

    distributor.status = 'Active';
    await distributor.save();

    return res.status(200).json({
      success: true,
      message: 'Distributor activated successfully',
      data: {
        _id: distributor._id,
        distributorId: distributor.distributorId,
        name: distributor.name,
        status: distributor.status,
      },
    });
  } catch (error) {
    console.error('Error activating distributor:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to activate distributor',
      error: error.message,
    });
  }
};

// ==========================================
// 2. CENTRAL INVENTORY
// ==========================================

/**
 * @desc    View central inventory
 * @route   GET /api/admin/inventory
 * @access  Private (Admin)
 */
const getCentralInventory = async (req, res) => {
  try {
    const inventory = await getOrCreateCentralInventory();

    // Fetch all distributor inventories for comprehensive breakdown
    const distributorInventories = await Inventory.find({ distributor: { $ne: null } })
      .populate('distributor', 'name distributorId fpsCode district taluk status');

    return res.status(200).json({
      success: true,
      data: {
        centralInventory: inventory,
        distributorInventories,
      },
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
 * @desc    Add rice stock to Central Inventory
 * @route   POST /api/admin/inventory/rice
 * @access  Private (Admin)
 */
const addRiceStock = async (req, res) => {
  try {
    const { quantity } = req.body;
    const qty = Number(quantity);

    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid positive quantity for rice stock',
      });
    }

    const inventory = await getOrCreateCentralInventory();
    inventory.riceStock += qty;
    inventory.lastUpdated = new Date();
    await inventory.save();

    return res.status(200).json({
      success: true,
      message: `Successfully added ${qty} kg of rice to central inventory`,
      data: inventory,
    });
  } catch (error) {
    console.error('Error adding rice stock:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add rice stock',
      error: error.message,
    });
  }
};

/**
 * @desc    Add oil stock to Central Inventory
 * @route   POST /api/admin/inventory/oil
 * @access  Private (Admin)
 */
const addOilStock = async (req, res) => {
  try {
    const { quantity } = req.body;
    const qty = Number(quantity);

    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid positive quantity for oil stock',
      });
    }

    const inventory = await getOrCreateCentralInventory();
    inventory.oilStock += qty;
    inventory.lastUpdated = new Date();
    await inventory.save();

    return res.status(200).json({
      success: true,
      message: `Successfully added ${qty} liters of oil to central inventory`,
      data: inventory,
    });
  } catch (error) {
    console.error('Error adding oil stock:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add oil stock',
      error: error.message,
    });
  }
};

/**
 * @desc    Update central inventory directly
 * @route   PUT /api/admin/inventory
 * @access  Private (Admin)
 */
const updateCentralInventory = async (req, res) => {
  try {
    const { riceStock, oilStock, minimumStock } = req.body;

    const inventory = await getOrCreateCentralInventory();

    if (riceStock !== undefined && !isNaN(Number(riceStock))) {
      inventory.riceStock = Math.max(0, Number(riceStock));
    }

    if (oilStock !== undefined && !isNaN(Number(oilStock))) {
      inventory.oilStock = Math.max(0, Number(oilStock));
    }

    if (minimumStock) {
      if (minimumStock.rice !== undefined && !isNaN(Number(minimumStock.rice))) {
        inventory.minimumStock.rice = Math.max(0, Number(minimumStock.rice));
      }
      if (minimumStock.oil !== undefined && !isNaN(Number(minimumStock.oil))) {
        inventory.minimumStock.oil = Math.max(0, Number(minimumStock.oil));
      }
    }

    inventory.lastUpdated = new Date();
    await inventory.save();

    return res.status(200).json({
      success: true,
      message: 'Central inventory updated successfully',
      data: inventory,
    });
  } catch (error) {
    console.error('Error updating central inventory:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update central inventory',
      error: error.message,
    });
  }
};

// ==========================================
// 3. STOCK DISPATCH
// ==========================================

/**
 * @desc    Allocate rice to distributor
 * @route   POST /api/admin/dispatch/rice
 * @access  Private (Admin)
 */
const dispatchRice = async (req, res) => {
  try {
    const { distributorId, quantity } = req.body;
    const qty = Number(quantity);

    if (!distributorId || isNaN(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid distributorId and a positive rice quantity',
      });
    }

    const distQuery = mongoose.isValidObjectId(distributorId)
      ? { $or: [{ _id: distributorId }, { distributorId: String(distributorId).trim().toUpperCase() }] }
      : { distributorId: String(distributorId).trim().toUpperCase() };
    const distributor = await Distributor.findOne(distQuery);
    if (!distributor) {
      return res.status(404).json({
        success: false,
        message: 'Distributor not found',
      });
    }

    // Check central inventory
    const centralInventory = await getOrCreateCentralInventory();
    if (centralInventory.riceStock < qty) {
      return res.status(400).json({
        success: false,
        message: `Insufficient rice stock in central inventory. Available: ${centralInventory.riceStock} kg`,
      });
    }

    // Deduct from central stock
    centralInventory.riceStock -= qty;
    centralInventory.lastUpdated = new Date();
    await centralInventory.save();

    // Add to distributor's inventory
    let distInventory = await Inventory.findOne({
    distributor: distributor._id
});
    if (!distInventory) {
      distInventory = await Inventory.create({
        distributor: distributor._id,
        riceStock: qty,
        oilStock: 0,
      });
    } else {
      distInventory.riceStock += qty;
      distInventory.lastUpdated = new Date();
      await distInventory.save();
    }

    // Create a dispatch notification for the distributor
    await Notification.create({
      receiverId: distributor._id,
      receiverRole: 'Distributor',
      title: 'Stock Dispatch Received',
      message: `Admin dispatched ${qty} kg of rice to your inventory.`,
    });

    // Automatically create a Dispatch Record
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dispatchRecord = await DispatchRecord.create({
      dispatchId: `DSP-RICE-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      distributor: distributor._id,
      riceQuantity: qty,
      oilQuantity: 0,
      date: now,
      time: timeStr,
      adminId: req.user.id,
      status: 'Completed',
    });

    return res.status(200).json({
      success: true,
      message: `Successfully allocated ${qty} kg of rice to Distributor ${distributor.name}`,
      data: {
        distributor: {
          _id: distributor._id,
          name: distributor.name,
          distributorId: distributor.distributorId,
        },
        riceDispatched: qty,
        updatedDistributorInventory: distInventory,
        remainingCentralRiceStock: centralInventory.riceStock,
        dispatchRecord,
      },
    });
  } catch (error) {
    console.error('Error dispatching rice:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to allocate rice to distributor',
      error: error.message,
    });
  }
};

/**
 * @desc    Allocate oil to distributor
 * @route   POST /api/admin/dispatch/oil
 * @access  Private (Admin)
 */
const dispatchOil = async (req, res) => {
  try {
    const { distributorId, quantity } = req.body;
    const qty = Number(quantity);

    if (!distributorId || isNaN(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid distributorId and a positive oil quantity',
      });
    }

    const distQuery = mongoose.isValidObjectId(distributorId)
      ? { $or: [{ _id: distributorId }, { distributorId: String(distributorId).trim().toUpperCase() }] }
      : { distributorId: String(distributorId).trim().toUpperCase() };
    const distributor = await Distributor.findOne(distQuery);
    if (!distributor) {
      return res.status(404).json({
        success: false,
        message: 'Distributor not found',
      });
    }

    // Check central inventory
    const centralInventory = await getOrCreateCentralInventory();
    if (centralInventory.oilStock < qty) {
      return res.status(400).json({
        success: false,
        message: `Insufficient oil stock in central inventory. Available: ${centralInventory.oilStock} liters`,
      });
    }

    // Deduct from central stock
    centralInventory.oilStock -= qty;
    centralInventory.lastUpdated = new Date();
    await centralInventory.save();

    // Add to distributor's inventory
   let distInventory = await Inventory.findOne({
    distributor: distributor._id
});
    if (!distInventory) {
     distInventory = await Inventory.create({
    distributor: distributor._id,
    riceStock: 0,
    oilStock: qty,
});
    } else {
      distInventory.oilStock += qty;
      distInventory.lastUpdated = new Date();
      await distInventory.save();
    }

    // Create a dispatch notification for the distributor
    await Notification.create({
      receiverId: distributor._id,
      receiverRole: 'Distributor',
      title: 'Stock Dispatch Received',
      message: `Admin dispatched ${qty} liters of oil to your inventory.`,
    });

    // Automatically create a Dispatch Record
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dispatchRecord = await DispatchRecord.create({
      dispatchId: `DSP-OIL-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      distributor: distributor._id,
      riceQuantity: 0,
      oilQuantity: qty,
      date: now,
      time: timeStr,
      adminId: req.user.id,
      status: 'Completed',
    });

    return res.status(200).json({
      success: true,
      message: `Successfully allocated ${qty} liters of oil to Distributor ${distributor.name}`,
      data: {
        distributor: {
          _id: distributor._id,
          name: distributor.name,
          distributorId: distributor.distributorId,
        },
        oilDispatched: qty,
        updatedDistributorInventory: distInventory,
        remainingCentralOilStock: centralInventory.oilStock,
        dispatchRecord,
      },
    });
  } catch (error) {
    console.error('Error dispatching oil:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to allocate oil to distributor',
      error: error.message,
    });
  }
};

/**
 * @desc    Record and view dispatch history (Allocations / Dispatch logs)
 * @route   GET /api/admin/dispatch/history
 * @access  Private (Admin)
 */
const getDispatchHistory = async (req, res) => {
  try {
    const dispatchRecords = await DispatchRecord.find()
      .populate('distributor', 'name distributorId fpsCode district taluk')
      .populate('adminId', 'name adminId role')
      .sort({ createdAt: -1 });

    const allocations = await Allocation.find()
      .populate('beneficiary', 'fullName rationCardNumber mobileNumber')
      .populate('distributor', 'name distributorId fpsCode district taluk')
      .populate('allocatedBy', 'name distributorId')
      .sort({ createdAt: -1 });

    const distributorInventories = await Inventory.find({ distributor: { $ne: null } })
      .populate('distributor', 'name distributorId fpsCode district taluk');

    return res.status(200).json({
      success: true,
      count: dispatchRecords.length,
      data: {
        dispatchRecords,
        allocations,
        distributorStockOverview: distributorInventories,
      },
    });
  } catch (error) {
    console.error('Error fetching dispatch history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve dispatch history',
      error: error.message,
    });
  }
};

// ==========================================
// 4. REPORTS
// ==========================================

/**
 * @desc    Summary Report
 * @route   GET /api/admin/reports/summary
 * @access  Private (Admin)
 */
const getSummaryReport = async (req, res) => {
  try {
    const totalDistributors = await Distributor.countDocuments();
    const totalBeneficiaries = await Beneficiary.countDocuments();

    // Aggregate total rice and oil distributed from successful transactions
    const totals = await Transaction.aggregate([
      { $match: { status: 'Successful' } },
      {
        $group: {
          _id: null,
          totalRiceDistributed: { $sum: '$riceDispensed' },
          totalOilDistributed: { $sum: '$oilDispensed' },
          transactionCount: { $sum: 1 },
        },
      },
    ]);

    const stats = totals.length > 0 ? totals[0] : { totalRiceDistributed: 0, totalOilDistributed: 0, transactionCount: 0 };

    const centralInventory = await getOrCreateCentralInventory();

    return res.status(200).json({
      success: true,
      data: {
        totalDistributors,
        totalBeneficiaries,
        totalRiceDistributed: stats.totalRiceDistributed,
        totalOilDistributed: stats.totalOilDistributed,
        totalTransactionsCount: stats.transactionCount,
        centralInventoryStock: {
          rice: centralInventory.riceStock,
          oil: centralInventory.oilStock,
        },
      },
    });
  } catch (error) {
    console.error('Error generating summary report:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate summary report',
      error: error.message,
    });
  }
};

/**
 * @desc    Daily Transactions Report
 * @route   GET /api/admin/reports/transactions/daily
 * @access  Private (Admin)
 */
const getDailyTransactions = async (req, res) => {
  try {
    const { date } = req.query;
    let targetDateStart, targetDateEnd;

    if (date) {
      targetDateStart = new Date(date);
      targetDateStart.setHours(0, 0, 0, 0);
      targetDateEnd = new Date(date);
      targetDateEnd.setHours(23, 59, 59, 999);
    } else {
      targetDateStart = new Date();
      targetDateStart.setHours(0, 0, 0, 0);
      targetDateEnd = new Date();
      targetDateEnd.setHours(23, 59, 59, 999);
    }

    const transactions = await Transaction.find({
      date: { $gte: targetDateStart, $lte: targetDateEnd },
    })
      .populate('beneficiary', 'fullName rationCardNumber mobileNumber')
      .populate('distributor', 'name distributorId fpsCode')
      .sort({ createdAt: -1 });

    const totalRice = transactions.reduce((acc, t) => acc + (t.status === 'Successful' ? t.riceDispensed : 0), 0);
    const totalOil = transactions.reduce((acc, t) => acc + (t.status === 'Successful' ? t.oilDispensed : 0), 0);

    return res.status(200).json({
      success: true,
      date: targetDateStart.toISOString().split('T')[0],
      count: transactions.length,
      totals: {
        riceDispensed: totalRice,
        oilDispensed: totalOil,
      },
      data: transactions,
    });
  } catch (error) {
    console.error('Error fetching daily transactions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve daily transactions report',
      error: error.message,
    });
  }
};

/**
 * @desc    Monthly Transactions Report
 * @route   GET /api/admin/reports/transactions/monthly
 * @access  Private (Admin)
 */
const getMonthlyTransactions = async (req, res) => {
  try {
    const { month, year } = req.query;

    const currentYear = year ? parseInt(year, 10) : new Date().getFullYear();
    const currentMonth = month ? parseInt(month, 10) - 1 : new Date().getMonth(); // 0-indexed month

    const startDate = new Date(currentYear, currentMonth, 1);
    const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    const transactions = await Transaction.find({
      date: { $gte: startDate, $lte: endDate },
    })
      .populate('beneficiary', 'fullName rationCardNumber mobileNumber')
      .populate('distributor', 'name distributorId fpsCode')
      .sort({ createdAt: -1 });

    const totalRice = transactions.reduce((acc, t) => acc + (t.status === 'Successful' ? t.riceDispensed : 0), 0);
    const totalOil = transactions.reduce((acc, t) => acc + (t.status === 'Successful' ? t.oilDispensed : 0), 0);

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
      message: 'Failed to retrieve monthly transactions report',
      error: error.message,
    });
  }
};

// ==========================================
// 5. NOTIFICATIONS
// ==========================================

/**
 * @desc    Send notification to one distributor
 * @route   POST /api/admin/notifications/distributor
 * @access  Private (Admin)
 */
const sendNotificationToDistributor = async (req, res) => {
  try {
    const { distributorId, title, message } = req.body;

    if (!distributorId || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide distributorId, title, and message',
      });
    }

    const distQuery = mongoose.isValidObjectId(distributorId)
      ? { $or: [{ _id: distributorId }, { distributorId: String(distributorId).trim().toUpperCase() }] }
      : { distributorId: String(distributorId).trim().toUpperCase() };
    const distributor = await Distributor.findOne(distQuery);
    if (!distributor) {
      return res.status(404).json({
        success: false,
        message: 'Distributor not found',
      });
    }

    const notification = await Notification.create({
      receiverId: distributor._id,
      receiverRole: 'Distributor',
      title: title.trim(),
      message: message.trim(),
    });

    return res.status(201).json({
      success: true,
      message: `Notification sent successfully to distributor ${distributor.name}`,
      data: notification,
    });
  } catch (error) {
    console.error('Error sending notification to distributor:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send notification to distributor',
      error: error.message,
    });
  }
};

/**
 * @desc    Send notification to all distributors
 * @route   POST /api/admin/notifications/distributors/all
 * @access  Private (Admin)
 */
const sendNotificationToAllDistributors = async (req, res) => {
  try {
    const { title, message } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title and message',
      });
    }

    const distributors = await Distributor.find({ status: 'Active' });

    if (distributors.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active distributors found to send notification',
      });
    }

    const notifications = distributors.map((d) => ({
      receiverId: d._id,
      receiverRole: 'Distributor',
      title: title.trim(),
      message: message.trim(),
    }));

    await Notification.insertMany(notifications);

    return res.status(201).json({
      success: true,
      message: `Notification sent to all ${distributors.length} active distributors`,
      recipientCount: distributors.length,
    });
  } catch (error) {
    console.error('Error sending notification to all distributors:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send notification to all distributors',
      error: error.message,
    });
  }
};

/**
 * @desc    Send notification to one beneficiary
 * @route   POST /api/admin/notifications/beneficiary
 * @access  Private (Admin)
 */
const sendNotificationToBeneficiary = async (req, res) => {
  try {
    const { beneficiaryId, title, message } = req.body;

    if (!beneficiaryId || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide beneficiaryId, title, and message',
      });
    }

    const benQuery = mongoose.isValidObjectId(beneficiaryId)
      ? { $or: [{ _id: beneficiaryId }, { rationCardNumber: String(beneficiaryId).trim() }] }
      : { rationCardNumber: String(beneficiaryId).trim() };
    const beneficiary = await Beneficiary.findOne(benQuery);
    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found',
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
      message: `Notification sent successfully to beneficiary ${beneficiary.fullName}`,
      data: notification,
    });
  } catch (error) {
    console.error('Error sending notification to beneficiary:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send notification to beneficiary',
      error: error.message,
    });
  }
};

/**
 * @desc    Send notification to all beneficiaries
 * @route   POST /api/admin/notifications/beneficiaries/all
 * @access  Private (Admin)
 */
const sendNotificationToAllBeneficiaries = async (req, res) => {
  try {
    const { title, message } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title and message',
      });
    }

    const beneficiaries = await Beneficiary.find({ status: 'Active' });

    if (beneficiaries.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active beneficiaries found to send notification',
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
      message: `Notification sent to all ${beneficiaries.length} active beneficiaries`,
      recipientCount: beneficiaries.length,
    });
  } catch (error) {
    console.error('Error sending notification to all beneficiaries:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send notification to all beneficiaries',
      error: error.message,
    });
  }
};

module.exports = {
  // Distributor Management
  getAllDistributors,
  getPendingDistributors,
  approveDistributor,
  rejectDistributor,
  suspendDistributor,
  activateDistributor,

  // Central Inventory
  getCentralInventory,
  addRiceStock,
  addOilStock,
  updateCentralInventory,

  // Stock Dispatch
  dispatchRice,
  dispatchOil,
  getDispatchHistory,

  // Reports
  getSummaryReport,
  getDailyTransactions,
  getMonthlyTransactions,

  // Notifications
  sendNotificationToDistributor,
  sendNotificationToAllDistributors,
  sendNotificationToBeneficiary,
  sendNotificationToAllBeneficiaries,
};
