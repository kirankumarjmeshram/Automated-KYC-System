const axios = require("axios");
const env = require("../config/env");
const logger = require("../logger");
const VerificationStatus = require("../constants/verificationStatus");

/**
 * AI Service RPC Client
 * Dispatches document image buffers to FastAPI AI Microservice (POST /ocr/process).
 * Strictly handles timeouts, offline states, and OCR failures without generating dummy data.
 */
const processImageWithAI = async (file) => {
  if (!file || !file.buffer) {
    return {
      success: false,
      status: VerificationStatus.OCR_FAILED,
      verified: false,
      error: "Invalid file buffer",
    };
  }

  const aiServiceUrl = process.env.AI_SERVICE_URL || env.AI_SERVICE_URL || "http://localhost:8000";
  const targetEndpoint = `${aiServiceUrl}/ocr/process`;

  try {
    logger.info(`[${VerificationStatus.OCR_PROCESSING}] Forwarding ${file.originalname} (${file.size} bytes) to AI Service: ${targetEndpoint}`);

    const FormData = require("form-data");
    const formData = new FormData();
    formData.append("file", file.buffer, {
      filename: file.originalname || "document.png",
      contentType: file.mimetype || "image/png",
    });

    const response = await axios.post(targetEndpoint, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 12000,
    });

    if (response.data && response.data.success) {
      const engine = response.data.ocr_engine || "none";
      const details = response.data.details;

      // If no text extracted or document type unknown, return OCR_FAILED
      if (engine === "none" || !details || !details.type || details.type === "Unknown" || (!details.number && !details.name)) {
        logger.warn(`[${VerificationStatus.OCR_FAILED}] OCR engine could not extract readable identity fields from ${file.originalname}`);
        return {
          success: false,
          status: VerificationStatus.OCR_FAILED,
          verified: false,
          details: null,
          message: "OCR extraction failed. Could not read identity text from document image.",
        };
      }

      logger.info(`[${VerificationStatus.OCR_COMPLETED}] Extracted details via ${engine} for ${file.originalname}`);
      return {
        success: true,
        status: VerificationStatus.OCR_COMPLETED,
        verified: false,
        details: response.data.details,
        ocrEngine: engine,
        confidence: response.data.confidence_score || 0,
      };
    } else {
      logger.warn(`[${VerificationStatus.OCR_FAILED}] AI Service failed processing ${file.originalname}`);
      return {
        success: false,
        status: VerificationStatus.OCR_FAILED,
        verified: false,
        details: null,
        error: response.data?.message || "OCR extraction failed",
      };
    }
  } catch (error) {
    logger.warn(`[${VerificationStatus.OCR_UNAVAILABLE}] AI Service unreachable (${targetEndpoint}): ${error.message}`);
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
