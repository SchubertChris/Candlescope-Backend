// Backend/models/User/User.js
// KORRIGIERT: assignedAdmin NIEMALS required machen + Erweiterte Features
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // OAuth/Auth Felder
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // OAuth Provider Daten
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    githubId: {
      type: String,
      sparse: true,
      unique: true,
    },

    // Lokale Registrierung
    password: {
      type: String,
      required: function () {
        return !this.googleId && !this.githubId;
      },
    },

    // Rollensystem
    role: {
      type: String,
      enum: ["admin", "kunde"],
      default: "kunde",
      index: true,
    },

    // Profil-Informationen
    firstName: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    company: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    // Avatar
    avatar: {
      type: String,
      default: null,
    },

    // KORRIGIERT: assignedAdmin NIEMALS required machen
    assignedAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // GEÄNDERT: Niemals required!
      default: null, // HINZUGEFÜGT: Expliziter Default-Wert
      index: true,
      validate: {
        validator: async function (value) {
          // Nur validieren wenn Wert gesetzt ist
          if (!value) return true;

          // Prüfen ob referenzierter User Admin ist
          const admin = await mongoose.model("User").findById(value);
          return admin && admin.role === "admin";
        },
        message: "Zugewiesener Admin muss existieren und Admin-Rolle haben",
      },
    },

    // Account Status
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    // Zeitstempel
    lastLogin: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Automatische createdAt/updatedAt
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password; // SICHERHEIT: Passwort nie in JSON ausgeben
        delete ret.__v; // SAUBERKEIT: Mongoose-Version entfernen
        return ret;
      },
    },
  }
);

// KORRIGIERT: Compound Index für bessere Performance
userSchema.index({ assignedAdmin: 1, isActive: 1 });
userSchema.index({ role: 1, isActive: 1 });

// HINZUGEFÜGT: Pre-save Middleware für Auto-Assignment
userSchema.pre("save", async function (next) {
  // Nur bei neuen Kunden ohne assignedAdmin
  if (this.isNew && this.role === "kunde" && !this.assignedAdmin) {
    try {
      // Ersten verfügbaren Admin finden
      const availableAdmin = await mongoose
        .model("User")
        .findOne({
          role: "admin",
          isActive: true,
        })
        .sort({ createdAt: 1 }); // Ältester Admin zuerst

      if (availableAdmin) {
        this.assignedAdmin = availableAdmin._id;
        console.log(`✅ Auto-assigned Admin ${availableAdmin.email} to customer ${this.email}`);
      } else {
        console.log(`⚠️ Kein Admin verfügbar für Customer ${this.email} - bleibt unzugewiesen`);
      }
    } catch (error) {
      console.error("❌ Auto-Assignment Fehler:", error);
      // Fehler nicht weiterwerfen - Assignment kann später erfolgen
    }
  }
  next();
});

// HINZUGEFÜGT: Virtuelle Felder
userSchema.virtual("fullName").get(function () {
  return `${this.firstName || ""} ${this.lastName || ""}`.trim() || this.email;
});

userSchema.virtual("displayName").get(function () {
  if (this.firstName || this.lastName) {
    return this.fullName;
  }
  return this.firstName || this.email.split("@")[0];
});

// HINZUGEFÜGT: Instance Methods
userSchema.methods.isAdmin = function () {
  return this.role === "admin";
};

userSchema.methods.isKunde = function () {
  return this.role === "kunde";
};

userSchema.methods.isOAuthUser = function () {
  return !!(this.googleId || this.githubId);
};

userSchema.methods.updateLastLogin = function () {
  this.lastLogin = new Date();
  return this.save();
};

// HINZUGEFÜGT: Static Methods
userSchema.statics.findAdmins = function () {
  return this.find({ role: "admin", isActive: true });
};

userSchema.statics.findKundenByAdmin = function (adminId) {
  return this.find({ assignedAdmin: adminId, isActive: true });
};

userSchema.statics.findByOAuth = function (provider, providerId) {
  const query = {};
  if (provider === "google") {
    query.googleId = providerId;
  } else if (provider === "github") {
    query.githubId = providerId;
  }
  return this.findOne(query);
};

// HINZUGEFÜGT: Statische Methode für nachträgliche Zuweisung
userSchema.statics.assignUnassignedCustomers = async function (adminId) {
  try {
    const result = await this.updateMany(
      {
        role: "kunde",
        $or: [{ assignedAdmin: null }, { assignedAdmin: { $exists: false } }],
      },
      {
        $set: { assignedAdmin: adminId },
      }
    );

    console.log(`✅ ${result.modifiedCount} unzugewiesene Kunden dem Admin zugewiesen`);
    return result.modifiedCount;
  } catch (error) {
    console.error("❌ Fehler beim Zuweisen unzugewiesener Kunden:", error);
    return 0;
  }
};

// HINZUGEFÜGT: Statistik-Methoden
userSchema.statics.getStats = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: "$role",
        count: { $sum: 1 },
        active: { $sum: { $cond: ["$isActive", 1, 0] } },
        verified: { $sum: { $cond: ["$isEmailVerified", 1, 0] } },
      },
    },
  ]);

  return stats.reduce((acc, stat) => {
    acc[stat._id] = {
      total: stat.count,
      active: stat.active,
      verified: stat.verified,
    };
    return acc;
  }, {});
};

export default mongoose.model("User", userSchema);
