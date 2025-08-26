// config/passport.js
// VOLLSTÄNDIGE DATEI - OAuth mit GitHub Email-Fix für private Accounts
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import User from "../models/user/user.js";
import jwt from "jsonwebtoken";
import emailService from "../services/email-service.js";
import dotenv from "dotenv";

dotenv.config();

console.log("🔍 PASSPORT - Checking OAuth credentials:");
console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID ? "✅ LOADED" : "❌ MISSING");
console.log("GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET ? "✅ LOADED" : "❌ MISSING");
console.log("GITHUB_CLIENT_ID:", process.env.GITHUB_CLIENT_ID ? "✅ LOADED" : "❌ MISSING");
console.log("GITHUB_CLIENT_SECRET:", process.env.GITHUB_CLIENT_SECRET ? "✅ LOADED" : "❌ MISSING");

// HINZUGEFÜGT: Dynamische Callback-URL Funktion
const getCallbackURL = (provider) => {
  const baseURL = process.env.NODE_ENV === 'production' 
    ? process.env.BACKEND_URL || 'https://your-backend-domain.com'
    : 'http://localhost:5000';
  
  const callbackURL = `${baseURL}/api/oauth/${provider}/callback`;
  
  console.log(`🔗 ${provider.toUpperCase()} CALLBACK URL:`, callbackURL);
  return callbackURL;
};

// GOOGLE OAUTH STRATEGY
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  console.log("✅ INITIALIZING GOOGLE OAUTH STRATEGY");

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: getCallbackURL('google'),
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          console.log("\n🔍 GOOGLE AUTH CALLBACK STARTED");
          console.log("  - Profile ID:", profile.id);
          console.log("  - Email:", profile.emails[0].value);
          console.log("  - Name:", profile.displayName);
          console.log("  - Avatar:", profile.photos[0]?.value);

          const userEmail = profile.emails[0].value;
          let user = await User.findOne({ email: userEmail });
          let isNewUser = false;

          if (user) {
            console.log("✅ GOOGLE AUTH - Existing user found");
            console.log("  - User ID:", user._id);
            console.log("  - Current Role:", user.role);
            
            if (!user.googleId) {
              user.googleId = profile.id;
              user.name = user.name || profile.displayName;
              user.avatar = user.avatar || profile.photos[0]?.value;
              user.lastLogin = new Date();
              await user.save();
              console.log("✅ GOOGLE AUTH - Updated existing user with Google data");
            } else {
              user.lastLogin = new Date();
              await user.save();
            }
            
            return done(null, user);
          }

          // NEUEN USER ERSTELLEN
          console.log("🆕 GOOGLE AUTH - Creating new user...");
          
          user = new User({
            email: userEmail,
            password: "oauth_user",
            googleId: profile.id,
            name: profile.displayName,
            avatar: profile.photos[0]?.value,
            isEmailVerified: true,
            role: 'kunde',
            authProvider: 'google',
            createdAt: new Date(),
            lastLogin: new Date()
          });

          await user.save();
          isNewUser = true;
          
          console.log("✅ GOOGLE AUTH - New OAuth user created successfully");
          console.log("  - New User ID:", user._id);
          console.log("  - Email:", user.email);
          console.log("  - Name:", user.name);
          console.log("  - Role:", user.role);

          // Welcome-Email für neue OAuth-User
          if (isNewUser) {
            try {
              console.log("📧 SENDING GOOGLE OAUTH WELCOME EMAIL...");
              
              if (emailService && emailService.sendOAuthWelcomeEmail) {
                const emailResult = await emailService.sendOAuthWelcomeEmail(
                  user.email,
                  "google",
                  user.name
                );

                if (emailResult && emailResult.success) {
                  console.log("✅ GOOGLE OAUTH WELCOME EMAIL SENT SUCCESSFULLY");
                } else {
                  console.error("❌ GOOGLE OAUTH EMAIL FAILED:", emailResult?.error);
                }
              } else {
                console.warn("⚠️ Email service not available, skipping welcome email");
              }
            } catch (emailError) {
              console.error("❌ GOOGLE OAUTH EMAIL ERROR:", emailError);
            }
          }

          console.log("✅ GOOGLE AUTH CALLBACK COMPLETED SUCCESSFULLY\n");
          return done(null, user);
          
        } catch (error) {
          console.error("❌ GOOGLE AUTH ERROR:", error);
          console.error("  - Error Name:", error.name);
          console.error("  - Error Message:", error.message);
          console.error("  - Error Stack:", error.stack);
          return done(error, null);
        }
      }
    )
  );
} else {
  console.log("⚠️ GOOGLE OAUTH DISABLED - Missing credentials");
}

