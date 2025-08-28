// Backend/routes/dashboard.js
// KORRIGIERT: ES Modules Version
import express from "express";
import jwt from "jsonwebtoken";

// Dynamic imports für Models
const User = (await import("../models/user/User.js")).default;
const Project = (await import("../models/project/project.js")).default;
const Message = (await import("../models/message/message.js")).default;

const router = express.Router();

// Middleware: Authentifizierung prüfen
const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ success: false, error: "Token fehlt" });
    }

    // Token-Validierung
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: "Benutzer nicht gefunden" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: "Ungültiger Token" });
  }
};

// Middleware: Admin-Rechte prüfen
const requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ success: false, error: "Admin-Rechte erforderlich" });
  }
  next();
};

// ===========================
// DASHBOARD OVERVIEW
// ===========================

// GET /api/dashboard - Dashboard-Daten laden
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = req.user;

    // Projekte laden (rollenbasiert)
    const projects = await Project.findByUser(user);

    // Nachrichten laden (rollenbasiert)
    const messages = await Message.findRecentByUser(user, 10);

    // Ungelesene Nachrichten zählen
    const unreadCount = await Message.getUnreadCount(user._id, user.role);
    const notifications = unreadCount[0]?.unreadCount || 0;

    // Statistiken berechnen
    const stats = {
      totalProjects: projects.length,
      activeProjects: projects.filter((p) => p.status !== "completed").length,
      totalMessages: messages.length,
      unreadMessages: notifications,
      totalFiles: projects.reduce((sum, p) => sum + (p.filesCount || 0), 0),
    };

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          company: user.company,
          avatar: user.avatar,
        },
        projects,
        messages,
        notifications,
        stats,
      },
    });
  } catch (error) {
    console.error("Dashboard-Fehler:", error);
    res.status(500).json({ success: false, error: "Server-Fehler beim Laden des Dashboards" });
  }
});

// ===========================
// PROJEKT-VERWALTUNG
// ===========================

// GET /api/dashboard/projects - Alle Projekte
router.get("/projects", requireAuth, async (req, res) => {
  try {
    const projects = await Project.findByUser(req.user);

    res.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error("Projekt-Laden-Fehler:", error);
    res.status(500).json({ success: false, error: "Fehler beim Laden der Projekte" });
  }
});

// POST /api/dashboard/projects - Neues Projekt erstellen (nur Admin)
router.post("/projects", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, type, description, deadline, priority, customerId } = req.body;

    // Validierung
    if (!name || !type || !deadline || !customerId) {
      return res.status(400).json({
        success: false,
        error: "Name, Typ, Deadline und Kunde sind erforderlich",
      });
    }

    // Prüfen ob Kunde existiert und dem Admin zugewiesen ist
    const customer = await User.findOne({
      _id: customerId,
      role: "kunde",
      assignedAdmin: req.user._id,
    });

    if (!customer) {
      return res.status(400).json({
        success: false,
        error: "Kunde nicht gefunden oder nicht zugewiesen",
      });
    }

    const project = new Project({
      name,
      type,
      description,
      deadline: new Date(deadline),
      priority: priority || "medium",
      customerId,
      assignedAdmin: req.user._id,
    });

    await project.save();
    await project.populate("customerId", "firstName lastName email company");

    res.status(201).json({
      success: true,
      data: project,
      message: "Projekt erfolgreich erstellt",
    });
  } catch (error) {
    console.error("Projekt-Erstellen-Fehler:", error);
    res.status(500).json({ success: false, error: "Fehler beim Erstellen des Projekts" });
  }
});

// PUT /api/dashboard/projects/:id - Projekt aktualisieren (nur Admin)
router.put("/projects/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const project = await Project.findOne({
      _id: id,
      assignedAdmin: req.user._id,
    });

    if (!project) {
      return res.status(404).json({ success: false, error: "Projekt nicht gefunden" });
    }

    // Erlaubte Updates
    const allowedUpdates = ["name", "description", "status", "priority", "deadline", "progress"];
    const updateFields = {};

    allowedUpdates.forEach((field) => {
      if (updates[field] !== undefined) {
        updateFields[field] = updates[field];
      }
    });

    Object.assign(project, updateFields);
    await project.save();

    res.json({
      success: true,
      data: project,
      message: "Projekt erfolgreich aktualisiert",
    });
  } catch (error) {
    console.error("Projekt-Update-Fehler:", error);
    res.status(500).json({ success: false, error: "Fehler beim Aktualisieren des Projekts" });
  }
});

// DELETE /api/dashboard/projects/:id - Projekt löschen (nur Admin)
router.delete("/projects/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findOne({
      _id: id,
      assignedAdmin: req.user._id,
    });

    if (!project) {
      return res.status(404).json({ success: false, error: "Projekt nicht gefunden" });
    }

    // Soft-Delete (inaktiv setzen statt löschen)
    project.isActive = false;
    await project.save();

    res.json({
      success: true,
      message: "Projekt erfolgreich deaktiviert",
    });
  } catch (error) {
    console.error("Projekt-Löschen-Fehler:", error);
    res.status(500).json({ success: false, error: "Fehler beim Löschen des Projekts" });
  }
});

// ===========================
// NACHRICHTEN-VERWALTUNG
// ===========================

