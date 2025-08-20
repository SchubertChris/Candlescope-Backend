// routes/contact.js
// FINAL KORRIGIERT: Alle Fehler behoben
import express from 'express';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';
import Contact from '../models/Contact/Contact.js'; // KORRIGIERT: Großbuchstaben!

const router = express.Router();

// Rate Limiting
const contactRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    message: 'Zu viele Kontaktanfragen. Bitte warten Sie 15 Minuten.',
    retryAfter: 15 * 60 * 1000
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Email Transporter
const createEmailTransporter = () => {
  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Admin Email Template
const createAdminEmailHTML = (formData) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Neue Kontaktanfrage</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #f39c12, #e67e22);
          color: white;
          padding: 20px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .content {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 0 0 8px 8px;
        }
        .section {
          margin-bottom: 20px;
          padding: 15px;
          background: white;
          border-radius: 5px;
          border-left: 4px solid #f39c12;
        }
        .label {
          font-weight: bold;
          color: #555;
        }
        .value {
          margin-bottom: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🚀 Neue Kontaktanfrage</h1>
        <p>Portfolio Website</p>
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
          <div class="value"><span class="label">Budget:</span> ${formData.mappedBudget || formData.budget || 'Nicht angegeben'}</div>
          <div class="value"><span class="label">Zeitrahmen:</span> ${formData.mappedTimeline || formData.timeline || 'Nicht angegeben'}</div>
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
          <a href="mailto:${formData.email}" style="background: #f39c12; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Direkt antworten
          </a>
        </p>
      </div>
    </body>
    </html>
  `;
};

// Customer Email Template
const createCustomerEmailHTML = (formData) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Ihre Anfrage wurde empfangen</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #f39c12, #e67e22);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .content {
          background: #f8f9fa;
          padding: 30px;
          border-radius: 0 0 8px 8px;
        }
        .section {
          margin-bottom: 20px;
          padding: 15px;
          background: white;
          border-radius: 5px;
        }
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
          ${formData.mappedBudget ? `<p><strong>Budget:</strong> ${formData.mappedBudget}</p>` : ''}
          ${formData.mappedTimeline ? `<p><strong>Zeitrahmen:</strong> ${formData.mappedTimeline}</p>` : ''}
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

// POST /api/contact - Hauptkontaktformular
router.post('/', contactRateLimit, async (req, res) => {
  try {
    console.log('📧 Contact request received:', req.body);
    
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
      source = 'website_contact_form'
    } = req.body;

    // Validierung
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, E-Mail und Nachricht sind erforderlich.'
      });
    }

    // Email validieren
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.'
      });
    }

    // HINZUGEFÜGT: Budget/Timeline Mapping
    const budgetMapping = {
      'unter-2500': '< 2.500€',
      '2500-5000': '2.500€ - 5.000€',
      '5000-10000': '5.000€ - 10.000€',
      '10000-plus': '> 5.000€'
    };

    const timelineMapping = {
      'asap': 'Innerhalb 1 Woche',
      '1-month': '2-4 Wochen',
      '2-3-months': '2-3 Monate',
      'flexible': 'Flexibel'
    };

    // Daten vorbereiten
    const mappedBudget = budgetMapping[budget] || budget;
    const mappedTimeline = timelineMapping[timeline] || timeline;

    const formData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || '',
      company: company?.trim() || '',
      projectType: projectType || 'general',
      budget: budget || '',
      timeline: timeline || '',
      mappedBudget,
      mappedTimeline,
      message: message.trim(),
      newsletter: Boolean(newsletter),
      source,
      ip: req.ip
    };

    // KORRIGIERT: In Datenbank speichern mit korrekten Werten
    const contactEntry = new Contact({
      name: formData.name,
      email: formData.email,
      phone: formData.phone || null,
      company: formData.company || null,
      projectType: formData.projectType,
      budget: mappedBudget || null, // Verwende gemappten Wert
      timeline: mappedTimeline || null, // Verwende gemappten Wert
      message: formData.message,
      newsletter: formData.newsletter,
      source: formData.source,
      status: 'new',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      createdAt: new Date()
    });

    await contactEntry.save();
    console.log('✅ Contact saved:', contactEntry._id);

    // E-Mails senden
    try {
      const transporter = createEmailTransporter();

      // Admin E-Mail
      await transporter.sendMail({
        from: `"Portfolio Contact" <${process.env.EMAIL_USER}>`,
        to: process.env.ADMIN_EMAIL,
        subject: `🚀 Neue Anfrage: ${formData.projectType} - ${formData.name}`,
        html: createAdminEmailHTML(formData),
        replyTo: formData.email
      });

      // Kunden E-Mail
      await transporter.sendMail({
        from: `"Chris Schubert" <${process.env.EMAIL_USER}>`,
        to: formData.email,
        subject: '✅ Ihre Anfrage wurde empfangen - Chris Schubert',
        html: createCustomerEmailHTML(formData)
      });

      console.log('✅ Contact emails sent successfully');

    } catch (emailError) {
      console.error('⚠️ Email sending failed:', emailError);
      // E-Mail-Fehler nicht blockierend
    }

    res.status(200).json({
      success: true,
      message: 'Vielen Dank für deine Nachricht! Ich melde mich innerhalb von 24 Stunden bei dir.',
      data: {
        contactId: contactEntry._id,
        timestamp: contactEntry.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Contact form error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Newsletter Anmeldung (gleich wie vorher)
router.post('/newsletter', contactRateLimit, async (req, res) => {
  try {
    const { email, source = 'newsletter_popup' } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'E-Mail-Adresse ist erforderlich.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.'
      });
    }

    const existingContact = await Contact.findOne({ 
      email: email.toLowerCase().trim(),
      newsletter: true 
    });

    if (existingContact) {
      return res.status(200).json({
        success: true,
        message: 'Sie sind bereits für den Newsletter angemeldet.',
        data: { alreadySubscribed: true }
      });
    }

    const newsletterEntry = new Contact({
      name: 'Newsletter Abonnent',
      email: email.toLowerCase().trim(),
      message: 'Newsletter-Anmeldung über Website',
      newsletter: true,
      source,
      status: 'newsletter_only',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      createdAt: new Date()
    });

    await newsletterEntry.save();

    const transporter = createEmailTransporter();
    
    await transporter.sendMail({
      from: `"Chris Schubert Newsletter" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🎉 Willkommen zum Newsletter!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f39c12, #e67e22); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1>🎉 Willkommen!</h1>
            <p>Vielen Dank für Ihre Newsletter-Anmeldung!</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
            <p>Sie erhalten ab sofort exklusive Web-Development Tipps und Tools direkt aus der Praxis.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://portfolio-chris-schubert.vercel.app" style="background: #f39c12; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                Website besuchen
              </a>
            </div>
            
            <p>Beste Grüße<br><strong>Chris Schubert</strong><br>Web Developer</p>
          </div>
        </div>
      `
    });

    console.log('📬 Newsletter subscription successful:', email);

    res.status(200).json({
      success: true,
      message: 'Erfolgreich für den Newsletter angemeldet!',
      data: { email, subscriptionId: newsletterEntry._id }
    });

  } catch (error) {
    console.error('❌ Newsletter subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler bei der Newsletter-Anmeldung.'
    });
  }
});

// Alle anderen Routes (Statistics, etc.) bleiben gleich
router.get('/email-preview/:type', (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Nur im Development-Modus verfügbar' });
  }

  const { type } = req.params;
  const sampleData = {
    name: 'Max Mustermann',
    email: 'max@beispiel.de',
    phone: '+49 160 123 456 78',
    company: 'Beispiel GmbH',
    projectType: 'ecommerce',
    budget: '5000-10000',
    timeline: 'asap',
    mappedBudget: '5.000€ - 10.000€',
    mappedTimeline: 'Innerhalb 1 Woche',
    message: 'Ich benötige eine moderne E-Commerce-Plattform für mein Unternehmen.',
    newsletter: true,
    source: 'contact_page',
    ip: '127.0.0.1'
  };

  switch (type) {
    case 'admin':
      res.send(createAdminEmailHTML(sampleData));
      break;
    case 'customer':
      res.send(createCustomerEmailHTML(sampleData));
      break;
    default:
      res.status(404).json({ error: 'Template nicht gefunden. Verfügbar: admin, customer' });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const stats = await Contact.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          new: { $sum: { $cond: [{ $eq: ['$status', 'new'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          newsletterSubscribers: { $sum: { $cond: ['$newsletter', 1, 0] } }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: stats[0] || {
        total: 0,
        new: 0,
        inProgress: 0,
        completed: 0,
        newsletterSubscribers: 0
      }
    });

  } catch (error) {
    console.error('❌ Contact statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Statistiken.'
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;

    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const contacts = await Contact.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Contact.countDocuments(query);

    res.json({
      success: true,
      data: {
        contacts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('❌ Fetch contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Kontakte.'
    });
  }
});

export default router;