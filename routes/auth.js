// Auth Routes
// routes/auth.js
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User/User.js";
import emailService from "../services/email-service.js";
import { loginLimiter, accountCreationLimiter, emailRateLimiter } from "../middleware/rate-limit.js"; // HINZUGEFÜGT

const router = express.Router();

// ====================
// Login mit automatischer Account-Erstellung (VEREINFACHT)
// ====================
router.post("/login", 
  loginLimiter,           // HINZUGEFÜGT: Allgemeines Login Rate-Limiting
  emailRateLimiter,       // HINZUGEFÜGT: Email-spezifisches Rate-Limiting
  async (req, res) => {
    try {
      console.log("🔐 LOGIN REQUEST RECEIVED:", req.body);
      
      const { email, password, confirmAccountCreation } = req.body; // HINZUGEFÜGT: confirmAccountCreation

      if (!email || !password) {
        console.log("❌ LOGIN ERROR: Missing email or password");
        return res.status(400).json({ message: "Email and password are required" });
      }

      console.log("🔍 SEARCHING FOR USER:", email);

      // User suchen
      let user = await User.findOne({ email });
      
      if (!user) {
        console.log("👤 USER NOT FOUND:", email);
        
        // HINZUGEFÜGT: Check ob User Account-Erstellung bestätigt hat
        if (!confirmAccountCreation) {
          console.log("❌ ACCOUNT CREATION NOT CONFIRMED");
          return res.status(200).json({
            requiresConfirmation: true,
            message: "Account existiert nicht. Soll automatisch ein Account erstellt werden?",
            email: email
          });
        }

        console.log("✅ ACCOUNT CREATION CONFIRMED - PROCEEDING");
        
        // HINZUGEFÜGT: Account-Creation Rate-Limiting anwenden
        accountCreationLimiter(req, res, (err) => {
          if (err) {
            return res.status(429).json({
              message: "Zu viele Account-Erstellungsversuche. Bitte warten Sie 15 Minuten."
            });
          }
        });

        // Email Rate-Limiting increment
        if (req.emailLimiter) {
          req.emailLimiter.increment();
        }
        
        // Automatische Account-Erstellung
        try {
          const randomPassword = emailService.generateRandomPassword();
          console.log("🎲 GENERATED PASSWORD:", randomPassword);
          
          const hashedPassword = await bcrypt.hash(randomPassword, 10);
          
          user = new User({ email, password: hashedPassword });
          await user.save();
          console.log("✅ NEW USER CREATED:", email);
          
          // Email mit Login-Daten versenden
          const emailResult = await emailService.sendLoginCredentials(email, randomPassword);
          
          if (emailResult.success) {
            console.log("📧 EMAIL SENT SUCCESSFULLY to:", email);
            return res.status(200).json({
              message: "Account wurde erstellt! Bitte prüfen Sie Ihre Emails für die Login-Daten.",
              accountCreated: true,
              emailSent: true,
              email: email
            });
          } else {
            console.log("❌ EMAIL SENDING FAILED:", emailResult.error);
            return res.status(500).json({
              message: "Account wurde erstellt, aber Email-Versand fehlgeschlagen. Bitte kontaktieren Sie den Support.",
              accountCreated: true,
              emailSent: false
            });
          }
          
        } catch (autoRegisterError) {
          console.error("🔥 AUTO-REGISTRATION ERROR:", autoRegisterError);
          return res.status(500).json({ 
            message: "Fehler bei der automatischen Account-Erstellung" 
          });
        }
      }

      console.log("👤 EXISTING USER FOUND:", user.email);

      // Passwort vergleichen (für bestehende User)
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        console.log("❌ LOGIN ERROR: Wrong password for:", email);
        return res.status(400).json({ 
          message: "Ungültige Anmeldedaten." 
        });
      }

      console.log("🔑 PASSWORD CORRECT, GENERATING TOKEN");

      // JWT Token generieren
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });

      console.log("✅ LOGIN SUCCESS:", email);
      res.json({ 
        token, 
        user: { id: user._id, email: user.email },
        message: "Login erfolgreich!"
      });
      
    } catch (err) {
      console.error("🔥 LOGIN FATAL ERROR:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// HINZUGEFÜGT: Rate-Limit Status abfragen
router.get("/rate-limit-status/:email", (req, res) => {
  // Vereinfacht - könnte erweitert werden um aktuelle Limits zu zeigen
  res.json({
    message: "Rate limits: 3 Accounts pro 15min, 2 pro Email pro Stunde, 10 Logins pro 15min"
  });
});

export default router;