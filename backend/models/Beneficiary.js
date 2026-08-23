const mongoose = require('mongoose');

const beneficiarySchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    rationCardNumber: {
      type: String,
      required: [true, 'Ration card number is required'],
      unique: true,
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
    },
    district: {
      type: String,
      required: [true, 'District is required'],
      trim: true,
    },
    taluk: {
      type: String,
      required: [true, 'Taluk is required'],
      trim: true,
    },
    village: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    familyMemberCount: {
      type: Number,
      default: 1,
      min: [1, 'At least 1 family member required'],
    },
    rfidUid: {
      type: String,
      trim: true,
      sparse: true,
    },
    assignedDistributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Distributor',
      default: null,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Blocked'],
      default: 'Active',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Beneficiary', beneficiarySchema);
