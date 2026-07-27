const logger = require("./logger/logger");
const requestLogger = require("./logger/requestLogger");
const { logAudit } = require("./logger/auditLogger");
const { logPerformance } = require("./logger/performanceLogger");
const { logOcrStep } = require("./logger/ocrLogger");

module.exports = logger;
module.exports.requestLogger = requestLogger;
module.exports.logAudit = logAudit;
module.exports.logPerformance = logPerformance;
module.exports.logOcrStep = logOcrStep;
