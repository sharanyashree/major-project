const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
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
    riceDispensed: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    oilDispensed: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    rfidUid: {
      type: String,
      trim: true,
    },
    machineId: {
      type: String,
      trim: true,
    },
    otpVerified: {
      type: Boolean,
      default: false,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    time: {
      type: String,
    },
    status: {
      type: String,
      enum: ['Successful', 'Failed', 'Pending'],
      default: 'Successful',
    },
    requestId: {
      type: String,
      sparse: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

transactionSchema.virtual('transactionId').get(function () {
  return this._id.toString();
});
transactionSchema.set('toJSON', { virtuals: true });
transactionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Transaction', transactionSchema);
