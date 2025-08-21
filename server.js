// server.js
// VOLLSTÄNDIGE SERVER-DATEI: Korrigierte MongoDB-Optionen + Alle Features
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Routes
import contactRoutes from './routes/contact.js';

// ES Module Setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment laden
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS-Konfiguration
const corsOptions = {
  origin: [
    'http://localhost:5173',  // Vite dev server
    'http://localhost:3000',  // React dev server
    'http://127.0.0.1:5173',  // Alternative localhost
    'https://portfolio-chris-schubert.vercel.app', // Production
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Accept', 
    'Origin', 
    'X-Requested-With',
    'Access-Control-Allow-Origin'
  ],
  optionsSuccessStatus: 200,
  maxAge: 86400
};

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Security Headers
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  next();
});

// Body Parser
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logging für Development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`\n${timestamp} - ${req.method} ${req.path}`);
    console.log('🔍 Origin:', req.get('Origin'));
    console.log('🔍 Content-Type:', req.get('Content-Type'));
    console.log('🔍 User-Agent:', req.get('User-Agent')?.substring(0, 50) + '...');
    if (req.body && Object.keys(req.body).length > 0) {
      console.log('📊 Body:', req.body);
    }
    next();
  });
}

// KORRIGIERT: Database Connection mit gültigen MongoDB-Optionen
const connectDB = async () => {
  try {
    console.log('\n🔄 CONNECTING TO DATABASE...');
    console.log('📍 MongoDB URI:', process.env.MONGODB_URI ? 'Set ✅' : 'NOT SET ❌');
    
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    // KORRIGIERT: Entfernt ungültige bufferMaxEntries Option
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
      // ENTFERNT: bufferCommands und bufferMaxEntries (nicht mehr unterstützt)
    });
    
    console.log('✅ DATABASE CONNECTED SUCCESSFULLY');
    console.log('📊 Database:', conn.connection.name);
    console.log('🔗 Host:', conn.connection.host);
    console.log('🔐 Ready State:', conn.connection.readyState);
    
    // Database event listeners
    mongoose.connection.on('error', (error) => {
      console.error('❌ Database connection error:', error);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ Database disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('🔄 Database reconnected');
    });
    
  } catch (error) {
    console.error('❌ DATABASE CONNECTION ERROR:', error.message);
    console.error('📍 Full error:', error);
    process.exit(1);
  }
};

// Database verbinden
await connectDB();

// Health Check Route
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    port: PORT,
    database: {
      state: dbStatus[dbState] || 'unknown',
      name: mongoose.connection.name,
      host: mongoose.connection.host
    },
    services: {
      email: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
      mongodb: dbState === 1
    },
    version: process.env.APP_VERSION || '1.0.0'
  });
});

// API Info Route
app.get('/', (req, res) => {
  res.json({
    message: 'Portfolio Backend API - Chris Schubert',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV,
    endpoints: {
      health: '/health',
      contact: '/api/contact',
      contactTest: '/api/contact/test',
      emailTest: '/api/contact/test-email',
      dbTest: '/api/contact/test-db'
    },
    documentation: {
      contact_form: 'POST /api/contact',
      newsletter: 'POST /api/contact/newsletter',
      health_check: 'GET /health'
    },
    cors: {
      origins: corsOptions.origin,
      credentials: corsOptions.credentials
    },
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/contact', contactRoutes);

// Development Debug Routes
if (process.env.NODE_ENV === 'development') {
  app.get('/debug/env', (req, res) => {
    res.json({
      environment: process.env.NODE_ENV,
      port: process.env.PORT,
      frontend_url: process.env.FRONTEND_URL,
      has_mongodb: !!process.env.MONGODB_URI,
      has_email_user: !!process.env.EMAIL_USER,
      has_email_pass: !!process.env.EMAIL_PASS,
      admin_email: process.env.ADMIN_EMAIL,
      session_secret: !!process.env.SESSION_SECRET
    });
  });

  app.get('/debug/headers', (req, res) => {
    res.json({
      headers: req.headers,
      method: req.method,
      url: req.url,
      origin: req.get('Origin'),
      userAgent: req.get('User-Agent'),
      contentType: req.get('Content-Type')
    });
  });

  app.get('/debug/cors-test', (req, res) => {
    res.json({
      message: 'CORS test successful',
      origin: req.get('Origin'),
      method: req.method,
      allowedOrigins: corsOptions.origin,
      timestamp: new Date().toISOString()
    });
  });
}

// Static files (für Production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
  
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

// 404 Handler
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  console.log('📍 Available routes:');
  console.log('   GET  / - API Info');
  console.log('   GET  /health - Health Check');
  console.log('   POST /api/contact - Contact Form');
  if (process.env.NODE_ENV === 'development') {
    console.log('   GET  /debug/env - Environment Variables');
    console.log('   GET  /api/contact/test - Contact Test');
    console.log('   GET  /api/contact/test-email - Email Test');
  }
  
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      'GET /',
      'GET /health',
      'POST /api/contact',
      'POST /api/contact/newsletter',
      ...(process.env.NODE_ENV === 'development' ? [
        'GET /debug/env',
        'POST /api/contact/test',
        'GET /api/contact/test-email',
        'GET /api/contact/test-db'
      ] : [])
    ],
    suggestion: 'Check available endpoints at GET /',
    timestamp: new Date().toISOString()
  });
});

