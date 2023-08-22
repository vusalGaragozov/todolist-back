const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  report: String,
  class: String,
  caption: String,
  fsLine: String,
  currency: String
});

const Account = mongoose.model('Account', accountSchema);

module.exports = Account;
