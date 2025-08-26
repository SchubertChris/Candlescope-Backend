// routes/contact.js
// VOLLSTÄNDIG KORRIGIERT: Richtiger Import-Pfad + IPv6-sicheres Rate Limiting
import express from 'express';
import rateLimit from 'express-rate-limit';
import emailService from '../services/email-service.js';
import Contact from '../models/contact/contact.js';

const router = express.Router();

// KORRIGIERT: IPv6-sicheres Rate Limiting
const contactRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 5, // 5 Anfragen pro IP
  message: {
    success: false,
    message: 'Zu viele Kontaktanfragen. Bitte warten Sie 15 Minuten.',
    retryAfter: 15 * 60 * 1000
  },
  standardHeaders: true,
  legacyHeaders: false,
  // KORRIGIERT: Entfernt problematischen keyGenerator - verwendet Standard-Generator
  skip: (req) => {
    // Development komplett überspringen
    return process.env.NODE_ENV === 'development';
  }
});

// Email-Templates
const createAdminEmailHTML = (formData) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Neue Kontaktanfrage - ${formData.name}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #a259ff, #667eea); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
        .section { margin-bottom: 20px; padding: 15px; background: white; border-radius: 5px; border-left: 4px solid #a259ff; }
        .label { font-weight: bold; color: #555; }
        .value { margin-bottom: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🚀 Neue Kontaktanfrage</h1>
        <p>Portfolio Website - Chris Schubert</p>
      </div>
      
      <div class="content">
        <div class="section">
          <h3>👤 Kontaktdaten</h3>
          <div class="value"><span class="label">Name:</span> ${formData.name}</div>
          <div class="value"><span class="label">E-Mail:</span> <a href="mailto:${formData.email}">${formData.email}</a></div>
          <div class="value"><span class="label">Telefon:</span> ${formData.phone || 'Nicht angegeben'}</div>
          <div class="value"><span class="label">Unternehmen:</span> ${formData.company || 'Nicht angegeben'}</div>
        </div>
        
        <div class="section">
          <h3>💼 Projekt-Details</h3>
          <div class="value"><span class="label">Typ:</span> ${formData.projectType || 'Nicht angegeben'}</div>
          <div class="value"><span class="label">Budget:</span> ${formData.budget || 'Nicht angegeben'}</div>
          <div class="value"><span class="label">Zeitrahmen:</span> ${formData.timeline || 'Nicht angegeben'}</div>
        </div>
        
        <div class="section">
          <h3>💬 Nachricht</h3>
          <div class="value" style="white-space: pre-wrap;">${formData.message}</div>
        </div>
        
        <div class="section">
          <h3>📊 Zusätzlich</h3>
          <div class="value"><span class="label">Newsletter:</span> ${formData.newsletter ? 'Ja' : 'Nein'}</div>
          <div class="value"><span class="label">Quelle:</span> ${formData.source}</div>
          <div class="value"><span class="label">Zeitstempel:</span> ${new Date().toLocaleString('de-DE')}</div>
          <div class="value"><span class="label">IP:</span> ${formData.ip || 'Unbekannt'}</div>
        </div>
        
        <p style="text-align: center; margin-top: 20px;">
          <a href="mailto:${formData.email}" style="background: #a259ff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Direkt antworten
          </a>
        </p>
      </div>
    </body>
    </html>
  `;
};

const createCustomerEmailHTML = (formData) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Ihre Anfrage wurde empfangen - Chris Schubert</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #a259ff, #667eea); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        .section { margin-bottom: 20px; padding: 15px; background: white; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>✅ Anfrage erhalten!</h1>
        <p>Vielen Dank für Ihr Vertrauen</p>
      </div>
      
      <div class="content">
        <h2>Hallo ${formData.name}!</h2>
        <p>Ihre Projektanfrage ist bei mir eingegangen. Ich werde mich innerhalb von 24 Stunden bei Ihnen melden.</p>
        
        <div class="section">
          <h3>📋 Ihre Anfrage im Überblick</h3>
          <p><strong>Projekt-Typ:</strong> ${formData.projectType || 'Allgemeine Anfrage'}</p>
          ${formData.budget ? `<p><strong>Budget:</strong> ${formData.budget}</p>` : ''}
          ${formData.timeline ? `<p><strong>Zeitrahmen:</strong> ${formData.timeline}</p>` : ''}
        </div>
        
        <div class="section">
          <h3>📞 Kontakt</h3>
          <p>📧 E-Mail: <a href="mailto:schubert_chris@rocketmail.com">schubert_chris@rocketmail.com</a></p>
          <p>📱 Telefon: <a href="tel:+4916094168348">+49 160 941 683 48</a></p>
          <p>📍 Standort: Potsdam, Brandenburg</p>
          <p>🌐 Website: <a href="https://portfolio-chris-schubert.vercel.app">portfolio-chris-schubert.vercel.app</a></p>
        </div>
        
        <p>Bei Rückfragen bin ich jederzeit für Sie da!</p>
        <p>Beste Grüße<br><strong>Chris Schubert</strong><br>Web Developer</p>
      </div>
    </body>
    </html>
  `;
};

// HAUPTROUTE: Kontaktformular
router.post('/', contactRateLimit, async (req, res) => {
  console.log('\n📧 CONTACT REQUEST RECEIVED');
  console.log('📊 Headers:', req.headers);
  console.log('📊 Body:', req.body);
  console.log('🔍 Content-Type:', req.get('Content-Type'));
  console.log('🌐 Origin:', req.get('Origin'));
  
  try {
    const {
      name,
      email,
      phone,
      company,
      projectType,
      budget,
      timeline,
      message,
      newsletter,
      source = 'contact_page'
    } = req.body;

    console.log('📋 EXTRACTED FIELDS:', { 
      name: !!name, 
      email: !!email, 
      message: !!message,
      projectType 
    });

    // Basis-Validierung mit detailliertem Logging
    const missingFields = [];
    if (!name || name.trim() === '') missingFields.push('name');
    if (!email || email.trim() === '') missingFields.push('email');
    if (!message || message.trim() === '') missingFields.push('message');

    if (missingFields.length > 0) {
      console.warn('❌ VALIDATION FAILED - Missing fields:', missingFields);
      return res.status(400).json({
        success: false,
        message: `Folgende Felder sind erforderlich: ${missingFields.join(', ')}`,
        missingFields
      });
    }

    // Email-Validierung
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      console.warn('❌ INVALID EMAIL FORMAT:', email);
      return res.status(400).json({
        success: false,
        message: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.'
      });
    }

    // Sichere Datenaufbereitung
    const formData = {
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      phone: phone ? String(phone).trim() : '',
      company: company ? String(company).trim() : '',
      projectType: projectType || 'website',
      budget: budget || '',
      timeline: timeline || '',
      message: String(message).trim(),
      newsletter: Boolean(newsletter),
      source: source || 'contact_page',
      ip: req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown'
    };

    console.log('💾 PREPARED FORM DATA:', formData);

    // SCHRITT 1: Database Save - NICHT BLOCKIEREND
    let contactEntry = null;
    let dbSaveSuccess = false;
    
    try {
      console.log('💾 ATTEMPTING DATABASE SAVE...');
      
      contactEntry = new Contact({
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        company: formData.company || null,
        projectType: formData.projectType,
        budget: formData.budget || null,
        timeline: formData.timeline || null,
        message: formData.message,
        newsletter: formData.newsletter,
        source: formData.source,
        status: 'new',
        ipAddress: formData.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        createdAt: new Date()
      });

      const savedContact = await contactEntry.save();
      dbSaveSuccess = true;
      console.log('✅ DATABASE SAVE SUCCESS:', savedContact._id);
      
    } catch (dbError) {
      console.error('❌ DATABASE SAVE ERROR:', dbError);
      // DB-Fehler nicht blockierend für User
      if (dbError.code === 11000) {
        console.warn('⚠️ DUPLICATE ENTRY DETECTED - continuing...');
      }
    }

    // SCHRITT 2: Email Service - Direkte Integration
    let emailSentSuccessfully = false;
    let emailError = null;
    
    try {
      console.log('📤 TESTING EMAIL CONNECTION...');
      
      // Test email service connection
      const emailTestResult = await emailService.testConnection();
      if (!emailTestResult) {
        throw new Error('Email service connection failed');
      }
      
      console.log('✅ EMAIL SERVICE CONNECTED');
      
      // Verwende nodemailer direkt von emailService
      const transporter = emailService.getTransporter();
      
      // Admin Email senden
      console.log('📧 SENDING ADMIN EMAIL...');
      await transporter.sendMail({
        from: `"Portfolio Contact" <${process.env.EMAIL_USER}>`,
        to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
        subject: `🚀 Neue Anfrage: ${formData.projectType} - ${formData.name}`,
        html: createAdminEmailHTML(formData),
        replyTo: formData.email
      });
      console.log('✅ ADMIN EMAIL SENT');

      // Customer Email senden
      console.log('📧 SENDING CUSTOMER EMAIL...');
      await transporter.sendMail({
        from: `"Chris Schubert" <${process.env.EMAIL_USER}>`,
        to: formData.email,
        subject: '✅ Ihre Anfrage wurde empfangen - Chris Schubert',
        html: createCustomerEmailHTML(formData)
      });
      console.log('✅ CUSTOMER EMAIL SENT');

      emailSentSuccessfully = true;
      console.log('🎉 ALL EMAILS SENT SUCCESSFULLY');

    } catch (emailErr) {
      console.error('❌ EMAIL SENDING ERROR:', emailErr);
      emailError = emailErr;
      // Email-Fehler nicht blockierend
    }

    // SCHRITT 3: Erfolgreiche Response - IMMER
    const responseMessage = emailSentSuccessfully 
      ? 'Vielen Dank für deine Nachricht! Ich melde mich innerhalb von 24 Stunden bei dir.'
      : 'Deine Nachricht wurde empfangen! Falls du keine Bestätigung per Email erhältst, kontaktiere mich bitte direkt unter schubert_chris@rocketmail.com';

    console.log('✅ CONTACT FORM SUCCESS - Sending response');

    // Immer erfolgreiche Response bei gültigen Daten
    return res.status(200).json({
      success: true,
      message: responseMessage,
      data: {
        contactId: contactEntry?._id || `temp_${Date.now()}`,
        timestamp: new Date().toISOString(),
        emailSent: emailSentSuccessfully,
        dbSaved: dbSaveSuccess
      }
    });

  } catch (error) {
    // Umfassendes Error Logging
    console.error('\n❌ CONTACT FORM FATAL ERROR:');
    console.error('📍 Error Type:', error.constructor.name);
    console.error('📍 Error Message:', error.message);
    console.error('📍 Error Stack:', error.stack);
    console.error('📍 Request Body:', req.body);
    console.error('📍 Request Headers:', req.headers);
    
    // Spezifische Fehlerbehandlung
    let errorMessage = 'Ein unbekannter Fehler ist aufgetreten.';
    let statusCode = 500;
    
    if (error.name === 'ValidationError') {
      errorMessage = 'Validierungsfehler: Bitte prüfen Sie Ihre Eingaben.';
      statusCode = 400;
    } else if (error.name === 'MongoNetworkError' || error.name === 'MongooseError') {
      errorMessage = 'Datenbankfehler: Ihre Nachricht wurde trotzdem registriert.';
      statusCode = 503;
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Zeitüberschreitung: Bitte versuchen Sie es erneut.';
      statusCode = 408;
    } else if (error.message?.includes('JSON')) {
      errorMessage = 'Datenformat-Fehler: Bitte laden Sie die Seite neu.';
      statusCode = 400;
    } else if (error.message?.includes('fetch')) {
      errorMessage = 'Netzwerkfehler: Bitte prüfen Sie Ihre Verbindung.';
      statusCode = 503;
    }
    
    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined,
      contactInfo: {
        email: 'schubert_chris@rocketmail.com',
        phone: '+49 160 941 683 48'
      },
      debug: process.env.NODE_ENV === 'development' ? {
        timestamp: new Date().toISOString(),
        requestBody: req.body,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      } : undefined
    });
  }
});

