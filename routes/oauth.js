// routes/oauth.js
// KORRIGIERT: JWT Token Format und besseres Error Handling
import express from "express";
// import passport from '../config/passport.js';
import passport from "../config/passport/index.js"; // GEÄNDERT: expliziter Import des Index
import jwt from "jsonwebtoken";

const router = express.Router();

const getFrontendURL = () => {
  return process.env.FRONTEND_URL || "http://localhost:5173";
};

// GOOGLE OAUTH ROUTES
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

router.get("/google/callback", passport.authenticate("google", { session: false }), (req, res) => {
  try {
    const frontendURL = getFrontendURL();

    console.log("🔍 GOOGLE CALLBACK - User Data:");
    console.log("  - User ID:", req.user._id);
    console.log("  - Email:", req.user.email);
    console.log("  - Name:", req.user.name);
    console.log("  - Role:", req.user.role);

    // KORRIGIERT: JWT Token mit richtigem Payload (userId statt id)
    const token = jwt.sign(
      {
        userId: req.user._id, // GEÄNDERT: 'userId' statt 'id'
        email: req.user.email,
        role: req.user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" } // GEÄNDERT: 2h statt 1h
    );

    console.log("✅ GOOGLE LOGIN SUCCESS:", req.user.email);
    console.log("🎫 JWT Token generated with userId:", req.user._id);
    console.log("🔗 REDIRECTING TO:", frontendURL);

    // KORRIGIERT: User-Daten für Frontend aufbereiten
    const userData = {
      id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      avatar: req.user.avatar,
      role: req.user.role,
      authProvider: "google",
    };

    // Redirect zum Frontend mit Token
    res.redirect(`${frontendURL}/oauth-success?token=${token}&user=${encodeURIComponent(JSON.stringify(userData))}`);
  } catch (error) {
    console.error("❌ GOOGLE CALLBACK ERROR:", error);
    const frontendURL = getFrontendURL();
    res.redirect(
      `${frontendURL}/oauth-error?error=token_generation_failed&message=${encodeURIComponent(error.message)}`
    );
  }
});

// GITHUB OAUTH ROUTES
router.get(
  "/github",
  passport.authenticate("github", {
    scope: ["user:email"],
  })
);

router.get("/github/callback", passport.authenticate("github", { session: false }), (req, res) => {
  try {
    const frontendURL = getFrontendURL();

    console.log("🔍 GITHUB CALLBACK - User Data:");
    console.log("  - User ID:", req.user._id);
    console.log("  - Email:", req.user.email);
    console.log("  - Name:", req.user.name);
    console.log("  - Role:", req.user.role);

    // KORRIGIERT: JWT Token mit richtigem Payload (userId statt id)
    const token = jwt.sign(
      {
        userId: req.user._id, // GEÄNDERT: 'userId' statt 'id'
        email: req.user.email,
        role: req.user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" } // GEÄNDERT: 2h statt 1h
    );

    console.log("✅ GITHUB LOGIN SUCCESS:", req.user.email);
    console.log("🎫 JWT Token generated with userId:", req.user._id);
    console.log("🔗 REDIRECTING TO:", frontendURL);

    // KORRIGIERT: User-Daten für Frontend aufbereiten
    const userData = {
      id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      avatar: req.user.avatar,
      role: req.user.role,
      authProvider: "github",
    };

    // Redirect zum Frontend mit Token
    res.redirect(`${frontendURL}/oauth-success?token=${token}&user=${encodeURIComponent(JSON.stringify(userData))}`);
  } catch (error) {
    console.error("❌ GITHUB CALLBACK ERROR:", error);
    const frontendURL = getFrontendURL();
    res.redirect(
      `${frontendURL}/oauth-error?error=token_generation_failed&message=${encodeURIComponent(error.message)}`
    );
  }
});

// HINZUGEFÜGT: OAuth Status Check mit Debug-Info
router.get("/status", (req, res) => {
  res.json({
    google: !!process.env.GOOGLE_CLIENT_ID,
    github: !!process.env.GITHUB_CLIENT_ID,
    frontendURL: getFrontendURL(),
    callbackURLs: {
      google: "/api/oauth/google/callback",
      github: "/api/oauth/github/callback",
    },
    message: "OAuth endpoints active with correct callback URLs",
  });
});

// HINZUGEFÜGT: Debug Route für JWT Token Test
router.get("/test-token", (req, res) => {
  if (process.env.NODE_ENV !== "development") {
    return res.status(404).json({ error: "Route only available in development" });
  }

  try {
    const testToken = jwt.sign(
      {
        userId: "test_user_id",
        email: "test@example.com",
        role: "kunde",
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    const decoded = jwt.verify(testToken, process.env.JWT_SECRET);

    res.json({
      message: "JWT Token test successful",
      token: testToken.substring(0, 50) + "...",
      decoded: decoded,
      frontendURL: getFrontendURL(),
    });
  } catch (error) {
    res.status(500).json({
      error: "JWT Token test failed",
      message: error.message,
    });
  }
});

export default router;
