// models/Contact.js
// VOLLSTÄNDIGES CONTACT MODEL - Korrekte Pfadstruktur
import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
  // Persönliche Daten
  name: {
    type: String,
    required: [true, 'Name ist erforderlich'],
    trim: true,
    maxlength: [100, 'Name darf maximal 100 Zeichen lang sein']
  },
  email: {
    type: String,
    required: [true, 'E-Mail ist erforderlich'],
    trim: true,
    lowercase: true,
    maxlength: [255, 'E-Mail darf maximal 255 Zeichen lang sein'],
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Bitte geben Sie eine gültige E-Mail-Adresse ein']
  },
  phone: {
    type: String,
    trim: true,
    maxlength: [50, 'Telefonnummer darf maximal 50 Zeichen lang sein'],
    default: null
  },
  company: {
    type: String,
    trim: true,
    maxlength: [100, 'Unternehmen darf maximal 100 Zeichen lang sein'],
    default: null
  },
  
  // Projekt-Details
  projectType: {
    type: String,
    enum: {
      values: ['website', 'ecommerce', 'bewerbung', 'newsletter', 'consulting', 'custom'],
      message: 'Ungültiger Projekt-Typ: {VALUE}'
    },
    default: 'website'
  },
  budget: {
    type: String,
    enum: {
      values: ['', 'unter-2500', '2500-5000', '5000-10000', '10000-plus'],
      message: 'Ungültige Budget-Option: {VALUE}'
    },
    default: null
  },
  timeline: {
    type: String,
    enum: {
      values: ['', 'asap', '1-month', '2-3-months', 'flexible'],
      message: 'Ungültige Timeline-Option: {VALUE}'
    },
    default: null
  },
  
  // Nachricht
  message: {
    type: String,
    required: [true, 'Nachricht ist erforderlich'],
    trim: true,
    maxlength: [2000, 'Nachricht darf maximal 2000 Zeichen lang sein']
  },
  
  // Newsletter
  newsletter: {
    type: Boolean,
    default: false
  },
  
  // Status und Meta-Daten
  status: {
    type: String,
    enum: {
      values: ['new', 'read', 'replied', 'newsletter_only', 'spam', 'archived'],
      message: 'Ungültiger Status: {VALUE}'
    },
    default: 'new'
  },
  source: {
    type: String,
    enum: {
      values: ['contact_page', 'newsletter_signup', 'direct_email', 'phone', 'other'],
      message: 'Ungültige Quelle: {VALUE}'
    },
    default: 'contact_page'
  },
  
  // Technische Meta-Daten
  ipAddress: {
    type: String,
    default: 'unknown'
  },
  userAgent: {
    type: String,
    default: 'unknown'
  },
  
  // Antwort-Tracking
  isReplied: {
    type: Boolean,
    default: false
  },
  repliedAt: {
    type: Date,
    default: null
  },
  repliedBy: {
    type: String,
    default: null
  },
  
  // Admin-Notizen
  adminNotes: {
    type: String,
    maxlength: [1000, 'Admin-Notizen dürfen maximal 1000 Zeichen lang sein'],
    default: ''
  },
  
  // Priorität
  priority: {
    type: String,
    enum: {
      values: ['low', 'normal', 'high', 'urgent'],
      message: 'Ungültige Priorität: {VALUE}'
    },
    default: 'normal'
  },
  
  // Tags für Kategorisierung
  tags: [{
    type: String,
    trim: true
  }],
  
  // Archivierung
  isActive: {
    type: Boolean,
    default: true
  },
  archivedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true, // Erstellt automatisch createdAt und updatedAt
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// ===========================
// INDEXES FÜR PERFORMANCE
// ===========================
contactSchema.index({ email: 1 });
contactSchema.index({ status: 1 });
contactSchema.index({ createdAt: -1 });
contactSchema.index({ projectType: 1 });
contactSchema.index({ newsletter: 1 });
contactSchema.index({ isActive: 1, createdAt: -1 });

// Compound Index für häufige Abfragen
contactSchema.index({ status: 1, isActive: 1, createdAt: -1 });

// ===========================
// VIRTUELLE FELDER
// ===========================
contactSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `vor ${days} Tag${days > 1 ? 'en' : ''}`;
  if (hours > 0) return `vor ${hours} Stunde${hours > 1 ? 'n' : ''}`;
  if (minutes > 0) return `vor ${minutes} Minute${minutes > 1 ? 'n' : ''}`;
  return 'gerade eben';
});

