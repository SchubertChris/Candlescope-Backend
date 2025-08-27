// services/email-service.js
// KORRIGIERT: Robuste Fehlerbehandlung + Credential-Validation OHNE Optik-Änderungen
import nodemailer from 'nodemailer';

class EmailService {
  constructor() {
    // KORRIGIERT: Transporter wird erst bei Bedarf erstellt (Lazy Loading)
    this.transporter = null;
  }

  // KORRIGIERT: Transporter erst bei Bedarf initialisieren + Fehlerbehandlung
  getTransporter() {
    if (!this.transporter) {
      console.log('🔧 INITIALIZING EMAIL TRANSPORTER:');
      console.log('EMAIL_USER:', process.env.EMAIL_USER || 'MISSING');
      console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? `${process.env.EMAIL_PASS.length} chars` : 'MISSING');
      
      // KORRIGIERT: Credential-Check vor Transporter-Erstellung
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error('EMAIL_USER und EMAIL_PASS müssen in .env gesetzt sein');
      }
      
      // KORRIGIERT: createTransport (nicht createTransporter) + Timeout-Konfiguration
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        // HINZUGEFÜGT: Timeout-Konfiguration für Stabilität
        connectionTimeout: 10000, // 10 Sekunden
        greetingTimeout: 5000,    // 5 Sekunden
        socketTimeout: 10000      // 10 Sekunden
      });
    }
    return this.transporter;
  }

  generateRandomPassword(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
    password += '0123456789'[Math.floor(Math.random() * 10)];
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)];
    
    for (let i = 4; i < length; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  async sendLoginCredentials(email, temporaryPassword) {
    try {
      // KORRIGIERT: Credential-Check zur Laufzeit mit besserer Fehlerbehandlung
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('❌ EMAIL CREDENTIALS MISSING AT RUNTIME');
        return { success: false, error: 'Email credentials not configured' };
      }

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: '🔐 Ihre CandleScope Login-Daten',
        html: `
        <div style="font-family: 'Arial', sans-serif; max-width: 650px; margin: 0 auto; padding: 0; background: #0f0f23; border-radius: 24px; overflow: hidden;">
          
          <!-- Header Section -->
          <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 60px 40px; text-align: center; position: relative;">
          <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: radial-gradient(circle at 30% 20%, rgba(162, 89, 255, 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(59, 130, 246, 0.1) 0%, transparent 50%);"></div>
          <div style="position: relative; z-index: 10;">
            <h1 style="margin: 0; font-size: 42px; font-weight: 300; color: #ffffff; letter-spacing: 2px;"> CandleScope</h1>
            <p style="margin: 16px 0 0; font-size: 18px; color: rgba(255, 255, 255, 0.8); font-weight: 300;">Ihr persönlicher Kommunikationskanal</p>
            <div style="width: 80px; height: 3px; background: linear-gradient(90deg, #a259ff, #3b82f6); margin: 24px auto; border-radius: 2px;"></div>
          </div>
          </div>
          
          <!-- Main Content -->
          <div style="padding: 50px 40px; background: #1a1a2e;">
          
          <!-- Welcome Message -->
          <div style="text-align: center; margin-bottom: 40px;">
            <h2 style="margin: 0 0 16px; font-size: 28px; font-weight: 400; color: #ffffff;">Willkommen bei CandleScope!</h2>
            <p style="margin: 0; font-size: 16px; color: rgba(255, 255, 255, 0.7); line-height: 1.6; max-width: 480px; margin: 0 auto;">
            Ihr Account wurde erfolgreich erstellt. Diese Plattform ermöglicht eine direkte, interaktive Kommunikation zwischen uns als Ihrem persönlichen Service-Partner.
            </p>
          </div>
          
          <!-- Login Credentials Card -->
          <div style="background: linear-gradient(135deg, #2d2d44 0%, #3a3a5c 100%); border-radius: 20px; padding: 40px; margin: 32px 0; border: 1px solid rgba(162, 89, 255, 0.2); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);">
            <h3 style="margin: 0 0 32px; font-size: 22px; font-weight: 500; color: #ffffff; text-align: center;">🔐 Ihre Zugangsdaten</h3>
            
            <div style="margin-bottom: 24px;">
            <div style="background: rgba(162, 89, 255, 0.1); border: 1px solid rgba(162, 89, 255, 0.3); border-radius: 16px; padding: 20px;">
              <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #a259ff; text-transform: uppercase; letter-spacing: 1px;">📧 Email-Adresse</p>
              <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 18px; color: #ffffff !important; word-break: break-all;">${email}</p>
            </div>
            </div>
            
            <div style="margin-bottom: 32px;">
            <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 16px; padding: 20px;">
              <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #3b82f6; text-transform: uppercase; letter-spacing: 1px;">🔑 Temporäres Passwort</p>
              <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 22px; color: #FFD700; letter-spacing: 3px; font-weight: bold;">${temporaryPassword}</p>
            </div>
            </div>
            
            <div style="background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); border-radius: 16px; padding: 20px; margin-bottom: 32px;">
            <p style="margin: 0; font-size: 14px; color: rgba(255, 193, 7, 0.9); line-height: 1.5;">
              ⚠️ <strong>Wichtiger Hinweis:</strong> Bitte ändern Sie Ihr Passwort nach dem ersten Login über Ihr Dashboard.
            </p>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center;">
            <a href="http://localhost:5173" 
               style="display: inline-block; background: linear-gradient(135deg, #a259ff 0%, #667eea 100%); 
                  padding: 18px 40px; text-decoration: none; color: white; border-radius: 16px; 
                  font-weight: 600; font-size: 16px; box-shadow: 0 8px 24px rgba(162, 89, 255, 0.3);
                  transition: all 0.3s ease; border: 1px solid rgba(255, 255, 255, 0.1);">
              🚀 Jetzt anmelden & Dashboard öffnen
            </a>
            </div>
          </div>
          
          <!-- Service Info -->
          <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 20px; padding: 32px; margin: 32px 0; border: 1px solid rgba(255, 255, 255, 0.1);">
            <h3 style="margin: 0 0 20px; font-size: 20px; font-weight: 500; color: #ffffff; text-align: center;">💼 Ihr persönlicher Service</h3>
            <div style="display: grid; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 32px;">
              <div style="background: rgba(34, 197, 94, 0.2); padding: 12px; border-radius: 12px; flex-shrink: 0;">
              <span style="font-size: 20px; ">💬</span>
              </div>
              <div>
              <p style="margin: 0; font-size: 16px; font-weight: 500; color: #ffffff;">Direkte Kommunikation</p>
              <p style="margin: 4px 0 0; font-size: 14px; color: rgba(255, 255, 255, 0.6);">Persönlicher Kontakt ohne Umwege</p>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 32px;">
              <div style="background: rgba(59, 130, 246, 0.2); padding: 12px; border-radius: 12px; flex-shrink: 0;">
              <span style="font-size: 20px; ">⚡</span>
              </div>
              <div>
              <p style="margin: 0; font-size: 16px; font-weight: 500; color: #ffffff;">Schnelle Antworten</p>
              <p style="margin: 4px 0 0; font-size: 14px; color: rgba(255, 255, 255, 0.6);">Interaktive Lösungen in Echtzeit</p>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 32px;">
              <div style="background: rgba(162, 89, 255, 0.2); padding: 12px; border-radius: 12px; flex-shrink: 0;">
              <span style="font-size: 20px; ">🎯</span>
              </div>
              <div>
              <p style="margin: 0; font-size: 16px; font-weight: 500; color: #ffffff;">Maßgeschneidert</p>
              <p style="margin: 4px 0 0; font-size: 14px; color: rgba(255, 255, 255, 0.6);">Individuelle Betreuung für Ihre Bedürfnisse</p>
              </div>
            </div>
            </div>
          </div>
          </div>
          
          <!-- Footer -->
          <div style="background: #0f0f23; padding: 32px 40px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.1);">
          <p style="margin: 0 0 16px; font-size: 14px; color: rgba(255, 255, 255, 0.5);">
            Diese Email wurde automatisch generiert von Ihrem CandleScope Service-Team.<br>
            Bei Fragen erreichen Sie uns direkt über: <a href="mailto:${process.env.EMAIL_USER}" style="color: #a259ff; text-decoration: none;">${process.env.EMAIL_USER}</a>
          </p>
          <div style="margin-top: 20px;">
            <span style="font-size: 12px; color: rgba(255, 255, 255, 0.3);">CandleScope - Ihr persönlicher Kommunikationskanal</span>
          </div>
          </div>
        </div>
        `
      };

      // KORRIGIERT: Bessere Fehlerbehandlung beim Email-Versand
      console.log(`📤 SENDING EMAIL TO: ${email}`);
      const transporter = this.getTransporter();
      const info = await transporter.sendMail(mailOptions);
      console.log('✅ EMAIL SENT SUCCESSFULLY:', info.messageId);
      return { success: true, messageId: info.messageId };
      
    } catch (error) {
      console.error('❌ EMAIL SEND ERROR:', error.message);
      console.error('❌ FULL ERROR:', error);
      
      // KORRIGIERT: Spezifische Fehlerbehandlung für verschiedene Email-Probleme
      let errorMessage = error.message;
      
      if (error.code === 'EAUTH') {
        errorMessage = 'Email-Authentifizierung fehlgeschlagen. Prüfen Sie EMAIL_USER und EMAIL_PASS.';
      } else if (error.code === 'ECONNECTION') {
        errorMessage = 'Keine Verbindung zum Email-Server möglich.';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = 'Email-Versand Timeout. Versuchen Sie es später erneut.';
      }
      
      return { success: false, error: errorMessage };
    }
  }

  // OAuth-Welcome-Email-Funktion (UNVERÄNDERT - exakt deine Optik)
  async sendOAuthWelcomeEmail(email, provider, userName = '') {
    try {
      // Credential-Check zur Laufzeit
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('❌ EMAIL CREDENTIALS MISSING AT RUNTIME');
        return { success: false, error: 'Email credentials not configured' };
      }

      const providerName = provider === 'google' ? 'Google' : 'GitHub';
      const providerIcon = provider === 'google' ? '🌐' : '🐙';
      const providerColor = provider === 'google' ? '#db4437' : '#ffffffff';

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `🎉 Willkommen bei CandleScope - ${providerName} Login erfolgreich`,
        html: `
        <div style="font-family: 'Arial', sans-serif; max-width: 650px; margin: 0 auto; padding: 0; background: #0f0f23; border-radius: 24px; overflow: hidden;">
          
          <!-- Header Section -->
          <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 60px 40px; text-align: center; position: relative;">
          <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: radial-gradient(circle at 30% 20%, rgba(162, 89, 255, 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(59, 130, 246, 0.1) 0%, transparent 50%);"></div>
          <div style="position: relative; z-index: 10;">
            <h1 style="margin: 0; font-size: 42px; font-weight: 300; color: #ffffff; letter-spacing: 2px;">CandleScope</h1>
            <p style="margin: 16px 0 0; font-size: 18px; color: rgba(255, 255, 255, 0.8); font-weight: 300;">${providerIcon} ${providerName} Anmeldung erfolgreich</p>
            <div style="width: 80px; height: 3px; background: linear-gradient(90deg, #a259ff, ${providerColor}); margin: 24px auto; border-radius: 2px;"></div>
          </div>
          </div>
          
          <!-- Main Content -->
          <div style="padding: 50px 40px; background: #1a1a2e;">
          
          <!-- Welcome Message -->
          <div style="text-align: center; margin-bottom: 40px;">
            <h2 style="margin: 0 0 16px; font-size: 28px; font-weight: 400; color: #ffffff;">Willkommen${userName ? `, ${userName}` : ''}!</h2>
            <p style="margin: 0; font-size: 16px; color: rgba(255, 255, 255, 0.7); line-height: 1.6; max-width: 480px; margin: 0 auto;">
            Sie haben sich erfolgreich über ${providerName} bei CandleScope angemeldet. Ihr Account ist jetzt aktiv und Sie können alle Features nutzen.
            </p>
          </div>
          
          <!-- OAuth Success Card -->
          <div style="background: linear-gradient(135deg, #2d2d44 0%, #3a3a5c 100%); border-radius: 20px; padding: 40px; margin: 32px 0; border: 1px solid rgba(162, 89, 255, 0.2); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);">
            <h3 style="margin: 0 0 32px; font-size: 22px; font-weight: 500; color: #ffffff; text-align: center;">${providerIcon} ${providerName} Anmeldung bestätigt</h3>
            
            <div style="margin-bottom: 24px;">
            <div style="background: rgba(162, 89, 255, 0.1); border: 1px solid rgba(162, 89, 255, 0.3); border-radius: 16px; padding: 20px;">
              <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #a259ff; text-transform: uppercase; letter-spacing: 1px;">📧 Angemeldete Email</p>
              <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 18px; color: #ffffff; word-break: break-all;">${email}</p>
            </div>
            </div>
            
            <div style="margin-bottom: 32px;">
            <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 16px; padding: 20px;">
              <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #22c55e; text-transform: uppercase; letter-spacing: 1px;">✅ Status</p>
              <p style="margin: 0; font-size: 18px; color: #22c55e; font-weight: 600;">Account aktiv über ${providerName}. Ändere dein Passwort in den Einstellungen!</p>
            </div>
            </div>
            
            <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 16px; padding: 20px; margin-bottom: 32px;">
            <p style="margin: 0; font-size: 14px; color: rgba(59, 130, 246, 0.9); line-height: 1.5;">
              ℹ️ <strong>Automatische Anmeldung:</strong> Sie können sich jederzeit über ${providerName} anmelden, ohne weitere Passwörter zu merken.
            </p>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center;">
            <a href="http://localhost:5173" 
               style="display: inline-block; background: linear-gradient(135deg, #a259ff 0%, #667eea 100%); 
                  padding: 18px 40px; text-decoration: none; color: white; border-radius: 16px; 
                  font-weight: 600; font-size: 16px; box-shadow: 0 8px 24px rgba(162, 89, 255, 0.3);
                  transition: all 0.3s ease; border: 1px solid rgba(255, 255, 255, 0.1);">
              🚀 Dashboard öffnen
            </a>
            </div>
          </div>
          
          <!-- Service Info -->
          <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 20px; padding: 32px; margin: 32px 0; border: 1px solid rgba(255, 255, 255, 0.1);">
            <h3 style="margin: 0 0 20px; font-size: 20px; font-weight: 500; color: #ffffff; text-align: center;">💼 Ihre Vorteile</h3>
            <div style="display: grid; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 32px;">
              <div style="background: rgba(34, 197, 94, 0.2); padding: 12px; border-radius: 12px; flex-shrink: 0;">
              <span style="font-size: 20px;">🔐</span>
              </div>
              <div>
              <p style="margin: 0; font-size: 16px; font-weight: 500; color: #ffffff;">Sichere ${providerName} Anmeldung</p>
              <p style="margin: 4px 0 0; font-size: 14px; color: rgba(255, 255, 255, 0.6);">Keine zusätzlichen Passwörter erforderlich</p>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 32px;">
              <div style="background: rgba(59, 130, 246, 0.2); padding: 12px; border-radius: 12px; flex-shrink: 0;">
              <span style="font-size: 20px;">⚡</span>
              </div>
              <div>
              <p style="margin: 0; font-size: 16px; font-weight: 500; color: #ffffff;">Schneller Zugang</p>
              <p style="margin: 4px 0 0; font-size: 14px; color: rgba(255, 255, 255, 0.6);">Ein-Klick Anmeldung bei jedem Besuch</p>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 32px;">
              <div style="background: rgba(162, 89, 255, 0.2); padding: 12px; border-radius: 12px; flex-shrink: 0;">
              <span style="font-size: 20px;">🎯</span>
              </div>
              <div>
              <p style="margin: 0; font-size: 16px; font-weight: 500; color: #ffffff;">Personalisierte Erfahrung</p>
              <p style="margin: 4px 0 0; font-size: 14px; color: rgba(255, 255, 255, 0.6);">Ihre Daten sind sicher mit ${providerName} verknüpft</p>
              </div>
            </div>
            </div>
          </div>
          </div>
          
          <!-- Footer -->
          <div style="background: #0f0f23; padding: 32px 40px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.1);">
          <p style="margin: 0 0 16px; font-size: 14px; color: rgba(255, 255, 255, 0.5);">
            Diese Email wurde automatisch nach Ihrer ${providerName} Anmeldung generiert.<br>
            Bei Fragen erreichen Sie uns direkt über: <a href="mailto:${process.env.EMAIL_USER}" style="color: #a259ff; text-decoration: none;">${process.env.EMAIL_USER}</a>
          </p>
          <div style="margin-top: 20px;">
            <span style="font-size: 12px; color: rgba(255, 255, 255, 0.3);">CandleScope - Ihr persönlicher Kommunikationskanal</span>
          </div>
          </div>
        </div>
        `
      };

      console.log(`📤 SENDING OAUTH WELCOME EMAIL TO: ${email} (${providerName})`);
      const transporter = this.getTransporter();
      const info = await transporter.sendMail(mailOptions);
      console.log('✅ OAUTH EMAIL SENT SUCCESSFULLY:', info.messageId);
      return { success: true, messageId: info.messageId };
      
    } catch (error) {
      console.error('❌ OAUTH EMAIL SEND ERROR:', error.message);
      console.error('❌ FULL ERROR:', error);
      return { success: false, error: error.message };
    }
  }

  // Connection-Test mit Lazy Loading (KORRIGIERT: Bessere Fehlerbehandlung)
  async testConnection() {
    try {
      console.log('🔍 TESTING EMAIL CONNECTION...');
      const transporter = this.getTransporter();
      await transporter.verify();
      console.log('✅ EMAIL CONNECTION SUCCESSFUL');
      return true;
    } catch (error) {
      console.error('❌ EMAIL CONNECTION FAILED:', error.message);
      return false;
    }
  }
}

const emailService = new EmailService();
export default emailService;