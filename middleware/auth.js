// middleware/auth.js
// AUTH MIDDLEWARE - Authentifizierung und Autorisierung für Newsletter
import jwt from "jsonwebtoken";
import User from "../models/user/User.js";

// Basis-Authentifizierung (Token-basiert)
export const requireAuth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "") || req.cookies?.auth_token || req.session?.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Zugriff verweigert. Authentifizierung erforderlich.",
        code: "NO_TOKEN",
      });
    }

    // Token verifizieren
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");

    // User aus Datenbank laden
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Ungültiger Token. Benutzer nicht gefunden.",
        code: "INVALID_USER",
      });
    }

    // User zu Request hinzufügen
    req.user = user;
    next();
  } catch (error) {
    console.error("❌ Auth middleware error:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        error: "Ungültiger Token.",
        code: "INVALID_TOKEN",
      });
    } else if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        error: "Token ist abgelaufen. Bitte melden Sie sich erneut an.",
        code: "TOKEN_EXPIRED",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Authentifizierungsfehler.",
      code: "AUTH_ERROR",
    });
  }
};

// Admin-Berechtigung prüfen
export const requireAdmin = async (req, res, next) => {
  try {
    // Voraussetzen, dass requireAuth bereits ausgeführt wurde
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentifizierung erforderlich.",
        code: "NO_USER",
      });
    }

    // Admin-Rolle prüfen
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Zugriff verweigert. Administrator-Berechtigung erforderlich.",
        code: "INSUFFICIENT_PERMISSIONS",
      });
    }

    next();
  } catch (error) {
    console.error("❌ Admin auth error:", error);
    return res.status(500).json({
      success: false,
      error: "Autorisierungsfehler.",
      code: "AUTHORIZATION_ERROR",
    });
  }
};

// Optional: User muss bestätigt sein
export const requireVerified = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentifizierung erforderlich.",
        code: "NO_USER",
      });
    }

    if (!req.user.isVerified) {
      return res.status(403).json({
        success: false,
        error: "E-Mail-Adresse muss bestätigt werden.",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    next();
  } catch (error) {
    console.error("❌ Verification auth error:", error);
    return res.status(500).json({
      success: false,
      error: "Verifizierungsfehler.",
      code: "VERIFICATION_ERROR",
    });
  }
};

// Development/Mock Auth (für Testing ohne echte User)
export const mockAuth = (role = "admin") => {
  return (req, res, next) => {
    if (process.env.NODE_ENV === "development") {
      req.user = {
        _id: "mock-user-id",
        email: "admin@example.com",
        role: role,
        firstName: "Admin",
        lastName: "User",
        isVerified: true,
      };

      console.log("🧪 Mock Auth:", req.user);
      next();
    } else {
      return requireAuth(req, res, next);
    }
  };
};

// Rate Limiting für Newsletter
export const newsletterRateLimit = (req, res, next) => {
  // Einfaches Rate Limiting (kann später erweitert werden)
  const ip = req.ip || req.connection.remoteAddress;
  const key = `newsletter_rate_${ip}`;

  // Hier könnte Redis oder Memory Store verwendet werden
  // Für jetzt: einfache Implementierung
  next();
};

export default {
  requireAuth,
  requireAdmin,
  requireVerified,
  mockAuth,
  newsletterRateLimit,
};
