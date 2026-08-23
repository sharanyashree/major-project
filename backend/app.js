const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// ==========================================
// MIDDLEWARE CONFIGURATION
// ==========================================

// Enable Cross-Origin Resource Sharing (CORS)
app.use(cors());

// Parse incoming JSON payloads
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Serve static directory for uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// ROUTES CONFIGURATION
// ==========================================
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const distributorRoutes = require('./routes/distributorRoutes');
const beneficiaryRoutes = require('./routes/beneficiaryRoutes');
const machineRoutes = require('./routes/machineRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/distributor', distributorRoutes);
app.use('/api/beneficiary', beneficiaryRoutes);
app.use('/api/machine', machineRoutes);

// ==========================================
// BASE HEALTH CHECK ROUTE
// ==========================================
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Ration Distribution System Backend API Server Running',
    database: 'ration_distribution_system',
    timestamp: new Date().toISOString()
  });
});

module.exports = app;
