// Backend/server.js
// KORRIGIERT: MongoDB-Connection ohne unsupported Options
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
// ENVIRONMENT VALIDATION
// ===========================
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ KRITISCHE UMGEBUNGSVARIABLEN FEHLEN:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\n📋 ERSTELLE EINE .env DATEI MIT:');
  console.error('MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database');
  console.error('JWT_SECRET=your-super-secret-key-here');
  process.exit(1);
}

// ===========================
// MIDDLEWARE
// ===========================

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: {
    success: false,
    error: 'Zu viele Anfragen, bitte versuchen Sie es später erneut.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);

// CORS Configuration
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173'
    ];
    
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Nicht erlaubte CORS-Origin'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body Parser
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({
        success: false,
        error: 'Ungültiges JSON-Format'
      });
      throw e;
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Powered-By', 'Portfolio Backend');
  next();
});

// Request Logging (Development)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });
}

// ===========================
// ROUTES - DYNAMIC IMPORTS
// ===========================
try {
  const authRoutes = await import('./routes/auth.js');
  const oauthRoutes = await import('./routes/oauth.js');
  const dashboardRoutes = await import('./routes/dashboard.js');

  app.use('/api/auth', authRoutes.default);
  app.use('/api/oauth', oauthRoutes.default);
  app.use('/api/dashboard', dashboardRoutes.default);
  
} catch (routeError) {
  console.error('❌ Fehler beim Laden der Routes:', routeError);
  
  app.use('/api/auth', (req, res) => {
    res.status(503).json({
      success: false,
      error: 'Auth-Service temporär nicht verfügbar'
    });
  });
}

// Health Check
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  res.json({
    success: true,
    message: 'Server läuft',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: dbStatus,
    uptime: process.uptime()
  });
});

// API Info Endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Portfolio Backend API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      oauth: '/api/oauth', 
      dashboard: '/api/dashboard',
      health: '/api/health'
    }
  });
});

// 404 Handler
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API-Endpunkt nicht gefunden',
    path: req.originalUrl,
    availableEndpoints: ['/api/auth', '/api/oauth', '/api/dashboard', '/api/health']
  });
});

// ===========================
// ERROR HANDLING
// ===========================
app.use((err, req, res, next) => {
  console.error('Global Error:', err);
  
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'Feld';
    return res.status(400).json({
      success: false,
      error: `${field} ist bereits vergeben`,
      code: 'DUPLICATE_KEY'
    });
  }
  
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      error: 'Validierungsfehler',
      details: errors,
      code: 'VALIDATION_ERROR'
    });
  }
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Ungültiger Token',
      code: 'INVALID_TOKEN'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token abgelaufen',
      code: 'TOKEN_EXPIRED'
    });
  }
  
  if (err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      error: 'CORS-Richtlinie verletzt',
      code: 'CORS_ERROR'
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Interner Server-Fehler',
    code: err.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err 
    })
  });
});

// ===========================
// DATABASE CONNECTION (KORRIGIERT: Ohne unsupported Options)
// ===========================
mongoose.connect(process.env.MONGODB_URI, {
  // KORRIGIERT: Nur unterstützte Optionen
  serverSelectionTimeoutMS: 5000,
  heartbeatFrequencyMS: 2000,
  maxPoolSize: 10,
  minPoolSize: 5,
  maxIdleTimeMS: 30000
  // ENTFERNT: bufferCommands und bufferMaxEntries (nicht mehr unterstützt)
})
.then(() => {
  console.log('✅ MongoDB verbunden');
  console.log(`📊 Database: ${mongoose.connection.name}`);
  console.log(`🌐 Host: ${mongoose.connection.host}:${mongoose.connection.port}`);
  
  createDefaultAdmin();
})
.catch((error) => {
  console.error('❌ MongoDB Verbindungsfehler:', error);
  
  if (error.message.includes('ECONNREFUSED')) {
    console.error('🔧 Lösungsvorschläge:');
    console.error('1. Prüfe MONGODB_URI in .env');
    console.error('2. Verwende MongoDB Atlas für Cloud-Database');
    console.error('3. Starte lokale MongoDB: net start MongoDB');
  }
  
  if (error.message.includes('not supported')) {
    console.error('🔧 MongoDB-Driver-Kompatibilität:');
    console.error('1. Verwende nur unterstützte Connection-Optionen');
    console.error('2. Prüfe Mongoose/MongoDB-Driver-Versionen');
  }
  
  process.exit(1);
});

