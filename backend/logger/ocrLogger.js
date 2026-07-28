const winston = require("winston");
const path = require("path");

const logDir = path.join(__dirname, "..", "logs");

const ocrWinston = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    winston.format.printf(({ timestamp, message }) => `${timestamp} ${message}`)
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, "ocr.log") }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, message }) => `${timestamp} ${message}`)
      ),
    }),
  ],
});

/**
 * Enhanced OCR Pipeline Logger with Unsummarized Object Dumping
 */
const logOcrStep = ({
  traceId,
  step,
  stage,
  fileName = "",
  ocrEngine = "none",
  confidence = 0,
  message = "",
  rawText = null,
  parsedData = null,
  geminiResponse = null,
  validationInput = null,
  comparisonResult = null,
  error = null,
  imageMetadata = null,
  cvSteps = null,
  engineInfo = null,
  rawObjects = null,
  perLineConfidence = null,
  parserDecisions = null,
}) => {
  const currentStage = stage || step || "PIPELINE_STEP";
  const fileStr = fileName ? ` File="${fileName}"` : "";
  const engineStr = ocrEngine ? ` Engine=${ocrEngine}` : "";
  const confStr = confidence ? ` Confidence=${confidence.toFixed(2)}` : "";
  const msgStr = message ? ` Message="${message}"` : "";

  const logLine = `[OCR_PIPELINE] TraceID=${traceId} Stage=${currentStage}${fileStr}${engineStr}${confStr}${msgStr}`;
  ocrWinston.info(logLine);

  // 1. Image Information
  if (imageMetadata) {
    logImageInfo({
      traceId,
      fileName: imageMetadata.fileName || fileName,
      fileSize: imageMetadata.size || imageMetadata.fileSize || "0 bytes",
      mimeType: imageMetadata.mime || imageMetadata.mimeType || "image/unknown",
      width: imageMetadata.width || "N/A",
      height: imageMetadata.height || "N/A",
      format: imageMetadata.format || "UNKNOWN",
    });
  }

  // 2. Preprocessing Steps
  if (cvSteps && cvSteps.length > 0) {
    logCvSteps({ traceId, steps: cvSteps });
  }

  // 3. OCR Engine Info
  if (engineInfo) {
    logEngineInfo({ traceId, engineInfo });
  }

  // 4. Raw Unsummarized Response Objects
  if (rawObjects !== null && rawObjects !== undefined) {
    logRawResponseObjects({ traceId, rawObjects });
  }

  // 5. Per-Line Confidence & Bounding Boxes
  if (perLineConfidence && perLineConfidence.length > 0) {
    logPerLineConfidence({ traceId, lines: perLineConfidence });
  }

  // 6. Parser Input
  if (rawText !== null && rawText !== undefined) {
    logParserInput({ traceId, rawText });
  }

  // 7. Parser Decisions & Reasoning
  if (parserDecisions && parserDecisions.length > 0) {
    logParserDecisions({ traceId, decisions: parserDecisions });
  }

  // 8. Parsed Data
  if (parsedData !== null) {
    logParsedData({ traceId, parsedData });
  }

  // 9. Validation Input
  if (validationInput !== null) {
    logValidationInput({ traceId, submittedData: validationInput.submitted, extractedData: validationInput.extracted });
  }

  // 10. Match Result
  if (comparisonResult !== null) {
    logMatchResult({ traceId, matchResult: comparisonResult });
  }

  // 11. Error / Failure
  if (error !== null) {
    logOcrFailure({
      traceId,
      reason: error.message || error,
      engineResponse: error.response?.data || "N/A",
      rawResponse: error.rawResponse || "N/A",
      exception: error.name || "Exception",
      stackTrace: error.stack || "N/A",
    });
  }
};

const logImageInfo = ({ traceId, fileName, fileSize, mimeType, width, height, format }) => {
  const block = `
========== IMAGE INFORMATION ==========
TraceID: ${traceId}
Filename: ${fileName}
Size: ${fileSize}
Mime Type: ${mimeType}
Width: ${width} px
Height: ${height} px
Image Format: ${format}
=======================================`;
  ocrWinston.info(block);
};

const logCvSteps = ({ traceId, steps }) => {
  const stepLines = steps.map((s) => `${s.step} -> ${s.dimensions}`).join("\n");
  const block = `
========== IMAGE PREPROCESSING STAGES ==========
TraceID: ${traceId}
${stepLines}
================================================`;
  ocrWinston.info(block);
};

