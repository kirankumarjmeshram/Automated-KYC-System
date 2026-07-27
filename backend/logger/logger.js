const winston = require("winston");
const path = require("path");
const fs = require("fs");

const logDir = path.join(__dirname, "..", "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Configurable Log Level (default: info, or process.env.LOG_LEVEL)
const getLogLevel = () => {
  if (process.env.LOG_LEVEL) return process.env.LOG_LEVEL.toLowerCase();
  return process.env.NODE_ENV === "production" ? "info" : "debug";
};

const customFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  winston.format.printf(({ timestamp, level, message, traceId }) => {
    const traceStr = traceId ? ` [TraceID=${traceId}]` : "";
    return `${timestamp} [${level.toUpperCase()}]${traceStr}: ${message}`;
  })
);

const logger = winston.createLogger({
  level: getLogLevel(),
  format: customFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, "application.log"),
      maxsize: 10 * 1024 * 1024, // 10MB rotation
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, traceId }) => {
          const traceStr = traceId ? ` [TraceID=${traceId}]` : "";
          return `${timestamp} [${level}]${traceStr}: ${message}`;
        })
      ),
    }),
  ],
});

module.exports = logger;
