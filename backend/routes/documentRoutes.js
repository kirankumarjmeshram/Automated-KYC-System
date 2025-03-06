const express = require("express");
const multer = require("multer");
const { processImage } = require("../controllers/documentController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/process", upload.single("file"), async (req, res) => {
  const result = await processImage(req.file);
  res.json(result);
});

module.exports = router;
