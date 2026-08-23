const mongoose = require('mongoose');

const distributorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Distributor name is required'],
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
    },
    distributorId: {
      type: String,
      required: [true, 'Distributor ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
    },
    fpsCode: {
      type: String,
      required: [true, 'FPS Code is required'],
      unique: true,
      trim: true,
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
    status: {
      type: String,
      enum: ['Pending', 'Active', 'Inactive', 'Suspended'],
      default: 'Pending',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Distributor', distributorSchema);
