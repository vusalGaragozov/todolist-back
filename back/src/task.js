const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  listNumber: Number,
  shortDescription: String,
  longDescription: String,
  deadline: Date,
  priority: String,
  assignedBy: String,
});



const Task = mongoose.model('Task', taskSchema);

module.exports = Task;