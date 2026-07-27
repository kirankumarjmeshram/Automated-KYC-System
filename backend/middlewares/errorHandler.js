const logger = require("../logger");

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  // Log error using Winston logger
  logger.error(`[${req.method}] ${req.originalUrl} - ${err.message}`, {
    statusCode: err.statusCode,
    stack: err.stack,
  });

  // Operational, trusted error: send message to client
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
  }

  // Database CastError (Invalid ID)
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      error: `Invalid ${err.path}: ${err.value}`,
    });
  }

  // Database Duplicate key
  if (err.code === 11000) {
    const value = Object.keys(err.keyValue).join(", ");
    return res.status(400).json({
      success: false,
      error: `Duplicate field value: ${value}`,
    });
  }

  // Database ValidationError
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((el) => el.message);
    return res.status(400).json({
      success: false,
      error: "Invalid input data",
      details: errors,
    });
  }

  // Programming or non-operational error: don't leak stack traces in production
  return res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === "production" 
      ? "Internal server error" 
      : err.message,
  });
};

module.exports = errorHandler;