// Newsletter Route
router.post('/newsletter', async (req, res) => {
  try {
    console.log('📬 NEWSLETTER SUBSCRIPTION REQUEST:', req.body);
    
    const { email, source = 'newsletter_signup' } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'E-Mail-Adresse ist erforderlich.'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.'
      });
    }

    // Check for existing subscription (optional - nicht blockierend)
    let existingContact = null;
    try {
      existingContact = await Contact.findOne({ 
        email: email.toLowerCase().trim(),
        newsletter: true 
      });
    } catch (dbErr) {
      console.warn('⚠️ Newsletter duplicate check failed:', dbErr.message);
    }

    if (existingContact) {
      return res.status(200).json({
        success: true,
        message: 'Sie sind bereits für den Newsletter angemeldet.',
        data: { alreadySubscribed: true }
      });
    }

    // Create newsletter entry
    try {
      const newsletterEntry = new Contact({
        name: 'Newsletter Abonnent',
        email: email.toLowerCase().trim(),
        message: 'Newsletter-Anmeldung über Website',
        newsletter: true,
        source,
        status: 'newsletter_only',
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        createdAt: new Date()
      });

      await newsletterEntry.save();
      console.log('📬 Newsletter subscription saved:', email);
    } catch (dbErr) {
      console.error('❌ Newsletter DB save failed:', dbErr);
    }

    return res.status(200).json({
      success: true,
      message: 'Erfolgreich für den Newsletter angemeldet!',
      data: { email }
    });

  } catch (error) {
    console.error('❌ Newsletter subscription error:', error);
    return res.status(500).json({
      success: false,
      message: 'Fehler bei der Newsletter-Anmeldung.'
    });
  }
});

