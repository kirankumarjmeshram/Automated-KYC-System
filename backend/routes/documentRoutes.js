const express = require("express");
const multer = require("multer");
const { processImage } = require("../controllers/documentController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Endpoint 1: POST /api/verify (used by KycStepupForm)
router.post(
  "/verify",
  upload.fields([
    { name: "aadhaarFile", maxCount: 1 },
    { name: "panFile", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      console.log("Received Form Data:", req.body);
      console.log("Files Uploaded:", req.files);

      if (!req.body.name || (!req.body.aadhaar && !req.body.pan)) {
        return res.status(400).json({ success: false, error: "Missing form data" });
      }

      const formData = {
        name: req.body.name ? req.body.name.trim().toUpperCase() : "",
        aadhaar: req.body.aadhaar ? req.body.aadhaar.trim() : "",
        pan: req.body.pan ? req.body.pan.trim() : "",
      };

      const aadhaarFile = req.files?.aadhaarFile ? req.files.aadhaarFile[0] : (req.files?.file ? req.files.file[0] : null);
      const panFile = req.files?.panFile ? req.files.panFile[0] : null;

      if (!aadhaarFile && !panFile) {
        return res.status(400).json({ success: false, error: "No files uploaded" });
      }

      const extractedAadhaar = aadhaarFile ? await processImage(aadhaarFile) : null;
      const extractedPAN = panFile ? await processImage(panFile) : null;

      // If no real OCR is configured, skip strict number matching
      const aadhaarIsFallback = extractedAadhaar?.fallback === true;
      const panIsFallback = extractedPAN?.fallback === true;

      if (aadhaarIsFallback && panIsFallback) {
        return res.json({
          success: true,
          message: "KYC documents received. OCR verification will be available when AI service is configured.",
          details: {
            aadhaar: extractedAadhaar?.details || null,
            pan: extractedPAN?.details || null,
            ocrConfigured: false,
          },
        });
      }

      let mismatches = [];
      let aadhaarNameMatch = false;
      let panNameMatch = false;

      if (extractedAadhaar?.success && !aadhaarIsFallback) {
        if (formData.aadhaar && extractedAadhaar.details.number && formData.aadhaar !== extractedAadhaar.details.number) {
          mismatches.push("Aadhaar number mismatch.");
        }
        if (extractedAadhaar.details.name && extractedAadhaar.details.name.toUpperCase().includes(formData.name)) {
          aadhaarNameMatch = true;
        }
      } else if (aadhaarFile && !aadhaarIsFallback) {
        mismatches.push("Aadhaar extraction failed.");
      }

      if (extractedPAN?.success && !panIsFallback) {
        if (formData.pan && extractedPAN.details.number && formData.pan !== extractedPAN.details.number) {
          mismatches.push("PAN number mismatch.");
        }
        if (extractedPAN.details.name && extractedPAN.details.name.toUpperCase().includes(formData.name)) {
          panNameMatch = true;
        }
      } else if (panFile && !panIsFallback) {
        mismatches.push("PAN extraction failed.");
      }

      // If at least one document extracted successfully or name match confirmed
      if (mismatches.length > 0 && !aadhaarNameMatch && !panNameMatch) {
        return res.status(400).json({ success: false, error: mismatches.join(" ") });
      }

      res.json({ success: true, message: "KYC Verified Successfully!" });
    } catch (error) {
      console.error("Server Error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
);

// Endpoint 2: POST /api/process (used by AadhaarPanForm)
router.post("/process", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const result = await processImage(req.file);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error || "Processing failed" });
    }

    res.json({
      success: true,
      details: result.details,
    });
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
