const express = require("express");
const multer = require("multer");
const { processImage } = require("../controllers/documentController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/process", upload.fields([{ name: "aadhaarFile" }, { name: "panFile" }]), async (req, res) => {
  try {
    if (!req.files || (!req.files.aadhaarFile && !req.files.panFile)) {
      return res.status(400).json({ success: false, error: "Files are required." });
    }

    const formData = {
      name: req.body.name.trim().toUpperCase(),
      aadhaar: req.body.aadhaar.trim(),
      pan: req.body.pan.trim(),
    };

    console.log("Received Form Data:", formData);

    let aadhaarDetails = { success: false, details: {} };
    let panDetails = { success: false, details: {} };

    if (req.files.aadhaarFile) {
      aadhaarDetails = await processImage(req.files.aadhaarFile[0]);
    }

    if (req.files.panFile) {
      panDetails = await processImage(req.files.panFile[0]);
    }

    console.log("Extracted Aadhaar Details:", aadhaarDetails);
    console.log("Extracted PAN Details:", panDetails);

    let mismatches = [];

    // Aadhaar Validation
    if (aadhaarDetails.success) {
      const extractedAadhaarName = aadhaarDetails.details.name.trim().toUpperCase();
      if (!extractedAadhaarName.includes(formData.name)) {
        mismatches.push("Name does not match with Aadhaar");
      }
      if (formData.aadhaar !== aadhaarDetails.details.number) {
        mismatches.push(`Aadhaar number mismatch: Extracted=${aadhaarDetails.details.number}, Provided=${formData.aadhaar}`);
      }
    } else {
      mismatches.push("Aadhaar extraction failed.");
    }

    // PAN Validation
    if (panDetails.success) {
      const extractedPanName = panDetails.details.name.trim().toUpperCase();
      if (!extractedPanName.includes(formData.name)) {
        mismatches.push("Name does not match with PAN");
      }
      if (formData.pan !== panDetails.details.number) {
        mismatches.push(`PAN number mismatch: Extracted=${panDetails.details.number}, Provided=${formData.pan}`);
      }
    } else {
      mismatches.push("PAN extraction failed.");
    }

    if (mismatches.length === 0) {
      return res.json({ success: true, message: "KYC Verified Successfully!" });
    } else {
      return res.json({ success: false, error: mismatches.join(", ") });
    }
  } catch (error) {
    console.error("Error processing KYC:", error);
    res.status(500).json({ success: false, error: "Internal server error." });
  }
});

module.exports = router;
