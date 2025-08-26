// models/Newsletter/Newsletter.js
// VOLLSTÄNDIGES NEWSLETTER MODEL - DSGVO-konform mit Rich-Text und Scheduling
import mongoose from 'mongoose';
// NEWSLETTER SUBSCRIBER SCHEMA
// ===========================
const newsletterSubscriberSchema = new mongoose.Schema({
  // Basis-Daten
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Ungültige E-Mail-Adresse']
  },
  firstName: {
    type: String,
    trim: true,
    maxlength: 50,
    default: null
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: 50,
    default: null
  },
  
  // DSGVO-Konformität
  isConfirmed: {
    type: Boolean,
    default: false // Double-Opt-In erforderlich
  },
  confirmationToken: {
    type: String,
    default: null
  },
  confirmedAt: {
    type: Date,
    default: null
  },
  unsubscribeToken: {
    type: String,
    required: true
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  unsubscribedAt: {
    type: Date,
    default: null
  },
  unsubscribeReason: {
    type: String,
    enum: ['user_request', 'bounce', 'spam_complaint', 'admin_action'],
    default: null
  },
  
  // Tracking
  source: {
    type: String,
    enum: ['contact_form', 'newsletter_signup', 'manual_import', 'api'],
    default: 'newsletter_signup'
  },
  ipAddress: {
    type: String,
    default: 'unknown'
  },
  userAgent: {
    type: String,
    default: 'unknown'
  },
  
  // Engagement-Tracking
  totalEmailsReceived: {
    type: Number,
    default: 0
  },
  totalEmailsOpened: {
    type: Number,
    default: 0
  },
  lastOpenedAt: {
    type: Date,
    default: null
  },
  totalLinksClicked: {
    type: Number,
    default: 0
  },
  lastClickedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true }
});

// ===========================
// NEWSLETTER TEMPLATE SCHEMA
// ===========================
const newsletterTemplateSchema = new mongoose.Schema({
  // Template-Informationen
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  preheader: {
    type: String,
    trim: true,
    maxlength: 150,
    default: ''
  },
  
  // Rich-Text Content
  content: {
    html: {
      type: String,
      required: true
    },
    text: {
      type: String,
      required: true // Fallback für Text-E-Mail-Clients
    },
    json: {
      type: mongoose.Schema.Types.Mixed, // Rich-Editor-State
      default: null
    }
  },
  
  // Bilder und Assets
  images: [{
    url: {
      type: String,
      required: true
    },
    alt: {
      type: String,
      default: ''
    },
    width: Number,
    height: Number
  }],
  
  // Versand-Einstellungen
  scheduledDate: {
    type: Date,
    default: null
  },
  isScheduled: {
    type: Boolean,
    default: false
  },
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sending', 'sent', 'failed'],
    default: 'draft'
  },
  
  // Versand-Statistiken
  sentCount: {
    type: Number,
    default: 0
  },
  deliveredCount: {
    type: Number,
    default: 0
  },
  openedCount: {
    type: Number,
    default: 0
  },
  clickedCount: {
    type: Number,
    default: 0
  },
  bouncedCount: {
    type: Number,
    default: 0
  },
  
  // Admin-Informationen
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sentAt: {
    type: Date,
    default: null
  },
  
  // Template-Settings
  isTemplate: {
    type: Boolean,
    default: false // Für wiederverwendbare Templates
  },
  templateCategory: {
    type: String,
    enum: ['announcement', 'newsletter', 'promotion', 'update', 'custom'],
    default: 'newsletter'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true }
});

// ===========================
// NEWSLETTER SEND LOG SCHEMA
// ===========================
const newsletterSendLogSchema = new mongoose.Schema({
  // Referenzen
  newsletterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NewsletterTemplate',
    required: true,
    index: true
  },
  subscriberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NewsletterSubscriber',
    required: true,
    index: true
  },
  
  // E-Mail-Details
  recipientEmail: {
    type: String,
    required: true,
    index: true
  },
  subject: {
    type: String,
    required: true
  },
  
  // Versand-Status
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed'],
    default: 'pending',
    index: true
  },
  
  // Timing
  sentAt: {
    type: Date,
    default: null
  },
  deliveredAt: {
    type: Date,
    default: null
  },
  openedAt: {
    type: Date,
    default: null
  },
  firstClickedAt: {
    type: Date,
    default: null
  },
  
  // Tracking
  openCount: {
    type: Number,
    default: 0
  },
  clickCount: {
    type: Number,
    default: 0
  },
  
  // Fehler-Logging
  errorMessage: {
    type: String,
    default: null
  },
  retryCount: {
    type: Number,
    default: 0
  },
  
  // E-Mail-Provider-Daten
  providerMessageId: {
    type: String,
    default: null
  },
  providerResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true }
});

// ===========================
// INDEXES FÜR PERFORMANCE
// ===========================

