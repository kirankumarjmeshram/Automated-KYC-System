/**
 * Recommendation Engine
 * Analyzes OCR confidence, field extraction results, name matching, and pipeline diagnostics.
 * Produces structured, user-friendly recommendation objects for UI and Admin dashboards.
 * 
 * Schema:
 * [
 *   {
 *     "code": "LOW_IMAGE_QUALITY",
 *     "severity": "warning" | "danger" | "info",
 *     "title": "Low Image Quality",
 *     "description": "OCR confidence is below 80%.",
 *     "action": "Retake the document using better lighting."
 *   }
 * ]
 */

function generateRecommendations({
  status,
  ocrConfidence = 100,
  extractedAadhaar = null,
  extractedPAN = null,
  mismatches = [],
  nameMatchResult = null,
}) {
  const recommendations = [];

  // 1. Image Quality & Low OCR Confidence
  if (ocrConfidence > 0 && ocrConfidence < 80) {
    recommendations.push({
      code: "LOW_IMAGE_QUALITY",
      severity: "warning",
      title: "Low Image Quality Detected",
      description: `OCR confidence score (${ocrConfidence}%) is below 80% threshold.`,
      action: "Retake the document using a higher resolution camera with adequate focus.",
    });
  }

  // 2. AI OCR Service Offline / Unavailable
  if (status === "OCR_UNAVAILABLE") {
    recommendations.push({
      code: "AI_SERVICE_OFFLINE",
      severity: "warning",
      title: "AI Service Unreachable",
      description: "Automated AI OCR microservice is unconfigured or offline.",
      action: "Ensure Python FastAPI microservice is running on port 8000.",
    });
  }

  // 3. OCR Failed to Extract Text
  if (status === "OCR_FAILED") {
    recommendations.push({
      code: "UNREADABLE_DOCUMENT",
      severity: "danger",
      title: "Unreadable Document Image",
      description: "OCR engine could not read legible identity text from uploaded files.",
      action: "Capture the document in portrait orientation under bright lighting without glare or reflection.",
    });
    recommendations.push({
      code: "DOCUMENT_CROPPED",
      severity: "info",
      title: "Ensure Full Document Alignment",
      description: "Document edges or corners may be cut off.",
      action: "Capture the complete document including all 4 edges and corner borders.",
    });
  }

  // 4. Attribute Mismatches & Rejected Verification
  if (status === "REJECTED" || mismatches.length > 0) {
    if (mismatches.some((m) => m.includes("PAN"))) {
      recommendations.push({
        code: "PAN_MISMATCH",
        severity: "danger",
        title: "PAN Details Mismatch",
        description: "Submitted PAN number or card holder name does not match extracted card details.",
        action: "Verify the PAN number and applicant name entered in the form.",
      });
    }
    if (mismatches.some((m) => m.includes("Aadhaar"))) {
      recommendations.push({
        code: "AADHAAR_MISMATCH",
        severity: "danger",
        title: "Aadhaar Details Mismatch",
        description: "Submitted Aadhaar number or card holder name does not match extracted card details.",
        action: "Verify the 12-digit Aadhaar number entered in the form.",
      });
    }
  }

  // 5. Name Abbreviation / Manual Review Warnings
  if (nameMatchResult) {
    if (nameMatchResult.warnings && nameMatchResult.warnings.includes("Middle name abbreviated.")) {
      recommendations.push({
        code: "MIDDLE_NAME_ABBREVIATED",
        severity: "info",
        title: "Middle Name Abbreviated",
        description: "Middle name appears abbreviated on document (e.g., 'J' vs 'JAGESHWAR').",
        action: "Verification accepted automatically based on rule engine.",
      });
    }
    if (nameMatchResult.decision === "MANUAL_REVIEW") {
      recommendations.push({
        code: "MANUAL_REVIEW_REQUIRED",
        severity: "warning",
        title: "Compliance Officer Review Recommended",
        description: "Name matching rule flagged for manual compliance review.",
        action: "Forward report to a compliance officer for review.",
      });
    }
  }

  return recommendations;
}

module.exports = { generateRecommendations };
