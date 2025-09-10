// middlewares/logger.js
const fs = require("fs");
const path = require("path");

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, "../logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const ACCESS_LOG = path.join(LOG_DIR, "access.log");
const ERROR_LOG = path.join(LOG_DIR, "error.log");

function append(file, obj) {
  try {
    fs.appendFile(file, JSON.stringify(obj) + "\n", () => {});
  } catch (e) {
    // swallow; don't console.log (challenge forbids console logging)
  }
}

function middleware(req, res, next) {
  const start = Date.now();
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip || "")
    .toString().split(",")[0].trim();

  res.on("finish", () => {
    const log = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      responseTimeMs: Date.now() - start,
      ip
    };
    append(ACCESS_LOG, log);
  });

  next();
}

// helper to write info or errors from code
middleware.info = (obj) => append(ACCESS_LOG, Object.assign({ timestamp: new Date().toISOString() }, obj));
middleware.error = (obj) => append(ERROR_LOG, Object.assign({ timestamp: new Date().toISOString() }, obj));

module.exports = middleware;
