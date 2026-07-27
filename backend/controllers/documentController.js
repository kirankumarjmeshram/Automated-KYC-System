const vision = require("@google-cloud/vision");
const sharp = require("sharp");
const logger = require("../logger");
const { processImageWithAI } = require("../services/aiService");
const VerificationStatus = require("../constants/verificationStatus");

let client = null;
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    client = new vision.ImageAnnotatorClient();
  }
} catch (err) {
  logger.warn("Google Vision Client initialization skipped: " + err.message);
}

const processImage = async (file) => {
  try {
    if (!file || !file.buffer) {
      logger.error("Invalid file: No buffer detected.");
      return {
        success: false,
        status: VerificationStatus.OCR_FAILED,
        verified: false,
        error: "Invalid file input",
      };
    }

    logger.info(`[${VerificationStatus.OCR_PROCESSING}] Processing image: ${file.originalname}, Size: ${file.size}`);

    // Step 1: Attempt extraction via Python FastAPI AI Microservice
    const aiResult = await processImageWithAI(file);
    if (aiResult) {
      return aiResult;
    }

    // Step 2: Local Google Vision API processing if client configured
    if (client) {
      try {
        const enhancedBuffer = await sharp(file.buffer)
          .resize(1000)
          .png({ quality: 100 })
          .toBuffer();

        const base64Image = enhancedBuffer.toString("base64");
        const [result] = await client.textDetection({ image: { content: base64Image } });
        const extractedText = result.textAnnotations[0]?.description || "";

        if (extractedText) {
          const details = extractDetailsFromText(extractedText);
          if (details && details.type) {
            logger.info(`[${VerificationStatus.OCR_COMPLETED}] Extracted details via Google Vision API`);
            return {
              success: true,
              status: VerificationStatus.OCR_COMPLETED,
              verified: false,
              details: details,
            };
          }
        }
      } catch (processingErr) {
        logger.warn(`Google Vision API error: ${processingErr.message}`);
      }
    }

    // If no OCR engine succeeded, return OCR_UNAVAILABLE or OCR_FAILED without dummy data
    logger.warn(`[${VerificationStatus.OCR_UNAVAILABLE}] No active OCR engine available for ${file.originalname}`);
    return {
      success: true,
      status: VerificationStatus.OCR_UNAVAILABLE,
      verified: false,
      details: null,
      message: "Documents uploaded successfully. AI OCR service is not configured.",
    };
  } catch (error) {
    logger.error(`Error in OCR processing: ${error.message}`);
    return {
      success: false,
      status: VerificationStatus.OCR_FAILED,
      verified: false,
      error: "OCR processing failed",
    };
  }
};

const extractDetailsFromText = (extractedText) => {
  if (!extractedText) return null;

  let details = { type: "", name: "", number: "", dob: "" };
  const lines = extractedText.split("\n").map((line) => line.trim());

  if (extractedText.includes("आधार") || extractedText.includes("Aadhaar")) {
    details.type = "Aadhaar";

    const aadhaarMatch = extractedText.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/);
    if (aadhaarMatch) {
      details.number = aadhaarMatch[0].replace(/\s/g, "");
    }

    const dobMatch = extractedText.match(/\b\d{2}\/\d{2}\/\d{4}\b/);
    if (dobMatch) {
      details.dob = dobMatch[0];
    }

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("DOB") || lines[i].includes("DATE OF BIRTH") || lines[i].includes("Birth")) {
        if (i > 0 && lines[i - 1] && !lines[i - 1].includes("INDIA")) {
          details.name = lines[i - 1].toUpperCase();
          break;
        }
      }
    }
  } else if (extractedText.includes("INCOME TAX DEPARTMENT") || extractedText.match(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/)) {
    details.type = "PAN";

    const panMatch = extractedText.match(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/);
    if (panMatch) {
      details.number = panMatch[0];
    }

    const dobMatch = extractedText.match(/\b\d{2}\/\d{2}\/\d{4}\b/);
    if (dobMatch) {
      details.dob = dobMatch[0];
    }

    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].includes("INCOME TAX") && !lines[i].includes("GOVT OF INDIA") && lines[i].match(/^[A-Z ]{3,30}$/)) {
        details.name = lines[i].trim().toUpperCase();
        break;
      }
    }
  }

  return details.type ? details : null;
};

module.exports = { processImage };
