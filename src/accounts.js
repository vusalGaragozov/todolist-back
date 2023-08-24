const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    userName: {
        type: String,
        required: true,
      },
  report: String,
  accountClass: String,
  caption: String,
  fsLine: String,
  currency: String
});

const Account = mongoose.model('Account', accountSchema);

module.exports = Account;
