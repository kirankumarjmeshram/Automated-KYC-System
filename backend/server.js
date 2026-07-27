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

// Connect to MongoDB
connectDB();

// Security HTTP Headers
app.use(helmet());

// Strict CORS Configuration
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// General Rate Limiter (100 requests per 15 minutes)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: "Too many requests from this IP, please try again later.",
  },
});
app.use("/api", limiter);

// Body Parsing Middlewares
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health Check Endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api", documentRoutes);

// 404 Route Handler
app.use("*", (req, res, next) => {
  res.status(404).json({
    success: false,
    error: `Cannot find ${req.originalUrl} on this server`,
  });
});

// Global Centralized Error Handler
app.use(errorHandler);

const PORT = env.PORT;
const server = app.listen(PORT, () => {
  logger.info(`Server running in ${env.NODE_ENV} mode on port ${PORT}`);
});

// Unhandled Promise Rejections Handling
process.on("unhandledRejection", (err) => {
  logger.error(`UNHANDLED REJECTION! Shutting down... ${err.name}: ${err.message}`);
  server.close(() => {
    process.exit(1);
  });
});

