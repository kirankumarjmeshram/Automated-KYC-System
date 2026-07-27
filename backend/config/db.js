const mongoose = require("mongoose");
const env = require("./env");
const logger = require("../logger");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on("error", (err) => {
      logger.error(`MongoDB connection error: ${err}`);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected. Reconnecting...");
    });
  } catch (error) {
    logger.error(`MongoDB initial connection error: ${error.message}`);
    logger.warn("Server will continue without database connection.");
  }
};

module.exports = connectDB;
