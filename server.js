// Backend/server.js
// VOLLSTÄNDIG: Server mit Contact Routes Integration
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
// ROUTES - DYNAMIC IMPORTS (ERWEITERT: Mit Contact Routes)
// ===========================
try {
  const authRoutes = await import('./routes/auth.js');
  const oauthRoutes = await import('./routes/oauth.js');
  const dashboardRoutes = await import('./routes/dashboard.js');
  const contactRoutes = await import('./routes/contact.js'); // HINZUGEFÜGT: Contact Routes

  app.use('/api/auth', authRoutes.default);
  app.use('/api/oauth', oauthRoutes.default);
  app.use('/api/dashboard', dashboardRoutes.default);
  app.use('/api/contact', contactRoutes.default); // HINZUGEFÜGT: Contact Routes Registration
  
  console.log('✅ Alle Routes erfolgreich geladen');
  
} catch (routeError) {
  console.error('❌ Fehler beim Laden der Routes:', routeError);
  
  // Fallback Routes für Service-Ausfälle
  app.use('/api/auth', (req, res) => {
    res.status(503).json({
      success: false,
      error: 'Auth-Service temporär nicht verfügbar'
    });
  });
  
  app.use('/api/contact', (req, res) => {
    res.status(503).json({
      success: false,
      error: 'Contact-Service temporär nicht verfügbar'
    });
  });
}

// ===========================
// API ENDPOINTS
// ===========================

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
    uptime: process.uptime(),
    services: {
      auth: 'available',
      oauth: 'available', 
      dashboard: 'available',
      contact: 'available' // HINZUGEFÜGT: Contact Service Status
    }
  });
});

// API Info Endpoint (ERWEITERT: Mit Contact)
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Portfolio Backend API',
    version: '1.0.0',
    description: 'Backend API für Chris Schubert Portfolio mit OAuth, Dashboard und Contact System',
    endpoints: {
      auth: '/api/auth',
      oauth: '/api/oauth', 
      dashboard: '/api/dashboard',
      contact: '/api/contact', // HINZUGEFÜGT: Contact Endpoint
      health: '/api/health'
    },
    features: [
      'OAuth Authentication (Google, GitHub)',
      'JWT Token Management',
      'Dashboard with Projects & Messages',
      'Contact Form with Email Notifications', // HINZUGEFÜGT
      'Rate Limiting & Security Headers'
    ]
  });
});

// ===========================
// ERROR HANDLING
// ===========================

// 404 Handler für API Routes (ERWEITERT: Mit Contact)
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API-Endpunkt nicht gefunden',
    path: req.originalUrl,
    availableEndpoints: [
      '/api/auth', 
      '/api/oauth', 
      '/api/dashboard', 
      '/api/contact', // HINZUGEFÜGT
      '/api/health'
    ],
    suggestion: 'Überprüfen Sie die API-Dokumentation für verfügbare Endpunkte'
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Global Error:', err);
  
  // MongoDB Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'Feld';
    return res.status(400).json({
      success: false,
      error: `${field} ist bereits vergeben`,
      code: 'DUPLICATE_KEY'
    });
  }
  
  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      error: 'Validierungsfehler',
      details: errors,
      code: 'VALIDATION_ERROR'
    });
  }
  
  // JWT Errors
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
  
  // CORS Error
  if (err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      error: 'CORS-Richtlinie verletzt',
      code: 'CORS_ERROR'
    });
  }
  
  // Rate Limit Error
  if (err.status === 429) {
    return res.status(429).json({
      success: false,
      error: 'Zu viele Anfragen',
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }
  
  // Generic Error
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
// DATABASE CONNECTION
// ===========================
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  heartbeatFrequencyMS: 2000,
  maxPoolSize: 10,
  minPoolSize: 5,
  maxIdleTimeMS: 30000
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
// DEFAULT ADMIN ERSTELLEN
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
      
      // Unzugewiesene Kunden diesem Admin zuweisen
      try {
        const assignedCount = await User.assignUnassignedCustomers(defaultAdmin._id);
        if (assignedCount > 0) {
          console.log(`✅ ${assignedCount} unzugewiesene Kunden dem Admin zugewiesen`);
        }
      } catch (assignError) {
        console.warn('⚠️ Kunde-Zuweisung fehlgeschlagen:', assignError.message);
      }
      
      if (!process.env.ADMIN_PASSWORD) {
        console.warn('⚠️ SICHERHEITSHINWEIS: Setze ADMIN_PASSWORD in .env für Produktion!');
      }
    } else {
      console.log('ℹ️ Admin-User bereits vorhanden');
      
      // Auch bei vorhandenem Admin prüfen ob unzugewiesene Kunden existieren
      try {
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
      } catch (checkError) {
        console.warn('⚠️ Kunde-Check fehlgeschlagen:', checkError.message);
      }
    }
  } catch (error) {
    console.error('❌ Fehler beim Erstellen des Standard-Admins:', error);
  }
}

// ===========================
// SERVER START
// ===========================
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`\n📋 API Endpoints:`);
    console.log(`   🔐 Auth: http://localhost:${PORT}/api/auth`);
    console.log(`   👤 OAuth: http://localhost:${PORT}/api/oauth`);
    console.log(`   📊 Dashboard: http://localhost:${PORT}/api/dashboard`);
    console.log(`   📧 Contact: http://localhost:${PORT}/api/contact`); // HINZUGEFÜGT
    console.log(`   💗 Health: http://localhost:${PORT}/api/health`);
    console.log(`   📖 Info: http://localhost:${PORT}/api\n`);
    
    console.log(`🔧 Development Features:`);
    console.log(`   • Contact Form mit E-Mail-Versand`);
    console.log(`   • Rate Limiting (3 Anfragen/15min)`);
    console.log(`   • Automatische Admin-Erstellung`);
    console.log(`   • MongoDB Auto-Reconnect`);
    console.log(`   • CORS für Frontend-Integration\n`);
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
  
  // Forced Shutdown nach 10 Sekunden
  setTimeout(() => {
    console.error('🚨 Erzwungener Shutdown nach Timeout');
    process.exit(1);
  }, 10000);
};

// Process Event Handlers
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

// ===========================
// DEVELOPMENT HELPERS
// ===========================
if (process.env.NODE_ENV === 'development') {
  // Memory Usage Monitoring
  setInterval(() => {
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed > 100 * 1024 * 1024) { // > 100MB
      console.warn(`⚠️ Hoher Memory-Verbrauch: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    }
  }, 60000); // Alle 60 Sekunden
  
  // Database Connection Monitoring
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB-Verbindung getrennt');
  });
  
  mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB-Verbindung wiederhergestellt');
  });
}

export default app;