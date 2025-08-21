// services/newsletter.service.js
// VOLLSTÄNDIGER NEWSLETTER SERVICE - E-Mail-Versand und Template-Verarbeitung
import { NewsletterSubscriber, NewsletterTemplate, NewsletterSendLog } from '../models/Newsletter/Newsletter.js';
import emailService from './email-service.js';
import crypto from 'crypto';

class NewsletterService {
  
  // ===========================
  // BESTÄTIGUNGS-E-MAIL (Double-Opt-In)
  // ===========================
  async sendConfirmationEmail(subscriber) {
    try {
      if (!subscriber.confirmationToken) {
        subscriber.generateTokens();
        await subscriber.save();
      }
      
      const confirmationUrl = `${process.env.FRONTEND_URL}/newsletter/confirm/${subscriber.confirmationToken}`;
      
      const emailHtml = this.generateConfirmationEmailHTML({
        email: subscriber.email,
        firstName: subscriber.firstName || 'Newsletter-Abonnent',
        confirmationUrl
      });
      
      const emailText = `
Bestätigen Sie Ihre Newsletter-Anmeldung

Hallo ${subscriber.firstName || 'Newsletter-Abonnent'},

vielen Dank für Ihr Interesse an unserem Newsletter! 

Um Ihre Anmeldung zu vervollständigen, klicken Sie bitte auf den folgenden Link:
${confirmationUrl}

Falls Sie sich nicht für unseren Newsletter angemeldet haben, können Sie diese E-Mail ignorieren.

Mit freundlichen Grüßen
Chris Schubert
Portfolio & Web Development

---
Chris Schubert
Web Developer & Digital Solutions
E-Mail: schubert_chris@rocketmail.com
Website: portfolio-chris-schubert.vercel.app
      `.trim();
      
      await emailService.sendEmail({
        to: subscriber.email,
        subject: 'Newsletter-Anmeldung bestätigen - Chris Schubert',
        text: emailText,
        html: emailHtml
      });
      
      console.log(`✅ Confirmation email sent to: ${subscriber.email}`);
      return true;
      
    } catch (error) {
      console.error('❌ Confirmation email failed:', error);
      throw new Error('Fehler beim Senden der Bestätigungs-E-Mail');
    }
  }
  
  // ===========================
  // NEWSLETTER VERSENDEN
  // ===========================
  async sendNewsletter(templateId) {
    try {
      const template = await NewsletterTemplate.findById(templateId);
      if (!template) {
        throw new Error('Template nicht gefunden');
      }
      
      if (template.status === 'sent') {
        throw new Error('Newsletter wurde bereits gesendet');
      }
      
      // Status auf "sending" setzen
      template.status = 'sending';
      await template.save();
      
      // Aktive und bestätigte Abonnenten abrufen
      const subscribers = await NewsletterSubscriber.getActiveSubscribers();
      
      if (subscribers.length === 0) {
        template.status = 'failed';
        await template.save();
        throw new Error('Keine aktiven Abonnenten gefunden');
      }
      
      console.log(`📧 Starting newsletter send to ${subscribers.length} subscribers`);
      
      let sentCount = 0;
      let failedCount = 0;
      
      // E-Mails in Batches versenden (um Rate-Limits zu vermeiden)
      const batchSize = 10;
      const batches = this.chunkArray(subscribers, batchSize);
      
      for (const batch of batches) {
        const batchPromises = batch.map(async (subscriber) => {
          try {
            await this.sendNewsletterToSubscriber(template, subscriber);
            sentCount++;
            
            // Subscriber-Statistiken aktualisieren
            subscriber.totalEmailsReceived += 1;
            await subscriber.save();
            
          } catch (error) {
            console.error(`❌ Failed to send to ${subscriber.email}:`, error.message);
            failedCount++;
            
            // Fehler-Log erstellen
            await NewsletterSendLog.create({
              newsletterId: template._id,
              subscriberId: subscriber._id,
              recipientEmail: subscriber.email,
              subject: template.subject,
              status: 'failed',
              errorMessage: error.message
            });
          }
        });
        
        await Promise.all(batchPromises);
        
        // Kurze Pause zwischen Batches
        if (batches.indexOf(batch) < batches.length - 1) {
          await this.delay(1000); // 1 Sekunde Pause
        }
      }
      
      // Template-Statistiken aktualisieren
      template.status = 'sent';
      template.sentAt = new Date();
      template.sentCount = sentCount;
      await template.save();
      
      console.log(`✅ Newsletter sent successfully: ${sentCount} sent, ${failedCount} failed`);
      
      return {
        templateId: template._id,
        totalSubscribers: subscribers.length,
        sentCount,
        failedCount,
        sentAt: template.sentAt
      };
      
    } catch (error) {
      console.error('❌ Newsletter send failed:', error);
      
      // Template Status auf failed setzen
      try {
        await NewsletterTemplate.findByIdAndUpdate(templateId, {
          status: 'failed'
        });
      } catch (updateError) {
        console.error('❌ Failed to update template status:', updateError);
      }
      
      throw error;
    }
  }
  
