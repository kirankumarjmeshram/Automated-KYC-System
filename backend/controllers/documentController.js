const vision = require("@google-cloud/vision");
const client = new vision.ImageAnnotatorClient();

// const processImage = async (file) => {
//   try {
//     const [result] = await client.textDetection(file.buffer);
//     const extractedText = result.textAnnotations[0]?.description || "";
    
//     console.log("Extracted OCR Text:", extractedText); // Debugging log

//     let details = { type: "", name: "", number: "", dob: "" };

//     if (extractedText.includes("Aadhaar")) {
//       details.type = "Aadhaar";

//       // Extract Aadhaar Name (Skipping "Issue Date" issue)
//       const aadhaarLines = extractedText.split("\n").map(line => line.trim());
//       for (let i = 0; i < aadhaarLines.length; i++) {
//         if (aadhaarLines[i].match(/^\d{4}\s\d{4}\s\d{4}$/)) {
//           details.number = aadhaarLines[i].replace(/\s/g, ""); // Remove spaces in Aadhaar number
//           if (i > 0) details.name = aadhaarLines[i - 1]; // Name is above Aadhaar number
//           break;
//         }
//       }

//       // Extract DOB from Aadhaar
//       const dobMatch = extractedText.match(/(\d{2}\/\d{2}\/\d{4})/);
//       if (dobMatch) details.dob = dobMatch[1];
//     }

//     if (extractedText.includes("INCOME TAX DEPARTMENT") || extractedText.includes("आयकर विभाग")) {
//       details.type = "PAN";

//       // Extract PAN Number
//       const panMatch = extractedText.match(/[A-Z]{5}[0-9]{4}[A-Z]/);
//       if (panMatch) details.number = panMatch[0];

//       // Extract Name (Assuming it appears just above PAN number)
//       const panLines = extractedText.split("\n").map(line => line.trim());
//       for (let i = 0; i < panLines.length; i++) {
//         if (panLines[i].match(/[A-Z]{5}[0-9]{4}[A-Z]/)) {
//           if (i > 0) details.name = panLines[i - 1];
//           break;
//         }
//       }
//     }

//     return { success: true, details };
//   } catch (error) {
//     console.error("Error in OCR processing:", error);
//     return { success: false, error: "OCR processing failed" };
//   }
// };

const processImage = async (file) => {
  try {
    const [result] = await client.textDetection(file.buffer);
    const extractedText = result.textAnnotations[0]?.description || "";

    console.log("Extracted OCR Text:", extractedText); // Debugging log

    let details = { type: "", name: "", number: "", dob: "" };

    if (extractedText.includes("आधार") || extractedText.includes("Aadhaar")) {
      details.type = "Aadhaar";

      // Extract Aadhaar number using a regex pattern
      const aadhaarMatch = extractedText.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/);
      if (aadhaarMatch) {
        details.number = aadhaarMatch[0].replace(/\s/g, ""); // Remove spaces to match provided format
      }

      // Extract Aadhaar Name (above the DOB line)
      const lines = extractedText.split("\n").map(line => line.trim());
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("DOB") || lines[i].includes("जन्म तारीख")) {
          details.dob = lines[i].match(/\d{2}\/\d{2}\/\d{4}/)?.[0] || "";
          if (i > 1) details.name = lines[i - 2]; // Name appears 2 lines above DOB
          break;
        }
      }
    }

    return { success: true, details };
  } catch (error) {
    console.error("Error in OCR processing:", error);
    return { success: false, error: "OCR processing failed" };
  }
};


module.exports = { processImage };


// const client = require("../config/googleVision");
// const Document = require("../models/Document");

// const extractDetails = (text) => {
//   const lines = text.split("\n");
//   let type = "Unknown", name = "", number = "", dob = "";

//   lines.forEach((line) => {
//     if (/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(line.trim())) {
//       type = "PAN";
//       number = line.trim();
//     }
//     if (/\d{4}\s\d{4}\s\d{4}/.test(line)) {
//       type = "Aadhaar";
//       number = line.replace(/\s/g, "");
//     }
//     if (/DOB|Birth|Year|Date of Birth/i.test(line)) {
//       dob = line.split(/:|-| /).pop().trim();
//     }
//     if (!name && !line.match(/GOVT|INDIA|TAX|IDENTITY|MALE|FEMALE|DOB|Year/i)) {
//       name = line;
//     }
//   });

//   return { type, name, number, dob };
// };

// const processImage = async (file) => {
//   try {
//     const [result] = await client.textDetection({ image: { content: file.buffer } });
//     const text = result.fullTextAnnotation ? result.fullTextAnnotation.text : "";
//     const details = extractDetails(text);

//     if (details.type === "Unknown") {
//       return { success: false, message: "Not an Aadhaar or PAN card" };
//     }

//     const document = new Document({ ...details, extractedText: text });
//     await document.save();

//     return { success: true, details };
//   } catch (error) {
//     console.error(error);
//     return { success: false, message: "Error processing image" };
//   }
// };

// module.exports = { processImage };
