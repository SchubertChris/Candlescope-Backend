// Backend/server.js
// KORRIGIERT: ES Modules statt CommonJS
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ES Module Pfad-Setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dotenv laden
config();

const app = express();

// ===========================
// MIDDLEWARE
// ===========================

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 1000, // Max 1000 requests pro 15 min
  message: 'Zu viele Anfragen, bitte versuchen Sie es später erneut.'
});

app.use(limiter);

// CORS Configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ===========================
// ROUTES - DYNAMIC IMPORTS
// ===========================

// Import routes dynamisch
const authRoutes = await import('./routes/auth.js');
const oauthRoutes = await import('./routes/oauth.js');
const dashboardRoutes = await import('./routes/dashboard.js');

// Route Registration
app.use('/api/auth', authRoutes.default);
app.use('/api/oauth', oauthRoutes.default);
app.use('/api/dashboard', dashboardRoutes.default);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server läuft',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0'
  });
});

// 404 Handler
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API-Endpunkt nicht gefunden',
    path: req.originalUrl
  });
});

// ===========================
// ERROR HANDLING
// ===========================

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Global Error:', err);
  
  // MongoDB Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      error: `${field} ist bereits vergeben`
    });
  }
  
  // Validation Error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      error: 'Validierungsfehler',
      details: errors
    });
  }
  
  // JWT Error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Ungültiger Token'
    });
  }
  
  // Default Error
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Interner Server-Fehler',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ===========================
// DATABASE CONNECTION
// ===========================

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/portfolio-dashboard', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB verbunden');
  
  // Admin-User erstellen falls nicht vorhanden
  createDefaultAdmin();
})
.catch((error) => {
  console.error('❌ MongoDB Verbindungsfehler:', error);
  process.exit(1);
});

// ===========================
// DEFAULT ADMIN ERSTELLEN
// ===========================

async function createDefaultAdmin() {
  try {
    const { default: User } = await import('./models/User/User.js');
    const bcrypt = await import('bcrypt');
    
    const adminExists = await User.findOne({ role: 'admin' });
    
    if (!adminExists) {
      const defaultAdmin = new User({
        email: process.env.ADMIN_EMAIL || 'admin@portfolio.com',
        password: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10),
        role: 'admin',
        firstName: 'Chris',
        lastName: 'Schubert',
        isEmailVerified: true,
        isActive: true
      });
      
      await defaultAdmin.save();
      console.log('✅ Standard-Admin erstellt:', defaultAdmin.email);
    }
  } catch (error) {
    console.error('❌ Fehler beim Erstellen des Standard-Admins:', error);
  }
}

// ===========================
// SERVER START
// ===========================

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`\n📋 API Endpoints:`);
    console.log(`   🔐 Auth: http://localhost:${PORT}/api/auth`);
    console.log(`   👤 OAuth: http://localhost:${PORT}/api/oauth`);
    console.log(`   📊 Dashboard: http://localhost:${PORT}/api/dashboard`);
    console.log(`   💗 Health: http://localhost:${PORT}/api/health\n`);
  }
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM empfangen, Server wird heruntergefahren...');
  mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT empfangen, Server wird heruntergefahren...');
  mongoose.connection.close();
  process.exit(0);
});

export default app;