  // ===========================
  // EINZELNE E-MAIL VERSENDEN
  // ===========================
  async sendNewsletterToSubscriber(template, subscriber) {
    try {
      // Personalisierte E-Mail generieren
      const personalizedContent = this.personalizeContent(template, subscriber);
      
      // Send-Log erstellen
      const sendLog = new NewsletterSendLog({
        newsletterId: template._id,
        subscriberId: subscriber._id,
        recipientEmail: subscriber.email,
        subject: personalizedContent.subject,
        status: 'pending'
      });
      await sendLog.save();
      
      // E-Mail versenden
      const emailResult = await emailService.sendEmail({
        to: subscriber.email,
        subject: personalizedContent.subject,
        html: personalizedContent.html,
        text: personalizedContent.text
      });
      
      // Send-Log aktualisieren
      sendLog.status = 'sent';
      sendLog.sentAt = new Date();
      sendLog.providerMessageId = emailResult.messageId || null;
      sendLog.providerResponse = emailResult;
      await sendLog.save();
      
      return emailResult;
      
    } catch (error) {
      console.error(`❌ Failed to send newsletter to ${subscriber.email}:`, error);
      throw error;
    }
  }
  
  // ===========================
  // CONTENT PERSONALISIERUNG
  // ===========================
  personalizeContent(template, subscriber) {
    const firstName = subscriber.firstName || 'Newsletter-Abonnent';
    const unsubscribeUrl = `${process.env.FRONTEND_URL}/newsletter/unsubscribe/${subscriber.unsubscribeToken}`;
    
    // Personalisierte Variablen
    const variables = {
      '{{firstName}}': firstName,
      '{{fullName}}': subscriber.fullName,
      '{{email}}': subscriber.email,
      '{{unsubscribeUrl}}': unsubscribeUrl
    };
    
    // HTML-Content personalisieren
    let personalizedHtml = template.content.html;
    Object.entries(variables).forEach(([placeholder, value]) => {
      personalizedHtml = personalizedHtml.replace(new RegExp(placeholder, 'g'), value);
    });
    
    // Tracking-Pixel hinzufügen (für Open-Tracking)
    const trackingPixel = `<img src="${process.env.FRONTEND_URL}/api/newsletter/track/open/${subscriber._id}/${template._id}" width="1" height="1" style="display:none;" alt="">`;
    personalizedHtml = personalizedHtml.replace('</body>', `${trackingPixel}</body>`);
    
    // Unsubscribe-Link hinzufügen falls nicht vorhanden
    if (!personalizedHtml.includes(unsubscribeUrl)) {
      const unsubscribeFooter = `
        <div style="margin-top: 40px; padding: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666; text-align: center;">
          <p>Sie erhalten diese E-Mail, weil Sie sich für unseren Newsletter angemeldet haben.</p>
          <p><a href="${unsubscribeUrl}" style="color: #666; text-decoration: underline;">Hier können Sie sich abmelden</a></p>
          <p>Chris Schubert | Web Developer | portfolio-chris-schubert.vercel.app</p>
        </div>
      `;
      personalizedHtml = personalizedHtml.replace('</body>', `${unsubscribeFooter}</body>`);
    }
    
    // Text-Content personalisieren
    let personalizedText = template.content.text;
    Object.entries(variables).forEach(([placeholder, value]) => {
      personalizedText = personalizedText.replace(new RegExp(placeholder, 'g'), value);
    });
    
    // Unsubscribe-Info zu Text hinzufügen
    personalizedText += `\n\n---\nZum Abmelden: ${unsubscribeUrl}\nChris Schubert | Web Developer`;
    
    // Subject personalisieren
    let personalizedSubject = template.subject;
    Object.entries(variables).forEach(([placeholder, value]) => {
      personalizedSubject = personalizedSubject.replace(new RegExp(placeholder, 'g'), value);
    });
    
    return {
      subject: personalizedSubject,
      html: personalizedHtml,
      text: personalizedText
    };
  }
  
