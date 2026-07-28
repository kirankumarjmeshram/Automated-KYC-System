const assert = require("assert");
const {
  normalizeName,
  tokenizeName,
  matchNames,
  levenshteinSimilarity,
  jaroWinklerSimilarity,
  stringSimilarity,
} = require("../utils/nameMatcher");

console.log("==================================================");
console.log("RUNNING AUTOMATED UNIT TESTS: NAME MATCHING ENGINE");
console.log("==================================================\n");

let passed = 0;
let failed = 0;

function runTest(testName, testFn) {
  try {
    testFn();
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${testName}: ${err.message}`);
    failed++;
  }
}

// 1. Exact Match Test
runTest("1. Exact Match", () => {
  const result = matchNames("KIRANKUMAR JAGESHWAR MESHRAM", "KIRANKUMAR JAGESHWAR MESHRAM");
  assert.strictEqual(result.decision, "VERIFIED");
  assert.strictEqual(result.confidence, 100);
});

// 2. Initials vs Full Names Test
runTest("2. Initials vs Full Names", () => {
  const result1 = matchNames("KIRANKUMAR JAGESHWAR MESHRAM", "KIRANKUMAR J MESHRAM");
  assert.strictEqual(result1.decision, "VERIFIED");
  assert.ok(result1.confidence >= 90);

  const result2 = matchNames("KIRANKUMAR JAGESHWAR MESHRAM", "K J MESHRAM");
  assert.strictEqual(result2.decision, "VERIFIED");
  assert.ok(result2.confidence >= 85);
});

// 3. OCR Noise Removal Test
runTest("3. OCR Noise Removal (GF DRH)", () => {
  const result = matchNames("KIRANKUMAR JAGESHWAR MESHRAM", "KIRANKUMAR JAGESHWAR MESHRAM GF DRH");
  assert.strictEqual(result.decision, "VERIFIED");
  assert.strictEqual(result.confidence, 100);
  assert.ok(result.reason.includes("extra tokens"));
});

// 4. Token Order Changes Test
runTest("4. Token Order Changes", () => {
  const result = matchNames("KIRANKUMAR JAGESHWAR MESHRAM", "MESHRAM KIRANKUMAR JAGESHWAR");
  assert.strictEqual(result.decision, "VERIFIED");
  assert.strictEqual(result.confidence, 100);
});

// 5. Minor OCR Spelling Errors Test
runTest("5. Minor OCR Spelling Errors (Levenshtein & Jaro-Winkler)", () => {
  const result = matchNames("KIRANKUMAR JAGESHWAR MESHRAM", "KIRANKUMAR JAGESWAR MESRAM");
  assert.strictEqual(result.decision, "VERIFIED");
  assert.ok(result.confidence >= 85);
});

// 6. Extra OCR Words Test (UIDAI INDIA GOVT)
runTest("6. Extra OCR Words Removal", () => {
  const result = matchNames("KIRANKUMAR JAGESHWAR MESHRAM", "KIRANKUMAR JAGESHWAR MESHRAM UIDAI INDIA GOVT");
  assert.strictEqual(result.decision, "VERIFIED");
  assert.strictEqual(result.confidence, 100);
});

// 7. Missing Middle Names Test
runTest("7. Missing Middle Names", () => {
  const result = matchNames("KIRANKUMAR JAGESHWAR MESHRAM", "KIRANKUMAR MESHRAM");
  assert.strictEqual(result.decision, "VERIFIED");
  assert.ok(result.confidence >= 90);
});

// 8. Double Spaces Normalization Test
runTest("8. Double Spaces Normalization", () => {
  const result = matchNames("KIRANKUMAR   JAGESHWAR  MESHRAM", "KIRANKUMAR JAGESHWAR MESHRAM");
  assert.strictEqual(result.decision, "VERIFIED");
  assert.strictEqual(result.confidence, 100);
});

// 9. Mixed Case Input Normalization Test
runTest("9. Mixed Case Input Normalization", () => {
  const result = matchNames("Kirankumar Jageshwar Meshram", "KIRANKUMAR JAGESHWAR MESHRAM");
  assert.strictEqual(result.decision, "VERIFIED");
  assert.strictEqual(result.confidence, 100);
});

// 10. Smarter Decision Rules Test (Document Number & DOB Match Context)
runTest("10. Smarter Decision Rules (Context Match Upgrade)", () => {
  const result = matchNames(
    "KIRANKUMAR JAGESHWAR MESHRAM",
    "KIRANKUMAR JAGESHWAR MESHRAM",
    95,
    { numberMatched: true, dobMatched: true }
  );
  assert.strictEqual(result.decision, "VERIFIED");
  assert.ok(result.reason.includes("Document number and DOB matched exactly"));
});

console.log("\n==================================================");
console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED out of ${passed + failed} TESTS`);
console.log("==================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