// Global Error Handler
app.use((error, req, res, next) => {
  console.error('\n❌ GLOBAL ERROR HANDLER TRIGGERED:');
  console.error('📍 Error Type:', error.constructor.name);
  console.error('📍 Error Message:', error.message);
  console.error('📍 Error Stack:', error.stack);
  console.error('📍 Request Details:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body
  });
  
  // CORS Headers für Error Response
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
  
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Spezifische Fehlercodes
  let statusCode = error.status || error.statusCode || 500;
  let message = error.message || 'Internal Server Error';
  
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error: ' + error.message;
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  } else if (error.name === 'MongoNetworkError') {
    statusCode = 503;
    message = 'Database connection error';
  } else if (error.code === 11000) {
    statusCode = 409;
    message = 'Duplicate entry';
  } else if (error.message?.includes('CORS')) {
    statusCode = 403;
    message = 'CORS policy violation';
  }
  
  res.status(statusCode).json({
    success: false,
    message: message,
    error: isDevelopment ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code
    } : undefined,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
    requestId: req.headers['x-request-id'] || 'unknown'
  });
});

// Server Start
const server = app.listen(PORT, () => {
  console.log('\n🚀 SERVER STARTED SUCCESSFULLY');
  console.log('=' .repeat(60));
  console.log(`📍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 Server running on: http://localhost:${PORT}`);
  console.log(`📊 Database: ${mongoose.connection.readyState === 1 ? 'Connected ✅' : 'Disconnected ❌'}`);
  console.log(`📧 Email Service: ${(process.env.EMAIL_USER && process.env.EMAIL_PASS) ? 'Configured ✅' : 'NOT CONFIGURED ❌'}`);
  
  console.log('\n📚 Available endpoints:');
  console.log(`   GET  http://localhost:${PORT}/                    - API Info`);
  console.log(`   GET  http://localhost:${PORT}/health             - Health Check`);
  console.log(`   POST http://localhost:${PORT}/api/contact        - Contact Form`);
  console.log(`   POST http://localhost:${PORT}/api/contact/newsletter - Newsletter`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log('\n🛠️  Development endpoints:');
    console.log(`   POST http://localhost:${PORT}/api/contact/test   - Contact Test`);
    console.log(`   GET  http://localhost:${PORT}/api/contact/test-email - Email Test`);
    console.log(`   GET  http://localhost:${PORT}/api/contact/test-db - Database Test`);
    console.log(`   GET  http://localhost:${PORT}/api/contact/debug-contacts - View Contacts`);
    console.log(`   GET  http://localhost:${PORT}/debug/env         - Environment Check`);
    console.log(`   GET  http://localhost:${PORT}/debug/headers     - Headers Debug`);
    console.log(`   GET  http://localhost:${PORT}/debug/cors-test   - CORS Test`);
  }
  
  console.log('=' .repeat(60));
  
  // Environment Validation
  const requiredEnvVars = [
    'MONGODB_URI',
    'EMAIL_USER', 
    'EMAIL_PASS',
    'ADMIN_EMAIL'
  ];
  
  const optionalEnvVars = [
    'SESSION_SECRET',
    'FRONTEND_URL',
    'APP_VERSION'
  ];
  
  const missingRequired = requiredEnvVars.filter(varName => !process.env[varName]);
  const missingOptional = optionalEnvVars.filter(varName => !process.env[varName]);
  
  if (missingRequired.length > 0) {
    console.warn('\n⚠️  CRITICAL: Missing Required Environment Variables:');
    missingRequired.forEach(varName => {
      console.warn(`   ❌ ${varName}`);
    });
    console.warn('   ⚠️  Some core features will not work!\n');
  } else {
    console.log('\n✅ All required environment variables are set');
  }
  
  if (missingOptional.length > 0) {
    console.log('\n📝 Optional environment variables not set:');
    missingOptional.forEach(varName => {
      console.log(`   ⚪ ${varName}`);
    });
    console.log('   ℹ️  These features will be disabled.\n');
  }
  
  console.log(`\n🎯 Frontend should connect to: http://localhost:${PORT}/api`);
  console.log(`🔗 Test contact form: curl -X POST http://localhost:${PORT}/api/contact/test`);
  console.log(`🔗 Test health check: curl http://localhost:${PORT}/health`);
  console.log('\n✨ Ready to receive requests!\n');
});

// Graceful Shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n📴 ${signal} received. Shutting down gracefully...`);
  
  server.close(() => {
    console.log('🛑 HTTP server closed.');
    
    mongoose.connection.close(false, () => {
      console.log('💾 Database connection closed.');
      console.log('✅ Graceful shutdown completed.');
      process.exit(0);
    });
  });
  
  // Force close after 30 seconds
  setTimeout(() => {
    console.error('⚠️ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled Promise Rejection Handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ UNHANDLED PROMISE REJECTION:');
  console.error('📍 Reason:', reason);
  console.error('📍 Promise:', promise);
  
  // In development, exit to catch issues early
  if (process.env.NODE_ENV === 'development') {
    console.error('💥 Exiting due to unhandled promise rejection in development');
    process.exit(1);
  } else {
    console.error('⚠️ Continuing in production mode, but this should be fixed');
  }
});

// Uncaught Exception Handler
process.on('uncaughtException', (error) => {
  console.error('\n❌ UNCAUGHT EXCEPTION:');
  console.error('📍 Error:', error.message);
  console.error('📍 Stack:', error.stack);
  console.error('💥 This is critical, shutting down immediately');
  process.exit(1);
});

export default app;