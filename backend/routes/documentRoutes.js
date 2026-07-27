const express = require("express");
const multer = require("multer");
const { processImage } = require("../controllers/documentController");
const VerificationStatus = require("../constants/verificationStatus");
const logger = require("../logger");
const { logAudit, logOcrStep, logPerformance } = require("../logger");
const { calculateNameSimilarity } = require("../utils/fuzzyMatch");

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
    const traceId = req.traceId;
    const requestStart = Date.now();

    try {
      logAudit({ traceId, oldStatus: null, newStatus: VerificationStatus.UPLOADED, event: "UPLOAD_RECEIVED" });
      logger.info(`Received KYC form submission: Name="${req.body.name || ""}"`, { traceId });

      if (!req.body.name || (!req.body.aadhaar && !req.body.pan)) {
        logAudit({ traceId, oldStatus: VerificationStatus.UPLOADED, newStatus: VerificationStatus.REJECTED, event: "MISSING_FORM_DATA" });
        return res.status(400).json({
          success: false,
          status: VerificationStatus.REJECTED,
          traceId,
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
        logAudit({ traceId, oldStatus: VerificationStatus.UPLOADED, newStatus: VerificationStatus.REJECTED, event: "NO_FILES_UPLOADED" });
        return res.status(400).json({
          success: false,
          status: VerificationStatus.REJECTED,
          traceId,
          verified: false,
          error: "No document files uploaded",
        });
      }

      logAudit({ traceId, oldStatus: VerificationStatus.UPLOADED, newStatus: VerificationStatus.OCR_PROCESSING, event: "OCR_STARTED" });

      const extractedAadhaar = aadhaarFile ? await processImage(aadhaarFile, traceId) : null;
      const extractedPAN = panFile ? await processImage(panFile, traceId) : null;

      // Case 1: AI Service / OCR engines offline or unconfigured
      const aadhaarUnavailable = !extractedAadhaar || extractedAadhaar.status === VerificationStatus.OCR_UNAVAILABLE;
      const panUnavailable = !extractedPAN || extractedPAN.status === VerificationStatus.OCR_UNAVAILABLE;

      if ((aadhaarFile && aadhaarUnavailable) || (panFile && panUnavailable)) {
        logAudit({ traceId, oldStatus: VerificationStatus.OCR_PROCESSING, newStatus: VerificationStatus.OCR_UNAVAILABLE, event: "OCR_SERVICE_UNAVAILABLE" });
        logPerformance({ traceId, operation: "TOTAL_KYC_VERIFY_REQUEST", durationMs: Date.now() - requestStart });

        return res.json({
          success: true,
          status: VerificationStatus.OCR_UNAVAILABLE,
          traceId,
          message: "Documents uploaded successfully. AI OCR service is not configured.",
          verified: false,
          details: {
            aadhaar: extractedAadhaar?.details || null,
            pan: extractedPAN?.details || null,
          },
        });
      }

      // Case 4: OCR failed to extract text from files
      const aadhaarFailed = extractedAadhaar?.status === VerificationStatus.OCR_FAILED;
      const panFailed = extractedPAN?.status === VerificationStatus.OCR_FAILED;

      if (aadhaarFailed || panFailed) {
        logAudit({ traceId, oldStatus: VerificationStatus.OCR_PROCESSING, newStatus: VerificationStatus.OCR_FAILED, event: "OCR_EXTRACTION_FAILED" });
        logPerformance({ traceId, operation: "TOTAL_KYC_VERIFY_REQUEST", durationMs: Date.now() - requestStart });

        return res.status(400).json({
          success: false,
          status: VerificationStatus.OCR_FAILED,
          traceId,
          message: "OCR extraction failed. Could not read identity text from document image.",
          verified: false,
        });
      }

      // Evaluate field matching
      logAudit({ traceId, oldStatus: VerificationStatus.OCR_PROCESSING, newStatus: VerificationStatus.OCR_COMPLETED, event: "DATA_MATCHING" });

      let mismatches = [];

      // Validate Aadhaar Details
      if (extractedAadhaar?.details) {
        if (extractedAadhaar.details.number && formData.aadhaar && formData.aadhaar !== extractedAadhaar.details.number) {
          mismatches.push("Aadhaar number mismatch.");
        }
        if (extractedAadhaar.details.name) {
          const aadhaarSim = calculateNameSimilarity(formData.name, extractedAadhaar.details.name);
          logOcrStep({ traceId, step: "AADHAAR_NAME_SIMILARITY", confidence: aadhaarSim, message: `Submitted="${formData.name}" OCR="${extractedAadhaar.details.name}"` });
          if (aadhaarSim < 65) {
            mismatches.push("Aadhaar holder name mismatch.");
          }
        }
      }

      // Validate PAN Details
      if (extractedPAN?.details) {
        if (extractedPAN.details.number && formData.pan && formData.pan !== extractedPAN.details.number) {
          mismatches.push("PAN number mismatch.");
        }
        if (extractedPAN.details.name) {
          const panSim = calculateNameSimilarity(formData.name, extractedPAN.details.name);
          logOcrStep({ traceId, step: "PAN_NAME_SIMILARITY", confidence: panSim, message: `Submitted="${formData.name}" OCR="${extractedPAN.details.name}"` });
          if (panSim < 65) {
            mismatches.push("PAN card holder name mismatch.");
          }
        }
      }

      if (mismatches.length > 0) {
        logAudit({ traceId, oldStatus: VerificationStatus.OCR_COMPLETED, newStatus: VerificationStatus.REJECTED, event: "ATTRIBUTE_MISMATCH", details: mismatches.join(" ") });
        logPerformance({ traceId, operation: "TOTAL_KYC_VERIFY_REQUEST", durationMs: Date.now() - requestStart });

        return res.status(400).json({
          success: false,
          status: VerificationStatus.REJECTED,
          traceId,
          message: mismatches.join(" "),
          verified: false,
        });
      }

      // Case 3: All validations passed!
      logAudit({ traceId, oldStatus: VerificationStatus.OCR_COMPLETED, newStatus: VerificationStatus.VERIFIED, event: "VERIFICATION_SUCCESS" });
      logPerformance({ traceId, operation: "TOTAL_KYC_VERIFY_REQUEST", durationMs: Date.now() - requestStart });

      return res.json({
        success: true,
        status: VerificationStatus.VERIFIED,
        traceId,
        message: "KYC Successfully Verified",
        verified: true,
        details: {
          aadhaar: extractedAadhaar?.details || null,
          pan: extractedPAN?.details || null,
        },
      });
    } catch (error) {
      logAudit({ traceId, oldStatus: null, newStatus: VerificationStatus.REJECTED, event: "SERVER_ERROR", details: error.message });
      logger.error(`Server Error in /verify: ${error.stack || error.message}`, { traceId });
      return res.status(500).json({
        success: false,
        status: VerificationStatus.REJECTED,
        traceId,
        message: "Internal server error during verification",
        verified: false,
      });
    }
  }
);

