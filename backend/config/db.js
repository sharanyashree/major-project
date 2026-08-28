const mongoose = require('mongoose');

/**
 * Connects to MongoDB Community Server
 */
const connectDB = async () => {
  try {
    mongoose.set('bufferCommands', false);
    const conn = await mongoose.connect(
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ration_distribution_system',
      { serverSelectionTimeoutMS: 2000 }
    );
    console.log(`[MongoDB] Connected Successfully: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.warn(`[MongoDB] Connection Warning (Offline/Fallback): ${error.message}`);
  }
};

module.exports = connectDB;
