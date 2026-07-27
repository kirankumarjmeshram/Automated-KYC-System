/**
 * Enterprise Name Matching Engine
 * Reusable single source of truth for comparing person names across all KYC documents
 * (Aadhaar, PAN, Passport, Driving Licence, Voter ID, etc.)
 */

/**
 * 1. Normalization Pipeline
 * Converts uppercase, collapses whitespace, strips punctuation/dots/special chars, normalizes Unicode.
 */
function normalizeName(rawName) {
  if (!rawName || typeof rawName !== "string") return "";

  return rawName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove Unicode diacritics
    .toUpperCase()
    .replace(/[\.,\-\/#\$%\^&\*;:{}=\-_`~()]/g, " ") // Replace punctuation & dots with spaces
    .replace(/[^A-Z\s]/g, "") // Keep only A-Z and spaces
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim();
}

/**
 * 2. Tokenization Pipeline
 * Splits normalized name into firstName, middleNames, lastName, and tokens array.
 */
function tokenizeName(normalizedName) {
  if (!normalizedName) {
    return { firstName: "", middleNames: [], lastName: "", tokens: [] };
  }

  const rawTokens = normalizedName.split(" ").filter(Boolean);
  
  // Remove duplicate consecutive tokens
  const tokens = rawTokens.filter((token, index) => token !== rawTokens[index - 1]);

  if (tokens.length === 0) {
    return { firstName: "", middleNames: [], lastName: "", tokens: [] };
  }

  if (tokens.length === 1) {
    return {
      firstName: tokens[0],
      middleNames: [],
      lastName: "",
      tokens,
    };
  }

  const firstName = tokens[0];
  const lastName = tokens[tokens.length - 1];
  const middleNames = tokens.slice(1, tokens.length - 1);

  return {
    firstName,
    middleNames,
    lastName,
    tokens,
  };
}

/**
 * Helper: Levenshtein distance ratio (0 to 100)
 */
function levenshteinSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 100;

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
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[j - 1] ? dp[i][j - 1] : dp[i - 1][j], dp[i - 1][j - 1]);
      }
    }
  }

  const maxLen = Math.max(m, n);
  const dist = dp[m][n];
  return Math.round(((maxLen - dist) / maxLen) * 100);
}

/**
 * 3. Matching Engine & Rule Evaluator
 * Evaluates similarity and applies business rules.
 */
