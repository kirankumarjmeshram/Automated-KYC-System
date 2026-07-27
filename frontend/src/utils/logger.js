/**
 * Frontend Centralized Debug Logger
 * Controls logging output and formats traceId for API requests.
 */
const isProduction = process.env.NODE_ENV === "production";

export const generateTraceId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "ft-" + Math.random().toString(36).substring(2, 11) + "-" + Date.now();
};

export const logger = {
  debug: (message, context = {}) => {
    if (!isProduction) {
      console.log(`[DEBUG] ${message}`, context);
    }
  },
  info: (message, context = {}) => {
    if (!isProduction) {
      console.info(`[INFO] ${message}`, context);
    }
  },
  warn: (message, context = {}) => {
    if (!isProduction) {
      console.warn(`[WARN] ${message}`, context);
    }
  },
  error: (message, context = {}) => {
    // Errors are always logged
    console.error(`[ERROR] ${message}`, context);
  },
};
