const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
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
} = require('../controllers/beneficiaryController');

// Apply protection and Beneficiary role authorization to all beneficiary routes
router.use(protect);
router.use(authorize('Beneficiary'));

// ==========================================
// 1. DASHBOARD ROUTES
// ==========================================
router.get('/dashboard', getDashboardSummary);

// ==========================================
// 2. PROFILE ROUTES
// ==========================================
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/profile/change-password', changePassword);

// ==========================================
// 3. ALLOCATION ROUTES
// ==========================================
router.get('/allocation/current', getCurrentAllocation);
router.get('/allocation/history', getAllocationHistory);
router.get('/allocation/details', getAllocationDetailsByMonthYear);

// ==========================================
// 4. TRANSACTION ROUTES
// ==========================================
router.get('/transactions', getTransactionHistory);
router.get('/transactions/today/latest', getTodayLatestTransaction);
router.get('/transactions/:id', getTransactionDetails);

// ==========================================
// 5. NOTIFICATION ROUTES
// ==========================================
router.get('/notifications', getAllNotifications);
router.get('/notifications/unread', getUnreadNotifications);
router.patch('/notifications/read-all', markAllNotificationsAsRead);
router.patch('/notifications/:id/read', markNotificationAsRead);

module.exports = router;
