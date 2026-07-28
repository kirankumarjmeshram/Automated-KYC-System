/**
 * Enterprise Name Matching Engine
 * Reusable single source of truth for comparing person names across all KYC documents
 * (Aadhaar, PAN, Passport, Driving Licence, Voter ID, etc.)
 */

const { OCR_NOISE_WORDS: NOISE_ARRAY, normalizeName } = require("../constants/ocrNoiseWords");

const OCR_NOISE_WORDS = new Set(NOISE_ARRAY.map((w) => w.toUpperCase()));

/**
 * 2. Tokenization Pipeline
 * Splits normalized name into firstName, middleNames, lastName, and tokens array.
 */
function tokenizeName(normalizedName) {
  if (!normalizedName) {
    return { firstName: "", middleNames: [], lastName: "", tokens: [] };
  }

  const rawTokens = normalizedName.split(" ").filter(Boolean);
  // Filter out duplicate consecutive tokens
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
 * Levenshtein Distance Ratio (0 to 100)
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
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  const maxLen = Math.max(m, n);
  const dist = dp[m][n];
  return Math.round(((maxLen - dist) / maxLen) * 100);
}

/**
 * Jaro-Winkler Similarity (0 to 100)
 */
function jaroWinklerSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 100;

  const len1 = s1.length;
  const len2 = s2.length;
  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;

  const matches1 = new Array(len1).fill(false);
  const matches2 = new Array(len2).fill(false);

  let matchCount = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);
    for (let j = start; j < end; j++) {
      if (!matches2[j] && s1[i] === s2[j]) {
        matches1[i] = true;
        matches2[j] = true;
        matchCount++;
        break;
      }
    }
  }

  if (matchCount === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (matches1[i]) {
      while (!matches2[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }
  }

  const jaro = (matchCount / len1 + matchCount / len2 + (matchCount - transpositions / 2) / matchCount) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, len1, len2); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  const jw = jaro + prefix * 0.1 * (1 - jaro);
  return Math.round(jw * 100);
}

/**
 * Combined String Similarity (Max of Levenshtein and Jaro-Winkler)
 */
function stringSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 100;
  return Math.max(levenshteinSimilarity(s1, s2), jaroWinklerSimilarity(s1, s2));
}

/**
 * Checks if two tokens form a valid initial match (e.g. "J" vs "JAGESHWAR")
 */
function isInitialMatch(t1, t2) {
  if (!t1 || !t2) return false;
  if (t1 === t2) return true;
  if (t1.length === 1 && t2.startsWith(t1)) return true;
  if (t2.length === 1 && t1.startsWith(t2)) return true;
  return false;
}

/**
 * 3. Matching Engine & Smarter Decision Evaluator
 * Compares normalized names using token matching, fuzzy algorithms, initial support,
 * weighted confidence (35% First, 35% Last, 20% Middle, 10% Token Overall), and context signals.
 */
