// models/Contact/Contact.js
// KORRIGIERT: Contact Model für ES Modules
import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
  // ===========================
  // PERSÖNLICHE DATEN
  // ===========================
  name: {
    type: String,
    required: [true, 'Name ist erforderlich'],
    trim: true,
    maxLength: [100, 'Name darf maximal 100 Zeichen lang sein']
  },
  
  email: {
    type: String,
    required: [true, 'E-Mail ist erforderlich'],
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Bitte geben Sie eine gültige E-Mail-Adresse ein']
  },
  
  phone: {
    type: String,
    trim: true,
    default: null
  },
  
  company: {
    type: String,
    trim: true,
    default: null,
    maxLength: [100, 'Firmenname darf maximal 100 Zeichen lang sein']
  },

  // ===========================
  // PROJEKT-DETAILS
  // ===========================
  projectType: {
    type: String,
    enum: ['website', 'bewerbung', 'newsletter', 'ecommerce', 'custom', 'general'],
    default: 'general'
  },
  
  budget: {
    type: String,
    enum: [
      '< 500€',
      '500€ - 1.000€', 
      '1.000€ - 2.500€',
      '2.500€ - 5.000€',
      '> 5.000€',
      'Individuell besprechen'
    ],
    default: null
  },
  
  timeline: {
    type: String,
    enum: [
      'Innerhalb 1 Woche',
      '2-4 Wochen',
      '1-2 Monate', 
      '2-3 Monate',
      'Flexibel'
    ],
    default: null
  },

  // ===========================
  // NACHRICHT & PRÄFERENZEN
  // ===========================
  message: {
    type: String,
    required: [true, 'Nachricht ist erforderlich'],
    trim: true,
    maxLength: [2000, 'Nachricht darf maximal 2000 Zeichen lang sein']
  },
  
  newsletter: {
    type: Boolean,
    default: false
  },

  // ===========================
  // STATUS & VERWALTUNG
  // ===========================
  status: {
    type: String,
    enum: ['new', 'in_progress', 'responded', 'completed', 'archived'],
    default: 'new'
  },
  
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  source: {
    type: String,
    enum: ['website_contact_form', 'offers_section', 'direct_email', 'phone', 'social_media'],
    default: 'website_contact_form'
  },

  // ===========================
  // ADMIN-NOTIZEN & FOLLOW-UP
  // ===========================
  adminNotes: {
    type: String,
    trim: true,
    maxLength: [1000, 'Admin-Notizen dürfen maximal 1000 Zeichen lang sein']
  },
  
  followUpDate: {
    type: Date,
    default: null
  },
  
  responseCount: {
    type: Number,
    default: 0
  },
  
  lastContactDate: {
    type: Date,
    default: null
  },

  // ===========================
  // TECHNISCHE DATEN
  // ===========================
  ipAddress: {
    type: String,
    trim: true
  },
  
  userAgent: {
    type: String,
    trim: true
  },
  
  referrer: {
    type: String,
    trim: true,
    default: null
  },

  // ===========================
  // ZEITSTEMPEL
  // ===========================
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  respondedAt: {
    type: Date,
    default: null
  }
});

// ===========================
// INDIZES FÜR PERFORMANCE
// ===========================
contactSchema.index({ email: 1 });
contactSchema.index({ status: 1 });
contactSchema.index({ createdAt: -1 });
contactSchema.index({ projectType: 1 });
contactSchema.index({ priority: 1, status: 1 });

// ===========================
// MIDDLEWARE
// ===========================

// Update timestamp bei jeder Änderung
contactSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// Automatische Priorität basierend auf Projekt-Typ
contactSchema.pre('save', function(next) {
  if (this.isNew && !this.priority) {
    switch (this.projectType) {
      case 'ecommerce':
      case 'custom':
        this.priority = 'high';
        break;
      case 'website':
      case 'bewerbung':
        this.priority = 'medium';
        break;
      default:
        this.priority = 'low';
    }
  }
  next();
});

// ===========================
// INSTANCE METHODS
// ===========================

// Status aktualisieren
contactSchema.methods.updateStatus = function(newStatus, adminNotes = null) {
  this.status = newStatus;
  this.updatedAt = new Date();
  
  if (newStatus === 'responded' && !this.respondedAt) {
    this.respondedAt = new Date();
    this.responseCount += 1;
  }
  
  if (adminNotes) {
    this.adminNotes = adminNotes;
  }
  
  return this.save();
};

// Follow-up Datum setzen
contactSchema.methods.setFollowUp = function(days = 7) {
  this.followUpDate = new Date(Date.now() + (days * 24 * 60 * 60 * 1000));
  return this.save();
};

// ===========================
// STATIC METHODS
// ===========================

// Alle offenen Kontakte
contactSchema.statics.findOpen = function() {
  return this.find({ 
    status: { $in: ['new', 'in_progress'] } 
  }).sort({ priority: -1, createdAt: -1 });
};

// Kontakte nach Projekt-Typ
contactSchema.statics.findByProjectType = function(projectType) {
  return this.find({ projectType }).sort({ createdAt: -1 });
};

// Follow-up erforderlich
contactSchema.statics.findRequiringFollowUp = function() {
  return this.find({
    followUpDate: { $lte: new Date() },
    status: { $in: ['new', 'in_progress', 'responded'] }
  }).sort({ followUpDate: 1 });
};

// Statistiken für Dashboard
contactSchema.statics.getStatistics = function() {
  return this.aggregate([
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
};

// JSON-Output konfigurieren
contactSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret.ipAddress; // Sensible Daten nicht in API-Response
    delete ret.userAgent;
    return ret;
  }
});

// ES Module Export
export default mongoose.model('Contact', contactSchema);