// Subscriber Indexes
newsletterSubscriberSchema.index({ email: 1 }, { unique: true });
newsletterSubscriberSchema.index({ isConfirmed: 1, isActive: 1 });
newsletterSubscriberSchema.index({ confirmationToken: 1 }, { sparse: true });
newsletterSubscriberSchema.index({ unsubscribeToken: 1 }, { unique: true });
newsletterSubscriberSchema.index({ createdAt: -1 });

// Template Indexes
newsletterTemplateSchema.index({ createdBy: 1, createdAt: -1 });
newsletterTemplateSchema.index({ status: 1, scheduledDate: 1 });
newsletterTemplateSchema.index({ isTemplate: 1, templateCategory: 1 });

// Send Log Indexes
newsletterSendLogSchema.index({ newsletterId: 1, subscriberId: 1 });
newsletterSendLogSchema.index({ status: 1, sentAt: -1 });
newsletterSendLogSchema.index({ recipientEmail: 1, sentAt: -1 });

// ===========================
// VIRTUAL FIELDS
// ===========================

newsletterSubscriberSchema.virtual('fullName').get(function() {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.firstName || this.lastName || 'Unbekannt';
});

newsletterSubscriberSchema.virtual('openRate').get(function() {
  return this.totalEmailsReceived > 0 
    ? Math.round((this.totalEmailsOpened / this.totalEmailsReceived) * 100)
    : 0;
});

newsletterTemplateSchema.virtual('openRate').get(function() {
  return this.sentCount > 0 
    ? Math.round((this.openedCount / this.sentCount) * 100)
    : 0;
});

newsletterTemplateSchema.virtual('clickRate').get(function() {
  return this.openedCount > 0 
    ? Math.round((this.clickedCount / this.openedCount) * 100)
    : 0;
});

// ===========================
// INSTANCE METHODS
// ===========================

// Subscriber Methods
newsletterSubscriberSchema.methods.generateTokens = function() {
  const crypto = require('crypto');
  this.confirmationToken = crypto.randomBytes(32).toString('hex');
  this.unsubscribeToken = crypto.randomBytes(32).toString('hex');
  return this;
};

newsletterSubscriberSchema.methods.confirm = async function() {
  this.isConfirmed = true;
  this.confirmedAt = new Date();
  this.confirmationToken = null;
  return this.save();
};

newsletterSubscriberSchema.methods.unsubscribe = async function(reason = 'user_request') {
  this.isActive = false;
  this.unsubscribedAt = new Date();
  this.unsubscribeReason = reason;
  return this.save();
};

// Template Methods
newsletterTemplateSchema.methods.scheduleFor = function(date) {
  this.scheduledDate = new Date(date);
  this.isScheduled = true;
  this.status = 'scheduled';
  return this;
};

newsletterTemplateSchema.methods.markAsSent = async function() {
  this.status = 'sent';
  this.sentAt = new Date();
  return this.save();
};

newsletterTemplateSchema.methods.generatePreview = function() {
  return {
    id: this._id,
    subject: this.subject,
    preheader: this.preheader,
    htmlContent: this.content.html,
    textContent: this.content.text,
    images: this.images,
    scheduledDate: this.scheduledDate,
    stats: {
      openRate: this.openRate,
      clickRate: this.clickRate,
      sentCount: this.sentCount
    }
  };
};

// ===========================
// STATIC METHODS
// ===========================

newsletterSubscriberSchema.statics.getActiveSubscribers = function() {
  return this.find({ 
    isConfirmed: true, 
    isActive: true 
  }).sort({ createdAt: -1 });
};

newsletterTemplateSchema.statics.getScheduledNewsletters = function() {
  return this.find({
    status: 'scheduled',
    scheduledDate: { $lte: new Date() }
  }).sort({ scheduledDate: 1 });
};

// ===========================
// PRE-SAVE MIDDLEWARE
// ===========================

newsletterSubscriberSchema.pre('save', function(next) {
  // Auto-generate tokens if new subscriber
  if (this.isNew && !this.unsubscribeToken) {
    this.generateTokens();
  }
  next();
});

newsletterTemplateSchema.pre('save', function(next) {
  // Auto-generate text content if only HTML provided
  if (this.content.html && !this.content.text) {
    // Basic HTML-to-text conversion
    this.content.text = this.content.html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
  next();
});

// ===========================
// MODEL EXPORTS
// ===========================

const NewsletterSubscriber = mongoose.model('NewsletterSubscriber', newsletterSubscriberSchema);
const NewsletterTemplate = mongoose.model('NewsletterTemplate', newsletterTemplateSchema);
const NewsletterSendLog = mongoose.model('NewsletterSendLog', newsletterSendLogSchema);

export { NewsletterSubscriber, NewsletterTemplate, NewsletterSendLog };