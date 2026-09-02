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
    riceQuota: {
      type: Number,
      default: 0,
      min: [0, 'Rice allocation quota cannot be negative'],
    },
    oilQuota: {
      type: Number,
      default: 0,
      min: [0, 'Oil allocation quota cannot be negative'],
    },
    status: {
      type: String,
      enum: ['Pending', 'Active', 'Approved', 'Rejected', 'Inactive', 'Blocked'],
      default: 'Pending',
    },
    submittedToAdmin: {
      type: Boolean,
      default: false,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    submissionStatus: {
      type: String,
      enum: [
        'Pending Distributor Review',
        'Submitted for Admin Review',
        'Under Admin Review',
        'Reviewed',
        'None',
      ],
      default: 'Pending Distributor Review',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Beneficiary', beneficiarySchema);