  // ===========================
  // BESTÄTIGUNGS-E-MAIL HTML TEMPLATE
  // ===========================
  generateConfirmationEmailHTML(data) {
    return `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Newsletter-Anmeldung bestätigen</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #007bff;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #007bff;
            margin-bottom: 10px;
        }
        .confirm-button {
            display: inline-block;
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            margin: 20px 0;
            transition: all 0.3s ease;
        }
        .confirm-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0,123,255,0.3);
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            font-size: 14px;
            color: #666;
            text-align: center;
        }
        .highlight {
            background: linear-gradient(120deg, #a8e6cf 0%, #dcedc1 100%);
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Chris Schubert</div>
            <p style="margin: 0; color: #666;">Web Developer & Digital Solutions</p>
        </div>
        
        <h1 style="color: #007bff; margin-bottom: 20px;">Bestätigen Sie Ihre Newsletter-Anmeldung</h1>
        
        <p>Hallo <strong>${data.firstName}</strong>,</p>
        
        <p>vielen Dank für Ihr Interesse an unserem Newsletter! Sie erhalten exklusive Tipps, Tools und Trends direkt aus der Web-Entwicklung.</p>
        
        <div class="highlight">
            <p><strong>🚀 Was Sie erwartet:</strong></p>
            <ul>
                <li>Aktuelle Web-Technologien und Frameworks</li>
                <li>Praxis-Tipps für bessere Websites</li>
                <li>Insider-Einblicke aus Projekten</li>
                <li>Kostenlose Tools und Ressourcen</li>
            </ul>
        </div>
        
        <p>Um Ihre Anmeldung zu vervollständigen, klicken Sie bitte auf den Button:</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="${data.confirmationUrl}" class="confirm-button">
                ✅ Newsletter-Anmeldung bestätigen
            </a>
        </div>
        
        <p><em>Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:</em><br>
        <a href="${data.confirmationUrl}" style="color: #007bff; word-break: break-all;">${data.confirmationUrl}</a></p>
        
        <p><strong>Wichtiger Hinweis:</strong> Falls Sie sich nicht für unseren Newsletter angemeldet haben, können Sie diese E-Mail einfach ignorieren.</p>
        
        <div class="footer">
            <p>Mit freundlichen Grüßen<br>
            <strong>Chris Schubert</strong></p>
            
            <p>---</p>
            
            <p>Chris Schubert | Web Developer<br>
            E-Mail: schubert_chris@rocketmail.com<br>
            Website: <a href="https://portfolio-chris-schubert.vercel.app" style="color: #007bff;">portfolio-chris-schubert.vercel.app</a></p>
        </div>
    </div>
</body>
</html>
    `.trim();
  }
  
  // ===========================
  // NEWSLETTER TEMPLATE GENERIEREN
  // ===========================
  generateNewsletterTemplate(data) {
    const { subject, content, images = [], headerImage, footerText } = data;
    
    return `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8f9fa;
        }
        .newsletter-container {
            max-width: 650px;
            margin: 0 auto;
            background: white;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 300;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        .content {
            padding: 40px;
        }
        .content h2 {
            color: #007bff;
            border-bottom: 2px solid #007bff;
            padding-bottom: 10px;
            margin-top: 30px;
        }
        .content img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 20px 0;
        }
        .highlight-box {
            background: linear-gradient(120deg, #e3f2fd 0%, #f3e5f5 100%);
            padding: 25px;
            border-radius: 12px;
            margin: 25px 0;
            border-left: 4px solid #007bff;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            margin: 20px 0;
            transition: all 0.3s ease;
        }
        .footer {
            background: #2c3e50;
            color: white;
            padding: 30px;
            text-align: center;
            font-size: 14px;
        }
        .footer a {
            color: #74b9ff;
            text-decoration: none;
        }
        .social-links {
            margin: 20px 0;
        }
        .social-links a {
            display: inline-block;
            margin: 0 10px;
            color: #74b9ff;
            text-decoration: none;
        }
        @media only screen and (max-width: 600px) {
            .newsletter-container {
                margin: 0;
                box-shadow: none;
            }
            .header, .content, .footer {
                padding: 20px;
            }
            .header h1 {
                font-size: 24px;
            }
        }
    </style>
</head>
<body>
    <div class="newsletter-container">
        <div class="header">
            <h1>Newsletter</h1>
            <p>Chris Schubert | Web Developer</p>
            ${headerImage ? `<img src="${headerImage}" alt="Header" style="max-width: 100%; margin-top: 20px; border-radius: 8px;">` : ''}
        </div>
        
        <div class="content">
            <h2>Hallo {{firstName}},</h2>
            
            ${content}
            
            <div class="highlight-box">
                <p><strong>💡 Tipp:</strong> Haben Sie Fragen zu Web-Entwicklung oder einem Projekt? Antworten Sie einfach auf diese E-Mail!</p>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>Chris Schubert</strong><br>
            Web Developer & Digital Solutions</p>
            
            <div class="social-links">
                <a href="https://portfolio-chris-schubert.vercel.app">🌐 Portfolio</a>
                <a href="https://linkedin.com/in/chris-schubert">💼 LinkedIn</a>
                <a href="https://github.com/chris-schubert">💻 GitHub</a>
            </div>
            
            <p>E-Mail: schubert_chris@rocketmail.com<br>
            Telefon: +49 160 941 683 48</p>
            
            ${footerText || ''}
            
            <p style="margin-top: 30px; font-size: 12px; opacity: 0.8;">
                Sie erhalten diese E-Mail, weil Sie sich für unseren Newsletter angemeldet haben.<br>
                <a href="{{unsubscribeUrl}}" style="color: #74b9ff;">Hier können Sie sich abmelden</a>
            </p>
        </div>
    </div>
</body>
</html>
    `.trim();
  }
  
