const vision = require("@google-cloud/vision");
const sharp = require("sharp");
const logger = require("../logger"); 

const client = new vision.ImageAnnotatorClient();

const processImage = async (file) => {
  try {
    if (!file || !file.buffer) {
      logger.error("Invalid file: No buffer detected.");
      return { success: false, error: "Invalid file input" };
    }

    logger.info(`Processing image: ${file.originalname}, Size: ${file.size}`);

    // Convert to high-quality PNG for better OCR detection
    const enhancedBuffer = await sharp(file.buffer)
      .resize(1000)
      .png({ quality: 100 })
      .toBuffer();

    // Convert image buffer to Base64
    const base64Image = enhancedBuffer.toString("base64");

    // Send image to Google Vision API
    const [result] = await client.textDetection({ image: { content: base64Image } });

    logger.info("Google Vision API Response: " + JSON.stringify(result, null, 2));

    const extractedText = result.textAnnotations[0]?.description || "";
    logger.info(`Extracted OCR Text: ${extractedText}`);

    if (!extractedText) {
      return { success: false, error: "No text detected" };
    }

    // Extract Aadhaar & PAN details
    const details = extractDetails(extractedText);
    logger.info(`Extracted Details: ${JSON.stringify(details)}`);

    return details;
  } catch (error) {
    logger.error(`Error in OCR processing: ${error}`);
    return { success: false, error: "OCR processing failed" };
  }
};

const extractDetails = (extractedText) => {
  let details = { type: "", name: "", number: "", dob: "" };
  const lines = extractedText.split("\n").map((line) => line.trim());

  if (extractedText.includes("आधार") || extractedText.includes("Aadhaar")) {
    details.type = "Aadhaar";

    // Extract Aadhaar number
    const aadhaarMatch = extractedText.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/);
    if (aadhaarMatch) {
      details.number = aadhaarMatch[0].replace(/\s/g, ""); // Remove spaces
    }

    // Extract Name (above DOB)
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("DOB") || lines[i].includes("जन्म तारीख")) {
        details.dob = lines[i].match(/\d{2}\/\d{2}\/\d{4}/)?.[0] || "";
        if (i > 1) details.name = lines[i - 2] + " " + lines[i - 1]; // Capture full name
        break;
      }
    }
  } else if (extractedText.includes("INCOME TAX DEPARTMENT")) {
    details.type = "PAN";

    // Extract PAN Number
    const panMatch = extractedText.match(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/);
    if (panMatch) {
      details.number = panMatch[0];
    }

    // Extract Name (First valid name, not "INCOME TAX DEPARTMENT")
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].includes("INCOME TAX DEPARTMENT") && lines[i].match(/^[A-Z ]+$/)) {
        details.name = lines[i].trim();
        break;
      }
    }
  }

  return { success: true, details };
};

module.exports = { processImage };