contactSchema.virtual('isUrgent').get(function() {
  return this.priority === 'urgent' || this.priority === 'high';
});

contactSchema.virtual('needsReply').get(function() {
  return this.status === 'new' && !this.isReplied;
});

contactSchema.virtual('fullContact').get(function() {
  let contact = this.name;
  if (this.company) contact += ` (${this.company})`;
  if (this.email) contact += ` - ${this.email}`;
  return contact;
});

// ===========================
// INSTANCE METHODS
// ===========================
contactSchema.methods.markAsRead = function() {
  if (this.status === 'new') {
    this.status = 'read';
  }
  return this.save();
};

contactSchema.methods.markAsReplied = function(repliedBy = 'admin') {
  this.isReplied = true;
  this.repliedAt = new Date();
  this.repliedBy = repliedBy;
  this.status = 'replied';
  return this.save();
};

contactSchema.methods.archive = function() {
  this.isActive = false;
  this.archivedAt = new Date();
  this.status = 'archived';
  return this.save();
};

contactSchema.methods.addTag = function(tag) {
  if (!this.tags.includes(tag)) {
    this.tags.push(tag);
    return this.save();
  }
  return this;
};

contactSchema.methods.removeTag = function(tag) {
  this.tags = this.tags.filter(t => t !== tag);
  return this.save();
};

contactSchema.methods.setPriority = function(priority) {
  if (['low', 'normal', 'high', 'urgent'].includes(priority)) {
    this.priority = priority;
    return this.save();
  }
  throw new Error('Invalid priority level');
};

// ===========================
// STATIC METHODS
// ===========================
contactSchema.statics.findActive = function() {
  return this.find({ isActive: true }).sort({ createdAt: -1 });
};

contactSchema.statics.findByStatus = function(status) {
  return this.find({ status: status, isActive: true }).sort({ createdAt: -1 });
};

contactSchema.statics.findUnreplied = function() {
  return this.find({ 
    isReplied: false, 
    status: { $in: ['new', 'read'] },
    isActive: true 
  }).sort({ createdAt: -1 });
};

contactSchema.statics.findByProjectType = function(projectType) {
  return this.find({ 
    projectType: projectType, 
    isActive: true 
  }).sort({ createdAt: -1 });
};

contactSchema.statics.findNewsletterSubscribers = function() {
  return this.find({ 
    newsletter: true, 
    isActive: true 
  }).sort({ createdAt: -1 });
};

contactSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        unreplied: {
          $sum: {
            $cond: [{ $eq: ['$isReplied', false] }, 1, 0]
          }
        },
        newsletter: {
          $sum: {
            $cond: [{ $eq: ['$newsletter', true] }, 1, 0]
          }
        },
        byStatus: {
          $push: {
            status: '$status',
            count: 1
          }
        },
        byProjectType: {
          $push: {
            projectType: '$projectType',
            count: 1
          }
        }
      }
    }
  ]);
  
  return stats[0] || {
    total: 0,
    unreplied: 0,
    newsletter: 0,
    byStatus: [],
    byProjectType: []
  };
};

contactSchema.statics.searchContacts = function(searchTerm) {
  const regex = new RegExp(searchTerm, 'i');
  return this.find({
    isActive: true,
    $or: [
      { name: regex },
      { email: regex },
      { company: regex },
      { message: regex }
    ]
  }).sort({ createdAt: -1 });
};

// ===========================
// MIDDLEWARE
// ===========================
contactSchema.pre('save', function(next) {
  // Automatische Tag-Generierung basierend auf Projekt-Typ
  if (this.isNew && this.projectType && !this.tags.includes(this.projectType)) {
    this.tags.push(this.projectType);
  }
  
  // Automatische Priorität basierend auf Budget
  if (this.isNew && this.budget) {
    if (this.budget === '10000-plus') {
      this.priority = 'high';
    } else if (this.budget === '5000-10000') {
      this.priority = 'normal';
    }
  }
  
  next();
});

contactSchema.post('save', function(doc) {
  console.log(`📝 Contact saved: ${doc.name} (${doc.email}) - Status: ${doc.status}`);
});

// ===========================
// TEXT SEARCH INDEX
// ===========================
contactSchema.index({
  name: 'text',
  email: 'text',
  company: 'text',
  message: 'text'
});

export default mongoose.model('Contact', contactSchema);