function matchNames(submittedName, ocrName, ocrConfidence = 95, context = {}) {
  const normSub = normalizeName(submittedName);
  const normOcr = normalizeName(ocrName);

  const subTok = tokenizeName(normSub);
  const ocrTok = tokenizeName(normOcr);

  let removedNoiseWords = [];
  if (ocrName) {
    const rawOcrUpper = ocrName.toUpperCase();
    removedNoiseWords = rawOcrUpper
      .split(/[^A-Z]/)
      .filter((w) => OCR_NOISE_WORDS.has(w));
  }

  // 1. Exact Match or Unordered Token Set Equivalence
  const ocrTokenSet = new Set(ocrTok.tokens);
  const isExactStringMatch = normSub === normOcr;
  const isUnorderedSetMatch =
    subTok.tokens.length > 0 &&
    ocrTok.tokens.length > 0 &&
    subTok.tokens.length === ocrTok.tokens.length &&
    subTok.tokens.every((t) => ocrTokenSet.has(t));

  // 2. Token Matching Engine
  let matchedTokenCount = 0;
  let totalTokenSim = 0;
  let initialMatchUsed = false;

  subTok.tokens.forEach((st) => {
    let bestSim = 0;
    ocrTok.tokens.forEach((ot) => {
      if (st === ot) {
        bestSim = Math.max(bestSim, 100);
      } else if (isInitialMatch(st, ot)) {
        bestSim = Math.max(bestSim, 95);
        initialMatchUsed = true;
      } else {
        const sim = stringSimilarity(st, ot);
        if (sim >= 75) {
          bestSim = Math.max(bestSim, sim);
        }
      }
    });

    if (bestSim >= 75) matchedTokenCount++;
    totalTokenSim += bestSim;
  });

  const tokenAverage = Math.round(totalTokenSim / Math.max(subTok.tokens.length, 1));

  // 3. First, Last, and Middle Component Evaluation
  const findBestComponentSim = (targetToken) => {
    if (!targetToken) return { sim: 100, isInitial: false };
    let bestSim = 0;
    let isInitial = false;
    ocrTok.tokens.forEach((ot) => {
      if (targetToken === ot) {
        bestSim = Math.max(bestSim, 100);
      } else if (isInitialMatch(targetToken, ot)) {
        bestSim = Math.max(bestSim, 95);
        isInitial = true;
      } else {
        const sim = stringSimilarity(targetToken, ot);
        if (sim > bestSim) bestSim = sim;
      }
    });
    return { sim: bestSim, isInitial };
  };

  const firstComp = findBestComponentSim(subTok.firstName);
  const lastComp = findBestComponentSim(subTok.lastName);

  const firstNameSim = firstComp.sim;
  const lastNameSim = lastComp.sim;
  const isFirstInitial = firstComp.isInitial;
  const isLastInitial = lastComp.isInitial;

  const firstMatch = firstNameSim >= 75;
  const lastMatch = subTok.lastName && ocrTok.tokens.length > 1 ? lastNameSim >= 75 : true;

  // Middle Name Evaluation
  let middleSim = 100;
  let middleMatch = true;
  let isMiddleAbbreviated = false;
  let isMiddleMissing = false;

  const subMiddleStr = subTok.middleNames.join(" ");
  const ocrMiddleStr = ocrTok.middleNames.join(" ");

  if (subMiddleStr && ocrMiddleStr) {
    if (subMiddleStr === ocrMiddleStr) {
      middleSim = 100;
    } else if (
      (subMiddleStr.length === 1 && ocrMiddleStr.startsWith(subMiddleStr)) ||
      (ocrMiddleStr.length === 1 && subMiddleStr.startsWith(ocrMiddleStr))
    ) {
      middleSim = 95;
      isMiddleAbbreviated = true;
    } else {
      middleSim = stringSimilarity(subMiddleStr, ocrMiddleStr);
      middleMatch = middleSim >= 70;
    }
  } else if (subMiddleStr && !ocrMiddleStr) {
    const middleMatchedAny = subTok.middleNames.some((mt) =>
      ocrTok.tokens.some((ot) => mt === ot || isInitialMatch(mt, ot) || stringSimilarity(mt, ot) >= 75)
    );
    if (middleMatchedAny) {
      middleSim = 95;
    } else {
      middleSim = 90;
      isMiddleMissing = true;
    }
  } else if (!subMiddleStr && ocrMiddleStr) {
    middleSim = 95;
  }

  // 4. Weighted Confidence Calculation (35% First, 35% Last, 20% Middle, 10% Token Overall)
  let weightedSim = Math.round(
    firstNameSim * 0.35 +
      lastNameSim * 0.35 +
      middleSim * 0.20 +
      tokenAverage * 0.10
  );

  if (isExactStringMatch || isUnorderedSetMatch) {
    weightedSim = 100;
  } else if (firstMatch && lastMatch && (isMiddleAbbreviated || isMiddleMissing)) {
    weightedSim = Math.max(weightedSim, 95);
  }

  const confFactor = Math.min(1.0, ocrConfidence / 100);
  const confidence = Math.round(weightedSim * 0.85 + confFactor * 15);

  // 5. Smarter Decision Rules Engine
  let decision = "REJECTED";
  let reason = "Name mismatch.";
  const warnings = [];

  let noiseNote = "";
  if (removedNoiseWords.length > 0) {
    const uniqueNoise = [...new Set(removedNoiseWords)].map((w) => `'${w}'`).join(", ");
    noiseNote = ` OCR contained extra tokens (${uniqueNoise}) that were removed during normalization.`;
  }

  if (context.numberMatched && context.dobMatched && (isExactStringMatch || isUnorderedSetMatch || weightedSim >= 80)) {
    decision = "VERIFIED";
    reason = `Document number and DOB matched exactly.${noiseNote} Remaining name tokens matched successfully.`;
    if (isMiddleAbbreviated || initialMatchUsed) warnings.push("Middle name abbreviated.");
    if (isMiddleMissing) warnings.push("Middle name omitted on document.");
  } else if (isExactStringMatch || isUnorderedSetMatch) {
    decision = "VERIFIED";
    reason = `Full name matched successfully.${noiseNote}`;
  } else if (weightedSim >= 90) {
    decision = "VERIFIED";
    reason = `Name matched with high confidence (${weightedSim}%).${noiseNote}`;
    if (isMiddleAbbreviated || initialMatchUsed) warnings.push("Middle name abbreviated.");
    if (isMiddleMissing) warnings.push("Middle name omitted on document.");
  } else if (firstMatch && lastMatch) {
    decision = "VERIFIED";
    if (isMiddleAbbreviated || initialMatchUsed || isFirstInitial || isLastInitial) {
      reason = `Name tokens matched successfully with initial abbreviations.${noiseNote}`;
      warnings.push("Name contains initial abbreviations.");
    } else if (isMiddleMissing) {
      reason = `First and last name matched successfully, middle name omitted on document.${noiseNote}`;
      warnings.push("Middle name missing on document.");
    } else {
      reason = `Name tokens matched successfully with minor OCR variation.${noiseNote}`;
    }
  } else if (firstMatch && !subTok.lastName) {
    decision = "VERIFIED";
    reason = `First name matched successfully.${noiseNote}`;
  } else if (firstMatch && !lastMatch && context.numberMatched) {
    decision = "VERIFIED";
    reason = `Document number matched. First name matched successfully.${noiseNote}`;
  } else if (firstMatch && !lastMatch) {
    decision = "MANUAL_REVIEW";
    reason = `Only first name matched, surname differs.${noiseNote}`;
    warnings.push("Surname mismatch.");
  } else if (!firstMatch && lastMatch) {
    decision = "REJECTED";
    reason = `Only surname matched, first name differs.`;
  } else {
    decision = "REJECTED";
    reason = `First name and surname both failed matching.`;
  }

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
      overall: weightedSim,
      firstName: firstNameSim,
      middleName: middleSim,
      lastName: lastNameSim,
      tokenAverage,
    },
    confidence: Math.max(confidence, weightedSim >= 90 ? weightedSim : confidence),
    reason,
    warnings,
    decision,
  };
}

module.exports = {
  normalizeName,
  tokenizeName,
  matchNames,
  levenshteinSimilarity,
  jaroWinklerSimilarity,
  stringSimilarity,
};
