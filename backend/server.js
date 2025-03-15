require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const documentRoutes = require("./routes/documentRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", documentRoutes);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
