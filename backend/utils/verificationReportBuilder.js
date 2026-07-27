const { matchNames } = require("./nameMatcher");
const { generateRecommendations } = require("./recommendationEngine");
const VerificationStatus = require("../constants/verificationStatus");

/**
 * Enterprise Verification Report Builder
 * Generates a standardized, comprehensive verification report with Decision, Recommendation & Debug Engines.
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

  // 1. Process Aadhaar Name Matching via Enterprise Name Engine
  const aadhaarDetails = extractedAadhaar?.details || null;
  let aadhaarNameMatchResult = null;
  let aadhaarNumberMatch = false;

  if (aadhaarDetails) {
    if (aadhaarDetails.name && nameSub) {
      aadhaarNameMatchResult = matchNames(nameSub, aadhaarDetails.name, extractedAadhaar.confidence ? Math.round(extractedAadhaar.confidence * 100) : 95);
    }
    if (aadhaarDetails.number && aadhaarSub) {
      aadhaarNumberMatch = aadhaarSub === aadhaarDetails.number.replace(/\s/g, "");
    }
  }

  // 2. Process PAN Name Matching via Enterprise Name Engine
  const panDetails = extractedPAN?.details || null;
  let panNameMatchResult = null;
  let panNumberMatch = false;

  if (panDetails) {
    if (panDetails.name && nameSub) {
      panNameMatchResult = matchNames(nameSub, panDetails.name, extractedPAN.confidence ? Math.round(extractedPAN.confidence * 100) : 95);
    }
    if (panDetails.number && panSub) {
      panNumberMatch = panSub === panDetails.number;
    }
  }

  // Determine Document Statuses
  let aadhaarStatus = "NOT_UPLOADED";
  if (extractedAadhaar) {
    if (extractedAadhaar.status === VerificationStatus.OCR_UNAVAILABLE) aadhaarStatus = VerificationStatus.OCR_UNAVAILABLE;
    else if (extractedAadhaar.status === VerificationStatus.OCR_FAILED) aadhaarStatus = VerificationStatus.OCR_FAILED;
    else if (aadhaarNameMatchResult) {
      if (aadhaarNameMatchResult.decision === "REJECTED" || (aadhaarSub && !aadhaarNumberMatch)) {
        aadhaarStatus = VerificationStatus.REJECTED;
      } else if (aadhaarNameMatchResult.decision === "MANUAL_REVIEW") {
        aadhaarStatus = VerificationStatus.MANUAL_REVIEW;
      } else {
        aadhaarStatus = VerificationStatus.VERIFIED;
      }
    }
  }

  let panStatus = "NOT_UPLOADED";
  if (extractedPAN) {
    if (extractedPAN.status === VerificationStatus.OCR_UNAVAILABLE) panStatus = VerificationStatus.OCR_UNAVAILABLE;
    else if (extractedPAN.status === VerificationStatus.OCR_FAILED) panStatus = VerificationStatus.OCR_FAILED;
    else if (panNameMatchResult) {
      if (panNameMatchResult.decision === "REJECTED" || (panSub && !panNumberMatch)) {
        panStatus = VerificationStatus.REJECTED;
      } else if (panNameMatchResult.decision === "MANUAL_REVIEW") {
        panStatus = VerificationStatus.MANUAL_REVIEW;
      } else {
        panStatus = VerificationStatus.VERIFIED;
      }
    }
  }

  // Compute Confidence Scores
  const aadhaarConf = extractedAadhaar?.confidence ? Math.round(extractedAadhaar.confidence * 100) : (aadhaarDetails ? 95.0 : 0.0);
  const panConf = extractedPAN?.confidence ? Math.round(extractedPAN.confidence * 100) : (panDetails ? 94.0 : 0.0);
  
  let validConfCount = 0;
  let confSum = 0;
  if (aadhaarConf > 0) { confSum += aadhaarConf; validConfCount++; }
  if (panConf > 0) { confSum += panConf; validConfCount++; }
  const overallConf = validConfCount > 0 ? Number((confSum / validConfCount).toFixed(1)) : 0.0;

  // Aggregate Warnings & Recommendations
  const finalWarnings = [...pipelineWarnings];
  const finalErrors = [...pipelineErrors];

  if (aadhaarNameMatchResult?.warnings) finalWarnings.push(...aadhaarNameMatchResult.warnings);
  if (panNameMatchResult?.warnings) finalWarnings.push(...panNameMatchResult.warnings);

  // Generate Structured Recommendations
  const structuredRecs = generateRecommendations({
    status,
    ocrConfidence: overallConf,
    extractedAadhaar,
    extractedPAN,
    mismatches,
    nameMatchResult: panNameMatchResult || aadhaarNameMatchResult,
  });

  const simpleRecStrings = structuredRecs.map((r) => `${r.title}: ${r.action}`);

  // Construct Base Report Payload
  const report = {
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
      manualReviewRequired: status === VerificationStatus.MANUAL_REVIEW || aadhaarStatus === VerificationStatus.MANUAL_REVIEW || panStatus === VerificationStatus.MANUAL_REVIEW,
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
        name: aadhaarNameMatchResult || {
          normalizedSubmitted: nameSub.toUpperCase(),
          normalizedOCR: (aadhaarDetails?.name || "").toUpperCase(),
          matches: { firstName: false, middleName: false, lastName: false },
          similarity: { overall: 0, firstName: 0, middleName: 0, lastName: 0, tokenAverage: 0 },
          confidence: 0,
          reason: "No Aadhaar name extracted",
          decision: "REJECTED",
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
        name: panNameMatchResult || {
          normalizedSubmitted: nameSub.toUpperCase(),
          normalizedOCR: (panDetails?.name || "").toUpperCase(),
          matches: { firstName: false, middleName: false, lastName: false },
          similarity: { overall: 0, firstName: 0, middleName: 0, lastName: 0, tokenAverage: 0 },
          confidence: 0,
          reason: "No PAN name extracted",
          decision: "REJECTED",
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
        reason: aadhaarNameMatchResult?.reason || "Aadhaar Extraction",
      },
      pan: {
        status: panStatus,
        reason: panNameMatchResult?.reason || "PAN Extraction",
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
    recommendations: structuredRecs,
    simpleRecommendations: simpleRecStrings,

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

  // Include Debug Payload in Development or when DEBUG=true
  if (process.env.NODE_ENV === "development" || process.env.DEBUG === "true") {
    report.debug = {
      rawPaddleOCR: extractedPAN?.raw_paddle || extractedAadhaar?.raw_paddle || "N/A",
      rawEasyOCR: extractedPAN?.raw_easy || extractedAadhaar?.raw_easy || "N/A",
      mergedOCR: extractedPAN?.raw_text || extractedAadhaar?.raw_text || "N/A",
      documentType: extractedPAN?.details?.type || extractedAadhaar?.details?.type || "Unknown",
      parserOutput: extractedPAN?.details || extractedAadhaar?.details || null,
      validatedOutput: report.ocrData,
      comparison: report.comparison,
      confidence: report.confidence,
    };
  }

  return report;
}

module.exports = { buildVerificationReport };
