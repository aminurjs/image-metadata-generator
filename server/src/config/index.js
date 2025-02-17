// config/index.js
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory name in ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables based on NODE_ENV
const environment = process.env.NODE_ENV || "development";
dotenv.config({
  path: path.resolve(__dirname, `../.env.${environment}`),
});

// Validate required environment variables
const requiredEnvVars = [
  "PORT",
  "DATABASE_URL",
  "JWT_SECRET",
  // Add other required variables
];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
}

// Configuration object with type checking and default values
const config = {
  env: {
    isProd: environment === "production",
    isDev: environment === "development",
    isTest: environment === "test",
    name: environment,
  },
  server: {
    port: Number(process.env.PORT),
    host: process.env.HOST || "localhost",
    baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT}`,
  },
  //   database: {
  //     url: process.env.DATABASE_URL,
  //     maxConnections: Number(process.env.DB_MAX_CONNECTIONS) || 20,
  //     minConnections: Number(process.env.DB_MIN_CONNECTIONS) || 5,
  //   },
  //   auth: {
  //     jwtSecret: process.env.JWT_SECRET,
  //     jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  //     saltRounds: Number(process.env.SALT_ROUNDS) || 10,
  //   },
  //   email: {
  //     from: process.env.EMAIL_FROM || "noreply@example.com",
  //     smtpHost: process.env.SMTP_HOST,
  //     smtpPort: Number(process.env.SMTP_PORT) || 587,
  //     smtpUser: process.env.SMTP_USER,
  //     smtpPass: process.env.SMTP_PASS,
  //   },
  //   cache: {
  //     redisUrl: process.env.REDIS_URL,
  //     ttl: Number(process.env.CACHE_TTL) || 3600,
  //   },
  //   logging: {
  //     level:
  //       process.env.LOG_LEVEL ||
  //       (environment === "production" ? "info" : "debug"),
  //     prettyPrint: environment !== "production",
  //   },
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*",
    credentials: true,
  },
};

Object.freeze(config);

export default config;
