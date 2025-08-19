// middleware/rate-limit.js
// KORRIGIERT: Vereinfachte Rate-Limiting ohne IPv6-Probleme
import rateLimit from 'express-rate-limit';

// Allgemeines Login Rate-Limiting
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 10, // Maximal 10 Login-Versuche pro IP
  message: {
    success: false,
    message: 'Zu viele Login-Versuche. Bitte warten Sie 15 Minuten.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Erfolgreiche Requests zählen nicht
});

// Account-Creation Rate-Limiting
export const accountCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 3, // Maximal 3 Account-Erstellungen pro IP
  message: {
    success: false,
    message: 'Zu viele Account-Erstellungsversuche. Bitte warten Sie 15 Minuten.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// VEREINFACHT: Email-Rate-Limiting als normales Middleware
const emailAttempts = new Map();

export const emailRateLimiter = (req, res, next) => {
  const email = req.body.email;
  
  if (!email) {
    return next();
  }
  
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 Stunde
  const maxAttempts = 2; // 2 Versuche pro Email pro Stunde

  // Cleanup alte Einträge
  for (const [key, data] of emailAttempts.entries()) {
    if (now - data.firstAttempt > windowMs) {
      emailAttempts.delete(key);
    }
  }

  const emailData = emailAttempts.get(email) || { count: 0, firstAttempt: now };

  // Reset wenn Window abgelaufen
  if (now - emailData.firstAttempt > windowMs) {
    emailData.count = 0;
    emailData.firstAttempt = now;
  }

  // Check Limit
  if (emailData.count >= maxAttempts) {
    return res.status(429).json({
      success: false,
      message: `Zu viele Versuche für ${email}. Bitte warten Sie 1 Stunde.`
    });
  }

  // Helper für Increment
  req.emailLimiter = {
    email,
    increment: () => {
      emailData.count++;
      emailAttempts.set(email, emailData);
    }
  };

  next();
};