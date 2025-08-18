// config/passport.js
// KORRIGIERT: .env-Variablen prüfen bevor OAuth-Strategien initialisiert werden
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import User from '../models/User/User.js';
import jwt from 'jsonwebtoken';
import emailService from '../services/email-service.js';
import dotenv from 'dotenv';

// HINZUGEFÜGT: Sicherstellen dass .env geladen ist
dotenv.config();

// HINZUGEFÜGT: OAuth-Credentials prüfen
console.log('🔍 PASSPORT - Checking OAuth credentials:');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ LOADED' : '❌ MISSING');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ LOADED' : '❌ MISSING');
console.log('GITHUB_CLIENT_ID:', process.env.GITHUB_CLIENT_ID ? '✅ LOADED' : '❌ MISSING');
console.log('GITHUB_CLIENT_SECRET:', process.env.GITHUB_CLIENT_SECRET ? '✅ LOADED' : '❌ MISSING');

// KORRIGIERT: Nur OAuth-Strategien initialisieren wenn Credentials vorhanden sind
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  console.log('✅ INITIALIZING GOOGLE OAUTH STRATEGY');
  
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      console.log('🔍 GOOGLE AUTH - Profile:', profile.emails[0].value);
      
      // Prüfen ob User bereits existiert
      let user = await User.findOne({ email: profile.emails[0].value });
      let isNewUser = false;
      
      if (user) {
        console.log('✅ GOOGLE AUTH - Existing user found');
        return done(null, user);
      }
      
      // Neuen User erstellen
      user = new User({
        email: profile.emails[0].value,
        password: 'oauth_user', // Placeholder für OAuth-User
        googleId: profile.id,
        name: profile.displayName,
        avatar: profile.photos[0]?.value
      });
      
      await user.save();
      isNewUser = true;
      console.log('✅ GOOGLE AUTH - New user created');
      
      // Welcome-Email für neue OAuth-User senden
      if (isNewUser) {
        try {
          console.log('📧 SENDING GOOGLE OAUTH WELCOME EMAIL...');
          const emailResult = await emailService.sendOAuthWelcomeEmail(
            user.email,
            'google',
            user.name
          );
          
          if (emailResult.success) {
            console.log('✅ GOOGLE OAUTH WELCOME EMAIL SENT SUCCESSFULLY');
          } else {
            console.error('❌ GOOGLE OAUTH EMAIL FAILED:', emailResult.error);
          }
        } catch (emailError) {
          console.error('❌ GOOGLE OAUTH EMAIL ERROR:', emailError);
          // Email-Fehler nicht weiterwerfen, OAuth soll trotzdem funktionieren
        }
      }
      
      return done(null, user);
    } catch (error) {
      console.error('❌ GOOGLE AUTH ERROR:', error);
      return done(error, null);
    }
  }));
} else {
  console.log('⚠️ GOOGLE OAUTH DISABLED - Missing credentials');
}

// KORRIGIERT: GitHub OAuth nur wenn Credentials vorhanden sind
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  console.log('✅ INITIALIZING GITHUB OAUTH STRATEGY');
  
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: "/api/auth/github/callback"
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      console.log('🔍 GITHUB AUTH - Profile:', profile.emails[0].value);
      
      // Prüfen ob User bereits existiert
      let user = await User.findOne({ email: profile.emails[0].value });
      let isNewUser = false;
      
      if (user) {
        console.log('✅ GITHUB AUTH - Existing user found');
        return done(null, user);
      }
      
      // Neuen User erstellen
      user = new User({
        email: profile.emails[0].value,
        password: 'oauth_user', // Placeholder für OAuth-User
        githubId: profile.id,
        name: profile.displayName || profile.username,
        avatar: profile.photos[0]?.value
      });
      
      await user.save();
      isNewUser = true;
      console.log('✅ GITHUB AUTH - New user created');
      
      // Welcome-Email für neue OAuth-User senden
      if (isNewUser) {
        try {
          console.log('📧 SENDING GITHUB OAUTH WELCOME EMAIL...');
          const emailResult = await emailService.sendOAuthWelcomeEmail(
            user.email,
            'github',
            user.name
          );
          
          if (emailResult.success) {
            console.log('✅ GITHUB OAUTH WELCOME EMAIL SENT SUCCESSFULLY');
          } else {
            console.error('❌ GITHUB OAUTH EMAIL FAILED:', emailResult.error);
          }
        } catch (emailError) {
          console.error('❌ GITHUB OAUTH EMAIL ERROR:', emailError);
          // Email-Fehler nicht weiterwerfen, OAuth soll trotzdem funktionieren
        }
      }
      
      return done(null, user);
    } catch (error) {
      console.error('❌ GITHUB AUTH ERROR:', error);
      return done(error, null);
    }
  }));
} else {
  console.log('⚠️ GITHUB OAUTH DISABLED - Missing credentials');
}

// Passport Serialization
passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;