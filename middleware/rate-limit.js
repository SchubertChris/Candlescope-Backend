// middleware/rate-limit.js
// KORRIGIERT: IPv6-Problem vollständig behoben
import rateLimit from 'express-rate-limit';

// HINZUGEFÜGT: Rate-Limiting für Account-Erstellung
export const accountCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 3, // Maximal 3 Account-Erstellungen pro IP in 15 Minuten
  message: {
    message: 'Zu viele Account-Erstellungsversuche. Bitte warten Sie 15 Minuten.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // KORRIGIERT: Verwende Standard-keyGenerator (IPv6-sicher)
  // Nur bei Account-Erstellung triggern
  skip: (req) => {
    // Skip wenn User bereits existiert (normaler Login)
    return req.userExists === true;
  }
});

// HINZUGEFÜGT: Allgemeines Login Rate-Limiting
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 10, // Maximal 10 Login-Versuche pro IP
  message: {
    message: 'Zu viele Login-Versuche. Bitte warten Sie 15 Minuten.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // ERWEITERT: Skip Rate-Limiting für erfolgreiche Logins
  skipSuccessfulRequests: true // Erfolgreiche Requests zählen nicht
  // KORRIGIERT: Standard-keyGenerator verwenden (IPv6-sicher)
});

// HINZUGEFÜGT: Email-spezifisches Rate-Limiting (pro Email-Adresse)
const emailAttempts = new Map();

export const emailRateLimiter = (req, res, next) => {
  const email = req.body.email;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 Stunde
  const maxAttempts = 2; // Maximal 2 Account-Erstellungen pro Email pro Stunde

  if (!email) {
    return next();
  }

  // Alte Einträge aufräumen
  for (const [key, data] of emailAttempts.entries()) {
    if (now - data.firstAttempt > windowMs) {
      emailAttempts.delete(key);
    }
  }

  const emailData = emailAttempts.get(email) || { count: 0, firstAttempt: now };

  // Reset window wenn abgelaufen
  if (now - emailData.firstAttempt > windowMs) {
    emailData.count = 0;
    emailData.firstAttempt = now;
  }

  // Check ob Limit erreicht
  if (emailData.count >= maxAttempts) {
    return res.status(429).json({
      message: `Zu viele Versuche für ${email}. Bitte warten Sie 1 Stunde.`
    });
  }

  // Nur bei neuen Account-Erstellungen zählen
  req.emailLimiter = {
    email,
    increment: () => {
      emailData.count++;
      emailAttempts.set(email, emailData);
    }
  };

  next();
};