// DEBUG ROUTES für Development
if (process.env.NODE_ENV === 'development') {
  
  // Test contact route
  router.post('/test', async (req, res) => {
    try {
      console.log('🧪 TEST CONTACT ENDPOINT HIT');
      console.log('📊 Request body:', req.body);
      console.log('📊 Request headers:', req.headers);
      
      return res.json({
        success: true,
        message: 'Test endpoint reached successfully',
        receivedData: req.body,
        timestamp: new Date().toISOString(),
        environment: {
          nodeEnv: process.env.NODE_ENV,
          port: process.env.PORT,
          hasEmailUser: !!process.env.EMAIL_USER,
          hasEmailPass: !!process.env.EMAIL_PASS
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Test email service
  router.get('/test-email', async (req, res) => {
    try {
      console.log('🧪 TESTING EMAIL SERVICE...');
      console.log('📧 EMAIL_USER:', process.env.EMAIL_USER ? 'Set' : 'NOT SET');
      console.log('📧 EMAIL_PASS:', process.env.EMAIL_PASS ? 'Set' : 'NOT SET');
      
      const emailTestResult = await emailService.testConnection();
      
      return res.json({ 
        success: emailTestResult, 
        message: emailTestResult ? 'Email service working!' : 'Email service failed',
        config: {
          emailUser: process.env.EMAIL_USER,
          hasPassword: !!process.env.EMAIL_PASS,
          adminEmail: process.env.ADMIN_EMAIL
        }
      });
    } catch (error) {
      console.error('❌ EMAIL TEST FAILED:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message,
        config: {
          emailUser: process.env.EMAIL_USER,
          hasPassword: !!process.env.EMAIL_PASS
        }
      });
    }
  });

  // Test database connection and model
  router.get('/test-db', async (req, res) => {
    try {
      console.log('🧪 TESTING DATABASE CONNECTION...');
      
      // Test basic connection
      const dbState = mongoose.connection.readyState;
      console.log('📊 DB State:', dbState);
      
      // Test Contact model
      const contactCount = await Contact.countDocuments();
      console.log('📊 Contact count:', contactCount);
      
      // Test creating a contact (without saving)
      const testContact = new Contact({
        name: 'Test User',
        email: 'test@example.com',
        message: 'Test message from DB test'
      });
      
      const validationResult = testContact.validateSync();
      
      return res.json({
        success: true,
        message: 'Database and Contact model working!',
        data: {
          dbState: dbState === 1 ? 'connected' : 'disconnected',
          contactCount,
          modelValidation: validationResult ? 'failed' : 'passed',
          testContact: {
            name: testContact.name,
            email: testContact.email,
            message: testContact.message
          }
        }
      });
      
    } catch (error) {
      console.error('❌ DATABASE TEST FAILED:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
        stack: error.stack
      });
    }
  });

  // Get all contacts (for debugging)
  router.get('/debug-contacts', async (req, res) => {
    try {
      const contacts = await Contact.find().limit(10).sort({ createdAt: -1 });
      return res.json({
        success: true,
        count: contacts.length,
        contacts: contacts.map(c => ({
          id: c._id,
          name: c.name,
          email: c.email,
          projectType: c.projectType,
          status: c.status,
          createdAt: c.createdAt
        }))
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
}

export default router;