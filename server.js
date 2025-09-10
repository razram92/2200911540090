// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const { nanoid } = require("nanoid");
const dayjs = require("dayjs");
const path = require("path");

const Url = require("./models/Url");
const logger = require("./middlewares/logger");
const errorHandler = require("./middlewares/errorHandler");
const getCountry = require("./utils/geoip");

const app = express();
app.set("trust proxy", true);
app.use(express.json());


app.use(logger);

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/urlshortener";


(async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    logger.info({ event: "mongodb_connected", uri: MONGO_URI });
    app.listen(PORT, () => {
      logger.info({ event: "server_started", port: PORT });
    });
  } catch (err) {
    logger.error({ event: "startup_error", message: err.message, stack: err.stack });
    process.exit(1);
  }
})();


app.post("/shorturls", async (req, res, next) => {
  try {
    const { url, validity, shortcode } = req.body;

    if (!url) return res.status(400).json({ error: "url is required" });

    // validate URL format
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    // validate shortcode if provided
    if (shortcode && !/^[a-zA-Z0-9]+$/.test(shortcode)) {
      return res.status(400).json({ error: "shortcode must be alphanumeric" });
    }

    // choose or generate shortId and ensure uniqueness
    let shortId = shortcode ? String(shortcode) : nanoid(6);
    let found = await Url.findOne({ shortId });
    if (found) {
      // conflict if user-provided shortcode is taken
      if (shortcode) return res.status(409).json({ error: "Shortcode already in use" });

      // otherwise try to generate unique shortcode (a few attempts, increase length)
      let attempts = 0;
      while (found && attempts < 6) {
        shortId = nanoid(6 + attempts); // increase length on each attempt
        found = await Url.findOne({ shortId });
        attempts++;
      }
      if (found) return res.status(500).json({ error: "Failed to generate unique shortcode, try again" });
    }

    // validity: default 30 minutes
    const minutes = Number.isInteger(validity) ? validity : (parseInt(validity) || null);
    const ttl = (minutes && Number.isFinite(minutes) && minutes > 0) ? minutes : 30;
    const expiresAt = dayjs().add(ttl, "minute").toDate();

    const newUrl = new Url({
      shortId,
      originalUrl: url,
      expiresAt
    });

    await newUrl.save();

    return res.status(201).json({
      shortLink: `${req.protocol}://${req.get("host")}/${newUrl.shortId}`,
      expiry: newUrl.expiresAt.toISOString()
    });
  } catch (err) {
    next(err);
  }
});


app.get("/shorturls/:shortcode", async (req, res, next) => {
  try {
    const { shortcode } = req.params;
    const urlDoc = await Url.findOne({ shortId: shortcode }).lean();

    if (!urlDoc) return res.status(404).json({ error: "Shortcode not found" });

    return res.json({
      originalUrl: urlDoc.originalUrl,
      createdAt: urlDoc.createdAt,
      expiry: urlDoc.expiresAt,
      totalClicks: (urlDoc.clicks || []).length,
      clicks: (urlDoc.clicks || []).map(c => ({
        timestamp: c.timestamp,
        referrer: c.referrer || "direct",
        country: c.country || "unknown"
      }))
    });
  } catch (err) {
    next(err);
  }
});

app.get("/:shortId", async (req, res, next) => {
  try {
    const { shortId } = req.params;

    // ensure this route doesn't accidentally capture API endpoints like /shorturls
    if (shortId === "shorturls") return res.status(404).json({ error: "Not found" });

    const urlDoc = await Url.findOne({ shortId });
    if (!urlDoc) return res.status(404).json({ error: "Short URL not found" });

    if (dayjs().isAfter(urlDoc.expiresAt)) {
      return res.status(410).json({ error: "Short URL expired" });
    }

    // gather click metadata
    const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip || "")
      .toString().split(",")[0].trim();
    const referrer = req.get("referer") || req.get("referrer") || "direct";
    const country = getCountry(ip);

    urlDoc.clicks.push({
      timestamp: new Date(),
      referrer,
      ip,
      country
    });

    // persist click (await to ensure it's saved)
    await urlDoc.save();

    return res.redirect(urlDoc.originalUrl);
  } catch (err) {
    next(err);
  }
});

/* global error handler */
app.use(errorHandler);
