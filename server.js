// server.js
// VOLLSTÄNDIGE SERVER-DATEI mit Admin-Account Auto-Creation
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import passport from './config/passport.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Route-Imports
import authRoutes from './routes/auth.js';
import contactRoutes from './routes/contact.js';
import dashboardRoutes from './routes/dashboard.js';
import oauthRoutes from './routes/oauth.js';
import newsletterRoutes from './routes/newsletter.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ES Module Setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(passport.initialize());

// Security Headers
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  next();
});

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

// Database Connection
const connectDB = async () => {
  try {
    console.log('\n🔄 CONNECTING TO DATABASE...');
    console.log('📍 MongoDB URI:', process.env.MONGODB_URI ? 'Set ✅' : 'NOT SET ❌');
    
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
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

// ADMIN ACCOUNT AUTO-CREATION
const ensureAdminAccount = async () => {
  try {
    console.log('\n👑 CHECKING ADMIN ACCOUNT...');
    
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminEmail || !adminPassword) {
      console.warn('⚠️ ADMIN_EMAIL or ADMIN_PASSWORD not set in .env');
      console.warn('   Add these to .env for auto-admin creation:');
      console.warn('   ADMIN_EMAIL=schubert_chris@rocketmail.com');
      console.warn('   ADMIN_PASSWORD=dD0DeO$KBBO9');
      return;
    }
    
    console.log('📧 Admin Email from .env:', adminEmail);
    
    // Dynamic imports nach DB-Connection
    const { default: User } = await import('./models/User/User.js');
    const { default: bcrypt } = await import('bcrypt');
    
    // Prüfen ob Admin bereits existiert
    let adminUser = await User.findOne({ email: adminEmail });
    
    if (adminUser) {
      console.log('✅ ADMIN ACCOUNT EXISTS');
      console.log('   - Email:', adminUser.email);
      console.log('   - Role:', adminUser.role);
      console.log('   - Created:', adminUser.createdAt);
      
      // Sicherstellen dass Rolle 'admin' ist
      if (adminUser.role !== 'admin') {
        adminUser.role = 'admin';
        await adminUser.save();
        console.log('✅ ADMIN ROLE UPDATED TO: admin');
      }
      
      return adminUser;
    }
    
    // Admin-Account erstellen
    console.log('🆕 CREATING NEW ADMIN ACCOUNT...');
    console.log('   - Email:', adminEmail);
    console.log('   - Password: [FROM .env ADMIN_PASSWORD]');
    
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    adminUser = new User({
      email: adminEmail.toLowerCase().trim(),
      password: hashedPassword,
      role: 'admin',
      firstName: 'Chris',
      lastName: 'Schubert', 
      company: 'Chris Schubert - Web Development',
      isEmailVerified: true,
      isActive: true,
      authProvider: 'local',
      createdAt: new Date(),
      lastLogin: new Date()
    });
    
    const savedAdmin = await adminUser.save();
    
    console.log('✅ ADMIN ACCOUNT CREATED SUCCESSFULLY!');
    console.log('   - User ID:', savedAdmin._id);
    console.log('   - Email:', savedAdmin.email);
    console.log('   - Role:', savedAdmin.role);
    console.log('   - Name:', savedAdmin.firstName, savedAdmin.lastName);
    console.log('   - Company:', savedAdmin.company);
    console.log('🔑 LOGIN CREDENTIALS:');
    console.log('   - Email:', adminEmail);
    console.log('   - Password: [Check .env ADMIN_PASSWORD]');
    
    return savedAdmin;
    
  } catch (error) {
    console.error('❌ ADMIN ACCOUNT CREATION ERROR:', error);
    console.error('   - Error Name:', error.name);
    console.error('   - Error Message:', error.message);
    
    if (error.code === 11000) {
      console.error('   - Duplicate key error - admin might already exist with different case');
    }
    
    // Nicht kritisch - Server kann trotzdem starten
    console.log('⚠️ Server continues without admin auto-creation');
  }
};

// API Info Route
app.get('/', (req, res) => {
  res.json({
    message: 'Portfolio Backend API - Chris Schubert',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV,
    endpoints: {
      health: '/health',
      contact: '/api/contact',
      dashboard: '/api/dashboard',
      auth: '/api/auth',
      oauth: '/api/oauth',
      newsletter: '/api/newsletter',
      contactTest: '/api/contact/test',
      emailTest: '/api/contact/test-email',
      dbTest: '/api/contact/test-db'
    },
    documentation: {
      contact_form: 'POST /api/contact',
      newsletter_signup: 'POST /api/newsletter/subscribe',
      newsletter_admin: 'GET /api/newsletter/* (Admin Auth Required)',
      dashboard: 'GET /api/dashboard/* (Auth Required)',
      health_check: 'GET /health',
      admin_login: 'POST /api/auth/login (Use ADMIN_EMAIL/ADMIN_PASSWORD from .env)'
    },
    cors: {
      origins: corsOptions.origin,
      credentials: corsOptions.credentials
    },
    timestamp: new Date().toISOString()
  });
});

// Routes Registration
app.use('/api/auth', authRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/newsletter', newsletterRoutes);

// Newsletter Tracking Endpoints
app.get('/api/newsletter/track/open/:subscriberId/:newsletterId', async (req, res) => {
  try {
    const { subscriberId, newsletterId } = req.params;
    
    const { default: newsletterService } = await import('./services/newsletter.service.js');
    await newsletterService.trackEmailOpen(subscriberId, newsletterId);
    
    // 1x1 transparentes Pixel
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    );
    
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': pixel.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(pixel);
    
  } catch (error) {
    console.error('❌ Newsletter open tracking error:', error);
    const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': pixel.length });
    res.end(pixel);
  }
});

app.get('/api/newsletter/track/click/:subscriberId/:newsletterId', async (req, res) => {
  try {
    const { subscriberId, newsletterId } = req.params;
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter required' });
    }
    
    const { default: newsletterService } = await import('./services/newsletter.service.js');
    await newsletterService.trackEmailClick(subscriberId, newsletterId, url);
    
    res.redirect(decodeURIComponent(url));
    
  } catch (error) {
    console.error('❌ Newsletter click tracking error:', error);
    const fallbackUrl = req.query.url || process.env.FRONTEND_URL || 'https://portfolio-chris-schubert.vercel.app';
    res.redirect(decodeURIComponent(fallbackUrl));
  }
});

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
      has_admin_password: !!process.env.ADMIN_PASSWORD,
      session_secret: !!process.env.SESSION_SECRET,
      has_newsletter: true,
      oauth_google: !!process.env.GOOGLE_CLIENT_ID,
      oauth_github: !!process.env.GITHUB_CLIENT_ID,
      newsletter_features: {
        subscriber_management: true,
        template_editor: true,
        email_tracking: true,
        scheduled_sending: true,
        double_opt_in: true
      }
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

