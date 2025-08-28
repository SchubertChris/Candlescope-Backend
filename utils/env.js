import dotenv from "dotenv";
dotenv.config();

export function readEnvVar(variable, defaultValue = undefined) {
  const value = process.env[variable];
  if (!value) {
    if (defaultValue !== undefined) {
      console.warn(`Missing environment variable: ${variable}. Using default value: ${defaultValue}`);
      return defaultValue;
    } else {
      throw new Error(`Missing required environment variable: ${variable}`);
    }
  }
  return value;
}

export const ENV = {
  NODE_ENV: readEnvVar("NODE_ENV", "development"),
  PORT: readEnvVar("PORT", 5000),
  BACKEND_URL: readEnvVar("BACKEND_URL", "http://localhost:5000"),
  FRONTEND_URL: readEnvVar("FRONTEND_URL", "http://localhost:3000"),
  GOOGLE: {
    CLIENT_ID: readEnvVar("GOOGLE_CLIENT_ID"),
    CLIENT_SECRET: readEnvVar("GOOGLE_CLIENT_SECRET"),
  },
  GITHUB: {
    CLIENT_ID: readEnvVar("GITHUB_CLIENT_ID"),
    CLIENT_SECRET: readEnvVar("GITHUB_CLIENT_SECRET"),
  },
};
