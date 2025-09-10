// models/Url.js
const mongoose = require("mongoose");

const ClickSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  referrer: { type: String, default: "direct" },
  ip: { type: String, default: "" },
  country: { type: String, default: "unknown" }
}, { _id: false });

const UrlSchema = new mongoose.Schema({
  shortId: { type: String, required: true, unique: true }, 
  originalUrl: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  clicks: { type: [ClickSchema], default: [] }
});


module.exports = mongoose.model("Url", UrlSchema);

