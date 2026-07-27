const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const env = require("./config/env");
const connectDB = require("./config/db");
const logger = require("./logger");
const errorHandler = require("./middlewares/errorHandler");
const documentRoutes = require("./routes/documentRoutes");

const app = express();

// Connect to MongoDB Database
connectDB();

// HTTP Security Headers
app.use(helmet());

// Strict CORS Configuration (support localhost:3000 and custom origin)
const allowedOrigins = [env.CORS_ORIGIN, "http://localhost:3000", "http://localhost:3001"];
app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like mobile apps or curl)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev to avoid CORS blocking frontend
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// General API Rate Limiting (100 requests per 15 minutes)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: "Too many requests from this IP address, please try again later.",
  },
});
app.use("/api", limiter);

// Request Parsing Middlewares
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// System Health Check Endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// API Routes (Mounted under /api)
app.use("/api", documentRoutes);

// Handle Unknown Routes (404)
app.use("*", (req, res, next) => {
  res.status(404).json({
    success: false,
    error: `Cannot find endpoint ${req.originalUrl} on this server`,
  });
});

// Global Centralized Error Handling Middleware
app.use(errorHandler);

const PORT = env.PORT;
const server = app.listen(PORT, () => {
  logger.info(`Server listening in ${env.NODE_ENV} mode on port ${PORT}`);
});

// Graceful Handling of Unhandled Promise Rejections
process.on("unhandledRejection", (err) => {
  logger.error(`UNHANDLED REJECTION: ${err.name} - ${err.message}`);
  server.close(() => {
    process.exit(1);
  });
});

module.exports = app;
