// routes/auth.js
// Getrennter Auth-Router - nur Route-Definitionen
import express from "express";
import { loginLimiter, accountCreationLimiter, emailRateLimiter } from "../middleware/rate-limit.js";
import * as authController from "../controller/auth.controller.js";

const router = express.Router();

// Login mit automatischer Account-Erstellung
router.post("/login", loginLimiter, emailRateLimiter, authController.login);

// OAuth-Redirect Routes für Frontend-Kompatibilität
router.get("/google/callback", authController.googleCallback);
router.get("/github/callback", authController.githubCallback);

// User-Profil abrufen
router.get("/profile", authController.getProfile);

// Rate-Limit Status
router.get("/rate-limit-status/:email", authController.getRateLimitStatus);

// Logout
router.post("/logout", authController.logout);

// OAuth Status für Debugging
router.get("/oauth-status", authController.getOAuthStatus);

export default router;
