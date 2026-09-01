const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  // Distributor Management
  getAllDistributors,
  getPendingDistributors,
  approveDistributor,
  rejectDistributor,
  suspendDistributor,
  activateDistributor,

  // Beneficiary Management & Approvals
  getAllBeneficiaries,
  getPendingBeneficiaries,
  approveBeneficiary,
  rejectBeneficiary,

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
} = require('../controllers/adminController');

// Apply protection and Admin role authorization to all admin routes
router.use(protect);
router.use(authorize('Admin'));

// ==========================================
// 1. DISTRIBUTOR MANAGEMENT ROUTES
// ==========================================
router.get('/distributors/pending', getPendingDistributors);
router.get('/distributors', getAllDistributors);
router.patch('/distributors/:id/approve', approveDistributor);
router.patch('/distributors/:id/reject', rejectDistributor);
router.patch('/distributors/:id/suspend', suspendDistributor);
router.patch('/distributors/:id/activate', activateDistributor);

// ==========================================
// 2. BENEFICIARY MANAGEMENT & APPROVAL ROUTES
// ==========================================
router.get('/beneficiaries/pending', getPendingBeneficiaries);
router.get('/beneficiaries', getAllBeneficiaries);
router.patch('/beneficiaries/:id/approve', approveBeneficiary);
router.patch('/beneficiaries/:id/reject', rejectBeneficiary);

// ==========================================
// 3. CENTRAL INVENTORY ROUTES
// ==========================================
router.get('/inventory', getCentralInventory);
router.post('/inventory/rice', addRiceStock);
router.post('/inventory/oil', addOilStock);
router.put('/inventory', updateCentralInventory);

// ==========================================
// 3. STOCK DISPATCH ROUTES
// ==========================================
router.post('/dispatch/rice', dispatchRice);
router.post('/dispatch/oil', dispatchOil);
router.get('/dispatch/history', getDispatchHistory);

// ==========================================
// 4. REPORTS ROUTES
// ==========================================
router.get('/reports/summary', getSummaryReport);
router.get('/reports/transactions/daily', getDailyTransactions);
router.get('/reports/transactions/monthly', getMonthlyTransactions);

// ==========================================
// 5. NOTIFICATION ROUTES
// ==========================================
router.post('/notifications/distributor', sendNotificationToDistributor);
router.post('/notifications/distributors/all', sendNotificationToAllDistributors);
router.post('/notifications/beneficiary', sendNotificationToBeneficiary);
router.post('/notifications/beneficiaries/all', sendNotificationToAllBeneficiaries);

module.exports = router;
