const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  event_type: { type: String, required: true },
  user_id: { type: String, required: true },
  session_id: { type: String, required: true },
  timestamp: { type: Date, required: true },
  event_data: {
    userAgent: String,
    referrer: String,
    url: String,
    element: String,
    text: String,
    duration: Number,
    pages: Number,
    interactions: Number,
    bounced: Boolean,
    type: String,
    step: String,
    label: String,
    load_time: Number,
    dom_content_loaded: Number,
    returning: Boolean,
  },
});

module.exports = mongoose.model('Event', EventSchema);