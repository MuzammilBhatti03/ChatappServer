// Forum.js
const mongoose = require('mongoose');


const forumSchema = new mongoose.Schema({
  id: { type: String, required: true }, // Ensure this is a string
  title: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, required: true },
}, { collection: 'Forum' });

const Forum = mongoose.model('Forum', forumSchema);

module.exports = Forum;