function matchNames(submittedName, ocrName, ocrConfidence = 95) {
  const normSub = normalizeName(submittedName);
  const normOcr = normalizeName(ocrName);

  const subTok = tokenizeName(normSub);
  const ocrTok = tokenizeName(normOcr);

  let firstNameSim = levenshteinSimilarity(subTok.firstName, ocrTok.firstName);
  let lastNameSim = levenshteinSimilarity(subTok.lastName, ocrTok.lastName);

  // If names were tokenized with 1 token on one side vs 2 on other (e.g. "KIRANKUMAR MESHRAM" vs "KIRANKUMARMESHRAM")
  if (subTok.firstName && ocrTok.firstName && (normSub.replace(/\s/g, "") === normOcr.replace(/\s/g, ""))) {
    firstNameSim = 100;
    lastNameSim = 100;
  }

  const firstMatch = firstNameSim >= 80;
  const lastMatch = subTok.lastName && ocrTok.lastName ? lastNameSim >= 80 : false;

  // Middle Name Similarity & Abbreviation Check
  let middleSim = 100;
  let middleMatch = true;
  let isMiddleAbbreviated = false;
  let isMiddleMissing = false;

  const subMiddleStr = subTok.middleNames.join(" ");
  const ocrMiddleStr = ocrTok.middleNames.join(" ");

  if (subMiddleStr && ocrMiddleStr) {
    if (subMiddleStr === ocrMiddleStr) {
      middleSim = 100;
      middleMatch = true;
    } else if (
      (subMiddleStr.length === 1 && ocrMiddleStr.startsWith(subMiddleStr)) ||
      (ocrMiddleStr.length === 1 && subMiddleStr.startsWith(ocrMiddleStr))
    ) {
      // Rule 2: Initial Match (e.g. "J" vs "JAGESHWAR")
      middleSim = 95;
      middleMatch = true;
      isMiddleAbbreviated = true;
    } else {
      middleSim = levenshteinSimilarity(subMiddleStr, ocrMiddleStr);
      middleMatch = middleSim >= 70;
    }
  } else if (subMiddleStr && !ocrMiddleStr) {
    // Rule 3: Middle Missing on OCR
    middleSim = 80;
    middleMatch = true;
    isMiddleMissing = true;
  } else if (!subMiddleStr && ocrMiddleStr) {
    middleSim = 85;
    middleMatch = true;
  }

  // Token Average Similarity
  const allSubTokens = subTok.tokens;
  const allOcrTokens = ocrTok.tokens;
  let matchedTokenCount = 0;

  allSubTokens.forEach((st) => {
    const bestMatch = allOcrTokens.some(
      (ot) => ot === st || (ot.length === 1 && st.startsWith(ot)) || (st.length === 1 && ot.startsWith(st)) || levenshteinSimilarity(st, ot) >= 80
    );
    if (bestMatch) matchedTokenCount++;
  });

  const maxTokenLen = Math.max(allSubTokens.length, allOcrTokens.length) || 1;
  const tokenAverage = Math.round((matchedTokenCount / maxTokenLen) * 100);

  // Overall Weighted Similarity
  let overallSim = Math.round(firstNameSim * 0.4 + lastNameSim * 0.4 + middleSim * 0.2);
  if (normSub === normOcr) {
    overallSim = 100;
  } else if (firstMatch && lastMatch && isMiddleAbbreviated) {
    overallSim = Math.max(overallSim, 98);
  } else if (firstMatch && lastMatch && isMiddleMissing) {
    overallSim = Math.max(overallSim, 95);
  }

  // Decision & Reasoning Rules
  let decision = "REJECTED";
  let reason = "Name mismatch.";
  const warnings = [];

  if (firstMatch && lastMatch) {
    if (isMiddleAbbreviated) {
      decision = "VERIFIED";
      reason = "Middle name abbreviated on document.";
      warnings.push("Middle name abbreviated.");
    } else if (isMiddleMissing) {
      decision = "VERIFIED";
      reason = "Middle name omitted on document.";
      warnings.push("Middle name missing on OCR.");
    } else if (!middleMatch) {
      // Rule 1: First and Last match, middle differs
      decision = "VERIFIED";
      reason = "First and last name matched, middle name differs.";
      warnings.push("Middle name mismatch.");
    } else {
      decision = "VERIFIED";
      reason = "Full name matched successfully.";
    }
  } else if (firstMatch && (!subTok.lastName || !ocrTok.lastName)) {
    // Rule 4: First matches, last missing
    decision = "MANUAL_REVIEW";
    reason = "First name matched, but last name is missing on document.";
    warnings.push("Missing surname on document.");
  } else if (!firstMatch && lastMatch) {
    // Rule 5: Only surname matches
    decision = "REJECTED";
    reason = "Only surname matched, first name differs.";
  } else if (firstMatch && !lastMatch) {
    // Rule 6: Only first name matches
    decision = "MANUAL_REVIEW";
    reason = "Only first name matched, surname differs.";
    warnings.push("Surname mismatch.");
  } else {
    // Rule 7: Nothing matches
    decision = "REJECTED";
    reason = "First name and surname both failed matching.";
  }

  // Calculate Final Confidence Score
  const confFactor = Math.min(1.0, ocrConfidence / 100);
  const confidence = Math.round(overallSim * 0.7 + tokenAverage * 0.3 * confFactor);

  return {
    normalizedSubmitted: normSub,
    normalizedOCR: normOcr,
    tokens: {
      submitted: {
        firstName: subTok.firstName,
        middleNames: subTok.middleNames,
        lastName: subTok.lastName,
      },
      ocr: {
        firstName: ocrTok.firstName,
        middleNames: ocrTok.middleNames,
        lastName: ocrTok.lastName,
      },
    },
    matches: {
      firstName: firstMatch,
      middleName: middleMatch,
      lastName: lastMatch,
    },
    similarity: {
      overall: overallSim,
      firstName: firstNameSim,
      middleName: middleSim,
      lastName: lastNameSim,
      tokenAverage,
    },
    confidence,
    reason,
    warnings,
    decision,
  };
}

module.exports = {
  normalizeName,
  tokenizeName,
  matchNames,
};
