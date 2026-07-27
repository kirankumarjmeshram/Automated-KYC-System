/**
 * Verification Status Enum
 * Represents the deterministic state of a KYC submission across the verification pipeline.
 */
const VerificationStatus = Object.freeze({
  UPLOADED: "UPLOADED",
  OCR_UNAVAILABLE: "OCR_UNAVAILABLE",
  OCR_PROCESSING: "OCR_PROCESSING",
  OCR_COMPLETED: "OCR_COMPLETED",
  FACE_VERIFICATION: "FACE_VERIFICATION",
  LIVENESS_VERIFICATION: "LIVENESS_VERIFICATION",
  VERIFIED: "VERIFIED",
  MANUAL_REVIEW: "MANUAL_REVIEW",
  OCR_FAILED: "OCR_FAILED",
  REJECTED: "REJECTED",
});

module.exports = VerificationStatus;
