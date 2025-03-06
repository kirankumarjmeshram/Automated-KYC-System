require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const documentRoutes = require("./routes/documentRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api", documentRoutes);

// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
