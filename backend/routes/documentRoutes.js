const express = require("express");
const multer = require("multer");
const { processImage, processImageWithAI, verifyFaceWithAI } = require("../controllers/documentController");
const VerificationStatus = require("../constants/verificationStatus");
const logger = require("../logger");
const {
  logOcrStep,
  logDocumentInfo,
  logRawOcr,
  logGeminiResponse,
  logParsedData,
  logValidationInput,
  logMatchResult,
  logOcrError,
} = require("../logger/ocrLogger");
const { logAudit, logPerformance } = require("../logger");
const { matchNames } = require("../utils/nameMatcher");
const { buildVerificationReport } = require("../utils/verificationReportBuilder");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Endpoint 1: POST /api/verify (used by KycStepupForm)
router.post(
  "/verify",
  upload.fields([
    { name: "aadhaarFile", maxCount: 1 },
    { name: "panFile", maxCount: 1 },
    { name: "selfieFile", maxCount: 1 },
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
      logOcrStep({ traceId, stage: "DOCUMENT_RECEIVED", message: `Form submission received: Name="${req.body.name || ""}"` });
      logAudit({ traceId, oldStatus: null, newStatus: VerificationStatus.UPLOADED, event: "UPLOAD_RECEIVED" });

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
      const selfieFile = req.files?.selfieFile ? req.files.selfieFile[0] : null;

      console.log("===== EXPRESS =====");
      console.log("Received req.files:", req.files ? Object.keys(req.files) : null);
      console.log("Field names:", req.files ? Object.keys(req.files) : []);
      console.log("File sizes:", {
        aadhaarFile: aadhaarFile ? `${aadhaarFile.originalname} (${aadhaarFile.size} bytes)` : null,
        panFile: panFile ? `${panFile.originalname} (${panFile.size} bytes)` : null,
        selfieFile: selfieFile ? `${selfieFile.originalname} (${selfieFile.size} bytes)` : null,
      });

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
      logOcrStep({ traceId, stage: "IMAGE_PREPROCESSING_STARTED" });
      logAudit({ traceId, oldStatus: VerificationStatus.UPLOADED, newStatus: VerificationStatus.OCR_PROCESSING, event: "OCR_STARTED" });

      // Execute OCR for uploaded documents sequentially to optimize CPU thread allocation
      logOcrStep({ traceId, stage: "OCR_STARTED" });
      const extractedAadhaar = aadhaarFile ? await processImage(aadhaarFile, traceId) : null;
      const extractedPAN = panFile ? await processImage(panFile, traceId) : null;

      // Execute Face Verification ONLY if selfieFile is uploaded
      let faceVerification = null;
      if (selfieFile) {
        const targetDocFile = aadhaarFile || panFile;
        if (targetDocFile) {
          logOcrStep({ traceId, stage: "FACE_VERIFICATION_STARTED" });
          faceVerification = await verifyFaceWithAI(targetDocFile, selfieFile, traceId);
          logOcrStep({ traceId, stage: "FACE_VERIFICATION_COMPLETED", message: `Similarity=${faceVerification?.similarity}% Verified=${faceVerification?.verified}` });
        }
      }

      logOcrStep({ traceId, stage: "OCR_COMPLETED" });

      // Log RAW OCR text & Parsed Data if available
      if (extractedPAN) {
        logOcrStep({ traceId, stage: "PARSER_STARTED", fileName: panFile?.originalname || "pan.png" });
        if (extractedPAN.raw_text) {
          logRawOcr({
            traceId,
            engine: extractedPAN.ocrEngine || "EasyOCR",
            confidence: extractedPAN.confidence || 0,
            rawText: extractedPAN.raw_text,
            rawPaddle: extractedPAN.raw_paddle,
            rawEasy: extractedPAN.raw_easy,
          });
        }
        if (extractedPAN.details) {
          logParsedData({ traceId, parsedData: extractedPAN.details });
        }
        logOcrStep({ traceId, stage: "PARSER_COMPLETED", fileName: panFile?.originalname || "pan.png" });
      }

      if (extractedAadhaar) {
        logOcrStep({ traceId, stage: "PARSER_STARTED", fileName: aadhaarFile?.originalname || "aadhaar.png" });
        if (extractedAadhaar.raw_text) {
          logRawOcr({
            traceId,
            engine: extractedAadhaar.ocrEngine || "EasyOCR",
            confidence: extractedAadhaar.confidence || 0,
            rawText: extractedAadhaar.raw_text,
            rawPaddle: extractedAadhaar.raw_paddle,
            rawEasy: extractedAadhaar.raw_easy,
          });
        }
        if (extractedAadhaar.details) {
          logParsedData({ traceId, parsedData: extractedAadhaar.details });
        }
        logOcrStep({ traceId, stage: "PARSER_COMPLETED", fileName: aadhaarFile?.originalname || "aadhaar.png" });
      }

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

      // Log VALIDATION_STARTED & Validation Inputs
      logOcrStep({ traceId, stage: "VALIDATION_STARTED" });
      logValidationInput({
        traceId,
        submittedData: formData,
        extractedData: {
          aadhaar: extractedAadhaar?.details || null,
          pan: extractedPAN?.details || null,
        },
      });
      logOcrStep({ traceId, stage: "VALIDATION_COMPLETED" });

      // Log MATCHING_STARTED
      logOcrStep({ traceId, stage: "MATCHING_STARTED" });
      addTimelineStep("DATA_MATCHING");
      logAudit({ traceId, oldStatus: VerificationStatus.OCR_PROCESSING, newStatus: VerificationStatus.OCR_COMPLETED, event: "DATA_MATCHING" });

      let mismatches = [];
      let manualReviewRequired = false;

      // Validate Aadhaar Details
      if (extractedAadhaar?.details) {
        const aadhaarNumMatch = extractedAadhaar.details.number && formData.aadhaar ? formData.aadhaar === extractedAadhaar.details.number.replace(/\s/g, "") : false;
        if (extractedAadhaar.details.number && formData.aadhaar && !aadhaarNumMatch) {
          mismatches.push("Aadhaar number mismatch.");
        }
        if (extractedAadhaar.details.name) {
          const aadhaarMatch = matchNames(
            formData.name,
            extractedAadhaar.details.name,
            extractedAadhaar.confidence ? Math.round(extractedAadhaar.confidence * 100) : 95,
            { numberMatched: aadhaarNumMatch, dobMatched: true }
          );
          logMatchResult({ traceId, matchResult: { document: "Aadhaar", ...aadhaarMatch } });

          if (aadhaarMatch.decision === "REJECTED") {
            mismatches.push(`Aadhaar name mismatch: ${aadhaarMatch.reason}`);
          } else if (aadhaarMatch.decision === "MANUAL_REVIEW") {
            manualReviewRequired = true;
          }
        }
      }

      // Validate PAN Details
      if (extractedPAN?.details) {
        const panNumMatch = extractedPAN.details.number && formData.pan ? formData.pan === extractedPAN.details.number : false;
        if (extractedPAN.details.number && formData.pan && !panNumMatch) {
          mismatches.push("PAN number mismatch.");
        }
        if (extractedPAN.details.name) {
          const panMatch = matchNames(
            formData.name,
            extractedPAN.details.name,
            extractedPAN.confidence ? Math.round(extractedPAN.confidence * 100) : 95,
            { numberMatched: panNumMatch, dobMatched: true }
          );
          logMatchResult({ traceId, matchResult: { document: "PAN", ...panMatch } });

          if (panMatch.decision === "REJECTED") {
            mismatches.push(`PAN name mismatch: ${panMatch.reason}`);
          } else if (panMatch.decision === "MANUAL_REVIEW") {
            manualReviewRequired = true;
          }
        }
      }

      logOcrStep({ traceId, stage: "MATCHING_COMPLETED" });

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

      if (manualReviewRequired) {
        addTimelineStep(VerificationStatus.MANUAL_REVIEW);
        logAudit({ traceId, oldStatus: VerificationStatus.OCR_COMPLETED, newStatus: VerificationStatus.MANUAL_REVIEW, event: "MANUAL_REVIEW_TRIGGERED" });
        logPerformance({ traceId, operation: "TOTAL_KYC_VERIFY_REQUEST", durationMs: Date.now() - requestStart });

        const report = buildVerificationReport({
          traceId,
          status: VerificationStatus.MANUAL_REVIEW,
          verified: false,
          message: "Name verification requires compliance officer review.",
          startTime: requestStart,
          submittedData: formData,
          extractedAadhaar,
          extractedPAN,
          pipelineWarnings: ["Name matching rule flagged for manual review."],
          timeline,
        });

        return res.json(report);
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
        faceVerification,
        timeline,
      });

      return res.json(report);
    } catch (error) {
      addTimelineStep(VerificationStatus.REJECTED);
      logOcrError({ traceId, stage: "PIPELINE_EXCEPTION", message: error.message, stack: error.stack });
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
    logOcrStep({ traceId, stage: "DOCUMENT_RECEIVED", message: `Single file upload: Name="${req.file?.originalname || ""}"` });
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

    logOcrStep({ traceId, stage: "IMAGE_PREPROCESSING_STARTED" });
    timeline.push({ status: VerificationStatus.OCR_PROCESSING, timestamp: new Date().toISOString() });

    logOcrStep({ traceId, stage: "OCR_STARTED" });
    const result = await processImage(req.file, traceId);
    logOcrStep({ traceId, stage: "OCR_COMPLETED" });

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

    logOcrStep({ traceId, stage: "PARSER_STARTED" });
    if (result.raw_text) {
      logRawOcr({
        traceId,
        engine: result.ocrEngine || "EasyOCR",
        confidence: result.confidence || 0,
        rawText: result.raw_text,
      });
    }
    if (result.details) {
      logParsedData({ traceId, parsedData: result.details });
    }
    logOcrStep({ traceId, stage: "PARSER_COMPLETED" });

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
    logOcrError({ traceId, stage: "SINGLE_FILE_PROCESS_EXCEPTION", message: error.message, stack: error.stack });
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