// ===========================
// DEFAULT ADMIN ERSTELLEN (ERWEITERT)
// ===========================
async function createDefaultAdmin() {
  try {
    const { default: User } = await import('./models/User/User.js');
    const bcrypt = await import('bcrypt');
    
    const adminExists = await User.findOne({ role: 'admin' });
    
    if (!adminExists) {
      console.log('🔨 Erstelle Standard-Admin...');
      
      const defaultAdmin = new User({
        email: process.env.ADMIN_EMAIL || 'admin@portfolio.com',
        password: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin123!', 12),
        role: 'admin',
        firstName: 'Chris',
        lastName: 'Schubert',
        isEmailVerified: true,
        isActive: true
      });
      
      await defaultAdmin.save();
      console.log('✅ Standard-Admin erstellt:', defaultAdmin.email);
      
      // HINZUGEFÜGT: Unzugewiesene Kunden diesem Admin zuweisen
      const assignedCount = await User.assignUnassignedCustomers(defaultAdmin._id);
      if (assignedCount > 0) {
        console.log(`✅ ${assignedCount} unzugewiesene Kunden dem Admin zugewiesen`);
      }
      
      if (!process.env.ADMIN_PASSWORD) {
        console.warn('⚠️ SICHERHEITSHINWEIS: Setze ADMIN_PASSWORD in .env für Produktion!');
      }
    } else {
      console.log('ℹ️ Admin-User bereits vorhanden');
      
      // HINZUGEFÜGT: Auch bei vorhandenem Admin prüfen ob unzugewiesene Kunden existieren
      const unassignedCount = await User.countDocuments({ 
        role: 'kunde', 
        $or: [
          { assignedAdmin: null },
          { assignedAdmin: { $exists: false } }
        ]
      });
      
      if (unassignedCount > 0) {
        console.log(`⚠️ ${unassignedCount} unzugewiesene Kunden gefunden - weise dem ersten Admin zu`);
        const firstAdmin = await User.findOne({ role: 'admin', isActive: true });
        if (firstAdmin) {
          const assignedCount = await User.assignUnassignedCustomers(firstAdmin._id);
          console.log(`✅ ${assignedCount} Kunden dem Admin ${firstAdmin.email} zugewiesen`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Fehler beim Erstellen des Standard-Admins:', error);
  }
}

// ===========================
// SERVER START
// ===========================
const PORT = process.env.PORT || 5000; // KORRIGIERT: Port 5000 aus deiner .env

const server = app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`\n📋 API Endpoints:`);
    console.log(`   🔐 Auth: http://localhost:${PORT}/api/auth`);
    console.log(`   👤 OAuth: http://localhost:${PORT}/api/oauth`);
    console.log(`   📊 Dashboard: http://localhost:${PORT}/api/dashboard`);
    console.log(`   💗 Health: http://localhost:${PORT}/api/health`);
    console.log(`   📖 Info: http://localhost:${PORT}/api\n`);
  }
});

// ===========================
// GRACEFUL SHUTDOWN
// ===========================
const gracefulShutdown = async (signal) => {
  console.log(`🛑 ${signal} empfangen, Server wird heruntergefahren...`);
  
  server.close(async () => {
    console.log('📡 HTTP-Server geschlossen');
    
    try {
      await mongoose.connection.close();
      console.log('🗄️ MongoDB-Verbindung geschlossen');
      
      console.log('✅ Graceful Shutdown abgeschlossen');
      process.exit(0);
    } catch (error) {
      console.error('❌ Fehler beim Shutdown:', error);
      process.exit(1);
    }
  });
  
  setTimeout(() => {
    console.error('🚨 Erzwungener Shutdown nach Timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

export default app;