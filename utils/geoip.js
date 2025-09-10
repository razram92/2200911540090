// utils/geoip.js
const geoip = require("geoip-lite");

module.exports = function getCountry(ip) {
  try {
    if (!ip) return "unknown";
    // remove IPv6 prefix if present
    const cleaned = ip.split(",")[0].trim().replace(/^.*:/, (m) => m);
    const geo = geoip.lookup(cleaned);
    return (geo && geo.country) ? geo.country : "unknown";
  } catch (e) {
    return "unknown";
  }
};
