const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    beneficiary: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Beneficiary',
      required: [true, 'Beneficiary reference is required'],
    },
    mobileNumber: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
    },
    otp: {
      type: String,
      required: [true, 'OTP is required'],
    },
    expiryTime: {
      type: Date,
      required: [true, 'Expiry time is required'],
    },
    verified: {
      type: Boolean,
      default: false,
    },
    otpPurpose: {
      type: String,
      enum: ['Collection', 'PasswordReset'],
      default: 'Collection',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('OTP', otpSchema);
