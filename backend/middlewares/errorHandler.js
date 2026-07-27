const logger = require("../logger");

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  // Log error details for engineering review
  logger.error(`[${req.method}] ${req.originalUrl} - ${err.message}`, {
    stack: err.stack,
    statusCode: err.statusCode,
  });

  // Operational, trusted error: send user-friendly message to client
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
  }

  // Handle Mongoose Validation Errors
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((el) => el.message);
    return res.status(400).json({
      success: false,
      error: "Invalid input data",
      details: errors,
    });
  }

  // Handle Mongoose Duplicate Key Error
  if (err.code === 11000) {
    const value = Object.keys(err.keyValue).join(", ");
    return res.status(400).json({
      success: false,
      error: `Duplicate field value entered for: ${value}`,
    });
  }

  // Programming or unknown error: don't leak stack trace in production
  return res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === "production" 
      ? "Internal server error" 
      : err.message,
  });
};

module.exports = errorHandler;
