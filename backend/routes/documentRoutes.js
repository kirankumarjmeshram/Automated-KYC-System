const express = require("express");
const multer = require("multer");
const { processImage } = require("../controllers/documentController");
const VerificationStatus = require("../constants/verificationStatus");
const logger = require("../logger");
const { logAudit, logOcrStep, logPerformance } = require("../logger");
const { calculateNameSimilarity } = require("../utils/fuzzyMatch");
const { buildVerificationReport } = require("../utils/verificationReportBuilder");

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
    const timeline = [];

    const addTimelineStep = (statusStep) => {
      timeline.push({ status: statusStep, timestamp: new Date().toISOString() });
    };

    try {
      addTimelineStep(VerificationStatus.UPLOADED);
      logAudit({ traceId, oldStatus: null, newStatus: VerificationStatus.UPLOADED, event: "UPLOAD_RECEIVED" });
      logger.info(`Received KYC form submission: Name="${req.body.name || ""}"`, { traceId });

      if (!req.body.name || (!req.body.aadhaar && !req.body.pan)) {
        addTimelineStep(VerificationStatus.REJECTED);
        logAudit({ traceId, oldStatus: VerificationStatus.UPLOADED, newStatus: VerificationStatus.REJECTED, event: "MISSING_FORM_DATA" });

        const report = buildVerificationReport({
          traceId,
          status: VerificationStatus.REJECTED,
          verified: false,
          message: "Missing required form parameters (name, aadhaar/pan)",
          startTime: requestStart,
          submittedData: { name: req.body.name, aadhaar: req.body.aadhaar, pan: req.body.pan },
          mismatches: ["Missing required form parameters"],
          timeline,
        });

        return res.status(400).json(report);
      }

      const formData = {
        name: req.body.name ? req.body.name.trim().toUpperCase() : "",
        aadhaar: req.body.aadhaar ? req.body.aadhaar.trim().replace(/\s/g, "") : "",
        pan: req.body.pan ? req.body.pan.trim().toUpperCase() : "",
      };

      const aadhaarFile = req.files?.aadhaarFile ? req.files.aadhaarFile[0] : (req.files?.file ? req.files.file[0] : null);
      const panFile = req.files?.panFile ? req.files.panFile[0] : null;

      if (!aadhaarFile && !panFile) {
        addTimelineStep(VerificationStatus.REJECTED);
        logAudit({ traceId, oldStatus: VerificationStatus.UPLOADED, newStatus: VerificationStatus.REJECTED, event: "NO_FILES_UPLOADED" });

        const report = buildVerificationReport({
          traceId,
          status: VerificationStatus.REJECTED,
          verified: false,
          message: "No document files uploaded",
          startTime: requestStart,
          submittedData: formData,
          mismatches: ["No document files uploaded"],
          timeline,
        });

        return res.status(400).json(report);
      }

      addTimelineStep(VerificationStatus.OCR_PROCESSING);
      logAudit({ traceId, oldStatus: VerificationStatus.UPLOADED, newStatus: VerificationStatus.OCR_PROCESSING, event: "OCR_STARTED" });

      const extractedAadhaar = aadhaarFile ? await processImage(aadhaarFile, traceId) : null;
      const extractedPAN = panFile ? await processImage(panFile, traceId) : null;

      // Case 1: AI Service / OCR engines offline or unconfigured
      const aadhaarUnavailable = !extractedAadhaar || extractedAadhaar.status === VerificationStatus.OCR_UNAVAILABLE;
      const panUnavailable = !extractedPAN || extractedPAN.status === VerificationStatus.OCR_UNAVAILABLE;

      if ((aadhaarFile && aadhaarUnavailable) || (panFile && panUnavailable)) {
        addTimelineStep(VerificationStatus.OCR_UNAVAILABLE);
        logAudit({ traceId, oldStatus: VerificationStatus.OCR_PROCESSING, newStatus: VerificationStatus.OCR_UNAVAILABLE, event: "OCR_SERVICE_UNAVAILABLE" });
        logPerformance({ traceId, operation: "TOTAL_KYC_VERIFY_REQUEST", durationMs: Date.now() - requestStart });

        const report = buildVerificationReport({
          traceId,
          status: VerificationStatus.OCR_UNAVAILABLE,
          verified: false,
          message: "Documents uploaded successfully. AI OCR service is not configured.",
          startTime: requestStart,
          submittedData: formData,
          extractedAadhaar,
          extractedPAN,
          timeline,
        });

        return res.json(report);
      }

      // Case 4: OCR failed to extract text from files
      const aadhaarFailed = extractedAadhaar?.status === VerificationStatus.OCR_FAILED;
      const panFailed = extractedPAN?.status === VerificationStatus.OCR_FAILED;

      if (aadhaarFailed || panFailed) {
        addTimelineStep(VerificationStatus.OCR_FAILED);
        logAudit({ traceId, oldStatus: VerificationStatus.OCR_PROCESSING, newStatus: VerificationStatus.OCR_FAILED, event: "OCR_EXTRACTION_FAILED" });
        logPerformance({ traceId, operation: "TOTAL_KYC_VERIFY_REQUEST", durationMs: Date.now() - requestStart });

        const report = buildVerificationReport({
          traceId,
          status: VerificationStatus.OCR_FAILED,
          verified: false,
          message: "OCR extraction failed. Could not read identity text from document image.",
          startTime: requestStart,
          submittedData: formData,
          extractedAadhaar,
          extractedPAN,
          pipelineErrors: ["Could not extract legible identity text from uploaded files."],
          timeline,
        });

        return res.status(400).json(report);
      }

      addTimelineStep(VerificationStatus.OCR_COMPLETED);

      // Evaluate field matching
      addTimelineStep("DATA_MATCHING");
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
        addTimelineStep(VerificationStatus.REJECTED);
        logAudit({ traceId, oldStatus: VerificationStatus.OCR_COMPLETED, newStatus: VerificationStatus.REJECTED, event: "ATTRIBUTE_MISMATCH", details: mismatches.join(" ") });
        logPerformance({ traceId, operation: "TOTAL_KYC_VERIFY_REQUEST", durationMs: Date.now() - requestStart });

        const report = buildVerificationReport({
          traceId,
          status: VerificationStatus.REJECTED,
          verified: false,
          message: mismatches.join(" "),
          startTime: requestStart,
          submittedData: formData,
          extractedAadhaar,
          extractedPAN,
          mismatches,
          timeline,
        });

        return res.status(400).json(report);
      }

      // Case 3: All validations passed!
      addTimelineStep(VerificationStatus.VERIFIED);
      logAudit({ traceId, oldStatus: VerificationStatus.OCR_COMPLETED, newStatus: VerificationStatus.VERIFIED, event: "VERIFICATION_SUCCESS" });
      logPerformance({ traceId, operation: "TOTAL_KYC_VERIFY_REQUEST", durationMs: Date.now() - requestStart });

      const report = buildVerificationReport({
        traceId,
        status: VerificationStatus.VERIFIED,
        verified: true,
        message: "KYC Successfully Verified",
        startTime: requestStart,
        submittedData: formData,
        extractedAadhaar,
        extractedPAN,
        timeline,
      });

      return res.json(report);
    } catch (error) {
      addTimelineStep(VerificationStatus.REJECTED);
      logAudit({ traceId, oldStatus: null, newStatus: VerificationStatus.REJECTED, event: "SERVER_ERROR", details: error.message });
      logger.error(`Server Error in /verify: ${error.stack || error.message}`, { traceId });

      const report = buildVerificationReport({
        traceId,
        status: VerificationStatus.REJECTED,
        verified: false,
        message: "Internal server error during verification",
        startTime: requestStart,
        submittedData: { name: req.body?.name, aadhaar: req.body?.aadhaar, pan: req.body?.pan },
        pipelineErrors: [error.message],
        timeline,
      });

      return res.status(500).json(report);
    }
  }
);

