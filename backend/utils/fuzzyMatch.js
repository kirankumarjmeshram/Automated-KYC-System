/**
 * Fuzzy Name Matching Utility
 * Computes similarity between submitted user name and OCR extracted name.
 * Handles middle name variations, minor OCR typos, and token order differences.
 */

function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

function normalizeName(name) {
  if (!name) return "";
  return name
    .toUpperCase()
    .replace(/[^A-Z\s]/g, "") // Remove non-alphabet chars
    .replace(/\s+/g, " ")
    .trim();
}

function calculateNameSimilarity(submittedName, ocrName) {
  const normSub = normalizeName(submittedName);
  const normOcr = normalizeName(ocrName);

  if (!normSub || !normOcr) return 0;

  // 1. Exact string match
  if (normSub === normOcr) return 100;

  // 2. Substring match (e.g. "KIRANKUMAR MESHRAM" inside "KIRANKUMAR JAGESHWAR MESHRAM")
  if (normOcr.includes(normSub) || normSub.includes(normOcr)) {
    return 95;
  }

  // 3. Token-set intersection match
  const subTokens = normSub.split(" ");
  const ocrTokens = normOcr.split(" ");

  const subTokenSet = new Set(subTokens);
  const ocrTokenSet = new Set(ocrTokens);

  let matchCount = 0;
  subTokens.forEach((t) => {
    if (ocrTokenSet.has(t)) matchCount++;
  });

  const tokenSimilarity = (matchCount / Math.max(subTokens.length, ocrTokens.length)) * 100;

  // If first and last name match, consider high similarity
  if (subTokens.length >= 2 && ocrTokens.length >= 2) {
    const firstSub = subTokens[0];
    const lastSub = subTokens[subTokens.length - 1];
    const firstOcr = ocrTokens[0];
    const lastOcr = ocrTokens[ocrTokens.length - 1];

    if (firstSub === firstOcr && lastSub === lastOcr) {
      return Math.max(tokenSimilarity, 90);
    }
  }

  // 4. Levenshtein edit distance ratio
  const maxLen = Math.max(normSub.length, normOcr.length);
  const dist = levenshteinDistance(normSub, normOcr);
  const levSimilarity = ((maxLen - dist) / maxLen) * 100;

  return Math.round(Math.max(tokenSimilarity, levSimilarity));
}

module.exports = { calculateNameSimilarity, normalizeName };
