export const validateEnvironment = () => {
  console.log("\n🔍 VALIDATING ENVIRONMENT VARIABLES...");
  const required = ["MONGODB_URI", "JWT_SECRET"];
  let hasErrors = false;

  required.forEach((key) => {
    if (!process.env[key]) {
      console.error(`❌ Missing: ${key}`);
      hasErrors = true;
    }
  });

  if (hasErrors) {
    console.error("💥 Missing critical env vars. Fix before starting server.");
    return false;
  }

  console.log("✅ Environment validation passed");
  return true;
};