const logEngineInfo = ({ traceId, engineInfo }) => {
  const block = `
========== OCR ENGINE INFORMATION ==========
TraceID: ${traceId}
OCR Engine: ${engineInfo.engine || "EasyOCR"}
EasyOCR Version: ${engineInfo.version || "1.7.x"}
Language: ${JSON.stringify(engineInfo.languages || ["en"])}
GPU Enabled: ${engineInfo.gpu_enabled ? "True" : "False"}
Model Path: ${engineInfo.model_path || "N/A"}
Configuration: ${JSON.stringify(engineInfo.configuration || {})}
============================================`;
  ocrWinston.info(block);
};

const logRawResponseObjects = ({ traceId, rawObjects }) => {
  const jsonStr = typeof rawObjects === "string" ? rawObjects : JSON.stringify(rawObjects, null, 2);
  const block = `
========== RAW OCR RESPONSE OBJECTS ==========
TraceID: ${traceId}
${jsonStr}
==============================================`;
  ocrWinston.info(block);
};

const logRawOcr = ({ traceId, engine, confidence, rawText, rawPaddle, rawEasy }) => {
  let extraEngines = "";
  if (rawPaddle) {
    extraEngines += `\n--- RAW PADDLE OCR ---\n${rawPaddle}\n`;
  }
  if (rawEasy) {
    extraEngines += `\n--- RAW EASYOCR ---\n${rawEasy}\n`;
  }

  const textVal = typeof rawText === "string" ? rawText : JSON.stringify(rawText);
  const block = `
========== RAW OCR ==========
TraceID: ${traceId}
Engine: ${engine}
Confidence: ${confidence}
Extracted Text:
${extraEngines}
${textVal}
=============================`;
  ocrWinston.info(block);
};

const logPerLineConfidence = ({ traceId, lines }) => {
  const lineStr = lines
    .map(
      (l) => `Text: "${l.text}"\nConfidence: ${l.confidence}\nBounding Box: ${JSON.stringify(l.box)}\n`
    )
    .join("\n");
  const block = `
========== PER-LINE OCR CONFIDENCE & BOUNDING BOXES ==========
TraceID: ${traceId}
${lineStr}==============================================================`;
  ocrWinston.info(block);
};

const logParserInput = ({ traceId, rawText }) => {
  const textStr = typeof rawText === "string" ? rawText : JSON.stringify(rawText);
  const block = `
========== PARSER INPUT ==========
TraceID: ${traceId}
Raw OCR Text:
${textStr}
==================================`;
  ocrWinston.info(block);
};

const logParserDecisions = ({ traceId, decisions }) => {
  const decStr = JSON.stringify(decisions, null, 2);
  const block = `
========== PARSER DECISIONS & REASONING ==========
TraceID: ${traceId}
${decStr}
==================================================`;
  ocrWinston.info(block);
};

const logParsedData = ({ traceId, parsedData }) => {
  const dataVal = JSON.stringify(parsedData, null, 2);
  const block = `
========== PARSED DATA ==========
TraceID: ${traceId}
${dataVal}
=================================`;
  ocrWinston.info(block);
};

const logValidationInput = ({ traceId, submittedData, extractedData }) => {
  const subVal = JSON.stringify(submittedData, null, 2);
  const extVal = JSON.stringify(extractedData, null, 2);
  const block = `
========== VALIDATION INPUT ==========
TraceID: ${traceId}
Submitted Data:
${subVal}

Extracted Data:
${extVal}
======================================`;
  ocrWinston.info(block);
};

const logMatchResult = ({ traceId, matchResult }) => {
  const matchVal = JSON.stringify(matchResult, null, 2);
  const block = `
========== MATCH RESULT ==========
TraceID: ${traceId}
${matchVal}
==================================`;
  ocrWinston.info(block);
};

const logOcrFailure = ({ traceId, reason, engineResponse, rawResponse, exception, stackTrace }) => {
  const block = `
========== OCR FAILURE ==========
TraceID: ${traceId}
Reason: ${reason || "N/A"}
Engine Response: ${typeof engineResponse === "string" ? engineResponse : JSON.stringify(engineResponse)}
Raw Response: ${typeof rawResponse === "string" ? rawResponse : JSON.stringify(rawResponse)}
Exception: ${exception || "Exception"}
Stack Trace: ${stackTrace || "N/A"}
=================================`;
  ocrWinston.info(block);
};

const logOcrError = ({ traceId, stage, message, stack, error }) => {
  logOcrFailure({
    traceId,
    reason: message || error?.message || "Unknown error",
    engineResponse: stage || "N/A",
    rawResponse: "N/A",
    exception: error?.name || "Error",
    stackTrace: stack || error?.stack || "N/A",
  });
};

module.exports = {
  logOcrStep,
  logImageInfo,
  logCvSteps,
  logEngineInfo,
  logRawResponseObjects,
  logRawOcr,
  logPerLineConfidence,
  logParserInput,
  logParserDecisions,
  logParsedData,
  logValidationInput,
  logMatchResult,
  logOcrFailure,
  logOcrError,
};
