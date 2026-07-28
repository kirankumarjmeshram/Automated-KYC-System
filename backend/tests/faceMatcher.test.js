const assert = require("assert");
const { buildVerificationReport } = require("../utils/verificationReportBuilder");
const VerificationStatus = require("../constants/verificationStatus");

console.log("==================================================");
console.log("RUNNING AUTOMATED UNIT TESTS: FACE MATCHING ENGINE");
console.log("==================================================");

let testsPassed = 0;
let testsFailed = 0;

function runTest(testName, testFn) {
  try {
    testFn();
    console.log(`✅ [PASS] ${testName}`);
    testsPassed++;
  } catch (err) {
    console.log(`❌ [FAIL] ${testName}: ${err.message}`);
    testsFailed++;
  }
}

// Test 1: Backward Compatibility (No selfie uploaded)
runTest("1. Backward Compatibility (No Selfie Uploaded)", () => {
  const report = buildVerificationReport({
    traceId: "test-no-selfie",
    status: VerificationStatus.VERIFIED,
    verified: true,
    startTime: Date.now(),
    submittedData: { name: "KIRANKUMAR JAGESHWAR MESHRAM" },
    faceVerification: null
  });

  assert.strictEqual(report.summary.faceVerified, false);
  assert.strictEqual(report.pipeline.faceVerification, "PENDING");
  assert.strictEqual(report.faceVerification, null);
});

// Test 2: Matching Selfie Uploaded
runTest("2. Matching Selfie Uploaded (Similarity >= 75%)", () => {
  const mockFace = {
    verified: true,
    similarity: 94.2,
    confidence: 94.2,
    threshold: 75.0,
    reason: "Face match verified with 94.2% similarity."
  };

  const report = buildVerificationReport({
    traceId: "test-matching-selfie",
    status: VerificationStatus.VERIFIED,
    verified: true,
    startTime: Date.now(),
    submittedData: { name: "KIRANKUMAR JAGESHWAR MESHRAM" },
    faceVerification: mockFace
  });

  assert.strictEqual(report.summary.faceVerified, true);
  assert.strictEqual(report.pipeline.faceVerification, "SUCCESS");
  assert.deepStrictEqual(report.faceVerification, mockFace);
});

// Test 3: Mismatched Selfie Uploaded
runTest("3. Mismatched Selfie Uploaded (Similarity < 75%)", () => {
  const mockFace = {
    verified: false,
    similarity: 42.1,
    confidence: 42.1,
    threshold: 75.0,
    reason: "Face mismatch: similarity (42.1%) is below 75% threshold."
  };

  const report = buildVerificationReport({
    traceId: "test-mismatched-selfie",
    status: VerificationStatus.REJECTED,
    verified: false,
    startTime: Date.now(),
    submittedData: { name: "KIRANKUMAR JAGESHWAR MESHRAM" },
    faceVerification: mockFace
  });

  assert.strictEqual(report.summary.faceVerified, false);
  assert.strictEqual(report.pipeline.faceVerification, "MISMATCH");
  assert.deepStrictEqual(report.faceVerification, mockFace);
});

console.log("==================================================");
console.log(`SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED out of ${testsPassed + testsFailed} TESTS`);
console.log("==================================================");

process.exit(testsFailed > 0 ? 1 : 0);
