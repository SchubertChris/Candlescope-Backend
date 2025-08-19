// routes/oauth.js
import express from 'express';
import passport from '../config/passport.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// HINZUGEFÜGT: Dynamische Frontend-URL basierend auf Environment
const getFrontendURL = () => {
  // Priorität: Environment Variable → Default Development
  return process.env.FRONTEND_URL || 'http://localhost:5173';
};

// GOOGLE OAUTH ROUTES
// ===================
// Google Auth - Login initiieren
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

// Google Auth - Callback nach Authentifizierung
router.get('/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    try {
      const frontendURL = getFrontendURL(); // GEÄNDERT: Dynamische URL
      
      // JWT Token für den User generieren
      const token = jwt.sign(
        { id: req.user._id },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
     
      console.log('✅ GOOGLE LOGIN SUCCESS:', req.user.email);
      console.log('🔗 REDIRECTING TO:', frontendURL); // HINZUGEFÜGT: Debug-Log
     
      // Redirect zum Frontend mit Token - GEÄNDERT: Dynamische URL
      res.redirect(`${frontendURL}/oauth-success?token=${token}&user=${encodeURIComponent(JSON.stringify({
        id: req.user._id,
        email: req.user.email,
        name: req.user.name,
        avatar: req.user.avatar
      }))}`);
     
    } catch (error) {
      console.error('❌ GOOGLE CALLBACK ERROR:', error);
      const frontendURL = getFrontendURL(); // GEÄNDERT: Dynamische URL auch für Errors
      res.redirect(`${frontendURL}/oauth-error?error=token_generation_failed`);
    }
  }
);

// GITHUB OAUTH ROUTES
// ===================
// GitHub Auth - Login initiieren
router.get('/github',
  passport.authenticate('github', {
    scope: ['user:email']
  })
);

// GitHub Auth - Callback nach Authentifizierung
router.get('/github/callback',
  passport.authenticate('github', { session: false }),
  (req, res) => {
    try {
      const frontendURL = getFrontendURL(); // GEÄNDERT: Dynamische URL
      
      // JWT Token für den User generieren
      const token = jwt.sign(
        { id: req.user._id },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
     
      console.log('✅ GITHUB LOGIN SUCCESS:', req.user.email);
      console.log('🔗 REDIRECTING TO:', frontendURL); // HINZUGEFÜGT: Debug-Log
     
      // Redirect zum Frontend mit Token - GEÄNDERT: Dynamische URL
      res.redirect(`${frontendURL}/oauth-success?token=${token}&user=${encodeURIComponent(JSON.stringify({
        id: req.user._id,
        email: req.user.email,
        name: req.user.name,
        avatar: req.user.avatar
      }))}`);
     
    } catch (error) {
      console.error('❌ GITHUB CALLBACK ERROR:', error);
      const frontendURL = getFrontendURL(); // GEÄNDERT: Dynamische URL auch für Errors
      res.redirect(`${frontendURL}/oauth-error?error=token_generation_failed`);
    }
  }
);

// OAuth Status Check - ERWEITERT: Zeigt auch Frontend-URL
router.get('/status', (req, res) => {
  res.json({
    google: !!process.env.GOOGLE_CLIENT_ID,
    github: !!process.env.GITHUB_CLIENT_ID,
    frontendURL: getFrontendURL(), // HINZUGEFÜGT: Aktuelle Frontend-URL anzeigen
    message: 'OAuth endpoints active'
  });
});

export default router;