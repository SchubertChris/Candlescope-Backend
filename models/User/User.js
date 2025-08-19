// Backend/models/User/User.js
// KORRIGIERT: ES Modules Version
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  // OAuth/Auth Felder (bereits vorhanden)
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  
  // OAuth Provider Daten
  googleId: {
    type: String,
    sparse: true
  },
  githubId: {
    type: String,
    sparse: true
  },
  
  // Lokale Registrierung
  password: {
    type: String,
    required: function() {
      return !this.googleId && !this.githubId;
    }
  },
  
  // ERWEITERT: Rollensystem
  role: {
    type: String,
    enum: ['admin', 'kunde'],
    default: 'kunde'
  },
  
  // Profil-Informationen
  firstName: {
    type: String,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: 50
  },
  company: {
    type: String,
    trim: true,
    maxlength: 100
  },
  
  // Avatar (später für Bildupload)
  avatar: {
    type: String,
    default: null
  },
  
  // HINZUGEFÜGT: Kunde-Admin Zuordnung
  assignedAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.role === 'kunde';
    }
  },
  
  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  
  // Zeitstempel
  lastLogin: {
    type: Date,
    default: Date.now
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.__v;
      return ret;
    }
  }
});

// HINZUGEFÜGT: Indexe für Performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ assignedAdmin: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ githubId: 1 });

// HINZUGEFÜGT: Middleware für updatedAt
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// HINZUGEFÜGT: Virtuelle Felder
userSchema.virtual('fullName').get(function() {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim() || this.email;
});

// HINZUGEFÜGT: Instance Methods
userSchema.methods.isAdmin = function() {
  return this.role === 'admin';
};

userSchema.methods.isKunde = function() {
  return this.role === 'kunde';
};

// HINZUGEFÜGT: Static Methods
userSchema.statics.findAdmins = function() {
  return this.find({ role: 'admin', isActive: true });
};

userSchema.statics.findKundenByAdmin = function(adminId) {
  return this.find({ assignedAdmin: adminId, isActive: true });
};

export default mongoose.model('User', userSchema);