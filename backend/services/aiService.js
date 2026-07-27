const axios = require("axios");
const env = require("../config/env");
const logger = require("../logger");
const { logOcrStep } = require("../logger/ocrLogger");
const { logPerformance } = require("../logger/performanceLogger");
const VerificationStatus = require("../constants/verificationStatus");

/**
 * AI Service RPC Client
 * Dispatches document image buffers to FastAPI AI Microservice (POST /ocr/process).
 * Forwards Trace ID and logs performance and step metrics.
 */
const processImageWithAI = async (file, traceId = "internal-trace") => {
  if (!file || !file.buffer) {
    logOcrStep({ traceId, step: "IMAGE_VALIDATION_FAILED", fileName: file?.originalname || "unknown", message: "Invalid file buffer" });
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

  logOcrStep({ traceId, step: "OCR_STARTED", fileName: file.originalname });

  try {
    const FormData = require("form-data");
    const formData = new FormData();
    formData.append("file", file.buffer, {
      filename: file.originalname || "document.png",
      contentType: file.mimetype || "image/png",
    });

    const response = await axios.post(targetEndpoint, formData, {
      headers: {
        ...formData.getHeaders(),
        "x-trace-id": traceId,
      },
      timeout: 12000,
    });

    const duration = Date.now() - startTime;
    logPerformance({ traceId, operation: "AI_SERVICE_RPC_CALL", durationMs: duration, details: `File=${file.originalname}` });

    if (response.data && response.data.success) {
      const engine = response.data.ocr_engine || "none";
      const details = response.data.details;
      const confidence = response.data.confidence_score || 0;

      if (engine === "none" || !details || !details.type || details.type === "Unknown" || (!details.number && !details.name)) {
        logOcrStep({ traceId, step: "OCR_FAILED", fileName: file.originalname, ocrEngine: engine, message: "No readable text extracted" });
        return {
          success: false,
          status: VerificationStatus.OCR_FAILED,
          verified: false,
          details: null,
          message: "OCR extraction failed. Could not read identity text from document image.",
        };
      }

      logOcrStep({ traceId, step: `${engine.toUpperCase()}_SUCCESS`, fileName: file.originalname, ocrEngine: engine, confidence });
      logOcrStep({ traceId, step: "FIELD_EXTRACTION_SUCCESS", fileName: file.originalname, message: `Type=${details.type}` });

      return {
        success: true,
        status: VerificationStatus.OCR_COMPLETED,
        verified: false,
        details: response.data.details,
        ocrEngine: engine,
        confidence,
      };
    } else {
      logOcrStep({ traceId, step: "OCR_FAILED", fileName: file.originalname, message: response.data?.message || "AI returned unsuccessful payload" });
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
    logPerformance({ traceId, operation: "AI_SERVICE_RPC_FAILED", durationMs: duration, details: error.message });
    logOcrStep({ traceId, step: "AI_SERVICE_UNAVAILABLE", fileName: file.originalname, message: error.message });

    return {
      success: true,
      status: VerificationStatus.OCR_UNAVAILABLE,
      verified: false,
      details: null,
      message: "Documents uploaded successfully. AI OCR service is not configured.",
    };
  }
};

module.exports = { processImageWithAI };
