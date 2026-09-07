require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB Local Community Server
connectDB();

// Start Express HTTP Server
const server = app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Ration Distribution System Server Running`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`==================================================`);
});

// Unhandled Promise Rejections Safety Handler
process.on('unhandledRejection', (err) => {
  console.error(`❌ Unhandled Rejection Error: ${err.message}`);
  server.close(() => process.exit(1));
});
