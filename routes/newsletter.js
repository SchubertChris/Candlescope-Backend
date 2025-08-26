// routes/newsletter.js
// VOLLSTÄNDIGE NEWSLETTER ROUTES - Admin-exklusiv mit Scheduling
import express from "express";
import {
  NewsletterSubscriber,
  NewsletterTemplate,
  NewsletterSendLog,
} from "../models/newsletter/newsletter.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
// In routes/newsletter.js ÄNDERN:
import newsletterService from '../services/newsletter-service.js';  // ← Mit Bindestrich
import emailService from '../services/email-service.js';           // ← Mit Bindestrich
const router = express.Router();

// ===========================
// SUBSCRIBER MANAGEMENT
// ===========================

// GET /api/newsletter/subscribers - Alle aktiven Abonnenten abrufen (Admin only)
router.get("/subscribers", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = "", status = "active" } = req.query;

    const filter = {};

    // Status-Filter
    if (status === "active") {
      filter.isConfirmed = true;
      filter.isActive = true;
    } else if (status === "unconfirmed") {
      filter.isConfirmed = false;
      filter.isActive = true;
    } else if (status === "unsubscribed") {
      filter.isActive = false;
    }

    // Such-Filter
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
      ];
    }

    const subscribers = await NewsletterSubscriber.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select("-confirmationToken -unsubscribeToken");

    const total = await NewsletterSubscriber.countDocuments(filter);

    res.json({
      success: true,
      data: {
        subscribers,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: subscribers.length,
          totalSubscribers: total,
        },
      },
    });
  } catch (error) {
    console.error("❌ Subscriber fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Fehler beim Laden der Abonnenten",
    });
  }
});

// POST /api/newsletter/subscribers - Neuen Abonnenten hinzufügen (Admin)
router.post("/subscribers", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { email, firstName, lastName } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "E-Mail-Adresse ist erforderlich",
      });
    }

    // Prüfe auf existierenden Abonnenten
    const existing = await NewsletterSubscriber.findOne({
      email: email.toLowerCase(),
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "E-Mail-Adresse ist bereits registriert",
      });
    }

    const subscriber = new NewsletterSubscriber({
      email: email.toLowerCase(),
      firstName,
      lastName,
      isConfirmed: true, // Admin kann direkt bestätigen
      confirmedAt: new Date(),
      source: "manual_import",
      ipAddress: req.ip || "admin",
    });

    await subscriber.save();

    res.status(201).json({
      success: true,
      data: subscriber,
      message: "Abonnent erfolgreich hinzugefügt",
    });
  } catch (error) {
    console.error("❌ Subscriber creation error:", error);
    res.status(500).json({
      success: false,
      message: "Fehler beim Hinzufügen des Abonnenten",
    });
  }
});

// DELETE /api/newsletter/subscribers/:id - Abonnent löschen (Admin)
router.delete(
  "/subscribers/:id",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const subscriber = await NewsletterSubscriber.findById(req.params.id);

      if (!subscriber) {
        return res.status(404).json({
          success: false,
          message: "Abonnent nicht gefunden",
        });
      }

      await subscriber.unsubscribe("admin_action");

      res.json({
        success: true,
        message: "Abonnent erfolgreich abgemeldet",
      });
    } catch (error) {
      console.error("❌ Subscriber deletion error:", error);
      res.status(500).json({
        success: false,
        message: "Fehler beim Löschen des Abonnenten",
      });
    }
  }
);

// ===========================
// NEWSLETTER TEMPLATES
// ===========================

// GET /api/newsletter/templates - Alle Newsletter-Templates (Admin)
router.get("/templates", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status = "all", limit = 20 } = req.query;

    const filter = {};
    if (status !== "all") {
      filter.status = status;
    }

    const templates = await NewsletterTemplate.find(filter)
      .populate("createdBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error("❌ Templates fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Fehler beim Laden der Templates",
    });
  }
});

// GET /api/newsletter/templates/:id - Einzelnes Template abrufen (Admin)
router.get("/templates/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const template = await NewsletterTemplate.findById(req.params.id).populate(
      "createdBy",
      "firstName lastName email"
    );

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template nicht gefunden",
      });
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error("❌ Template fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Fehler beim Laden des Templates",
    });
  }
});

// POST /api/newsletter/templates - Neues Template erstellen (Admin)
router.post("/templates", requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      name,
      subject,
      preheader,
      content,
      images,
      scheduledDate,
      templateCategory,
    } = req.body;

    if (!name || !subject || !content?.html) {
      return res.status(400).json({
        success: false,
        message: "Name, Betreff und HTML-Content sind erforderlich",
      });
    }

    const template = new NewsletterTemplate({
      name,
      subject,
      preheader,
      content,
      images: images || [],
      templateCategory: templateCategory || "newsletter",
      createdBy: req.user._id,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      isScheduled: !!scheduledDate,
      status: scheduledDate ? "scheduled" : "draft",
    });

    await template.save();
    await template.populate("createdBy", "firstName lastName email");

    res.status(201).json({
      success: true,
      data: template,
      message: "Template erfolgreich erstellt",
    });
  } catch (error) {
    console.error("❌ Template creation error:", error);
    res.status(500).json({
      success: false,
      message: "Fehler beim Erstellen des Templates",
    });
  }
});