// Static files (Production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
  
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

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
      mongodb: dbState === 1,
      newsletter: true,
      oauth: {
        google: !!process.env.GOOGLE_CLIENT_ID,
        github: !!process.env.GITHUB_CLIENT_ID
      }
    },
    admin: {
      auto_creation: !!(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD),
      email: process.env.ADMIN_EMAIL ? 'configured' : 'not configured'
    },
    version: process.env.APP_VERSION || '1.0.0'
  });
});

// 404 Handler
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  console.log('📍 Available routes:');
  console.log('   GET  / - API Info');
  console.log('   GET  /health - Health Check');
  console.log('   POST /api/contact - Contact Form');
  console.log('   ALL  /api/newsletter/* - Newsletter API');
  console.log('   POST /api/auth/login - Login (use ADMIN_EMAIL/ADMIN_PASSWORD)');
  if (process.env.NODE_ENV === 'development') {
    console.log('   GET  /debug/env - Environment Variables');
    console.log('   POST /api/contact/test - Contact Test');
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
      'POST /api/auth/login',
      'ALL /api/newsletter/*',
      'ALL /api/dashboard/*',
      'ALL /api/auth/*',
      'ALL /api/oauth/*',
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
  
  let statusCode = error.status || error.statusCode || 500;
  let message = error.message || 'Internal Server Error';
  
  // Spezifische Fehlercodes
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
  } else if (error.name === 'NewsletterError') {
    statusCode = 400;
    message = 'Newsletter Error: ' + error.message;
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

// Server Start mit Admin-Account Creation
const startServer = async () => {
  try {
    // 1. Database verbinden
    await connectDB();
    
    // 2. Admin-Account sicherstellen
    await ensureAdminAccount();
    
    // 3. Server starten
    const server = app.listen(PORT, () => {
      console.log('\n🚀 SERVER STARTED SUCCESSFULLY');
      console.log('=' .repeat(60));
      console.log(`📍 Environment: ${process.env.NODE_ENV}`);
      console.log(`🌐 Server running on: http://localhost:${PORT}`);
      console.log(`📊 Database: ${mongoose.connection.readyState === 1 ? 'Connected ✅' : 'Disconnected ❌'}`);
      console.log(`📧 Email Service: ${(process.env.EMAIL_USER && process.env.EMAIL_PASS) ? 'Configured ✅' : 'NOT CONFIGURED ❌'}`);
      console.log(`📬 Newsletter Service: Enabled ✅`);
      console.log(`👑 Admin Account: ${(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) ? 'Auto-Creation ✅' : 'Manual Setup Required ❌'}`);
      
      console.log('\n📚 Available endpoints:');
      console.log(`   GET  http://localhost:${PORT}/                    - API Info`);
      console.log(`   GET  http://localhost:${PORT}/health             - Health Check`);
      console.log(`   POST http://localhost:${PORT}/api/auth/login     - Login (Admin: ${process.env.ADMIN_EMAIL || 'check .env'})`);
      console.log(`   POST http://localhost:${PORT}/api/contact        - Contact Form`);
      console.log(`   ALL  http://localhost:${PORT}/api/dashboard/*    - Dashboard API (Auth Required)`);
      console.log(`   ALL  http://localhost:${PORT}/api/oauth/*        - OAuth Authentication`);
      
      console.log('\n📬 Newsletter endpoints:');
      console.log(`   POST http://localhost:${PORT}/api/newsletter/subscribe        - Public Newsletter Signup`);
      console.log(`   GET  http://localhost:${PORT}/api/newsletter/subscribers      - Admin: Get Subscribers`);
      console.log(`   GET  http://localhost:${PORT}/api/newsletter/templates        - Admin: Get Templates`);
      console.log(`   POST http://localhost:${PORT}/api/newsletter/templates        - Admin: Create Template`);
      console.log(`   GET  http://localhost:${PORT}/api/newsletter/stats            - Admin: Statistics`);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('\n🛠️  Development endpoints:');
        console.log(`   GET  http://localhost:${PORT}/debug/env         - Environment Check`);
        console.log(`   POST http://localhost:${PORT}/api/contact/test   - Contact Test`);
        console.log(`   GET  http://localhost:${PORT}/debug/cors-test   - CORS Test`);
      }
      
      console.log('=' .repeat(60));
      
      // Environment Validation
      const requiredEnvVars = [
        'MONGODB_URI',
        'JWT_SECRET',
        'EMAIL_USER', 
        'EMAIL_PASS'
      ];
      
      const optionalEnvVars = [
        'ADMIN_EMAIL',
        'ADMIN_PASSWORD',
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
      console.log(`🔗 Test health check: curl http://localhost:${PORT}/health`);
      console.log(`🔗 Test admin login: POST http://localhost:${PORT}/api/auth/login`);
      console.log('   Body: {"email": "' + (process.env.ADMIN_EMAIL || 'your@email.com') + '", "password": "your_password"}');
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
      
      setTimeout(() => {
        console.error('⚠️ Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return server;
    
  } catch (error) {
    console.error('❌ SERVER STARTUP ERROR:', error);
    process.exit(1);
  }
};

// Unhandled Promise Rejection Handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ UNHANDLED PROMISE REJECTION:');
  console.error('📍 Reason:', reason);
  console.error('📍 Promise:', promise);
  
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

// Start the server
startServer();

export default app;