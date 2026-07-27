const express = require("express");
const multer = require("multer");
const { processImage } = require("../controllers/documentController");
const VerificationStatus = require("../constants/verificationStatus");
const logger = require("../logger");

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
      logger.info(`[${VerificationStatus.UPLOADED}] Received KYC form submission: Name="${req.body.name || ""}", Aadhaar="${req.body.aadhaar || ""}", PAN="${req.body.pan || ""}"`);

      if (!req.body.name || (!req.body.aadhaar && !req.body.pan)) {
        return res.status(400).json({
          success: false,
          status: VerificationStatus.REJECTED,
          verified: false,
          error: "Missing required form parameters (name, aadhaar/pan)",
        });
      }

      const formData = {
        name: req.body.name ? req.body.name.trim().toUpperCase() : "",
        aadhaar: req.body.aadhaar ? req.body.aadhaar.trim().replace(/\s/g, "") : "",
        pan: req.body.pan ? req.body.pan.trim().toUpperCase() : "",
      };

      const aadhaarFile = req.files?.aadhaarFile ? req.files.aadhaarFile[0] : (req.files?.file ? req.files.file[0] : null);
      const panFile = req.files?.panFile ? req.files.panFile[0] : null;

      if (!aadhaarFile && !panFile) {
        return res.status(400).json({
          success: false,
          status: VerificationStatus.REJECTED,
          verified: false,
          error: "No document files uploaded",
        });
      }

      logger.info(`[${VerificationStatus.OCR_PROCESSING}] Initiating OCR processing pipeline...`);

      const extractedAadhaar = aadhaarFile ? await processImage(aadhaarFile) : null;
      const extractedPAN = panFile ? await processImage(panFile) : null;

      // Check Case 1: AI Service / OCR engines offline or unconfigured
      const aadhaarUnavailable = !extractedAadhaar || extractedAadhaar.status === VerificationStatus.OCR_UNAVAILABLE;
      const panUnavailable = !extractedPAN || extractedPAN.status === VerificationStatus.OCR_UNAVAILABLE;

      if ((aadhaarFile && aadhaarUnavailable) || (panFile && panUnavailable)) {
        logger.info(`[${VerificationStatus.OCR_UNAVAILABLE}] AI OCR service unavailable. Returning UPLOADS_RECEIVED state.`);
        return res.json({
          success: true,
          status: VerificationStatus.OCR_UNAVAILABLE,
          message: "Documents uploaded successfully. AI OCR service is not configured.",
          verified: false,
          details: {
            aadhaar: extractedAadhaar?.details || null,
            pan: extractedPAN?.details || null,
          },
        });
      }

      // Check Case 4: OCR failed to extract text from files
      const aadhaarFailed = extractedAadhaar?.status === VerificationStatus.OCR_FAILED;
      const panFailed = extractedPAN?.status === VerificationStatus.OCR_FAILED;

      if (aadhaarFailed || panFailed) {
        logger.warn(`[${VerificationStatus.OCR_FAILED}] OCR extraction failed on uploaded document images.`);
        return res.status(400).json({
          success: false,
          status: VerificationStatus.OCR_FAILED,
          message: "OCR extraction failed. Could not read identity text from document image.",
          verified: false,
        });
      }

      // Perform real field validation on extracted details
      logger.info(`[${VerificationStatus.OCR_COMPLETED}] Evaluating extracted OCR document attributes...`);
      let mismatches = [];
      let aadhaarMatched = false;
      let panMatched = false;

      if (extractedAadhaar?.details && extractedAadhaar.details.number) {
        if (formData.aadhaar && formData.aadhaar !== extractedAadhaar.details.number) {
          mismatches.push("Aadhaar number mismatch.");
        } else {
          aadhaarMatched = true;
        }
      }

      if (extractedPAN?.details && extractedPAN.details.number) {
        if (formData.pan && formData.pan !== extractedPAN.details.number) {
          mismatches.push("PAN number mismatch.");
        } else {
          panMatched = true;
        }
      }

      if (mismatches.length > 0) {
        logger.warn(`[${VerificationStatus.REJECTED}] Verification rejected due to attribute mismatch: ${mismatches.join(" ")}`);
        return res.status(400).json({
          success: false,
          status: VerificationStatus.REJECTED,
          message: mismatches.join(" "),
          verified: false,
        });
      }

      // Case 3: All validations passed!
      logger.info(`[${VerificationStatus.VERIFIED}] KYC successfully verified! All document attributes matched.`);
      return res.json({
        success: true,
        status: VerificationStatus.VERIFIED,
        message: "KYC Successfully Verified",
        verified: true,
        details: {
          aadhaar: extractedAadhaar?.details || null,
          pan: extractedPAN?.details || null,
        },
      });
    } catch (error) {
      logger.error(`Server Error in /verify: ${error.stack || error.message}`);
      return res.status(500).json({
        success: false,
        status: VerificationStatus.REJECTED,
        message: "Internal server error during verification",
        verified: false,
      });
    }
  }
);

// Endpoint 2: POST /api/process (used by AadhaarPanForm)
router.post("/process", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        status: VerificationStatus.REJECTED,
        message: "No file uploaded",
        verified: false,
      });
    }

    const result = await processImage(req.file);
    if (!result || !result.success || result.status === VerificationStatus.OCR_FAILED) {
      return res.status(400).json({
        success: false,
        status: result?.status || VerificationStatus.OCR_FAILED,
        message: result?.error || "OCR processing failed",
        verified: false,
      });
    }

    if (result.status === VerificationStatus.OCR_UNAVAILABLE) {
      return res.json({
        success: true,
        status: VerificationStatus.OCR_UNAVAILABLE,
        message: "Document uploaded successfully. AI OCR service is not configured.",
        verified: false,
        details: null,
      });
    }

    return res.json({
      success: true,
      status: VerificationStatus.OCR_COMPLETED,
      message: "Document text extracted successfully",
      verified: false,
      details: result.details,
    });
  } catch (error) {
    logger.error(`Server Error in /process: ${error.stack || error.message}`);
    return res.status(500).json({
      success: false,
      status: VerificationStatus.REJECTED,
      message: "Internal server error",
      verified: false,
    });
  }
});

module.exports = router;
