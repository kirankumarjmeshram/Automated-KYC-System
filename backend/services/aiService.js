const axios = require("axios");
const env = require("../config/env");
const logger = require("../logger");
const {
  logOcrStep,
  logImageInfo,
  logCvSteps,
  logEngineInfo,
  logRawResponseObjects,
  logPerLineConfidence,
  logParserInput,
  logParserDecisions,
  logParsedData,
  logOcrFailure,
} = require("../logger/ocrLogger");
const { logPerformance } = require("../logger/performanceLogger");
const VerificationStatus = require("../constants/verificationStatus");

/**
 * AI Service RPC Client
 * Dispatches document image buffers to FastAPI AI Microservice (POST /ocr/process).
 * Forwards Trace ID and logs image metadata, preprocessing steps, engine configuration,
 * unsummarized raw response objects, per-line confidence, parser reasoning, and errors.
 */
const processImageWithAI = async (file, traceId = "internal-trace") => {
  if (!file || !file.buffer) {
    logOcrStep({
      traceId,
      stage: "DOCUMENT_RECEIVED",
      fileName: file?.originalname || "unknown",
      message: "Invalid file buffer",
      error: new Error("Invalid file buffer"),
    });
    return {
      success: false,
      status: VerificationStatus.OCR_FAILED,
      verified: false,
      error: "Invalid file buffer",
    };
  }

  const startTime = Date.now();
  const aiServiceUrl = process.env.AI_SERVICE_URL || env.AI_SERVICE_URL || "http://localhost:8000";
  const targetEndpoint = `${aiServiceUrl}/ocr/process`;

  // 1. Log DOCUMENT_RECEIVED & Document Metadata
  logOcrStep({ traceId, stage: "DOCUMENT_RECEIVED", fileName: file.originalname });
  logImageInfo({
    traceId,
    fileName: file.originalname,
    fileSize: `${file.size} bytes`,
    mimeType: file.mimetype || "image/png",
    width: "N/A",
    height: "N/A",
    format: file.mimetype ? file.mimetype.split("/")[1].toUpperCase() : "UNKNOWN",
  });

  // 2. Log IMAGE_PREPROCESSING_STARTED
  logOcrStep({ traceId, stage: "IMAGE_PREPROCESSING_STARTED", fileName: file.originalname });

  try {
    const FormData = require("form-data");
    const formData = new FormData();
    formData.append("file", file.buffer, {
      filename: file.originalname || "document.png",
      contentType: file.mimetype || "image/png",
    });

    logOcrStep({ traceId, stage: "IMAGE_PREPROCESSING_COMPLETED", fileName: file.originalname });
    logOcrStep({ traceId, stage: "OCR_STARTED", fileName: file.originalname });

    const response = await axios.post(targetEndpoint, formData, {
      headers: {
        ...formData.getHeaders(),
        "x-trace-id": traceId,
      },
      timeout: 300000, // 300s timeout — first call loads PaddleOCR+EasyOCR models (~2-3min on CPU)
    });

    const duration = Date.now() - startTime;
    logPerformance({ traceId, operation: "AI_SERVICE_RPC_CALL", durationMs: duration, details: `File=${file.originalname}` });

    if (response.data && response.data.success) {
      const engine = response.data.ocr_engine || "none";
      const details = response.data.details;
      const confidence = response.data.confidence_score || 0;
      const rawText = response.data.raw_text || "";

      logOcrStep({ traceId, stage: "OCR_COMPLETED", fileName: file.originalname, ocrEngine: engine, confidence });

      // Log Preprocessing Steps Detail
      if (response.data.cv_steps_detail) {
        logCvSteps({ traceId, steps: response.data.cv_steps_detail });
      }

      // Log OCR Engine Configuration
      if (response.data.engine_info) {
        logEngineInfo({ traceId, engineInfo: response.data.engine_info });
      }

      // Log Raw Unsummarized Objects (EasyOCR / PaddleOCR)
      if (response.data.raw_easyocr_objects && response.data.raw_easyocr_objects.length > 0) {
        logRawResponseObjects({ traceId, rawObjects: response.data.raw_easyocr_objects });
      } else if (response.data.raw_paddle_objects) {
        logRawResponseObjects({ traceId, rawObjects: response.data.raw_paddle_objects });
      }

      // Log Per-Line Confidence & Bounding Boxes
      if (response.data.per_line_confidence && response.data.per_line_confidence.length > 0) {
        logPerLineConfidence({ traceId, lines: response.data.per_line_confidence });
      }

      // Log Parser Input
      logParserInput({ traceId, rawText });

      // Log Parser Decisions & Reasoning
      if (response.data.parser_decisions && response.data.parser_decisions.length > 0) {
        logParserDecisions({ traceId, decisions: response.data.parser_decisions });
      }

      // Log Parsed Data
      if (details) {
        logOcrStep({ traceId, stage: "PARSER_COMPLETED", fileName: file.originalname });
        logParsedData({ traceId, parsedData: details });
      }

      if (engine === "none" || !details || !details.type || details.type === "Unknown" || (!details.number && !details.name)) {
        logOcrStep({
          traceId,
          stage: "OCR_FAILED",
          fileName: file.originalname,
          ocrEngine: engine,
          message: "No readable text extracted",
        });
        return {
          success: false,
          status: VerificationStatus.OCR_FAILED,
          verified: false,
          details: null,
          raw_text: rawText,
          raw_paddle: response.data.raw_paddle || "",
          raw_easy: response.data.raw_easy || "",
          message: "OCR extraction failed. Could not read identity text from document image.",
        };
      }

      return {
        success: true,
        status: VerificationStatus.OCR_COMPLETED,
        verified: false,
        details: response.data.details,
        ocrEngine: engine,
        confidence,
        raw_text: rawText,
        raw_paddle: response.data.raw_paddle || "",
        raw_easy: response.data.raw_easy || "",
      };
    } else {
      logOcrStep({
        traceId,
        stage: "OCR_FAILED",
        fileName: file.originalname,
        message: response.data?.message || "AI returned unsuccessful payload",
      });
      return {
        success: false,
        status: VerificationStatus.OCR_FAILED,
        verified: false,
        details: null,
        error: response.data?.message || "OCR extraction failed",
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("===== AI SERVICE RPC EXCEPTION =====");
    console.error(`Target: ${targetEndpoint}`);
    console.error(`Error: ${error.message}`);
    console.error(error.stack);
    logPerformance({ traceId, operation: "AI_SERVICE_RPC_FAILED", durationMs: duration, details: error.message });
    logOcrFailure({
      traceId,
      reason: error.message,
      engineResponse: error.response?.data || "N/A",
      rawResponse: error.response ? JSON.stringify(error.response.data) : "N/A",
      exception: error.name || "RPCException",
      stackTrace: error.stack || "N/A",
    });

    return {
      success: true,
      status: VerificationStatus.OCR_UNAVAILABLE,
      verified: false,
      details: null,
      message: "Documents uploaded successfully. AI OCR service is not configured.",
    };
  }
};

/**
 * Dispatches document image & selfie photo buffers to FastAPI AI Microservice (POST /face/verify).
 */
const verifyFaceWithAI = async (docFile, selfieFile, traceId = "internal-trace") => {
  if (!docFile || !selfieFile || !docFile.buffer || !selfieFile.buffer) {
    return {
      verified: false,
      similarity: 0.0,
      confidence: 0.0,
      threshold: 75.0,
      reason: "Missing document or selfie image buffer."
    };
  }

  const aiServiceUrl = process.env.AI_SERVICE_URL || env.AI_SERVICE_URL || "http://localhost:8000";
  const targetEndpoint = `${aiServiceUrl}/face/verify`;

  try {
    const FormData = require("form-data");
    const formData = new FormData();
    formData.append("documentFile", docFile.buffer, {
      filename: docFile.originalname || "document.png",
      contentType: docFile.mimetype || "image/png",
    });
    formData.append("selfieFile", selfieFile.buffer, {
      filename: selfieFile.originalname || "selfie.png",
      contentType: selfieFile.mimetype || "image/png",
    });

    const response = await axios.post(targetEndpoint, formData, {
      headers: {
        ...formData.getHeaders(),
        "x-trace-id": traceId,
      },
      timeout: 120000, // 120s — first call loads face detection models
    });

    return response.data?.faceVerification || {
      verified: false,
      similarity: 0.0,
      confidence: 0.0,
      threshold: 75.0,
      reason: "Invalid response from AI face verification service."
    };
  } catch (err) {
    logger.warn(`Face verification service error: ${err.message}`, { traceId });
    return {
      verified: false,
      similarity: 0.0,
      confidence: 0.0,
      threshold: 75.0,
      reason: `Face verification service unavailable: ${err.message}`
    };
  }
};

module.exports = { processImageWithAI, verifyFaceWithAI };
