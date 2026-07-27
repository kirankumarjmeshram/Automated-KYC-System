const winston = require("winston");
const path = require("path");

const logDir = path.join(__dirname, "..", "logs");

const auditWinston = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    winston.format.printf(({ timestamp, message }) => `${timestamp} ${message}`)
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, "audit.log") }),
  ],
});

/**
 * Audit Logger
 * Logs lifecycle state transitions and audit timeline events.
 */
const logAudit = ({ traceId, oldStatus, newStatus, event, details = "" }) => {
  const transition = oldStatus ? `${oldStatus} -> ${newStatus}` : newStatus;
  const detailsStr = details ? ` Details="${details}"` : "";
  const logLine = `[AUDIT] TraceID=${traceId} Event=${event || "STATUS_TRANSITION"} StatusTransition=[${transition}]${detailsStr}`;
  
  auditWinston.info(logLine);
};

module.exports = { logAudit };
