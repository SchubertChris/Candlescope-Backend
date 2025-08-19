// routes/contact.js
// KORRIGIERT: Contact Route für ES Modules
import express from 'express';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';
import Contact from '../models/Contact/contact.js'; // KORRIGIERT: ES Module Import

const router = express.Router();

// ===========================
// RATE LIMITING
// ===========================
const contactRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 3, // Maximal 3 Anfragen pro IP pro 15 Minuten
  message: {
    success: false,
    message: 'Zu viele Kontaktanfragen. Bitte warten Sie 15 Minuten.',
    retryAfter: 15 * 60 * 1000
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ===========================
// EMAIL TRANSPORTER KONFIGURATION
// ===========================
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

// ===========================
// KONTAKTANFRAGE SENDEN
// ===========================
router.post('/', contactRateLimit, async (req, res) => {
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
      source = 'website_contact_form'
    } = req.body;

    // Validierung
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, E-Mail und Nachricht sind erforderlich.'
      });
    }

    // Email-Format validieren
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.'
      });
    }

    // Kontakt in Datenbank speichern
    const contactEntry = new Contact({
      name,
      email,
      phone: phone || null,
      company: company || null,
      projectType: projectType || 'general',
      budget: budget || null,
      timeline: timeline || null,
      message,
      newsletter: newsletter || false,
      source,
      status: 'new',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      createdAt: new Date()
    });

    await contactEntry.save();
    console.log('✅ Contact saved to database:', contactEntry._id);

    // E-Mail an Admin senden
    const transporter = createEmailTransporter();
    
    const adminEmailContent = `
      <h2>🚀 Neue Kontaktanfrage von der Website</h2>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>📋 Persönliche Daten</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>E-Mail:</strong> <a href="mailto:${email}">${email}</a></p>
        ${phone ? `<p><strong>Telefon:</strong> <a href="tel:${phone}">${phone}</a></p>` : ''}
        ${company ? `<p><strong>Unternehmen:</strong> ${company}</p>` : ''}
      </div>

      <div style="background: #f3e5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>💬 Nachricht</h3>
        <p style="white-space: pre-wrap;">${message}</p>
      </div>

      <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>📊 Zusätzliche Informationen</h3>
        <p><strong>Newsletter:</strong> ${newsletter ? 'Ja' : 'Nein'}</p>
        <p><strong>Quelle:</strong> ${source}</p>
        <p><strong>Datum:</strong> ${new Date().toLocaleString('de-DE')}</p>
        <p><strong>IP-Adresse:</strong> ${req.ip}</p>
      </div>

      <div style="margin: 30px 0; text-align: center;">
        <a href="mailto:${email}?subject=Re: Ihre Kontaktanfrage" 
           style="background: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          📧 Direkt antworten
        </a>
      </div>
    `;

    await transporter.sendMail({
      from: `"Website Kontaktformular" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `🚀 Neue Kontaktanfrage: ${projectType || 'Allgemein'} - ${name}`,
      html: adminEmailContent,
      replyTo: email
    });

    // Bestätigungs-E-Mail an Kunden senden
    const customerEmailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">Vielen Dank für Ihre Kontaktanfrage!</h2>
        
        <p>Hallo ${name},</p>
        
        <p>vielen Dank für Ihr Interesse an meinen Dienstleistungen. Ihre Nachricht ist bei mir angekommen und ich werde mich innerhalb von 24 Stunden bei Ihnen melden.</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>📋 Ihre Anfrage im Überblick:</h3>
          ${projectType ? `<p><strong>Projekt-Art:</strong> ${projectType}</p>` : ''}
          ${budget ? `<p><strong>Budget:</strong> ${budget}</p>` : ''}
          ${timeline ? `<p><strong>Zeitrahmen:</strong> ${timeline}</p>` : ''}
        </div>
        
        <p>Falls Sie noch Fragen haben oder zusätzliche Informationen benötigen, können Sie mich gerne direkt kontaktieren:</p>
        
        <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>📧 E-Mail:</strong> <a href="mailto:schubert_chris@rocketmail.com">schubert_chris@rocketmail.com</a></p>
          <p><strong>📱 Telefon:</strong> <a href="tel:+491609416348">+49 160 941 683 48</a></p>
          <p><strong>🕒 Verfügbarkeit:</strong> Mo-Fr: 9-18 Uhr</p>
        </div>
        
        <p>Mit freundlichen Grüßen,<br>
        <strong>Chris Schubert</strong><br>
        <em>Web Developer & Digital Solutions</em></p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #666;">
          Diese E-Mail wurde automatisch generiert. Falls Sie diese Nachricht irrtümlich erhalten haben, können Sie sie ignorieren.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Chris Schubert" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Bestätigung Ihrer Kontaktanfrage - Chris Schubert Web Development',
      html: customerEmailContent
    });

    // Newsletter-Anmeldung verarbeiten (falls gewünscht)
    if (newsletter) {
      console.log('📬 Newsletter subscription for:', email);
      // Hier später Newsletter-Service integrieren
    }

    console.log('✅ Contact form submission successful:', email);

    res.status(200).json({
      success: true,
      message: 'Ihre Nachricht wurde erfolgreich gesendet. Sie erhalten in Kürze eine Bestätigung per E-Mail.',
      data: {
        contactId: contactEntry._id,
        timestamp: contactEntry.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Contact form error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut oder kontaktieren Sie mich direkt.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ===========================
// PROJEKT-SPEZIFISCHE ANFRAGE
// ===========================
router.post('/project-inquiry', contactRateLimit, async (req, res) => {
  try {
    const { projectType, ...contactData } = req.body;

    // Ähnliches Handling wie bei normaler Kontaktanfrage
    // Aber mit projekt-spezifischen E-Mail-Templates
    
    console.log('🎯 Project inquiry received:', projectType);

    res.status(200).json({
      success: true,
      message: `Ihre ${projectType}-Anfrage wurde erfolgreich gesendet.`,
      data: { projectType }
    });

  } catch (error) {
    console.error('❌ Project inquiry error:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler bei der Projekt-Anfrage.'
    });
  }
});

// ===========================
// RATE LIMIT STATUS ABFRAGEN
// ===========================
router.get('/rate-limit/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    // Anzahl der Kontakte in den letzten 15 Minuten
    const recentContacts = await Contact.countDocuments({
      email,
      createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) }
    });

    res.json({
      success: true,
      data: {
        requestsInLastWindow: recentContacts,
        maxRequests: 3,
        windowMs: 15 * 60 * 1000,
        canSubmit: recentContacts < 3
      }
    });

  } catch (error) {
    console.error('❌ Rate limit check error:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler bei der Rate-Limit-Prüfung.'
    });
  }
});

// ===========================
// KONTAKT-STATISTIKEN (für Admin Dashboard)
// ===========================
router.get('/statistics', async (req, res) => {
  try {
    const stats = await Contact.getStatistics();
    
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

// ES Module Export
export default router;