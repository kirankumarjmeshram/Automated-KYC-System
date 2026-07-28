/**
 * Configurable OCR Noise Dictionary
 * List of known OCR artifacts & garbage words to filter out during name display and verification.
 */
const OCR_NOISE_WORDS = [
  "GF",
  "DRH",
  "UIDAI",
  "INDIA",
  "GOVT",
  "GOVERNMENT",
  "DOB",
  "MALE",
  "FEMALE",
  "SIGNATURE",
  "YEAR",
  "QR",
  "PHOTO",
  "BHARAT",
  "SARKAR",
  "ADDRESS",
  "PATTA",
  "DATE",
  "BIRTH",
  "FATHER",
  "MOTHER",
  "HUSBAND",
  "NAME",
  "S/O",
  "D/O",
  "W/O",
  "C/O",
  "SO",
  "DO",
  "WO",
  "CO",
  "VID",
  "CARD",
  "NUMBER",
  "UNIQUE",
  "IDENTIFICATION",
  "AUTHORITY",
  "ISSUE",
  "DOWNLOAD",
  "INCOME",
  "TAX",
  "DEPARTMENT",
  "PERMANENT",
  "ACCOUNT",
  "TNG",
  "TENN",
  "HRS",
  "TNR",
  "BIGRATURE",
  "HRT",
  "HER",
  "FAT",
  "TT",
  "313XY",
  "313ZR",
  "H161",
  "HRCY",
  "FAFEEZ",
  "QFERCUT",
  "QFERCU"
];

const noiseSet = new Set(OCR_NOISE_WORDS.map((w) => w.toUpperCase()));

/**
 * Normalizes a name string:
 * - Converts to uppercase
 * - Trims spaces & collapses duplicate spaces
 * - Removes every word present in OCR_NOISE_WORDS
 *
 * Example:
 * Input: "KIRANKUMAR JAGESHWAR MESHRAM GF DRH"
 * Output: "KIRANKUMAR JAGESHWAR MESHRAM"
 */
function normalizeName(name) {
  if (!name || typeof name !== "string") return "";

  const clean = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[\.,\-\/#\$%\^&\*;:{}=\-_`~()\\@\+\?]/g, " ")
    .replace(/[^A-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = clean.split(" ").filter((t) => t.length > 0 && !noiseSet.has(t));
  return tokens.join(" ");
}

module.exports = {
  OCR_NOISE_WORDS,
  normalizeName,
};
