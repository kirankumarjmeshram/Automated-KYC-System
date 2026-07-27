const crypto = require("crypto");
const winston = require("winston");
const path = require("path");

const logDir = path.join(__dirname, "..", "logs");

const requestWinston = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    winston.format.printf(({ timestamp, message }) => `${timestamp} ${message}`)
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, "requests.log") }),
  ],
});

const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Extract or generate Trace ID
  const traceId = req.headers["x-trace-id"] || req.headers["traceid"] || crypto.randomUUID();
  req.traceId = traceId;
  res.setHeader("x-trace-id", traceId);

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    const userAgent = req.headers["user-agent"] || "Unknown";
    const status = res.statusCode;

    const logLine = `[INFO] TraceID=${traceId} Method=${req.method} Path=${req.originalUrl || req.url} Status=${status} Duration=${duration}ms IP=${ip} UserAgent="${userAgent}"`;
    requestWinston.info(logLine);
  });

  next();
};

module.exports = requestLogger;