// PUT /api/newsletter/templates/:id - Template aktualisieren (Admin)
router.put("/templates/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const template = await NewsletterTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template nicht gefunden",
      });
    }

    // Verhindere Änderungen an bereits gesendeten Templates
    if (template.status === "sent") {
      return res.status(400).json({
        success: false,
        message: "Bereits gesendete Templates können nicht geändert werden",
      });
    }

    const {
      name,
      subject,
      preheader,
      content,
      images,
      scheduledDate,
      templateCategory,
    } = req.body;

    // Aktualisiere Felder
    if (name) template.name = name;
    if (subject) template.subject = subject;
    if (preheader !== undefined) template.preheader = preheader;
    if (content) template.content = content;
    if (images) template.images = images;
    if (templateCategory) template.templateCategory = templateCategory;

    // Scheduling-Logik
    if (scheduledDate !== undefined) {
      if (scheduledDate) {
        template.scheduledDate = new Date(scheduledDate);
        template.isScheduled = true;
        template.status = "scheduled";
      } else {
        template.scheduledDate = null;
        template.isScheduled = false;
        template.status = "draft";
      }
    }

    await template.save();
    await template.populate("createdBy", "firstName lastName email");

    res.json({
      success: true,
      data: template,
      message: "Template erfolgreich aktualisiert",
    });
  } catch (error) {
    console.error("❌ Template update error:", error);
    res.status(500).json({
      success: false,
      message: "Fehler beim Aktualisieren des Templates",
    });
  }
});

// POST /api/newsletter/templates/:id/preview - Template-Vorschau generieren (Admin)
router.post(
  "/templates/:id/preview",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const template = await NewsletterTemplate.findById(req.params.id);

      if (!template) {
        return res.status(404).json({
          success: false,
          message: "Template nicht gefunden",
        });
      }

      const preview = template.generatePreview();

      res.json({
        success: true,
        data: preview,
      });
    } catch (error) {
      console.error("❌ Template preview error:", error);
      res.status(500).json({
        success: false,
        message: "Fehler beim Generieren der Vorschau",
      });
    }
  }
);

// POST /api/newsletter/templates/:id/send - Newsletter versenden (Admin)
router.post(
  "/templates/:id/send",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const template = await NewsletterTemplate.findById(req.params.id);

      if (!template) {
        return res.status(404).json({
          success: false,
          message: "Template nicht gefunden",
        });
      }

      if (template.status === "sent") {
        return res.status(400).json({
          success: false,
          message: "Template wurde bereits gesendet",
        });
      }

      // Bestätigung erforderlich
      const { confirm } = req.body;
      if (!confirm) {
        const subscriberCount = await NewsletterSubscriber.countDocuments({
          isConfirmed: true,
          isActive: true,
        });

        return res.json({
          success: false,
          requiresConfirmation: true,
          message: `Newsletter wird an ${subscriberCount} Abonnenten gesendet. Bestätigen Sie den Versand.`,
          data: { subscriberCount },
        });
      }

      // Newsletter-Versand starten
      const result = await newsletterService.sendNewsletter(template._id);

      res.json({
        success: true,
        data: result,
        message: "Newsletter-Versand wurde gestartet",
      });
    } catch (error) {
      console.error("❌ Newsletter send error:", error);
      res.status(500).json({
        success: false,
        message: "Fehler beim Versenden des Newsletters",
      });
    }
  }
);

// DELETE /api/newsletter/templates/:id - Template löschen (Admin)
router.delete("/templates/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const template = await NewsletterTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template nicht gefunden",
      });
    }

    // Verhindere Löschen von bereits gesendeten Templates
    if (template.status === "sent") {
      return res.status(400).json({
        success: false,
        message: "Bereits gesendete Templates können nicht gelöscht werden",
      });
    }

    await NewsletterTemplate.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Template erfolgreich gelöscht",
    });
  } catch (error) {
    console.error("❌ Template deletion error:", error);
    res.status(500).json({
      success: false,
      message: "Fehler beim Löschen des Templates",
    });
  }
});

// ===========================
// NEWSLETTER STATISTICS
// ===========================

