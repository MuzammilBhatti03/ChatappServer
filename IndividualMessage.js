const mongoose = require('mongoose');

// Define Individual Message Schema
const individualMessageSchema = new mongoose.Schema({
  senderID: { type: String, required: true }, // ID of the sender
  receiverID: { type: String, required: true }, // ID of the receiver
  content: { type: String, required: true }, // Message content
  createdAt: { type: Date, default: Date.now }, // Timestamp of the message
});

// Create Individual Message Model
const IndividualMessage = mongoose.model('IndividualMessage', individualMessageSchema);

module.exports = IndividualMessage;
