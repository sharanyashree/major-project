const mongoose = require('mongoose');

const allocationSchema = new mongoose.Schema(
  {
    beneficiary: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Beneficiary',
      required: [true, 'Beneficiary reference is required'],
    },
    distributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Distributor',
      required: [true, 'Distributor reference is required'],
    },
    allocatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Distributor',
    },
    riceAllocated: {
      type: Number,
      required: true,
      min: 0,
    },
    oilAllocated: {
      type: Number,
      required: true,
      min: 0,
    },
    month: {
      type: String,
      required: [true, 'Month is required'],
      enum: [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ],
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
    },
    collectionStatus: {
      type: String,
      enum: ['Pending', 'Partially Collected', 'Collected'],
      default: 'Pending',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Allocation', allocationSchema);