// GET /api/newsletter/stats - Newsletter-Statistiken (Admin)
router.get("/stats", requireAuth, requireAdmin, async (req, res) => {
  try {
    const totalSubscribers = await NewsletterSubscriber.countDocuments({
      isActive: true,
    });

    const confirmedSubscribers = await NewsletterSubscriber.countDocuments({
      isConfirmed: true,
      isActive: true,
    });

    const totalNewslettersSent = await NewsletterTemplate.countDocuments({
      status: "sent",
    });

    const scheduledNewsletters = await NewsletterTemplate.countDocuments({
      status: "scheduled",
      scheduledDate: { $gte: new Date() },
    });

    // Durchschnittliche Open-Rate der letzten 5 Newsletter
    const recentNewsletters = await NewsletterTemplate.find({
      status: "sent",
    })
      .sort({ sentAt: -1 })
      .limit(5)
      .select("openedCount sentCount");

    let avgOpenRate = 0;
    if (recentNewsletters.length > 0) {
      const totalSent = recentNewsletters.reduce(
        (sum, nl) => sum + nl.sentCount,
        0
      );
      const totalOpened = recentNewsletters.reduce(
        (sum, nl) => sum + nl.openedCount,
        0
      );
      avgOpenRate =
        totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
    }

    res.json({
      success: true,
      data: {
        totalSubscribers,
        confirmedSubscribers,
        unconfirmedSubscribers: totalSubscribers - confirmedSubscribers,
        totalNewslettersSent,
        scheduledNewsletters,
        avgOpenRate,
        confirmationRate:
          totalSubscribers > 0
            ? Math.round((confirmedSubscribers / totalSubscribers) * 100)
            : 0,
      },
    });
  } catch (error) {
    console.error("❌ Newsletter stats error:", error);
    res.status(500).json({
      success: false,
      message: "Fehler beim Laden der Statistiken",
    });
  }
});

// ===========================
// PUBLIC ENDPOINTS (für Frontend Newsletter-Anmeldung)
// ===========================

// POST /api/newsletter/subscribe - Öffentliche Newsletter-Anmeldung
router.post("/subscribe", async (req, res) => {
  try {
    const {
      email,
      firstName,
      lastName,
      source = "newsletter_signup",
    } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "E-Mail-Adresse ist erforderlich",
      });
    }

    // E-Mail-Validierung
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Bitte geben Sie eine gültige E-Mail-Adresse ein",
      });
    }

    // Prüfe auf existierenden Abonnenten
    let subscriber = await NewsletterSubscriber.findOne({
      email: email.toLowerCase(),
    });

    if (subscriber) {
      if (subscriber.isActive && subscriber.isConfirmed) {
        return res.status(200).json({
          success: true,
          message: "Sie sind bereits für den Newsletter angemeldet",
          data: { alreadySubscribed: true },
        });
      } else if (subscriber.isActive && !subscriber.isConfirmed) {
        // Bestätigungs-E-Mail erneut senden
        await newsletterService.sendConfirmationEmail(subscriber);
        return res.status(200).json({
          success: true,
          message: "Bestätigungs-E-Mail wurde erneut gesendet",
        });
      } else {
        // Reaktivierung
        subscriber.isActive = true;
        subscriber.isConfirmed = false;
        subscriber.unsubscribedAt = null;
        subscriber.generateTokens();
        await subscriber.save();
      }
    } else {
      // Neuer Abonnent
      subscriber = new NewsletterSubscriber({
        email: email.toLowerCase(),
        firstName,
        lastName,
        source,
        ipAddress: req.ip || "unknown",
        userAgent: req.get("User-Agent") || "unknown",
      });
      await subscriber.save();
    }

    // Bestätigungs-E-Mail senden (Double-Opt-In)
    await newsletterService.sendConfirmationEmail(subscriber);

    res.status(201).json({
      success: true,
      message:
        "Bitte überprüfen Sie Ihre E-Mails und bestätigen Sie Ihre Anmeldung",
      data: { email: subscriber.email },
    });
  } catch (error) {
    console.error("❌ Newsletter subscription error:", error);
    res.status(500).json({
      success: false,
      message: "Fehler bei der Newsletter-Anmeldung",
    });
  }
});

// GET /api/newsletter/confirm/:token - E-Mail-Bestätigung (Double-Opt-In)
router.get("/confirm/:token", async (req, res) => {
  try {
    const subscriber = await NewsletterSubscriber.findOne({
      confirmationToken: req.params.token,
      isActive: true,
    });

    if (!subscriber) {
      return res.status(400).json({
        success: false,
        message: "Ungültiger oder abgelaufener Bestätigungslink",
      });
    }

    await subscriber.confirm();

    res.json({
      success: true,
      message: "Ihre Newsletter-Anmeldung wurde erfolgreich bestätigt",
    });
  } catch (error) {
    console.error("❌ Newsletter confirmation error:", error);
    res.status(500).json({
      success: false,
      message: "Fehler bei der Bestätigung",
    });
  }
});

// GET /api/newsletter/unsubscribe/:token - Newsletter abbestellen
router.get("/unsubscribe/:token", async (req, res) => {
  try {
    const subscriber = await NewsletterSubscriber.findOne({
      unsubscribeToken: req.params.token,
    });

    if (!subscriber) {
      return res.status(400).json({
        success: false,
        message: "Ungültiger Abmelde-Link",
      });
    }

    await subscriber.unsubscribe("user_request");

    res.json({
      success: true,
      message: "Sie wurden erfolgreich vom Newsletter abgemeldet",
    });
  } catch (error) {
    console.error("❌ Newsletter unsubscribe error:", error);
    res.status(500).json({
      success: false,
      message: "Fehler beim Abmelden",
    });
  }
});

export default router;
