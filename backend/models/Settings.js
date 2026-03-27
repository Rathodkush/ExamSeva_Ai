const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  websiteName: { type: String, default: 'ExamSeva' },
  logoUrl: { type: String, default: '' },
  contactEmail: { type: String, default: 'support@examseva.com' },
  contactPhone: { type: String, default: '022-05200' },
  contactAddress: { type: String, default: '123 Education Street, Mumbai City,   400105' },
  aboutUs: { type: String, default: '' },
  footerLinks: [{
    title: String,
    url: String
  }],
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Settings', SettingsSchema);
