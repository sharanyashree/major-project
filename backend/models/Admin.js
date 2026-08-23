const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
  {
    adminId: {
      type: String,
      required: [true, 'Admin ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
    },
    name: {
      type: String,
      required: [true, 'Admin name is required'],
      trim: true,
    },
    role: {
      type: String,
      enum: ['Super Admin', 'Admin', 'Staff'],
      default: 'Admin',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Admin', adminSchema);
