const mongoose = require("mongoose");
const env = require("./env");
const logger = require("../logger");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on("error", (err) => {
      logger.error(`MongoDB runtime connection error: ${err}`);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected. Attempting to reconnect...");
    });
  } catch (error) {
    logger.error(`MongoDB Initial Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