// GET /api/dashboard/messages - Nachrichten laden
router.get("/messages", requireAuth, async (req, res) => {
  try {
    const { projectId } = req.query;
    let messages;

    if (projectId) {
      // Nachrichten für ein bestimmtes Projekt
      const project = await Project.findOne({ _id: projectId });
      if (!project || !project.canUserAccess(req.user)) {
        return res.status(404).json({ success: false, error: "Projekt nicht gefunden" });
      }

      messages = await Message.findByProject(projectId, req.user);
    } else {
      // Alle Nachrichten des Benutzers
      messages = await Message.findRecentByUser(req.user, 50);
    }

    res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error("Nachrichten-Laden-Fehler:", error);
    res.status(500).json({ success: false, error: "Fehler beim Laden der Nachrichten" });
  }
});

// POST /api/dashboard/messages - Neue Nachricht senden
router.post("/messages", requireAuth, async (req, res) => {
  try {
    const { projectId, content } = req.body;

    if (!projectId || !content) {
      return res.status(400).json({
        success: false,
        error: "Projekt-ID und Inhalt sind erforderlich",
      });
    }

    // Projekt prüfen und Berechtigung validieren
    const project = await Project.findOne({ _id: projectId });
    if (!project || !project.canUserAccess(req.user)) {
      return res.status(404).json({ success: false, error: "Projekt nicht gefunden" });
    }

    const message = new Message({
      projectId,
      senderId: req.user._id,
      senderRole: req.user.role,
      senderName: req.user.fullName,
      content: content.trim(),
      customerId: project.customerId,
    });

    await message.save();
    await message.populate("senderId", "firstName lastName email role");
    await message.populate("projectId", "name type");

    // Nachrichtenzähler im Projekt aktualisieren
    await Project.findByIdAndUpdate(projectId, {
      $inc: { messagesCount: 1 },
      updatedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      data: message,
      message: "Nachricht erfolgreich gesendet",
    });
  } catch (error) {
    console.error("Nachricht-Senden-Fehler:", error);
    res.status(500).json({ success: false, error: "Fehler beim Senden der Nachricht" });
  }
});

// PUT /api/dashboard/messages/:id/read - Nachricht als gelesen markieren
router.put("/messages/:id/read", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const message = await Message.findOne({ _id: id });
    if (!message || !message.canUserAccess(req.user)) {
      return res.status(404).json({ success: false, error: "Nachricht nicht gefunden" });
    }

    await message.markAsReadBy(req.user._id);

    res.json({
      success: true,
      message: "Nachricht als gelesen markiert",
    });
  } catch (error) {
    console.error("Nachricht-Lesen-Fehler:", error);
    res.status(500).json({ success: false, error: "Fehler beim Markieren der Nachricht" });
  }
});

// ===========================
// BENUTZER-VERWALTUNG
// ===========================

// GET /api/dashboard/customers - Kunden laden (nur Admin)
router.get("/customers", requireAuth, requireAdmin, async (req, res) => {
  try {
    const customers = await User.findKundenByAdmin(req.user._id);

    res.json({
      success: true,
      data: customers,
    });
  } catch (error) {
    console.error("Kunden-Laden-Fehler:", error);
    res.status(500).json({ success: false, error: "Fehler beim Laden der Kunden" });
  }
});

// PUT /api/dashboard/profile - Profil aktualisieren
router.put("/profile", requireAuth, async (req, res) => {
  try {
    const { firstName, lastName, company } = req.body;

    const user = req.user;
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (company !== undefined) user.company = company;

    await user.save();

    res.json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        company: user.company,
        avatar: user.avatar,
      },
      message: "Profil erfolgreich aktualisiert",
    });
  } catch (error) {
    console.error("Profil-Update-Fehler:", error);
    res.status(500).json({ success: false, error: "Fehler beim Aktualisieren des Profils" });
  }
});

// GET /api/dashboard/stats - Dashboard-Statistiken
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const user = req.user;

    let stats = {};

    if (user.role === "admin") {
      // Admin-Statistiken
      const totalCustomers = await User.countDocuments({
        assignedAdmin: user._id,
        role: "kunde",
        isActive: true,
      });

      const totalProjects = await Project.countDocuments({
        assignedAdmin: user._id,
        isActive: true,
      });

      const activeProjects = await Project.countDocuments({
        assignedAdmin: user._id,
        isActive: true,
        status: { $in: ["planning", "inProgress", "review"] },
      });

      const totalMessages = await Message.countDocuments({});

      stats = {
        totalCustomers,
        totalProjects,
        activeProjects,
        completedProjects: totalProjects - activeProjects,
        totalMessages,
      };
    } else {
      // Kunden-Statistiken
      const totalProjects = await Project.countDocuments({
        customerId: user._id,
        isActive: true,
      });

      const activeProjects = await Project.countDocuments({
        customerId: user._id,
        isActive: true,
        status: { $in: ["planning", "inProgress", "review"] },
      });

      const totalMessages = await Message.countDocuments({
        customerId: user._id,
      });

      const unreadMessages = await Message.getUnreadCount(user._id, user.role);

      stats = {
        totalProjects,
        activeProjects,
        completedProjects: totalProjects - activeProjects,
        totalMessages,
        unreadMessages: unreadMessages[0]?.unreadCount || 0,
      };
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Stats-Fehler:", error);
    res.status(500).json({ success: false, error: "Fehler beim Laden der Statistiken" });
  }
});

export default router;