// GITHUB OAUTH STRATEGY - VERBESSERT für private Email-Accounts
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  console.log("✅ INITIALIZING GITHUB OAUTH STRATEGY");

  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: getCallbackURL('github'),
        // ERWEITERTE SCOPES für private Emails
        scope: ['user:email', 'read:user']
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          console.log("\n🔍 GITHUB AUTH CALLBACK STARTED");
          console.log("  - Profile ID:", profile.id);
          console.log("  - Username:", profile.username);
          console.log("  - Profile Emails:", profile.emails);
          console.log("  - Name:", profile.displayName);

          // VERBESSERTES Email-Handling für private GitHub-Accounts
          let userEmail = null;
          
          // Schritt 1: Versuche Email aus Profil zu holen
          if (profile.emails && profile.emails.length > 0) {
            console.log("📧 Found emails in profile:", profile.emails.length);
            
            // Suche primary email
            const primaryEmail = profile.emails.find(email => email.primary);
            if (primaryEmail) {
              userEmail = primaryEmail.value;
              console.log("✅ Found primary email from profile:", userEmail);
            } else {
              // Fallback: erste verfügbare Email
              userEmail = profile.emails[0].value;
              console.log("✅ Using first available email from profile:", userEmail);
            }
          }
          
          // Schritt 2: Falls keine Email im Profil, GitHub API verwenden
          if (!userEmail) {
            console.log("⚠️ No email from profile, trying GitHub API...");
            
            try {
              const response = await fetch('https://api.github.com/user/emails', {
                headers: {
                  'Authorization': `token ${accessToken}`,
                  'User-Agent': 'Portfolio-App',
                  'Accept': 'application/vnd.github.v3+json'
                }
              });
              
              if (response.ok) {
                const emails = await response.json();
                console.log("📧 GitHub API emails response:", emails);
                
                if (emails && emails.length > 0) {
                  // Suche primary & verified email
                  const primaryEmail = emails.find(email => email.primary && email.verified);
                  if (primaryEmail) {
                    userEmail = primaryEmail.email;
                    console.log("✅ Found primary verified email via API:", userEmail);
                  } else {
                    // Fallback: erste verifizierte Email
                    const verifiedEmail = emails.find(email => email.verified);
                    if (verifiedEmail) {
                      userEmail = verifiedEmail.email;
                      console.log("✅ Found verified email via API:", userEmail);
                    } else {
                      // Letzter Fallback: erste Email
                      userEmail = emails[0].email;
                      console.log("⚠️ Using first email from API (unverified):", userEmail);
                    }
                  }
                }
              } else {
                console.error("❌ GitHub API email fetch failed:", response.status, response.statusText);
              }
            } catch (apiError) {
              console.error("❌ GitHub API email request error:", apiError.message);
            }
          }

          // Schritt 3: Letzte Validierung
          if (!userEmail) {
            console.error("❌ GITHUB AUTH - No email available from any source");
            console.error("  - Profile emails:", profile.emails);
            console.error("  - Suggestion: Make sure your GitHub account has a public email or grant email permissions");
            
            return done(new Error(
              "No email address available from GitHub account. " +
              "Please either make your email public in GitHub settings or ensure the app has email permissions."
            ), null);
          }

          console.log("📧 Final email to use:", userEmail);

          // User in Datenbank suchen/erstellen
          let user = await User.findOne({ email: userEmail });
          let isNewUser = false;

          if (user) {
            console.log("✅ GITHUB AUTH - Existing user found");
            console.log("  - User ID:", user._id);
            console.log("  - Current Role:", user.role);
            
            // GitHub-Daten aktualisieren
            if (!user.githubId) {
              user.githubId = profile.id;
              user.name = user.name || profile.displayName || profile.username;
              user.avatar = user.avatar || profile.photos?.[0]?.value;
              user.lastLogin = new Date();
              await user.save();
              console.log("✅ GITHUB AUTH - Updated existing user with GitHub data");
            } else {
              user.lastLogin = new Date();
              await user.save();
            }
            
            return done(null, user);
          }

          // NEUEN USER ERSTELLEN
          console.log("🆕 GITHUB AUTH - Creating new user...");
          
          user = new User({
            email: userEmail,
            password: "oauth_user",
            githubId: profile.id,
            name: profile.displayName || profile.username,
            avatar: profile.photos?.[0]?.value,
            isEmailVerified: true,
            role: 'kunde',
            authProvider: 'github',
            createdAt: new Date(),
            lastLogin: new Date()
          });

          await user.save();
          isNewUser = true;
          
          console.log("✅ GITHUB AUTH - New OAuth user created successfully");
          console.log("  - New User ID:", user._id);
          console.log("  - Email:", user.email);
          console.log("  - Name:", user.name);

          // Welcome-Email für neue OAuth-User
          if (isNewUser) {
            try {
              console.log("📧 SENDING GITHUB OAUTH WELCOME EMAIL...");
              
              if (emailService && emailService.sendOAuthWelcomeEmail) {
                const emailResult = await emailService.sendOAuthWelcomeEmail(
                  user.email,
                  "github",
                  user.name
                );

                if (emailResult && emailResult.success) {
                  console.log("✅ GITHUB OAUTH WELCOME EMAIL SENT SUCCESSFULLY");
                } else {
                  console.error("❌ GITHUB OAUTH EMAIL FAILED:", emailResult?.error);
                }
              } else {
                console.warn("⚠️ Email service not available, skipping welcome email");
              }
            } catch (emailError) {
              console.error("❌ GITHUB OAUTH EMAIL ERROR:", emailError);
            }
          }

          console.log("✅ GITHUB AUTH CALLBACK COMPLETED SUCCESSFULLY\n");
          return done(null, user);
          
        } catch (error) {
          console.error("❌ GITHUB AUTH ERROR:", error);
          console.error("  - Error Name:", error.name);
          console.error("  - Error Message:", error.message);
          console.error("  - Error Stack:", error.stack);
          return done(error, null);
        }
      }
    )
  );
} else {
  console.log("⚠️ GITHUB OAUTH DISABLED - Missing credentials");
}

// Passport Serialization
passport.serializeUser((user, done) => {
  console.log("🔐 SERIALIZING USER:", user._id);
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    console.log("🔓 DESERIALIZING USER:", id);
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    console.error("❌ USER DESERIALIZATION ERROR:", error);
    done(error, null);
  }
});

// Debug-Funktion für OAuth-Status
export const getOAuthStatus = () => {
  return {
    google: {
      enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      callbackURL: getCallbackURL('google')
    },
    github: {
      enabled: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
      callbackURL: getCallbackURL('github')
    },
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  };
};

console.log("\n🔍 OAUTH STATUS:", getOAuthStatus());
console.log("✅ PASSPORT CONFIGURATION COMPLETED\n");

export default passport;