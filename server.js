// server.js
// VOLLSTÄNDIG KORRIGIERT: CORS + OAuth + Keine Warnings

// =======================
// Import der Module
// =======================
import express from "express";      // Express Framework
import mongoose from "mongoose";    // MongoDB ODM (Object Data Modeling)
import dotenv from "dotenv";        // Für .env Variablen
import authRoutes from "./routes/auth.js"; // Authentifizierungs-Routen

// =======================
// Initialisierung
// =======================
dotenv.config();                    // .env laden
const app = express();              // Express App starten

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_DB_KEY;

// HINZUGEFÜGT: DEBUG - Environment-Variablen prüfen
console.log("🔧 DEBUG - Environment Variables:");
console.log("PORT:", process.env.PORT);
console.log("MONGO_DB_KEY:", process.env.MONGO_DB_KEY ? "✅ LOADED" : "❌ MISSING");
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "✅ LOADED" : "❌ MISSING");
console.log("EMAIL_USER:", process.env.EMAIL_USER ? "✅ LOADED" : "❌ MISSING");
console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "✅ LOADED" : "❌ MISSING");
console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID ? "✅ LOADED" : "❌ MISSING");
console.log("GITHUB_CLIENT_ID:", process.env.GITHUB_CLIENT_ID ? "✅ LOADED" : "❌ MISSING");

// =======================
// Middleware (KORRIGIERT: Richtige Reihenfolge)
// =======================

// KORRIGIERT: CORS muss VOR allen anderen Routen stehen
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173'); // Vite Dev-Server
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true'); // HINZUGEFÜGT: Für Cookies/Sessions
  
  // Preflight OPTIONS-Request behandeln
  if (req.method === 'OPTIONS') {
    console.log('🔍 PREFLIGHT REQUEST for:', req.url);
    return res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json()); // JSON-Parsing aktivieren

// OAuth-Setup
import session from 'express-session';
import passport from './config/passport.js';
import oauthRoutes from './routes/oauth.js';

// Session-Middleware
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Für Development
}));

// Passport-Middleware
app.use(passport.initialize());
app.use(passport.session());

// KORRIGIERT: Routen nach CORS und anderen Middlewares
app.use("/api/auth", oauthRoutes);
app.use("/api/auth", authRoutes);

// =======================
// Test-Route
// =======================
app.get("/", (req, res) => {
  res.send("API läuft und MongoDB ist verbunden");
});

// HINZUGEFÜGT: Test-Route für CORS
app.get("/api/test", (req, res) => {
  res.json({ message: "CORS funktioniert!", timestamp: new Date().toISOString() });
});

// =======================
// MongoDB Verbindung (KORRIGIERT: Deprecated Options entfernt)
// =======================
mongoose
  .connect(MONGO_URI) // KORRIGIERT: useNewUrlParser und useUnifiedTopology entfernt
  .then(() => {
    console.log("✅ MongoDB verbunden...");
    app.listen(PORT, () => {
      console.log(`🚀 Server läuft auf Port ${PORT}`);
      console.log(`🌐 Frontend URL: http://localhost:5173`);
      console.log(`🔧 Backend URL: http://localhost:${PORT}`);
      console.log(`📧 Email Service: ${process.env.EMAIL_USER ? 'Aktiv' : 'Inaktiv'}`);
      console.log(`🔐 OAuth Google: ${process.env.GOOGLE_CLIENT_ID ? 'Aktiv' : 'Inaktiv'}`);
      console.log(`🐙 OAuth GitHub: ${process.env.GITHUB_CLIENT_ID ? 'Aktiv' : 'Inaktiv'}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB Verbindung fehlgeschlagen:", err.message);
  });