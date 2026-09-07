const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    distributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Distributor',
      default: null,
      sparse: true,
    },
    distributorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Distributor',
      default: null,
      sparse: true,
    },
    riceStock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    oilStock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    minimumStock: {
      rice: {
        type: Number,
        default: 0,
        min: 0,
      },
      oil: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Inventory', inventorySchema);
