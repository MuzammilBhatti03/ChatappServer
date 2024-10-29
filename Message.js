const mongoose = require('mongoose');

// Define Message Schema
const messageSchema = new mongoose.Schema({
  userID: { type: String, required: true },
  username: { type: String, required: true },
  content: { type: String, required: true },
  forumID: { type: mongoose.Schema.Types.ObjectId, ref: 'Forum', required: true },
  createdAt: { type: Date, default: Date.now },
});


// Create Message Model
const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
