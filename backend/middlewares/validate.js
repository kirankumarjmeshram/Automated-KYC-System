const AppError = require("../utils/appError");

/**
 * Generic Zod request validation middleware.
 * Validates req.body, req.query, or req.params against a Zod schema.
 */
const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    // Replace req properties with sanitized parsed output
    if (parsed.body) req.body = parsed.body;
    if (parsed.query) req.query = parsed.query;
    if (parsed.params) req.params = parsed.params;

    next();
  } catch (error) {
    if (error.name === "ZodError") {
      const formattedErrors = error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: formattedErrors,
      });
    }

    next(new AppError("Invalid input format", 400));
  }
};

module.exports = validate;