// Endpoint 2: POST /api/process (used by AadhaarPanForm)
router.post("/process", upload.single("file"), async (req, res) => {
  const traceId = req.traceId;
  try {
    logAudit({ traceId, oldStatus: null, newStatus: VerificationStatus.UPLOADED, event: "SINGLE_FILE_UPLOAD" });

    if (!req.file) {
      return res.status(400).json({
        success: false,
        status: VerificationStatus.REJECTED,
        traceId,
        message: "No file uploaded",
        verified: false,
      });
    }

    const result = await processImage(req.file, traceId);
    if (!result || !result.success || result.status === VerificationStatus.OCR_FAILED) {
      logAudit({ traceId, oldStatus: VerificationStatus.UPLOADED, newStatus: VerificationStatus.OCR_FAILED, event: "SINGLE_FILE_OCR_FAILED" });
      return res.status(400).json({
        success: false,
        status: result?.status || VerificationStatus.OCR_FAILED,
        traceId,
        message: result?.error || "OCR processing failed",
        verified: false,
      });
    }

    if (result.status === VerificationStatus.OCR_UNAVAILABLE) {
      logAudit({ traceId, oldStatus: VerificationStatus.UPLOADED, newStatus: VerificationStatus.OCR_UNAVAILABLE, event: "SINGLE_FILE_OCR_UNAVAILABLE" });
      return res.json({
        success: true,
        status: VerificationStatus.OCR_UNAVAILABLE,
        traceId,
        message: "Document uploaded successfully. AI OCR service is not configured.",
        verified: false,
        details: null,
      });
    }

    logAudit({ traceId, oldStatus: VerificationStatus.UPLOADED, newStatus: VerificationStatus.OCR_COMPLETED, event: "SINGLE_FILE_OCR_SUCCESS" });
    return res.json({
      success: true,
      status: VerificationStatus.OCR_COMPLETED,
      traceId,
      message: "Document text extracted successfully",
      verified: false,
      details: result.details,
    });
  } catch (error) {
    logger.error(`Server Error in /process: ${error.stack || error.message}`, { traceId });
    return res.status(500).json({
      success: false,
      status: VerificationStatus.REJECTED,
      traceId,
      message: "Internal server error",
      verified: false,
    });
  }
});

module.exports = router;
