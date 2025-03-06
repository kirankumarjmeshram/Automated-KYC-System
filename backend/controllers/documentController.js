const client = require("../config/googleVision");
const Document = require("../models/Document");

const extractDetails = (text) => {
  const lines = text.split("\n");
  let type = "Unknown", name = "", number = "", dob = "";

  lines.forEach((line) => {
    if (/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(line.trim())) {
      type = "PAN";
      number = line.trim();
    }
    if (/\d{4}\s\d{4}\s\d{4}/.test(line)) {
      type = "Aadhaar";
      number = line.replace(/\s/g, "");
    }
    if (/DOB|Birth|Year|Date of Birth/i.test(line)) {
      dob = line.split(/:|-| /).pop().trim();
    }
    if (!name && !line.match(/GOVT|INDIA|TAX|IDENTITY|MALE|FEMALE|DOB|Year/i)) {
      name = line;
    }
  });

  return { type, name, number, dob };
};

const processImage = async (file) => {
  try {
    const [result] = await client.textDetection({ image: { content: file.buffer } });
    const text = result.fullTextAnnotation ? result.fullTextAnnotation.text : "";
    const details = extractDetails(text);

    if (details.type === "Unknown") {
      return { success: false, message: "Not an Aadhaar or PAN card" };
    }

    const document = new Document({ ...details, extractedText: text });
    await document.save();

    return { success: true, details };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Error processing image" };
  }
};

module.exports = { processImage };
