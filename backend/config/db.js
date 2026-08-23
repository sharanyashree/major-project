const mongoose = require('mongoose');

/**
 * Connects to MongoDB Community Server
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ration_distribution_system'
    );
    console.log(`[MongoDB] Connected Successfully: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error(`[MongoDB] Connection Failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
