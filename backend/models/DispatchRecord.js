const mongoose = require('mongoose');

const dispatchRecordSchema = new mongoose.Schema(
  {
    dispatchId: {
      type: String,
      required: [true, 'Dispatch ID is required'],
      unique: true,
      trim: true,
    },
    distributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Distributor',
      required: [true, 'Distributor reference is required'],
    },
    riceQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    oilQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    time: {
      type: String,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: [true, 'Admin reference is required'],
    },
    status: {
      type: String,
      enum: ['Completed', 'Pending', 'Failed', 'Cancelled'],
      default: 'Completed',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('DispatchRecord', dispatchRecordSchema);
