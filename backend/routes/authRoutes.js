const express = require('express');
const router = express.Router();
const {
  adminLogin,
  distributorLogin,
  beneficiaryLogin,
  beneficiaryRegister,
  distributorRegister,
} = require('../controllers/authController');

/**
 * @route   POST /api/auth/admin/login
 * @desc    Authenticate Admin & get token
 * @access  Public
 */
router.post('/admin/login', adminLogin);

/**
 * @route   POST /api/auth/distributor/login
 * @desc    Authenticate Distributor & get token
 * @access  Public
 */
router.post('/distributor/login', distributorLogin);

/**
 * @route   POST /api/auth/beneficiary/login
 * @desc    Authenticate Beneficiary & get token
 * @access  Public
 */
router.post('/beneficiary/login', beneficiaryLogin);

/**
 * @route   POST /api/auth/beneficiary/register
 * @desc    Register a new Beneficiary
 * @access  Public
 */
router.post('/beneficiary/register', beneficiaryRegister);

/**
 * @route   POST /api/auth/distributor/register
 * @desc    Register a new Distributor (Status set to Pending)
 * @access  Public
 */
router.post('/distributor/register', distributorRegister);

module.exports = router;
