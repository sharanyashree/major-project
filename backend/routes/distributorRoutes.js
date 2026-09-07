const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  // Dashboard
  getProfile,
  getInventory,
  getDashboardSummary,

  // Beneficiary Management
  getAssignedBeneficiaries,
  searchBeneficiaryByRationCard,
  getBeneficiaryDetails,
  submitBeneficiaryToAdmin,

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
} = require('../controllers/distributorController');

// Protect all routes and restrict access to 'Distributor' role
router.use(protect);
router.use(authorize('Distributor'));

// ==========================================
// 1. DASHBOARD ROUTES
// ==========================================
router.get('/dashboard', getDashboardSummary);
router.get('/inventory', getInventory);

// ==========================================
// 2. BENEFICIARY MANAGEMENT ROUTES
// ==========================================
router.get('/beneficiaries', getAssignedBeneficiaries);
router.get('/beneficiaries/search', searchBeneficiaryByRationCard);
router.patch('/beneficiaries/:id/submit', submitBeneficiaryToAdmin);
router.post('/beneficiaries/:id/submit', submitBeneficiaryToAdmin);
router.patch('/beneficiaries/:id/submit-to-admin', submitBeneficiaryToAdmin);
router.post('/beneficiaries/:id/submit-to-admin', submitBeneficiaryToAdmin);
router.get('/beneficiaries/:id', getBeneficiaryDetails);

// ==========================================
// 3. MONTHLY ALLOCATION ROUTES
// ==========================================
router.post('/allocations', allocateRation);
router.post('/allocate', allocateRation);
router.put('/allocations/:id', updateAllocation);
router.get('/allocations/history', getAllocationHistory);

// ==========================================
// 4. TRANSACTION ROUTES
// ==========================================
router.get('/transactions/today', getTodayTransactions);
router.get('/transactions/monthly', getMonthlyTransactions);
router.get('/transactions/search', searchTransactionsByBeneficiary);

// ==========================================
// 5. NOTIFICATION ROUTES
// ==========================================
router.post('/notifications/beneficiaries', sendNotificationToAssignedBeneficiaries);
router.get('/notifications', getReceivedNotifications);
router.get('/notifications/unread', getUnreadNotifications);
router.patch('/notifications/read-all', markAllNotificationsAsRead);
router.patch('/notifications/:id/read', markNotificationAsRead);

// ==========================================
// 6. PROFILE ROUTES
// ==========================================
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/profile/change-password', changePassword);

module.exports = router;
