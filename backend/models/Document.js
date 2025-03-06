const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema({
  type: String, 
  name: String,
  number: String,
  dob: String,
  extractedText: String,
  imagePath: String,
});

module.exports = mongoose.model("Document", DocumentSchema);
