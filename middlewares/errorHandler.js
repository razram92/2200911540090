// middlewares/errorHandler.js
const logger = require("./logger");

module.exports = (err, req, res, next) => {
  // log error to error log
  logger.error({
    message: err.message || "Internal Server Error",
    stack: err.stack || null,
    path: req.originalUrl
  });

  const status = err.statusCode || 500;
  res.status(status).json({ error: err.message || "Internal Server Error" });
};
