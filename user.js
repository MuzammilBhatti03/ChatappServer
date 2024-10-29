const mongoose = require('mongoose');
const AutoIncrementFactory = require('mongoose-sequence')(mongoose);

// Define User Schema
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true }, // No need for userID in the schema definition
  deviceId: { type: String, required: true },
  connectedUsers: { type: [String], default: [] }, // Array to store connected user IDs
});

// Apply auto-increment to userID field
UserSchema.plugin(AutoIncrementFactory, { inc_field: 'userID' });

// Create User Model
const User = mongoose.model('User', UserSchema);

module.exports = User;