  // ===========================
  // SCHEDULED NEWSLETTERS VERARBEITEN
  // ===========================
  async processScheduledNewsletters() {
    try {
      const scheduledNewsletters = await NewsletterTemplate.getScheduledNewsletters();
      
      console.log(`📅 Processing ${scheduledNewsletters.length} scheduled newsletters`);
      
      for (const newsletter of scheduledNewsletters) {
        try {
          console.log(`📧 Sending scheduled newsletter: ${newsletter.name}`);
          await this.sendNewsletter(newsletter._id);
        } catch (error) {
          console.error(`❌ Failed to send scheduled newsletter ${newsletter._id}:`, error);
          
          // Newsletter als failed markieren
          newsletter.status = 'failed';
          await newsletter.save();
        }
      }
      
    } catch (error) {
      console.error('❌ Error processing scheduled newsletters:', error);
    }
  }
  
  // ===========================
  // HILFSFUNKTIONEN
  // ===========================
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // ===========================
  // TRACKING FUNKTIONEN
  // ===========================
  async trackEmailOpen(subscriberId, newsletterId) {
    try {
      const sendLog = await NewsletterSendLog.findOne({
        subscriberId,
        newsletterId
      });
      
      if (sendLog && sendLog.status !== 'opened') {
        sendLog.status = 'opened';
        sendLog.openedAt = new Date();
        sendLog.openCount += 1;
        await sendLog.save();
        
        // Newsletter-Statistiken aktualisieren
        await NewsletterTemplate.findByIdAndUpdate(newsletterId, {
          $inc: { openedCount: 1 }
        });
        
        // Subscriber-Statistiken aktualisieren
        await NewsletterSubscriber.findByIdAndUpdate(subscriberId, {
          $inc: { totalEmailsOpened: 1 },
          lastOpenedAt: new Date()
        });
      }
      
    } catch (error) {
      console.error('❌ Email open tracking error:', error);
    }
  }
  
  async trackEmailClick(subscriberId, newsletterId, url) {
    try {
      const sendLog = await NewsletterSendLog.findOne({
        subscriberId,
        newsletterId
      });
      
      if (sendLog) {
        sendLog.clickCount += 1;
        if (sendLog.status === 'opened') {
          sendLog.status = 'clicked';
        }
        if (!sendLog.firstClickedAt) {
          sendLog.firstClickedAt = new Date();
        }
        await sendLog.save();
        
        // Newsletter-Statistiken aktualisieren
        await NewsletterTemplate.findByIdAndUpdate(newsletterId, {
          $inc: { clickedCount: 1 }
        });
        
        // Subscriber-Statistiken aktualisieren
        await NewsletterSubscriber.findByIdAndUpdate(subscriberId, {
          $inc: { totalLinksClicked: 1 },
          lastClickedAt: new Date()
        });
      }
      
    } catch (error) {
      console.error('❌ Email click tracking error:', error);
    }
  }
}

// Singleton Export
const newsletterService = new NewsletterService();

export default newsletterService;