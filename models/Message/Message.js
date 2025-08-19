// Backend/models/Message/Message.js
// NEU: Nachrichten-Model mit Datenschutz
import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    // Projekt-Zuordnung
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },

    // Sender-Informationen
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    senderRole: {
      type: String,
      enum: ["admin", "kunde"],
      required: true,
    },

    senderName: {
      type: String,
      required: true,
      trim: true,
    },

    // Nachrichteninhalt
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    // WICHTIG: Datenschutz - Nur der zugehörige Kunde kann die Nachricht sehen
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Read-Status (pro Empfänger)
    readBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Anhänge
    attachments: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        originalName: {
          type: String,
          required: true,
        },
        size: {
          type: Number,
          required: true,
        },
        mimeType: {
          type: String,
          required: true,
        },
        path: {
          type: String,
          required: true,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Zeitstempel
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// INDEXE für Performance und Datenschutz
messageSchema.index({ projectId: 1, createdAt: -1 });
messageSchema.index({ customerId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ "readBy.userId": 1 });

// VIRTUELLE FELDER
messageSchema.virtual("hasAttachment").get(function () {
  return this.attachments && this.attachments.length > 0;
});

// INSTANCE METHODS
messageSchema.methods.isReadBy = function (userId) {
  return this.readBy.some(
    (read) => read.userId.toString() === userId.toString()
  );
};

messageSchema.methods.markAsReadBy = function (userId) {
  if (!this.isReadBy(userId)) {
    this.readBy.push({
      userId: userId,
      readAt: new Date(),
    });
    return this.save();
  }
  return Promise.resolve(this);
};

messageSchema.methods.canUserAccess = function (user) {
  // Admin kann Nachrichten seiner zugewiesenen Kunden sehen
  if (user.role === "admin") {
    return (
      this.customerId.toString() === user._id.toString() ||
      this.senderId.toString() === user._id.toString()
    );
  }

  // Kunde kann nur Nachrichten seiner eigenen Projekte sehen
  if (user.role === "kunde") {
    return this.customerId.toString() === user._id.toString();
  }

  return false;
};

// STATIC METHODS
messageSchema.statics.findByProject = function (projectId, user) {
  const query = { projectId };

  // Datenschutz: Nur Nachrichten des berechtigten Benutzers
  if (user.role === "kunde") {
    query.customerId = user._id;
  } else if (user.role === "admin") {
    // Admin sieht Nachrichten aller seiner zugewiesenen Kunden
    // Diese Logik wird in der Route gehandhabt
  }

  return this.find(query)
    .populate("senderId", "firstName lastName email role")
    .sort({ createdAt: 1 });
};

messageSchema.statics.getUnreadCount = function (userId, userRole) {
  const pipeline = [
    {
      $match:
        userRole === "kunde"
          ? { customerId: userId }
          : { $or: [{ customerId: userId }, { senderId: userId }] },
    },
    {
      $match: {
        "readBy.userId": { $ne: userId },
      },
    },
    {
      $count: "unreadCount",
    },
  ];

  return this.aggregate(pipeline);
};

messageSchema.statics.findRecentByUser = function (user, limit = 10) {
  const query = user.role === "kunde" ? { customerId: user._id } : {}; // Admin sieht alle (wird in Route gefiltert)

  return this.find(query)
    .populate("projectId", "name type")
    .populate("senderId", "firstName lastName email role")
    .sort({ createdAt: -1 })
    .limit(limit);
};

export default mongoose.model("Message", messageSchema);
