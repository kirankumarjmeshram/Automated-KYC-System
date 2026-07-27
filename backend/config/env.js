const { z } = require("zod");
require("dotenv").config();

const envSchema = z.object({
  PORT: z.string().default("5000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MONGO_URI: z.string({
    required_error: "MONGO_URI is required in environment variables",
  }),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  
  // AWS S3 Configuration
  AWS_REGION: z.string().default("ap-south-1"),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET_NAME: z.string().default("kyc-documents-bucket"),
  
  // Clerk & AI Service Config
  CLERK_SECRET_KEY: z.string().optional(),
  AI_SERVICE_URL: z.string().default("http://localhost:8000"),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment variables:");
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }

  return result.data;
};

const env = parseEnv();

module.exports = env;
