// routes/oauth.js
import express from 'express';
import passport from '../config/passport.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

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
      // JWT Token für den User generieren
      const token = jwt.sign(
        { id: req.user._id }, 
        process.env.JWT_SECRET, 
        { expiresIn: '1h' }
      );
      
      console.log('✅ GOOGLE LOGIN SUCCESS:', req.user.email);
      
      // Redirect zum Frontend mit Token
      res.redirect(`http://localhost:5173/oauth-success?token=${token}&user=${encodeURIComponent(JSON.stringify({
        id: req.user._id,
        email: req.user.email,
        name: req.user.name,
        avatar: req.user.avatar
      }))}`);
      
    } catch (error) {
      console.error('❌ GOOGLE CALLBACK ERROR:', error);
      res.redirect('http://localhost:5173/oauth-error?error=token_generation_failed');
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
      // JWT Token für den User generieren
      const token = jwt.sign(
        { id: req.user._id }, 
        process.env.JWT_SECRET, 
        { expiresIn: '1h' }
      );
      
      console.log('✅ GITHUB LOGIN SUCCESS:', req.user.email);
      
      // Redirect zum Frontend mit Token
      res.redirect(`http://localhost:5173/oauth-success?token=${token}&user=${encodeURIComponent(JSON.stringify({
        id: req.user._id,
        email: req.user.email,
        name: req.user.name,
        avatar: req.user.avatar
      }))}`);
      
    } catch (error) {
      console.error('❌ GITHUB CALLBACK ERROR:', error);
      res.redirect('http://localhost:5173/oauth-error?error=token_generation_failed');
    }
  }
);

// OAuth Status Check
router.get('/status', (req, res) => {
  res.json({
    google: !!process.env.GOOGLE_CLIENT_ID,
    github: !!process.env.GITHUB_CLIENT_ID,
    message: 'OAuth endpoints active'
  });
});

export default router;