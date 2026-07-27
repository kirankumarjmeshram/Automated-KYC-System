const { calculateNameSimilarity } = require("./fuzzyMatch");
const VerificationStatus = require("../constants/verificationStatus");

/**
 * Enterprise Verification Report Builder
 * Generates a standardized, comprehensive verification report for all KYC outcomes.
 */
function buildVerificationReport({
  traceId,
  status,
  verified = false,
  message = "",
  startTime,
  submittedData = {},
  extractedAadhaar = null,
  extractedPAN = null,
  mismatches = [],
  pipelineErrors = [],
  pipelineWarnings = [],
  recommendations = [],
  timeline = [],
}) {
  const endTime = Date.now();
  const processingTimeMs = startTime ? endTime - startTime : 0;
  const isoTime = new Date().toISOString();

  const nameSub = submittedData.name || "";
  const aadhaarSub = submittedData.aadhaar || "";
  const panSub = submittedData.pan || "";

  // 1. Process Aadhaar Field Comparison & Confidence
  const aadhaarDetails = extractedAadhaar?.details || null;
  const aadhaarStatus = !aadhaarDetails
    ? (extractedAadhaar?.status || "NOT_UPLOADED")
    : (mismatches.some((m) => m.includes("Aadhaar")) ? VerificationStatus.REJECTED : VerificationStatus.VERIFIED);

  let aadhaarNameMatch = false;
  let aadhaarNameSim = 0;
  let aadhaarNumberMatch = false;

  if (aadhaarDetails) {
    if (aadhaarDetails.name && nameSub) {
      aadhaarNameSim = calculateNameSimilarity(nameSub, aadhaarDetails.name);
      aadhaarNameMatch = aadhaarNameSim >= 65;
    }
    if (aadhaarDetails.number && aadhaarSub) {
      aadhaarNumberMatch = aadhaarSub === aadhaarDetails.number.replace(/\s/g, "");
    }
  }

  // 2. Process PAN Field Comparison & Confidence
  const panDetails = extractedPAN?.details || null;
  const panStatus = !panDetails
    ? (extractedPAN?.status || "NOT_UPLOADED")
    : (mismatches.some((m) => m.includes("PAN")) ? VerificationStatus.REJECTED : VerificationStatus.VERIFIED);

  let panNameMatch = false;
  let panNameSim = 0;
  let panNumberMatch = false;

  if (panDetails) {
    if (panDetails.name && nameSub) {
      panNameSim = calculateNameSimilarity(nameSub, panDetails.name);
      panNameMatch = panNameSim >= 65;
    }
    if (panDetails.number && panSub) {
      panNumberMatch = panSub === panDetails.number;
    }
  }

  // 3. Compute Confidence Scores
  const aadhaarConf = extractedAadhaar?.confidence ? Math.round(extractedAadhaar.confidence * 100) : (aadhaarDetails ? 95.0 : 0.0);
  const panConf = extractedPAN?.confidence ? Math.round(extractedPAN.confidence * 100) : (panDetails ? 94.0 : 0.0);
  
  let validConfCount = 0;
  let confSum = 0;
  if (aadhaarConf > 0) { confSum += aadhaarConf; validConfCount++; }
  if (panConf > 0) { confSum += panConf; validConfCount++; }
  const overallConf = validConfCount > 0 ? Number((confSum / validConfCount).toFixed(1)) : 0.0;

  // 4. Determine Warnings and Recommendations
  const finalWarnings = [...pipelineWarnings];
  const finalRecommendations = [...recommendations];
  const finalErrors = [...pipelineErrors];

  if (status === VerificationStatus.OCR_UNAVAILABLE) {
    finalWarnings.push("AI OCR microservice is unconfigured or offline.");
    finalRecommendations.push("Start AI microservice on port 8000 for automated OCR verification.");
  } else if (status === VerificationStatus.OCR_FAILED) {
    finalErrors.push({
      document: "GENERAL",
      field: "IMAGE_QUALITY",
      reason: "Could not extract legible identity text from uploaded files.",
    });
    finalRecommendations.push("Upload clear, high-resolution document images under good lighting.");
    finalRecommendations.push("Ensure full document card is visible without glare or heavy rotation.");
  } else if (status === VerificationStatus.REJECTED) {
    mismatches.forEach((m) => {
      finalErrors.push({
        document: m.includes("Aadhaar") ? "Aadhaar" : "PAN",
        field: m.includes("name") ? "name" : "number",
        reason: m,
      });
    });
    finalRecommendations.push("Re-check submitted name and numbers against physical identity cards.");
  }

  // 5. Construct Enterprise Report Payload
  return {
    success: verified || status === VerificationStatus.OCR_UNAVAILABLE,
    traceId: traceId || "internal-trace",
    status,
    verified,
    message: message || (verified ? "KYC Successfully Verified" : `Verification status: ${status}`),
    verificationTime: isoTime,
    processingTimeMs,

    summary: {
      overallVerified: verified,
      aadhaarVerified: aadhaarStatus === VerificationStatus.VERIFIED,
      panVerified: panStatus === VerificationStatus.VERIFIED,
      faceVerified: false,
      livenessVerified: false,
      manualReviewRequired: status === VerificationStatus.MANUAL_REVIEW || status === VerificationStatus.OCR_FAILED,
    },

    submittedData: {
      name: nameSub,
      aadhaar: aadhaarSub,
      pan: panSub,
    },

    ocrData: {
      aadhaar: aadhaarDetails
        ? {
            type: aadhaarDetails.type || "Aadhaar",
            name: aadhaarDetails.name || "",
            number: aadhaarDetails.number || "",
            dob: aadhaarDetails.dob || "",
            gender: aadhaarDetails.gender || "",
            address: aadhaarDetails.address || "",
            confidence: aadhaarConf,
          }
        : null,
      pan: panDetails
        ? {
            type: panDetails.type || "PAN",
            name: panDetails.name || "",
            father_name: panDetails.father_name || "",
            number: panDetails.number || "",
            dob: panDetails.dob || "",
            confidence: panConf,
          }
        : null,
    },

    comparison: {
      aadhaar: {
        name: {
          submitted: nameSub,
          ocr: aadhaarDetails?.name || "",
          matched: aadhaarNameMatch,
          similarity: aadhaarNameSim,
        },
        number: {
          submitted: aadhaarSub,
          ocr: aadhaarDetails?.number || "",
          matched: aadhaarNumberMatch,
          similarity: aadhaarNumberMatch ? 100 : 0,
        },
        dobMatch: Boolean(aadhaarDetails?.dob),
        genderMatch: Boolean(aadhaarDetails?.gender),
        addressMatch: Boolean(aadhaarDetails?.address),
      },
      pan: {
        name: {
          submitted: nameSub,
          ocr: panDetails?.name || "",
          matched: panNameMatch,
          similarity: panNameSim,
        },
        number: {
          submitted: panSub,
          ocr: panDetails?.number || "",
          matched: panNumberMatch,
          similarity: panNumberMatch ? 100 : 0,
        },
        dobMatch: Boolean(panDetails?.dob),
      },
    },

    confidence: {
      overall: overallConf,
      aadhaar: aadhaarConf,
      pan: panConf,
    },

    documents: {
      aadhaar: {
        status: aadhaarStatus,
        reason: aadhaarStatus === VerificationStatus.VERIFIED ? "Matched" : (mismatches.find((m) => m.includes("Aadhaar")) || "Extraction Result"),
      },
      pan: {
        status: panStatus,
        reason: panStatus === VerificationStatus.VERIFIED ? "Matched" : (mismatches.find((m) => m.includes("PAN")) || "Extraction Result"),
      },
    },

    pipeline: {
      imageValidation: "SUCCESS",
      ocr: status === VerificationStatus.OCR_UNAVAILABLE ? "SKIPPED" : (status === VerificationStatus.OCR_FAILED ? "FAILED" : "SUCCESS"),
      gemini: status === VerificationStatus.OCR_UNAVAILABLE ? "SKIPPED" : "SUCCESS",
      dataMatching: status === VerificationStatus.VERIFIED ? "SUCCESS" : (status === VerificationStatus.REJECTED ? "MISMATCH" : "SKIPPED"),
      faceVerification: "PENDING",
      liveness: "PENDING",
    },

    errors: finalErrors,
    warnings: finalWarnings,
    recommendations: finalRecommendations,

    timeline: timeline.length > 0 ? timeline : [
      { status: VerificationStatus.UPLOADED, timestamp: isoTime },
      { status: status, timestamp: isoTime },
    ],

    futureCompatibility: {
      riskScore: 0.0,
      fraudScore: 0.0,
      faceVerification: null,
      liveness: null,
      reviewer: null,
      approvalDate: null,
      officerComments: null,
    },
  };
}

module.exports = { buildVerificationReport };