// Endpoint 2: POST /api/process (used by AadhaarPanForm)
router.post("/process", upload.single("file"), async (req, res) => {
  const traceId = req.traceId;
  const requestStart = Date.now();
  const timeline = [{ status: VerificationStatus.UPLOADED, timestamp: new Date().toISOString() }];

  try {
    logAudit({ traceId, oldStatus: null, newStatus: VerificationStatus.UPLOADED, event: "SINGLE_FILE_UPLOAD" });

    if (!req.file) {
      timeline.push({ status: VerificationStatus.REJECTED, timestamp: new Date().toISOString() });
      const report = buildVerificationReport({
        traceId,
        status: VerificationStatus.REJECTED,
        verified: false,
        message: "No file uploaded",
        startTime: requestStart,
        timeline,
      });
      return res.status(400).json(report);
    }

    timeline.push({ status: VerificationStatus.OCR_PROCESSING, timestamp: new Date().toISOString() });
    const result = await processImage(req.file, traceId);

    if (!result || !result.success || result.status === VerificationStatus.OCR_FAILED) {
      timeline.push({ status: VerificationStatus.OCR_FAILED, timestamp: new Date().toISOString() });
      logAudit({ traceId, oldStatus: VerificationStatus.UPLOADED, newStatus: VerificationStatus.OCR_FAILED, event: "SINGLE_FILE_OCR_FAILED" });

      const report = buildVerificationReport({
        traceId,
        status: result?.status || VerificationStatus.OCR_FAILED,
        verified: false,
        message: result?.error || "OCR processing failed",
        startTime: requestStart,
        timeline,
      });
      return res.status(400).json(report);
    }

    if (result.status === VerificationStatus.OCR_UNAVAILABLE) {
      timeline.push({ status: VerificationStatus.OCR_UNAVAILABLE, timestamp: new Date().toISOString() });
      logAudit({ traceId, oldStatus: VerificationStatus.UPLOADED, newStatus: VerificationStatus.OCR_UNAVAILABLE, event: "SINGLE_FILE_OCR_UNAVAILABLE" });

      const report = buildVerificationReport({
        traceId,
        status: VerificationStatus.OCR_UNAVAILABLE,
        verified: false,
        message: "Document uploaded successfully. AI OCR service is not configured.",
        startTime: requestStart,
        timeline,
      });
      return res.json(report);
    }

    timeline.push({ status: VerificationStatus.OCR_COMPLETED, timestamp: new Date().toISOString() });
    logAudit({ traceId, oldStatus: VerificationStatus.UPLOADED, newStatus: VerificationStatus.OCR_COMPLETED, event: "SINGLE_FILE_OCR_SUCCESS" });

    const isAadhaar = result.details?.type === "Aadhaar";
    const report = buildVerificationReport({
      traceId,
      status: VerificationStatus.OCR_COMPLETED,
      verified: false,
      message: "Document text extracted successfully",
      startTime: requestStart,
      extractedAadhaar: isAadhaar ? result : null,
      extractedPAN: !isAadhaar ? result : null,
      timeline,
    });

    return res.json(report);
  } catch (error) {
    logger.error(`Server Error in /process: ${error.stack || error.message}`, { traceId });
    const report = buildVerificationReport({
      traceId,
      status: VerificationStatus.REJECTED,
      verified: false,
      message: "Internal server error",
      startTime: requestStart,
      pipelineErrors: [error.message],
      timeline,
    });
    return res.status(500).json(report);
  }
});

module.exports = router;
