// routes/auth.js
// KORRIGIERT: Auth-Routes mit robuster Fehlerbehandlung
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User/User.js";
import emailService from "../services/email-service.js";
import { loginLimiter, accountCreationLimiter, emailRateLimiter } from "../middleware/rate-limit.js";

const router = express.Router();

// Login mit automatischer Account-Erstellung
router.post("/login", 
  loginLimiter,
  emailRateLimiter,
  async (req, res) => {
    try {
      console.log("🔐 LOGIN REQUEST RECEIVED:", { email: req.body.email });
      
      const { email, password, confirmAccountCreation } = req.body;

      // Validation
      if (!email || !password) {
        console.log("❌ LOGIN ERROR: Missing credentials");
        return res.status(400).json({ 
          success: false,
          message: "Email and password are required" 
        });
      }

      console.log("🔍 SEARCHING FOR USER:", email);

      // User suchen
      let user = await User.findOne({ email });
      
      if (!user) {
        console.log("👤 USER NOT FOUND:", email);
        
        // Account-Erstellung-Bestätigung prüfen
        if (!confirmAccountCreation) {
          console.log("❌ ACCOUNT CREATION NOT CONFIRMED");
          return res.status(200).json({
            success: false,
            requiresConfirmation: true,
            message: "Account existiert nicht. Soll automatisch ein Account erstellt werden?",
            email: email
          });
        }

        console.log("✅ ACCOUNT CREATION CONFIRMED - PROCEEDING");
        
        // KORRIGIERT: Account-Erstellung mit verbesserter Fehlerbehandlung
        try {
          // Passwort generieren
          const randomPassword = emailService.generateRandomPassword();
          console.log("🎲 GENERATED PASSWORD LENGTH:", randomPassword.length);
          
          const hashedPassword = await bcrypt.hash(randomPassword, 10);
          
          // KORRIGIERT: User mit erweiterten Feldern erstellen
          user = new User({ 
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            role: 'kunde', // Standard-Role
            isEmailVerified: false,
            isActive: true
          });
          
          await user.save();
          console.log("✅ NEW USER CREATED:", email);
          
          // Email Rate-Limiting increment
          if (req.emailLimiter) {
            req.emailLimiter.increment();
          }
          
          // Email mit Login-Daten versenden
          console.log("📧 ATTEMPTING TO SEND EMAIL...");
          const emailResult = await emailService.sendLoginCredentials(email, randomPassword);
          
          if (emailResult.success) {
            console.log("📧 EMAIL SENT SUCCESSFULLY to:", email);
            return res.status(200).json({
              success: true,
              message: "Account wurde erstellt! Bitte prüfen Sie Ihre Emails für die Login-Daten.",
              accountCreated: true,
              emailSent: true,
              email: email
            });
          } else {
            console.error("❌ EMAIL SENDING FAILED:", emailResult.error);
            return res.status(500).json({
              success: false,
              message: "Account wurde erstellt, aber Email-Versand fehlgeschlagen. Bitte kontaktieren Sie den Support.",
              accountCreated: true,
              emailSent: false,
              error: emailResult.error
            });
          }
          
        } catch (accountCreationError) {
          console.error("🔥 ACCOUNT CREATION ERROR:", accountCreationError);
          
          // Spezifische Fehlerbehandlung
          if (accountCreationError.code === 11000) {
            return res.status(400).json({ 
              success: false,
              message: "Ein Account mit dieser Email-Adresse existiert bereits." 
            });
          }
          
          if (accountCreationError.name === 'ValidationError') {
            const errors = Object.values(accountCreationError.errors).map(e => e.message);
            return res.status(400).json({ 
              success: false,
              message: "Validierungsfehler bei der Account-Erstellung",
              details: errors
            });
          }
          
          return res.status(500).json({ 
            success: false,
            message: "Fehler bei der automatischen Account-Erstellung",
            error: accountCreationError.message
          });
        }
      }

      console.log("👤 EXISTING USER FOUND:", user.email);

      // Passwort vergleichen
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        console.log("❌ LOGIN ERROR: Wrong password for:", email);
        return res.status(400).json({ 
          success: false,
          message: "Ungültige Anmeldedaten." 
        });
      }

      console.log("🔑 PASSWORD CORRECT, GENERATING TOKEN");

      // KORRIGIERT: JWT Token mit userId (für Dashboard-Kompatibilität)
      const token = jwt.sign({ 
        userId: user._id,  // KORRIGIERT: userId statt id
        email: user.email,
        role: user.role 
      }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });

      // Last Login aktualisieren
      user.lastLogin = new Date();
      await user.save();

      console.log("✅ LOGIN SUCCESS:", email);
      res.json({ 
        success: true,
        token, 
        user: { 
          id: user._id, 
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          company: user.company,
          avatar: user.avatar
        },
        message: "Login erfolgreich!"
      });
      
    } catch (err) {
      console.error("🔥 LOGIN FATAL ERROR:", err);
      res.status(500).json({ 
        success: false,
        error: err.message,
        message: "Ein unerwarteter Serverfehler ist aufgetreten."
      });
    }
  }
);

// User-Profil abrufen
router.get("/profile", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Token fehlt"
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User nicht gefunden"
      });
    }
    
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        company: user.company,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified,
        lastLogin: user.lastLogin
      }
    });
    
  } catch (error) {
    console.error("Profile Error:", error);
    res.status(401).json({
      success: false,
      error: "Ungültiger Token"
    });
  }
});

// Rate-Limit Status
router.get("/rate-limit-status/:email", (req, res) => {
  res.json({
    success: true,
    message: "Rate limits: 3 Accounts pro 15min, 2 pro Email pro Stunde, 10 Logins pro 15min"
  });
});

// Logout
router.post("/logout", (req, res) => {
  res.json({
    success: true,
    message: "Logout erfolgreich"
  });
});

export default router;