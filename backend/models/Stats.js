const mongoose = require('mongoose');

const VisitorSchema = new mongoose.Schema({
  date: { type: String, default: () => new Date().toISOString().split('T')[0] },
  ip: String,
  totalViews: { type: Number, default: 1 },
  lastVisited: { type: Date, default: Date.now }
});

const StatsSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: { type: Number, default: 0 }
});

const VisitorModel = mongoose.model('Visitor', VisitorSchema);
const StatsModel = mongoose.model('Stats', StatsSchema);

module.exports = { VisitorModel, StatsModel };
