// server.js
import express from "express";
import cors from "cors";
import passport from "./config/passport/index.js";
import dotenv from "dotenv";
import { ENV } from "./utils/env.js";
import { endpointDisplay } from "./debug/endpoints.js";

// Core-Setup
import { corsOptions } from "./config/cors.js";
import { applySecurityHeaders } from "./middleware/security.js";
import { applyRequestLogging } from "./middleware/logging.js";
import { validateEnvironment } from "./config/env-check.js";
import { connectDB } from "./config/database.js";
import { ensureAdminAccount } from "./config/admin.js";
import { applyDebugRoutes } from "./routes/debug.js";
import { applyNewsletterTracking } from "./routes/newsletter-tracking.js";
import { applyErrorHandling } from "./middleware/error.js";

// Normal Routes
import router from "./routes/index.js";

dotenv.config();
const app = express();

// Middleware
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(passport.initialize());
applySecurityHeaders(app);
applyRequestLogging(app);

// API-Routen
app.use("/api", router);

// Extra-Routen
applyNewsletterTracking(app);
applyDebugRoutes(app);
applyErrorHandling(app);

// Server Start
const startServer = async () => {
  if (!validateEnvironment()) process.exit(1);
  await connectDB();
  await ensureAdminAccount();

  const server = app.listen(ENV.PORT, "0.0.0.0", () => {
    const baseURL =
      ENV.NODE_ENV === "production" ? "https://candlescope-backend.onrender.com" : `http://localhost:${ENV.PORT}`;

    console.log(`🚀 Server running on ${baseURL}`);
    endpointDisplay(baseURL, ENV.NODE_ENV);
  });

  return server;
};

startServer();
export default app;
