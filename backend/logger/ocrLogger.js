const winston = require("winston");
const path = require("path");

const logDir = path.join(__dirname, "..", "logs");

const ocrWinston = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    winston.format.printf(({ timestamp, message }) => `${timestamp} ${message}`)
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, "ocr.log") }),
  ],
});

/**
 * OCR Step Logger
 * Tracks granular OCR pipeline steps.
 */
const logOcrStep = ({ traceId, step, fileName = "", ocrEngine = "none", confidence = 0, message = "" }) => {
  const fileStr = fileName ? ` File="${fileName}"` : "";
  const engineStr = ocrEngine ? ` Engine=${ocrEngine}` : "";
  const confStr = confidence ? ` Confidence=${confidence.toFixed(2)}` : "";
  const msgStr = message ? ` Message="${message}"` : "";

  const logLine = `[OCR_PIPELINE] TraceID=${traceId} Step=${step}${fileStr}${engineStr}${confStr}${msgStr}`;
  ocrWinston.info(logLine);
};

module.exports = { logOcrStep };
