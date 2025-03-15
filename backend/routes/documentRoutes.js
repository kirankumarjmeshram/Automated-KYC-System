const express = require("express");
const multer = require("multer");
const { processImage } = require("../controllers/documentController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/verify", upload.fields([{ name: "aadhaarFile" }, { name: "panFile" }]), async (req, res) => {
  try {
    console.log("Received Form Data:", req.body);
    console.log("Files Uploaded:", req.files);

    if (!req.body.name || !req.body.aadhaar || !req.body.pan) {
      return res.status(400).json({ success: false, error: "Missing form data" });
    }

    const formData = {
      name: req.body.name.trim().toUpperCase(),
      aadhaar: req.body.aadhaar.trim(),
      pan: req.body.pan.trim(),
    };

    if (!req.files || (!req.files.aadhaarFile && !req.files.panFile)) {
      return res.status(400).json({ success: false, error: "No files uploaded" });
    }

    const extractedAadhaar = req.files.aadhaarFile ? await processImage(req.files.aadhaarFile[0]) : null;
    const extractedPAN = req.files.panFile ? await processImage(req.files.panFile[0]) : null;

    let mismatches = [];
    let aadhaarNameMatch = false;
    let panNameMatch = false;

    if (extractedAadhaar?.success) {
      if (formData.aadhaar !== extractedAadhaar.details.number) {
        mismatches.push("Aadhaar number mismatch.");
      }
      if (extractedAadhaar.details.name.toUpperCase().includes(formData.name)) {
        aadhaarNameMatch = true;
      }
    } else {
      mismatches.push("Aadhaar extraction failed.");
    }

    if (extractedPAN?.success) {
      if (formData.pan !== extractedPAN.details.number) {
        mismatches.push("PAN number mismatch.");
      }
      if (extractedPAN.details.name.toUpperCase().includes(formData.name)) {
        panNameMatch = true;
      }
    } else {
      mismatches.push("PAN extraction failed.");
    }

    if (!aadhaarNameMatch && !panNameMatch) {
      mismatches.push("Name does not match with Aadhaar or PAN.");
    }

    if (mismatches.length > 0) {
      return res.status(400).json({ success: false, error: mismatches });
    }

    res.json({ success: true, message: "KYC Verified Successfully!" });
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

module.exports = router;
