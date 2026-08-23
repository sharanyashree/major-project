const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Receiver ID is required'],
      refPath: 'receiverRole',
    },
    receiverRole: {
      type: String,
      required: [true, 'Receiver role is required'],
      enum: ['Admin', 'Distributor', 'Beneficiary'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
    },
    readStatus: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Notification', notificationSchema);
