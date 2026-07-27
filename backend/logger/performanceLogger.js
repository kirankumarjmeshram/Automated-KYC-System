const winston = require("winston");
const path = require("path");

const logDir = path.join(__dirname, "..", "logs");

const perfWinston = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    winston.format.printf(({ timestamp, message }) => `${timestamp} ${message}`)
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, "performance.log") }),
  ],
});

/**
 * Performance Logger
 * Measures and logs component timings and memory metrics.
 */
const logPerformance = ({ traceId, operation, durationMs, memoryUsageMb = null, details = "" }) => {
  const memStr = memoryUsageMb ? ` MemoryUsage=${memoryUsageMb}MB` : "";
  const detailsStr = details ? ` Details="${details}"` : "";
  const memInfo = process.memoryUsage();
  const heapMb = (memInfo.heapUsed / 1024 / 1024).toFixed(2);

  const logLine = `[PERFORMANCE] TraceID=${traceId} Operation=${operation} Duration=${durationMs}ms HeapUsed=${heapMb}MB${memStr}${detailsStr}`;
  perfWinston.info(logLine);
};

module.exports = { logPerformance };
